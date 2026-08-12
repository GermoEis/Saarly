-- Määratud toode on kohe vastu võetud ning laevale viimine lõpetab korraga kogu kasutaja saadetise.
update public.items set status = 'accepted' where assigned_to is not null and status = 'assigned';
update public.item_assignments set status = 'accepted' where status = 'pending';

create or replace function public.sync_manager_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.assigned_to is distinct from new.assigned_to then
    update public.item_assignments set status = 'released' where item_id = new.id and status in ('pending', 'accepted');
  end if;
  if new.assigned_to is not null and new.status in ('assigned', 'accepted') and (tg_op = 'INSERT' or old.assigned_to is distinct from new.assigned_to) then
    insert into public.item_assignments(item_id, user_id, assigned_by, status) values(new.id, new.assigned_to, auth.uid(), 'accepted');
  end if;
  return new;
end $$;

drop trigger if exists notify_assignment_insert on public.item_assignments;
create trigger notify_assignment_insert after insert on public.item_assignments
for each row when (new.status in ('pending', 'accepted')) execute function public.notify_assignment_inserted();

create or replace function public.respond_to_assignment(target_item uuid, accept boolean) returns public.items
language plpgsql security definer set search_path = '' as $$
declare changed public.items; old_status public.item_status; action_name text;
begin
  select status into old_status from public.items where id = target_item and assigned_to = auth.uid() for update;
  if old_status is null then raise exception 'not_assigned_to_you' using errcode = '42501'; end if;
  if accept then
    update public.items set status = 'accepted' where id = target_item returning * into changed;
    action_name := 'Võttis ülesande vastu';
  else
    update public.items set status = 'unassigned', assigned_to = null where id = target_item returning * into changed;
    action_name := 'Ei saa praegu toodet võtta';
  end if;
  update public.item_assignments
    set status = case when accept then 'accepted'::public.assignment_status else 'declined'::public.assignment_status end
    where item_id = target_item and user_id = auth.uid() and status in ('pending', 'accepted');
  insert into public.activity_log(group_id, actor_id, list_id, item_id, action, previous_status, new_status)
    values(public.item_group(target_item), auth.uid(), changed.list_id, target_item, action_name, old_status, changed.status);
  if not accept and changed.created_by <> auth.uid() then
    insert into public.notifications(group_id, user_id, actor_id, list_id, item_id, type, title, body)
      values(public.item_group(target_item), changed.created_by, auth.uid(), changed.list_id, target_item, 'item_declined', 'Toode liikus jooksvasse listi', 'Viija ei saa praegu toodet „' || changed.name || '“ võtta.');
  end if;
  return changed;
end $$;

create or replace function public.notify_delivery_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target_list public.shopping_lists; actor_name text; when_text text; place_text text;
begin
  select * into target_list from public.shopping_lists where id = new.list_id;
  select display_name into actor_name from public.profiles where id = new.courier_id;
  when_text := to_char(new.departure_date, 'DD.MM.YYYY') || case when new.departure_time is not null then ' kell ' || to_char(new.departure_time, 'HH24:MI') else '' end;
  place_text := new.handover_place || case when lower(new.handover_place) like '%terminal%' then 'is' else 's' end;
  if target_list.created_by <> new.courier_id then
    insert into public.notifications(group_id, user_id, actor_id, list_id, type, title, body)
      values(target_list.group_id, target_list.created_by, new.courier_id, new.list_id,
        case when new.status = 'delivered' then 'delivery_completed' else 'delivery_updated' end,
        case when new.status = 'delivered' then 'Kaubad laevale viidud' else 'Laevainfo muudetud' end,
        case when new.status = 'delivered'
          then actor_name || ' viis kaubad ' || when_text || ' laevale ' || new.ship_name || '. Kaubad anti üle ' || place_text || '.'
          else actor_name || ' viib kaubad ' || when_text || ' laevale ' || new.ship_name || '. Kaubad antakse üle ' || place_text || '.'
        end);
  end if;
  return new;
end $$;

create function public.complete_delivery(
  target_list uuid,
  target_delivery uuid,
  delivery_ship text,
  delivery_date date,
  delivery_time time,
  delivery_port text,
  delivery_place text,
  delivery_note text
) returns public.deliveries
language plpgsql security definer set search_path = '' as $$
declare saved public.deliveries; target_group uuid; changed_item record;
begin
  select group_id into target_group from public.shopping_lists where id = target_list;
  if target_group is null or not public.is_group_member(target_group) then raise exception 'not_a_group_member' using errcode = '42501'; end if;
  if exists (
    select 1 from public.items
    where list_id = target_list and assigned_to = auth.uid() and status not in ('purchased', 'delivered', 'cancelled')
  ) then raise exception 'all_items_must_be_purchased' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.items where list_id = target_list and assigned_to = auth.uid() and status = 'purchased'
  ) then raise exception 'no_purchased_items' using errcode = 'P0001'; end if;

  if target_delivery is null then
    insert into public.deliveries(list_id, created_by, courier_id, ship_name, departure_date, departure_time, port, handover_place, note, status)
      values(target_list, auth.uid(), auth.uid(), trim(delivery_ship), delivery_date, delivery_time, trim(delivery_port), trim(delivery_place), delivery_note, 'delivered')
      returning * into saved;
  else
    update public.deliveries set ship_name = trim(delivery_ship), departure_date = delivery_date, departure_time = delivery_time,
      port = trim(delivery_port), handover_place = trim(delivery_place), note = delivery_note, status = 'delivered'
      where id = target_delivery and list_id = target_list and courier_id = auth.uid()
      returning * into saved;
    if saved.id is null then raise exception 'delivery_not_owned' using errcode = '42501'; end if;
  end if;

  for changed_item in
    select id, status from public.items
    where list_id = target_list and assigned_to = auth.uid() and status = 'purchased'
    for update
  loop
    insert into public.delivery_items(delivery_id, item_id) values(saved.id, changed_item.id) on conflict(delivery_id, item_id) do nothing;
    update public.items set status = 'delivered' where id = changed_item.id;
    insert into public.activity_log(group_id, actor_id, list_id, item_id, action, previous_status, new_status)
      values(target_group, auth.uid(), target_list, changed_item.id, 'Märkis kaubad laevale viiduks', changed_item.status, 'delivered');
  end loop;
  return saved;
end $$;

revoke all on function public.complete_delivery(uuid, uuid, text, date, time, text, text, text) from public;
grant execute on function public.complete_delivery(uuid, uuid, text, date, time, text, text, text) to authenticated;
