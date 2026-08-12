-- Peidetud grupiülene Jooksev list ja rahulikumad teavitused.
alter table public.shopping_lists
  add column if not exists is_quick_list boolean not null default false;

create unique index if not exists one_quick_list_per_group
  on public.shopping_lists(group_id) where is_quick_list;

-- Uue kauba lisamine ei saada kõigile grupiliikmetele teadet.
drop trigger if exists notify_item_insert on public.items;

create or replace function public.create_quick_item(
  target_group uuid,
  item_name text,
  item_quantity numeric,
  item_unit text default null,
  item_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  quick_list_id uuid;
  quick_category_id uuid;
  saved_item_id uuid;
begin
  if not public.is_group_manager(target_group) then
    raise exception 'manager_required' using errcode = '42501';
  end if;
  if nullif(trim(item_name), '') is null then
    raise exception 'item_name_required' using errcode = '22023';
  end if;
  if item_quantity is null or item_quantity <= 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
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

  insert into public.items(list_id, category_id, created_by, name, quantity, unit, note, status, searched_before)
    values(quick_list_id, quick_category_id, auth.uid(), trim(item_name), item_quantity, nullif(trim(item_unit), ''), nullif(trim(item_note), ''), 'unassigned', false)
    returning id into saved_item_id;

  insert into public.activity_log(group_id, actor_id, list_id, item_id, action, new_status)
    values(target_group, auth.uid(), quick_list_id, saved_item_id, 'Lisas toote otse jooksvasse listi', 'unassigned');

  return saved_item_id;
end $$;

revoke all on function public.create_quick_item(uuid, text, numeric, text, text) from public;
grant execute on function public.create_quick_item(uuid, text, numeric, text, text) to authenticated;

-- Toote enda võtmine ja sellest loobumine jäävad ajalukku, aga koostajat ei teavitata.
create or replace function public.claim_floating_item(target_item uuid) returns public.items
language plpgsql security definer set search_path = '' as $$
declare claimed public.items; target_group uuid;
begin
  target_group := public.item_group(target_item);
  if not public.is_group_member(target_group) then raise exception 'not_a_group_member' using errcode='42501'; end if;
  update public.items set assigned_to=auth.uid(), status='accepted', updated_at=now()
    where id=target_item and assigned_to is null and status in ('unassigned','unavailable') returning * into claimed;
  if claimed.id is null then raise exception 'item_already_claimed' using errcode='P0001'; end if;
  insert into public.item_assignments(item_id,user_id,assigned_by,status) values(target_item,auth.uid(),auth.uid(),'accepted');
  insert into public.activity_log(group_id,actor_id,list_id,item_id,action,new_status)
    values(target_group,auth.uid(),claimed.list_id,target_item,'Võttis ujuva toote endale','accepted');
  return claimed;
end $$;

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
  return changed;
end $$;

-- Ostetuks märkimine jääb olekusse ja ajalukku, kuid ei tekita koostajale teadet.
create or replace function public.set_item_status(target_item uuid, target_status public.item_status) returns public.items
language plpgsql security definer set search_path = '' as $$
declare changed public.items; old_status public.item_status; action_name text;
begin
  if target_status not in ('purchased','delivered') then raise exception 'unsupported_status' using errcode='22023'; end if;
  select status into old_status from public.items where id=target_item and assigned_to=auth.uid() for update;
  if old_status is null then raise exception 'not_assigned_to_you' using errcode='42501'; end if;
  update public.items set status=target_status where id=target_item returning * into changed;
  action_name := case when target_status='purchased' then 'Märkis toote ostetuks' else 'Märkis toote laevale viiduks' end;
  insert into public.activity_log(group_id,actor_id,list_id,item_id,action,previous_status,new_status)
    values(public.item_group(target_item),auth.uid(),changed.list_id,target_item,action_name,old_status,target_status);
  return changed;
end $$;

-- Koostaja saab laevateate alles siis, kui saadetis märgitakse päriselt laevale viiduks.
create or replace function public.notify_delivery_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target_list public.shopping_lists; actor_name text; when_text text; place_text text;
begin
  if new.status <> 'delivered' or (tg_op = 'UPDATE' and old.status = 'delivered') then return new; end if;
  select * into target_list from public.shopping_lists where id = new.list_id;
  select display_name into actor_name from public.profiles where id = new.courier_id;
  when_text := to_char(new.departure_date, 'DD.MM.YYYY') || case when new.departure_time is not null then ' kell ' || to_char(new.departure_time, 'HH24:MI') else '' end;
  place_text := new.handover_place || case when lower(new.handover_place) like '%terminal%' then 'is' else 's' end;
  if target_list.created_by <> new.courier_id then
    insert into public.notifications(group_id, user_id, actor_id, list_id, type, title, body)
      values(target_list.group_id, target_list.created_by, new.courier_id, new.list_id, 'delivery_completed', 'Kaubad laevale viidud', actor_name || ' viis kaubad ' || when_text || ' laevale ' || new.ship_name || '. Kaubad anti üle ' || place_text || '.');
  end if;
  return new;
end $$;
