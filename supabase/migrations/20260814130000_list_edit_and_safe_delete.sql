-- Nimekirja kustutamisel säilivad juba jooksvasse listi vabastatud tooted.
-- Funktsioon töötab kutsuja õigustes: olemasolevad RLS-reeglid jäävad alati kehtima.

create or replace function public.delete_shopping_list_preserving_floating(target_list uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_group uuid;
  target_is_quick boolean;
  quick_list_id uuid;
  quick_category_id uuid;
  moved_item_ids uuid[] := '{}'::uuid[];
begin
  select group_id, is_quick_list
    into target_group, target_is_quick
  from public.shopping_lists
  where id = target_list
  for update;

  if target_group is null then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;
  if target_is_quick then
    raise exception 'quick_list_cannot_be_deleted' using errcode = '22023';
  end if;

  select id into quick_list_id
  from public.shopping_lists
  where group_id = target_group and is_quick_list
  limit 1;

  if quick_list_id is null then
    insert into public.shopping_lists(group_id, created_by, name, description, is_quick_list)
      values(target_group, auth.uid(), 'Jooksev list', 'Ilma eraldi ostunimekirjata lisatud kaubad', true)
      returning id into quick_list_id;
  end if;

  select id into quick_category_id
  from public.categories
  where list_id = quick_list_id
  order by sort_order, created_at
  limit 1;

  if quick_category_id is null then
    insert into public.categories(list_id, name, sort_order)
      values(quick_list_id, 'Üldine', 0)
      returning id into quick_category_id;
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
    into moved_item_ids
  from public.items
  where list_id = target_list
    and assigned_to is null
    and status in ('unassigned', 'unavailable');

  if cardinality(moved_item_ids) > 0 then
    update public.items
      set list_id = quick_list_id, category_id = quick_category_id, updated_at = now()
      where id = any(moved_item_ids);

    insert into public.activity_log(group_id, actor_id, list_id, item_id, action, previous_status, new_status)
      select target_group, auth.uid(), quick_list_id, item.id,
        'Säilitas toote jooksvas listis nimekirja kustutamisel', item.status, item.status
      from public.items item
      where item.id = any(moved_item_ids);
  end if;

  delete from public.shopping_lists where id = target_list;
  return cardinality(moved_item_ids);
end;
$$;

revoke all on function public.delete_shopping_list_preserving_floating(uuid) from public;
grant execute on function public.delete_shopping_list_preserving_floating(uuid) to authenticated;
