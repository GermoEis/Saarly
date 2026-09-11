-- Grupis jagatud kategooria turvaline kustutamine.
-- Kategooria all olevad tooted viiakse sama nimekirja „Üldine“ kategooriasse.

create or replace function public.delete_shared_category(
  target_group uuid,
  category_name text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  clean_name text := nullif(trim(category_name), '');
  target_category record;
  fallback_category_id uuid;
  deleted_count integer := 0;
begin
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;
  if clean_name is null or length(clean_name) > 80 then
    raise exception 'invalid_category_name' using errcode = '22023';
  end if;
  if lower(clean_name) = lower('Üldine') then
    raise exception 'default_category_required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_group::text || ':shared-categories', 0));

  delete from public.category_templates
  where group_id = target_group and lower(trim(name)) = lower(clean_name);

  for target_category in
    select category.id, category.list_id
    from public.categories category
    join public.shopping_lists list on list.id = category.list_id
    where list.group_id = target_group
      and lower(trim(category.name)) = lower(clean_name)
  loop
    select id into fallback_category_id
    from public.categories
    where list_id = target_category.list_id and lower(trim(name)) = lower('Üldine')
    order by created_at
    limit 1;

    if fallback_category_id is null then
      insert into public.categories(list_id, name, sort_order)
      values(target_category.list_id, 'Üldine', 0)
      returning id into fallback_category_id;
    end if;

    update public.items
    set category_id = fallback_category_id
    where category_id = target_category.id;

    delete from public.categories where id = target_category.id;
    deleted_count := deleted_count + 1;
  end loop;

  if not exists (
    select 1 from public.category_templates
    where group_id = target_group and lower(trim(name)) = lower('Üldine')
  ) then
    insert into public.category_templates(group_id, created_by, name, sort_order)
    values(target_group, auth.uid(), 'Üldine', 0);
  end if;

  return deleted_count;
end $$;

revoke all on function public.delete_shared_category(uuid, text) from public;
grant execute on function public.delete_shared_category(uuid, text) to authenticated;
