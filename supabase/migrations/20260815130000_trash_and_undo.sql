-- 30-päevane prügikast ja serveripoolne tagasivõtmine.

alter table public.shopping_lists
  add column if not exists deleted_at timestamptz;

alter table public.items
  add column if not exists deleted_at timestamptz;

create index if not exists shopping_lists_deleted_at_idx
  on public.shopping_lists(group_id, deleted_at)
  where deleted_at is not null;

create index if not exists items_deleted_at_idx
  on public.items(deleted_at)
  where deleted_at is not null;

create or replace function public.trash_item(target_item uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
begin
  select public.item_group(target_item) into target_group;
  if target_group is null then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;

  update public.items
    set deleted_at = now(), updated_at = now()
  where id = target_item and deleted_at is null;
end;
$$;

revoke all on function public.trash_item(uuid) from public;
grant execute on function public.trash_item(uuid) to authenticated;

create or replace function public.restore_trashed_item(target_item uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
  parent_deleted_at timestamptz;
begin
  select list.group_id, list.deleted_at
    into target_group, parent_deleted_at
  from public.items item
  join public.shopping_lists list on list.id = item.list_id
  where item.id = target_item;

  if target_group is null then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;
  if parent_deleted_at is not null then
    raise exception 'list_still_in_trash' using errcode = 'P0001';
  end if;

  update public.items
    set deleted_at = null, updated_at = now()
  where id = target_item
    and deleted_at >= now() - interval '30 days';
end;
$$;

revoke all on function public.restore_trashed_item(uuid) from public;
grant execute on function public.restore_trashed_item(uuid) to authenticated;

create or replace function public.trash_shopping_list(target_list uuid)
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
  trash_at timestamptz := clock_timestamp();
  moved_item_ids uuid[] := '{}'::uuid[];
begin
  select group_id, is_quick_list
    into target_group, target_is_quick
  from public.shopping_lists
  where id = target_list and deleted_at is null
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
    and deleted_at is null
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
  end if;

  update public.items
    set deleted_at = trash_at, updated_at = now()
  where list_id = target_list and deleted_at is null;

  update public.shopping_lists
    set deleted_at = trash_at, updated_at = now()
  where id = target_list;

  return cardinality(moved_item_ids);
end;
$$;

revoke all on function public.trash_shopping_list(uuid) from public;
grant execute on function public.trash_shopping_list(uuid) to authenticated;

create or replace function public.restore_trashed_shopping_list(target_list uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
  trash_at timestamptz;
begin
  select group_id, deleted_at into target_group, trash_at
  from public.shopping_lists
  where id = target_list;

  if target_group is null then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;
  if trash_at is null or trash_at < now() - interval '30 days' then
    return;
  end if;

  update public.shopping_lists
    set deleted_at = null, updated_at = now()
  where id = target_list;

  update public.items
    set deleted_at = null, updated_at = now()
  where list_id = target_list and deleted_at = trash_at;
end;
$$;

revoke all on function public.restore_trashed_shopping_list(uuid) from public;
grant execute on function public.restore_trashed_shopping_list(uuid) to authenticated;

create or replace function public.purge_group_trash(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;

  delete from public.items item
  using public.shopping_lists list
  where item.list_id = list.id
    and list.group_id = target_group
    and item.deleted_at < now() - interval '30 days';

  delete from public.shopping_lists
  where group_id = target_group
    and deleted_at < now() - interval '30 days';
end;
$$;

revoke all on function public.purge_group_trash(uuid) from public;
grant execute on function public.purge_group_trash(uuid) to authenticated;

create or replace function public.undo_item_status(target_item uuid, previous_status public.item_status)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.items;
  current_status public.item_status;
  target_list uuid;
  target_group uuid;
begin
  if previous_status not in ('assigned', 'accepted', 'purchased') then
    raise exception 'unsupported_previous_status' using errcode = '22023';
  end if;

  select status, list_id
    into current_status, target_list
  from public.items
  where id = target_item
    and assigned_to = auth.uid()
    and deleted_at is null
  for update;

  if current_status not in ('purchased', 'delivered') then
    raise exception 'undo_state_conflict' using errcode = 'P0001';
  end if;

  target_group := public.item_group(target_item);
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;

  update public.items
    set status = previous_status, updated_at = now()
  where id = target_item
  returning * into changed;

  update public.shopping_lists
    set archived_at = null, updated_at = now()
  where id = target_list and archived_at is not null;

  insert into public.activity_log(group_id, actor_id, list_id, item_id, action, previous_status, new_status)
    values(target_group, auth.uid(), target_list, target_item, 'Võttis olekumuudatuse tagasi', current_status, previous_status);

  return changed;
end;
$$;

revoke all on function public.undo_item_status(uuid, public.item_status) from public;
grant execute on function public.undo_item_status(uuid, public.item_status) to authenticated;

create or replace function public.unarchive_shopping_list(target_list uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
begin
  select group_id into target_group from public.shopping_lists where id = target_list;
  if target_group is null then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;
  update public.shopping_lists set archived_at = null, updated_at = now() where id = target_list;
end;
$$;

revoke all on function public.unarchive_shopping_list(uuid) from public;
grant execute on function public.unarchive_shopping_list(uuid) to authenticated;

create or replace function public.undo_completed_delivery(target_delivery uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.deliveries;
  target_group uuid;
begin
  select * into saved
  from public.deliveries
  where id = target_delivery and courier_id = auth.uid() and status = 'delivered'
  for update;

  if saved.id is null then
    raise exception 'undo_state_conflict' using errcode = 'P0001';
  end if;
  if saved.updated_at < now() - interval '30 seconds' then
    raise exception 'undo_expired' using errcode = 'P0001';
  end if;

  target_group := public.list_group(saved.list_id);
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;

  update public.items item
    set status = 'purchased', updated_at = now()
  from public.delivery_items link
  where link.delivery_id = saved.id
    and link.item_id = item.id
    and item.assigned_to = auth.uid()
    and item.status = 'delivered';

  update public.deliveries
    set status = 'planned', updated_at = now()
  where id = saved.id;

  update public.shopping_lists
    set archived_at = null, updated_at = now()
  where id = saved.list_id and archived_at is not null;

  delete from public.notifications
  where group_id = target_group
    and actor_id = auth.uid()
    and list_id = saved.list_id
    and type = 'delivery_completed'
    and created_at >= saved.updated_at - interval '2 seconds';

  insert into public.activity_log(group_id, actor_id, list_id, action)
    values(target_group, auth.uid(), saved.list_id, 'Võttis laevale viimise tagasi');
end;
$$;

revoke all on function public.undo_completed_delivery(uuid) from public;
grant execute on function public.undo_completed_delivery(uuid) to authenticated;

-- Teavituse lisamine käivitab asünkroonselt Supabase Edge Functioni.
create extension if not exists pg_net with schema extensions;

create or replace function public.send_web_push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://ssutnrqhqmgdkdjznlvu.supabase.co/functions/v1/web-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public',
      'record', jsonb_build_object('id', new.id)
    ),
    timeout_milliseconds := 1000
  );
  return new;
end;
$$;

drop trigger if exists send_web_push_on_notification on public.notifications;
create trigger send_web_push_on_notification
after insert on public.notifications
for each row execute function public.send_web_push_notification();
