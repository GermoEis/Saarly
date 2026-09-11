-- Salvesta kriipsu ja ettemakse juures, kas arveldamine käib sulas või ülekandega.

alter table public.bar_ledger_entries
  add column payment_method text
  check (payment_method in ('cash', 'transfer'));

alter table public.bar_credit_transactions
  add column payment_method text
  check (payment_method in ('cash', 'transfer'));

drop function public.create_bar_ledger_entry(uuid,uuid,text,text,timestamptz,text,jsonb);
drop function public.update_bar_ledger_entry(uuid,uuid,text,text,timestamptz,text,jsonb);
drop function public.record_bar_prepayment(uuid,uuid,uuid,text,text,numeric,timestamptz,text);

create function public.create_bar_ledger_entry(
  target_group uuid,
  target_debtor uuid,
  debtor_name text,
  debtor_contact text,
  entry_occurred_at timestamptz,
  entry_note text,
  entry_items jsonb,
  entry_payment_method text default 'cash'
) returns public.bar_ledger_entries
language plpgsql security definer set search_path = '' as $$
declare
  debtor public.bar_debtors;
  changed public.bar_ledger_entries;
  line jsonb;
  quantity_value numeric;
  price_value numeric;
  total_value numeric := 0;
  line_product uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not public.is_group_member(target_group) then raise exception 'group_member_required' using errcode='42501'; end if;
  if entry_payment_method not in ('cash', 'transfer') then raise exception 'invalid_bar_payment_method' using errcode='22023'; end if;
  if length(trim(coalesce(entry_note, ''))) > 500 then raise exception 'bar_text_too_long' using errcode='22023'; end if;
  if jsonb_typeof(entry_items) <> 'array' or jsonb_array_length(entry_items) not between 1 and 50 then raise exception 'invalid_bar_items' using errcode='22023'; end if;

  for line in select value from jsonb_array_elements(entry_items) loop
    quantity_value := (line->>'quantity')::numeric;
    price_value := round((line->>'unit_price')::numeric, 2);
    if length(trim(coalesce(line->>'product_name', ''))) not between 1 and 120 or quantity_value <= 0 or price_value <= 0 then raise exception 'invalid_bar_item' using errcode='22023'; end if;
    line_product := nullif(line->>'product_id', '')::uuid;
    if line_product is not null and not exists(select 1 from public.bar_products p where p.id = line_product and p.group_id = target_group) then raise exception 'bar_product_not_found' using errcode='P0002'; end if;
    total_value := total_value + round(quantity_value * price_value, 2);
  end loop;
  total_value := round(total_value, 2);
  if total_value <= 0 then raise exception 'invalid_bar_total' using errcode='22023'; end if;

  debtor := public.resolve_bar_debtor(target_group, auth.uid(), target_debtor, debtor_name, debtor_contact);
  insert into public.bar_ledger_entries(group_id, owner_id, debtor_id, occurred_at, note, payment_method, total_amount)
  values(target_group, auth.uid(), debtor.id, coalesce(entry_occurred_at, now()), trim(coalesce(entry_note, '')), entry_payment_method, total_value)
  returning * into changed;
  insert into public.bar_ledger_items(entry_id, product_id, product_name, quantity, unit_price)
  select changed.id, nullif(value->>'product_id', '')::uuid, trim(value->>'product_name'), (value->>'quantity')::numeric, round((value->>'unit_price')::numeric, 2)
  from jsonb_array_elements(entry_items);
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(changed.id, auth.uid(), 'created', jsonb_build_object('total_amount', total_value, 'payment_method', entry_payment_method));
  perform public.apply_bar_credit_to_entry(changed.id);
  select * into changed from public.bar_ledger_entries where id = changed.id;
  return changed;
end $$;

