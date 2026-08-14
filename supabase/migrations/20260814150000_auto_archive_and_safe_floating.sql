-- „Ei leidnud“ toode viiakse päriselt jooksvasse listi. Lõpetatud nimekirjad
-- arhiveeritakse automaatselt ning kustutamisel säilitatakse jooksva toote ajalugu.

create or replace function public.ensure_quick_destination(
  target_group uuid,
  actor_id uuid,
  out quick_list_id uuid,
  out quick_category_id uuid
)
returns record
language plpgsql
security definer
set search_path = ''
as $$
begin
  select id into quick_list_id
  from public.shopping_lists
  where group_id = target_group and is_quick_list
  limit 1;

  if quick_list_id is null then
    begin
      insert into public.shopping_lists(group_id, created_by, name, description, is_quick_list)
        values(target_group, actor_id, 'Jooksev list', 'Ilma eraldi ostunimekirjata lisatud kaubad', true)
        returning id into quick_list_id;
    exception when unique_violation then
      select id into quick_list_id
      from public.shopping_lists
      where group_id = target_group and is_quick_list
      limit 1;
    end;
  end if;

  select id into quick_category_id
  from public.categories
  where list_id = quick_list_id
  order by sort_order, created_at
  limit 1;

  if quick_category_id is null then
    begin
      insert into public.categories(list_id, name, sort_order)
        values(quick_list_id, 'Üldine', 0)
        returning id into quick_category_id;
    exception when unique_violation then
      select id into quick_category_id
      from public.categories
      where list_id = quick_list_id
      order by sort_order, created_at
      limit 1;
    end;
  end if;
end;
$$;

revoke all on function public.ensure_quick_destination(uuid, uuid) from public, authenticated;

create or replace function public.archive_shopping_list_if_complete(target_list uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
  target_is_quick boolean;
begin
  select group_id, is_quick_list
    into target_group, target_is_quick
  from public.shopping_lists
  where id = target_list;

  if target_group is null or target_is_quick then
    return false;
  end if;
  if auth.uid() is not null and not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.items
    where list_id = target_list
      and status not in ('purchased', 'delivered', 'cancelled')
  ) then
    return false;
  end if;

  update public.shopping_lists
    set archived_at = coalesce(archived_at, now()), updated_at = now()
  where id = target_list and archived_at is null;
  return found;
end;
$$;

revoke all on function public.archive_shopping_list_if_complete(uuid) from public;
grant execute on function public.archive_shopping_list_if_complete(uuid) to authenticated;

create or replace function public.mark_item_unavailable(target_item uuid, attempt_note text default null)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.items;
  original_item public.items;
  original_list uuid;
  target_group uuid;
  quick_list_id uuid;
  quick_category_id uuid;
begin
  select * into original_item
  from public.items
  where id = target_item and assigned_to = auth.uid()
  for update;

  if original_item.id is null then
    raise exception 'not_assigned_to_you' using errcode = '42501';
  end if;

  original_list := original_item.list_id;
  select group_id into target_group
  from public.shopping_lists
  where id = original_list;

  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;

  if exists (select 1 from public.shopping_lists where id = original_list and is_quick_list) then
    quick_list_id := original_list;
    quick_category_id := original_item.category_id;
  else
    select destination.quick_list_id, destination.quick_category_id
      into quick_list_id, quick_category_id
    from public.ensure_quick_destination(target_group, auth.uid()) destination;
  end if;

  insert into public.item_attempts(item_id, user_id, outcome, note)
    values(target_item, auth.uid(), 'not_found', attempt_note);

  update public.items
    set list_id = quick_list_id,
        category_id = quick_category_id,
        status = 'unassigned',
        assigned_to = null,
        searched_before = true,
        updated_at = now()
  where id = target_item
  returning * into changed;

  update public.item_assignments
    set status = 'released', updated_at = now()
  where item_id = target_item
    and user_id = auth.uid()
    and status in ('pending', 'accepted');

  insert into public.activity_log(group_id, actor_id, list_id, item_id, action, previous_status, new_status, explanation)
    values(target_group, auth.uid(), quick_list_id, target_item, 'Ei leidnud toodet poest; viis jooksvasse listi', original_item.status, 'unassigned', attempt_note);

  insert into public.notifications(group_id, user_id, actor_id, list_id, item_id, type, title, body)
    select target_group, changed.created_by, auth.uid(), quick_list_id, target_item,
      'item_unavailable', 'Toodet ei olnud poes',
      'Toodet „' || changed.name || '“ ei olnud poes ja see liikus jooksvasse listi.'
    where changed.created_by <> auth.uid();

  perform public.archive_shopping_list_if_complete(original_list);
  return changed;
