-- Keep shared category templates and every non-deleted shopping list in sync.
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

  insert into public.categories(list_id, name, sort_order)
  select list.id, clean_name, coalesce((select max(existing.sort_order) + 1 from public.categories existing where existing.list_id = list.id), 0)
  from public.shopping_lists list
  where list.group_id = target_group
    and list.deleted_at is null
    and not exists (
      select 1 from public.categories existing
      where existing.list_id = list.id and lower(trim(existing.name)) = lower(clean_name)
    );

  return saved_template_id;
end $$;

revoke all on function public.create_shared_category(uuid, text) from public;
grant execute on function public.create_shared_category(uuid, text) to authenticated;

-- Backfill templates that existed before this migration.
insert into public.categories(list_id, name, sort_order)
select list.id, template.name,
  coalesce((select max(existing.sort_order) + 1 from public.categories existing where existing.list_id = list.id), 0)
  + row_number() over (partition by list.id order by template.sort_order, template.created_at)::integer - 1
from public.shopping_lists list
join public.category_templates template on template.group_id = list.group_id
where list.deleted_at is null
  and not exists (
    select 1 from public.categories existing
    where existing.list_id = list.id and lower(trim(existing.name)) = lower(trim(template.name))
  );