create function public.update_bar_ledger_entry(
  target_entry uuid,
  target_debtor uuid,
  debtor_name text,
  debtor_contact text,
  entry_occurred_at timestamptz,
  entry_note text,
  entry_items jsonb,
  entry_payment_method text default 'cash'
) returns public.bar_ledger_entries
language plpgsql security definer set search_path = '' as $$
declare
  target public.bar_ledger_entries;
  debtor public.bar_debtors;
  changed public.bar_ledger_entries;
  line jsonb;
  quantity_value numeric;
  price_value numeric;
  total_value numeric := 0;
  paid_value numeric := 0;
  line_product uuid;
  before_data jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into target from public.bar_ledger_entries where id = target_entry for update;
  if target.id is null then raise exception 'bar_entry_not_found' using errcode='P0002'; end if;
  if target.owner_id <> auth.uid() and not public.is_exact_group_admin(target.group_id) then raise exception 'bar_permission_denied' using errcode='42501'; end if;
  if target.status = 'cancelled' then raise exception 'bar_entry_cancelled' using errcode='P0001'; end if;
  if entry_payment_method not in ('cash', 'transfer') then raise exception 'invalid_bar_payment_method' using errcode='22023'; end if;
  if length(trim(coalesce(entry_note, ''))) > 500 then raise exception 'invalid_bar_text' using errcode='22023'; end if;
  if jsonb_typeof(entry_items) <> 'array' or jsonb_array_length(entry_items) not between 1 and 50 then raise exception 'invalid_bar_items' using errcode='22023'; end if;

  debtor := public.resolve_bar_debtor(target.group_id, target.owner_id, target_debtor, debtor_name, debtor_contact);
  for line in select value from jsonb_array_elements(entry_items) loop
    quantity_value := (line->>'quantity')::numeric;
    price_value := round((line->>'unit_price')::numeric, 2);
    if length(trim(coalesce(line->>'product_name', ''))) not between 1 and 120 or quantity_value <= 0 or price_value <= 0 then raise exception 'invalid_bar_item' using errcode='22023'; end if;
    line_product := nullif(line->>'product_id', '')::uuid;
    if line_product is not null and not exists(select 1 from public.bar_products p where p.id = line_product and p.group_id = target.group_id) then raise exception 'bar_product_not_found' using errcode='P0002'; end if;
    total_value := total_value + round(quantity_value * price_value, 2);
  end loop;
  total_value := round(total_value, 2);
  select coalesce(sum(amount), 0) into paid_value from public.bar_ledger_payments where entry_id = target.id and voided_at is null;
  if total_value < paid_value then raise exception 'bar_total_below_paid' using errcode='22023'; end if;

  select jsonb_build_object(
    'debtor_id', target.debtor_id, 'occurred_at', target.occurred_at, 'note', target.note,
    'payment_method', target.payment_method, 'total_amount', target.total_amount,
    'items', coalesce(jsonb_agg(to_jsonb(items) order by items.created_at), '[]'::jsonb)
  ) into before_data from public.bar_ledger_items items where items.entry_id = target.id;
  delete from public.bar_ledger_items where entry_id = target.id;
  insert into public.bar_ledger_items(entry_id, product_id, product_name, quantity, unit_price)
  select target.id, nullif(value->>'product_id', '')::uuid, trim(value->>'product_name'), (value->>'quantity')::numeric, round((value->>'unit_price')::numeric, 2)
  from jsonb_array_elements(entry_items);
  update public.bar_ledger_entries set
    debtor_id = debtor.id,
    occurred_at = coalesce(entry_occurred_at, occurred_at),
    note = trim(coalesce(entry_note, '')),
    payment_method = entry_payment_method,
    total_amount = total_value,
    status = case when total_value = paid_value then 'paid' else 'open' end,
    paid_at = case when total_value = paid_value then coalesce(paid_at, now()) else null end
  where id = target.id returning * into changed;
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(target.id, auth.uid(), 'updated', jsonb_build_object('before', before_data, 'total_amount', total_value, 'payment_method', entry_payment_method));
  perform public.apply_bar_credit_to_entry(target.id);
  select * into changed from public.bar_ledger_entries where id = target.id;
  return changed;
end $$;

create function public.record_bar_prepayment(
  target_group uuid,
  target_owner uuid,
  target_debtor uuid,
  debtor_name text,
  debtor_contact text,
  amount_value numeric,
  prepayment_occurred_at timestamptz,
  prepayment_note text,
  prepayment_method text default 'cash'
) returns public.bar_credit_transactions
language plpgsql security definer set search_path = '' as $$
declare
  owner_value uuid := coalesce(target_owner, auth.uid());
  clean_amount numeric := round(coalesce(amount_value, 0), 2);
  debtor public.bar_debtors;
  deposit public.bar_credit_transactions;
  open_entry record;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not public.is_group_member(target_group) then raise exception 'group_member_required' using errcode='42501'; end if;
  if owner_value <> auth.uid() and not public.is_exact_group_admin(target_group) then raise exception 'bar_permission_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.group_members where group_id = target_group and profile_id = owner_value) then raise exception 'bar_owner_not_found' using errcode='P0002'; end if;
  if prepayment_method not in ('cash', 'transfer') then raise exception 'invalid_bar_payment_method' using errcode='22023'; end if;
  if clean_amount <= 0 or length(trim(coalesce(prepayment_note, ''))) > 500 then raise exception 'invalid_bar_credit' using errcode='22023'; end if;

  debtor := public.resolve_bar_debtor(target_group, owner_value, target_debtor, debtor_name, debtor_contact);
  perform 1 from public.bar_debtors where id = debtor.id for update;
  insert into public.bar_credit_transactions(group_id, owner_id, debtor_id, kind, amount, occurred_at, recorded_by, note, payment_method)
  values(target_group, owner_value, debtor.id, 'deposit', clean_amount, coalesce(prepayment_occurred_at, now()), auth.uid(), trim(coalesce(prepayment_note, '')), prepayment_method)
  returning * into deposit;

  for open_entry in
    select id from public.bar_ledger_entries
    where debtor_id = debtor.id and status = 'open'
    order by occurred_at, created_at, id
  loop
    perform public.apply_bar_credit_to_entry(open_entry.id);
    exit when public.bar_debtor_credit_available(debtor.id) <= 0;
  end loop;
  return deposit;
end $$;

revoke all on function public.create_bar_ledger_entry(uuid,uuid,text,text,timestamptz,text,jsonb,text), public.update_bar_ledger_entry(uuid,uuid,text,text,timestamptz,text,jsonb,text), public.record_bar_prepayment(uuid,uuid,uuid,text,text,numeric,timestamptz,text,text) from public, anon;
grant execute on function public.create_bar_ledger_entry(uuid,uuid,text,text,timestamptz,text,jsonb,text), public.update_bar_ledger_entry(uuid,uuid,text,text,timestamptz,text,jsonb,text), public.record_bar_prepayment(uuid,uuid,uuid,text,text,numeric,timestamptz,text,text) to authenticated;