end;
$$;

revoke all on function public.mark_item_unavailable(uuid, text) from public;
grant execute on function public.mark_item_unavailable(uuid, text) to authenticated;

-- Ostetuks märkimine ei tekita teadet, kuid võib lõpetatud nimekirja arhiveerida.
create or replace function public.set_item_status(target_item uuid, target_status public.item_status)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.items;
  old_status public.item_status;
  original_list uuid;
  action_name text;
begin
  if target_status not in ('purchased', 'delivered') then
    raise exception 'unsupported_status' using errcode = '22023';
  end if;

  select status, list_id into old_status, original_list
  from public.items
  where id = target_item and assigned_to = auth.uid()
  for update;

  if old_status is null then
    raise exception 'not_assigned_to_you' using errcode = '42501';
  end if;

  update public.items
    set status = target_status
  where id = target_item
  returning * into changed;

  action_name := case
    when target_status = 'purchased' then 'Märkis toote ostetuks'
    else 'Märkis toote laevale viiduks'
  end;

  insert into public.activity_log(group_id, actor_id, list_id, item_id, action, previous_status, new_status)
    values(public.item_group(target_item), auth.uid(), changed.list_id, target_item, action_name, old_status, target_status);

  perform public.archive_shopping_list_if_complete(original_list);
  return changed;
end;
$$;

revoke all on function public.set_item_status(uuid, public.item_status) from public;
grant execute on function public.set_item_status(uuid, public.item_status) to authenticated;

create or replace function public.delete_shopping_list_preserving_floating(target_list uuid)
returns integer
language plpgsql
security definer
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

  select coalesce(array_agg(id), '{}'::uuid[])
    into moved_item_ids
  from public.items
  where list_id = target_list
    and assigned_to is null
    and status in ('unassigned', 'unavailable');

  if cardinality(moved_item_ids) > 0 then
    select destination.quick_list_id, destination.quick_category_id
      into quick_list_id, quick_category_id
    from public.ensure_quick_destination(target_group, auth.uid()) destination;

    update public.items
      set list_id = quick_list_id,
          category_id = quick_category_id,
          status = 'unassigned',
          updated_at = now()
    where id = any(moved_item_ids);

    update public.activity_log
      set list_id = quick_list_id, updated_at = now()
    where list_id = target_list and item_id = any(moved_item_ids);

    update public.notifications
      set list_id = quick_list_id, updated_at = now()
    where list_id = target_list and item_id = any(moved_item_ids);

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

-- Paranda juba olemasolevad „ei leidnud“ tooted, mis olid veel algse nimekirja küljes.
do $$
declare
  source record;
  quick_list_id uuid;
  quick_category_id uuid;
  moved_item_ids uuid[];
begin
  for source in
    select distinct sl.id as list_id, sl.group_id, sl.created_by
    from public.shopping_lists sl
    join public.items item on item.list_id = sl.id
    where not sl.is_quick_list
      and item.assigned_to is null
      and item.status = 'unassigned'
      and item.searched_before
  loop
    select coalesce(array_agg(id), '{}'::uuid[])
      into moved_item_ids
    from public.items
    where list_id = source.list_id
      and assigned_to is null
      and status = 'unassigned'
      and searched_before;

    select destination.quick_list_id, destination.quick_category_id
      into quick_list_id, quick_category_id
    from public.ensure_quick_destination(source.group_id, source.created_by) destination;

    update public.items
      set list_id = quick_list_id, category_id = quick_category_id, updated_at = now()
    where id = any(moved_item_ids);

    update public.activity_log
      set list_id = quick_list_id, updated_at = now()
    where list_id = source.list_id and item_id = any(moved_item_ids);

    update public.notifications
      set list_id = quick_list_id, updated_at = now()
    where list_id = source.list_id and item_id = any(moved_item_ids);

    perform public.archive_shopping_list_if_complete(source.list_id);
  end loop;
end;
$$;
