-- Jagatud kategooriad jooksvas ja kasutaja enda nimekirjas.
-- Kategooria nimi on grupis ühine, aga igas ostunimekirjas on sellel oma category_id.

create or replace function public.create_shared_category(
  target_group uuid,
  category_name text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  clean_name text := nullif(trim(category_name), '');
  saved_template_id uuid;
begin
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;
  if clean_name is null or length(clean_name) > 80 then
    raise exception 'invalid_category_name' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_group::text || ':shared-categories', 0));

  select id into saved_template_id
  from public.category_templates
  where group_id = target_group and lower(trim(name)) = lower(clean_name)
  order by created_at
  limit 1;

  if saved_template_id is null then
    insert into public.category_templates(group_id, created_by, name, sort_order)
      values(
        target_group,
        auth.uid(),
        clean_name,
        (select coalesce(max(sort_order), -1) + 1 from public.category_templates where group_id = target_group)
      )
      returning id into saved_template_id;
  end if;

  return saved_template_id;
end $$;

revoke all on function public.create_shared_category(uuid, text) from public;
grant execute on function public.create_shared_category(uuid, text) to authenticated;

create or replace function public.assign_items_category(
  target_group uuid,
  target_items uuid[],
  category_name text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  clean_name text := nullif(trim(category_name), '');
  target_count integer;
  changed_count integer := 0;
  row_changed_count integer;
  target_list record;
  saved_category_id uuid;
begin
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;
  if clean_name is null or length(clean_name) > 80 then
    raise exception 'invalid_category_name' using errcode = '22023';
  end if;
  if target_items is null or coalesce(array_length(target_items, 1), 0) = 0 then
    raise exception 'items_required' using errcode = '22023';
  end if;

  select count(distinct value) into target_count from unnest(target_items) value;
  if (
    select count(*)
    from public.items item
    join public.shopping_lists list on list.id = item.list_id
    where item.id = any(target_items)
      and item.deleted_at is null
      and list.deleted_at is null
      and list.group_id = target_group
  ) <> target_count then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_group::text || ':shared-categories', 0));

  if not exists (
    select 1 from public.category_templates
    where group_id = target_group and lower(trim(name)) = lower(clean_name)
  ) then
    insert into public.category_templates(group_id, created_by, name, sort_order)
      values(
        target_group,
        auth.uid(),
        clean_name,
        (select coalesce(max(sort_order), -1) + 1 from public.category_templates where group_id = target_group)
      );
  end if;

  for target_list in
    select distinct item.list_id
    from public.items item
    where item.id = any(target_items)
  loop
    select id into saved_category_id
    from public.categories
    where list_id = target_list.list_id and lower(trim(name)) = lower(clean_name)
    order by created_at
    limit 1;

    if saved_category_id is null then
      insert into public.categories(list_id, name, sort_order)
        values(
          target_list.list_id,
          clean_name,
          (select coalesce(max(sort_order), -1) + 1 from public.categories where list_id = target_list.list_id)
        )
        returning id into saved_category_id;
    end if;

    update public.items
      set category_id = saved_category_id
      where id = any(target_items) and list_id = target_list.list_id;
    get diagnostics row_changed_count = row_count;
    changed_count := changed_count + row_changed_count;
  end loop;

  insert into public.activity_log(group_id, actor_id, list_id, item_id, action)
  select target_group, auth.uid(), item.list_id, item.id, 'Määras kategooria „' || clean_name || '“'
  from public.items item
  where item.id = any(target_items);

  return changed_count;
end $$;

revoke all on function public.assign_items_category(uuid, uuid[], text) from public;
grant execute on function public.assign_items_category(uuid, uuid[], text) to authenticated;

drop function if exists public.create_quick_item(uuid, text, numeric, text, text);

create or replace function public.create_quick_item(
  target_group uuid,
  item_name text,
  item_quantity numeric,
  item_unit text default null,
  item_note text default null,
  item_category_name text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  quick_list_id uuid;
  quick_category_id uuid;
  saved_item_id uuid;
  clean_category_name text := coalesce(nullif(trim(item_category_name), ''), 'Üldine');
begin
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;
  if nullif(trim(item_name), '') is null then
    raise exception 'item_name_required' using errcode = '22023';
  end if;
  if item_quantity is null or item_quantity <= 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  if length(clean_category_name) > 80 then
    raise exception 'invalid_category_name' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_group::text || ':shared-categories', 0));

  select id into quick_list_id
  from public.shopping_lists
  where group_id = target_group and is_quick_list and deleted_at is null
  limit 1;

  if quick_list_id is null then
    insert into public.shopping_lists(group_id, created_by, name, description, is_quick_list)
      values(target_group, auth.uid(), 'Jooksev list', 'Ilma eraldi ostunimekirjata lisatud kaubad', true)
      returning id into quick_list_id;
  end if;

  if not exists (
    select 1 from public.category_templates
    where group_id = target_group and lower(trim(name)) = lower(clean_category_name)
  ) then
    insert into public.category_templates(group_id, created_by, name, sort_order)
      values(
        target_group,
        auth.uid(),
        clean_category_name,
        (select coalesce(max(sort_order), -1) + 1 from public.category_templates where group_id = target_group)
      );
  end if;

  select id into quick_category_id
  from public.categories
  where list_id = quick_list_id and lower(trim(name)) = lower(clean_category_name)
  order by created_at
  limit 1;

  if quick_category_id is null then
    insert into public.categories(list_id, name, sort_order)
      values(
        quick_list_id,
        clean_category_name,
        (select coalesce(max(sort_order), -1) + 1 from public.categories where list_id = quick_list_id)
      )
      returning id into quick_category_id;
  end if;

  insert into public.items(list_id, category_id, created_by, name, quantity, unit, note, status, searched_before)
    values(quick_list_id, quick_category_id, auth.uid(), trim(item_name), item_quantity, nullif(trim(item_unit), ''), nullif(trim(item_note), ''), 'unassigned', false)
    returning id into saved_item_id;

  insert into public.activity_log(group_id, actor_id, list_id, item_id, action, new_status)
    values(target_group, auth.uid(), quick_list_id, saved_item_id, 'Lisas toote otse jooksvasse listi', 'unassigned');

  return saved_item_id;
end $$;

revoke all on function public.create_quick_item(uuid, text, numeric, text, text, text) from public;
grant execute on function public.create_quick_item(uuid, text, numeric, text, text, text) to authenticated;
