-- Lõpeta ainult konkreetse saadetisega seotud ostetud kaubad.
-- Samas ostunimekirjas võivad kasutajal olla ka järgmise saadetise jaoks
-- veel ostmata või hiljem ostetud kaubad.

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

    insert into public.delivery_items(delivery_id, item_id)
    select saved.id, item.id
    from public.items item
    where item.list_id = target_list
      and item.assigned_to = auth.uid()
      and item.status = 'purchased'
      and item.deleted_at is null
      and not exists (
        select 1
        from public.delivery_items existing_link
        where existing_link.item_id = item.id
      )
    on conflict(delivery_id, item_id) do nothing;
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

    -- Vanema kliendiga loodud kavanditel ei pruugi seoseid veel olla.
    if not exists (
      select 1 from public.delivery_items where delivery_id = saved.id
    ) then
      insert into public.delivery_items(delivery_id, item_id)
      select saved.id, item.id
      from public.items item
      where item.list_id = target_list
        and item.assigned_to = auth.uid()
        and item.status = 'purchased'
        and item.deleted_at is null
        and not exists (
          select 1
          from public.delivery_items existing_link
          where existing_link.item_id = item.id
        )
      on conflict(delivery_id, item_id) do nothing;
    end if;
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
