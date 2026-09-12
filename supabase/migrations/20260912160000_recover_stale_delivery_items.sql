-- Kui kasutaja loob aegunud kavandi järel uue saadetise, võivad ostetud
-- tooted olla endiselt vana kavandiga seotud. Taasta need uude saadetisse
-- ainult siis, kui valitud saadetisel endal pole ühtegi ostetud toodet.

create or replace function public.complete_delivery(
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
declare
  saved public.deliveries;
  target_group uuid;
  changed_item record;
begin
  select group_id into target_group
  from public.shopping_lists
  where id = target_list;

  if target_group is null or not public.is_group_member(target_group) then
    raise exception 'not_a_group_member' using errcode = '42501';
  end if;

  if target_delivery is null then
    insert into public.deliveries(
      list_id, created_by, courier_id, ship_name, departure_date,
      departure_time, port, handover_place, note, status
    ) values (
      target_list, auth.uid(), auth.uid(), trim(delivery_ship), delivery_date,
      delivery_time, trim(delivery_port), trim(delivery_place), delivery_note, 'delivered'
    ) returning * into saved;
  else
    update public.deliveries
    set ship_name = trim(delivery_ship),
        departure_date = delivery_date,
        departure_time = delivery_time,
        port = trim(delivery_port),
        handover_place = trim(delivery_place),
        note = delivery_note,
        status = 'delivered'
    where id = target_delivery
      and list_id = target_list
      and courier_id = auth.uid()
      and status = 'planned'
    returning * into saved;

    if saved.id is null then
      raise exception 'delivery_not_available' using errcode = '42501';
    end if;
  end if;

  -- Uuel kavandil võivad seosed puududa, sest samad tooted jäid aegunud
  -- kavandi külge. Sel juhul tõsta kasutaja ostetud tooted valitud saadetisse.
  if not exists (
    select 1
    from public.delivery_items link
    join public.items item on item.id = link.item_id
    where link.delivery_id = saved.id
      and item.list_id = target_list
      and item.assigned_to = auth.uid()
      and item.status = 'purchased'
      and item.deleted_at is null
  ) then
    delete from public.delivery_items old_link
    using public.deliveries old_delivery, public.items item
    where old_link.delivery_id = old_delivery.id
      and old_link.item_id = item.id
      and old_delivery.id <> saved.id
      and old_delivery.list_id = target_list
      and old_delivery.courier_id = auth.uid()
      and old_delivery.status = 'planned'
      and item.list_id = target_list
      and item.assigned_to = auth.uid()
      and item.status = 'purchased'
      and item.deleted_at is null;

    insert into public.delivery_items(delivery_id, item_id)
    select saved.id, item.id
    from public.items item
    where item.list_id = target_list
      and item.assigned_to = auth.uid()
      and item.status = 'purchased'
      and item.deleted_at is null
    on conflict(delivery_id, item_id) do nothing;
  end if;

  if not exists (
    select 1
    from public.delivery_items link
    join public.items item on item.id = link.item_id
    where link.delivery_id = saved.id
      and item.list_id = target_list
      and item.assigned_to = auth.uid()
      and item.status = 'purchased'
      and item.deleted_at is null
  ) then
    raise exception 'no_purchased_items' using errcode = 'P0001';
  end if;

  -- Sama toode ei pea jääma paralleelselt vana kavandi külge.
  delete from public.delivery_items old_link
  using public.deliveries old_delivery, public.delivery_items selected_link,
        public.items selected_item
  where selected_link.delivery_id = saved.id
    and selected_link.item_id = selected_item.id
    and selected_item.list_id = target_list
    and selected_item.assigned_to = auth.uid()
    and selected_item.status = 'purchased'
    and selected_item.deleted_at is null
    and old_link.item_id = selected_link.item_id
    and old_link.delivery_id = old_delivery.id
    and old_delivery.id <> saved.id
    and old_delivery.status = 'planned';

  for changed_item in
    select item.id, item.status
    from public.delivery_items link
    join public.items item on item.id = link.item_id
    where link.delivery_id = saved.id
      and item.list_id = target_list
      and item.assigned_to = auth.uid()
      and item.status = 'purchased'
      and item.deleted_at is null
    for update of item
  loop
    update public.items set status = 'delivered' where id = changed_item.id;
    insert into public.activity_log(group_id, actor_id, list_id, item_id, action, previous_status, new_status)
      values(target_group, auth.uid(), target_list, changed_item.id, 'Märkis kaubad laevale viiduks', changed_item.status, 'delivered');
  end loop;

  return saved;
end $$;

revoke all on function public.complete_delivery(uuid, uuid, text, date, time, text, text, text) from public;
grant execute on function public.complete_delivery(uuid, uuid, text, date, time, text, text, text) to authenticated;
