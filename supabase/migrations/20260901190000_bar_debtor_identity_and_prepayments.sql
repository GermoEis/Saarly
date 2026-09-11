-- Sama omaniku sama nimega baariklient on üks inimene. Ettemakse kasutatakse
-- automaatselt vanimate avatud ostude ning seejärel uute ostude katteks.

create or replace function public.normalize_bar_debtor_name(value text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(trim(coalesce(value, '')), '\s+', ' ', 'g'))
$$;

-- Ühenda enne unikaalsusreeglit olemasolevad sama nimega inimesed.
with ranked as (
  select id,
    first_value(id) over (
      partition by group_id, owner_id, public.normalize_bar_debtor_name(name)
      order by created_at, id
    ) as keep_id,
    row_number() over (
      partition by group_id, owner_id, public.normalize_bar_debtor_name(name)
      order by created_at, id
    ) as position
  from public.bar_debtors
), duplicates as (
  select id, keep_id from ranked where position > 1
)
update public.bar_ledger_entries entry
set debtor_id = duplicate.keep_id
from duplicates duplicate
where entry.debtor_id = duplicate.id;

with ranked as (
  select id,
    row_number() over (
      partition by group_id, owner_id, public.normalize_bar_debtor_name(name)
      order by created_at, id
    ) as position
  from public.bar_debtors
)
delete from public.bar_debtors debtor
using ranked duplicate
where debtor.id = duplicate.id and duplicate.position > 1;

create unique index bar_debtors_owner_normalized_name_uidx
  on public.bar_debtors(group_id, owner_id, public.normalize_bar_debtor_name(name));

create table public.bar_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  debtor_id uuid not null references public.bar_debtors(id) on delete restrict,
  entry_id uuid references public.bar_ledger_entries(id) on delete set null,
  kind text not null check (kind in ('deposit','usage')),
  amount numeric(12,2) not null check (amount > 0),
  occurred_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  note text not null default '' check (length(trim(note)) <= 500),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'usage' and entry_id is not null) or (kind = 'deposit' and entry_id is null))
);
create index bar_credit_transactions_debtor_idx
  on public.bar_credit_transactions(debtor_id, voided_at, occurred_at desc);
create trigger set_updated_at before update on public.bar_credit_transactions
for each row execute function public.set_updated_at();

alter table public.bar_ledger_payments
  add column source text not null default 'payment',
  add column credit_transaction_id uuid references public.bar_credit_transactions(id) on delete restrict,
  add constraint bar_ledger_payments_source_check check (source in ('payment','prepayment')),
  add constraint bar_ledger_payments_credit_source_check check (
    (source = 'payment' and credit_transaction_id is null)
    or (source = 'prepayment' and credit_transaction_id is not null)
  );
create unique index bar_ledger_payments_credit_transaction_uidx
  on public.bar_ledger_payments(credit_transaction_id)
  where credit_transaction_id is not null;

alter table public.bar_credit_transactions enable row level security;
create policy bar_credit_transactions_private_read on public.bar_credit_transactions
for select to authenticated
using (
  public.is_group_member(group_id)
  and (owner_id = auth.uid() or public.is_exact_group_admin(group_id))
);
grant select on public.bar_credit_transactions to authenticated;
revoke insert, update, delete on public.bar_credit_transactions from authenticated, anon;

create or replace function public.resolve_bar_debtor(
  target_group uuid,
  target_owner uuid,
  target_debtor uuid,
  supplied_name text,
  supplied_contact text
) returns public.bar_debtors
language plpgsql security definer set search_path = '' as $$
declare
  selected public.bar_debtors;
  same_name public.bar_debtors;
  clean_name text := regexp_replace(trim(coalesce(supplied_name, '')), '\s+', ' ', 'g');
  clean_contact text := trim(coalesce(supplied_contact, ''));
begin
  if length(clean_name) not between 1 and 120 or length(clean_contact) > 240 then
    raise exception 'invalid_debtor_name' using errcode='22023';
  end if;

  if target_debtor is not null then
    select * into selected from public.bar_debtors
    where id = target_debtor and group_id = target_group and owner_id = target_owner
    for update;
    if selected.id is null then raise exception 'bar_debtor_not_found' using errcode='P0002'; end if;
  end if;

  select * into same_name from public.bar_debtors
  where group_id = target_group and owner_id = target_owner
    and public.normalize_bar_debtor_name(name) = public.normalize_bar_debtor_name(clean_name)
  limit 1 for update;

  if same_name.id is not null then
    update public.bar_debtors set
      name = clean_name,
      contact = case when clean_contact = '' then contact else clean_contact end
    where id = same_name.id returning * into selected;
    return selected;
  end if;

  if selected.id is not null then
    update public.bar_debtors set name = clean_name, contact = clean_contact
    where id = selected.id returning * into selected;
    return selected;
  end if;

  begin
    insert into public.bar_debtors(group_id, owner_id, name, contact)
    values(target_group, target_owner, clean_name, clean_contact)
    returning * into selected;
  exception when unique_violation then
    select * into selected from public.bar_debtors
    where group_id = target_group and owner_id = target_owner
      and public.normalize_bar_debtor_name(name) = public.normalize_bar_debtor_name(clean_name)
    limit 1 for update;
  end;
  return selected;
end $$;
revoke all on function public.resolve_bar_debtor(uuid,uuid,uuid,text,text) from public, anon, authenticated;

create or replace function public.bar_debtor_credit_available(target_debtor uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select round(coalesce(sum(case when transaction.kind = 'deposit' then transaction.amount else -transaction.amount end), 0), 2)
  from public.bar_credit_transactions transaction
  where transaction.debtor_id = target_debtor and transaction.voided_at is null
$$;
revoke all on function public.bar_debtor_credit_available(uuid) from public, anon, authenticated;

create or replace function public.apply_bar_credit_to_entry(target_entry uuid)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  entry public.bar_ledger_entries;
  available_value numeric;
  paid_value numeric;
  remaining_value numeric;
  applied_value numeric;
  usage public.bar_credit_transactions;
  payment public.bar_ledger_payments;
begin
  select * into entry from public.bar_ledger_entries where id = target_entry for update;
  if entry.id is null or entry.status <> 'open' then return 0; end if;
  perform 1 from public.bar_debtors where id = entry.debtor_id for update;
  select coalesce(sum(amount), 0) into paid_value
  from public.bar_ledger_payments where entry_id = entry.id and voided_at is null;
  remaining_value := round(entry.total_amount - paid_value, 2);
  available_value := public.bar_debtor_credit_available(entry.debtor_id);
  applied_value := least(remaining_value, available_value);
  if applied_value <= 0 then return 0; end if;

  insert into public.bar_credit_transactions(group_id, owner_id, debtor_id, entry_id, kind, amount, recorded_by, note)
  values(entry.group_id, entry.owner_id, entry.debtor_id, entry.id, 'usage', applied_value, auth.uid(), 'Rakendatud automaatselt ostule')
  returning * into usage;
  insert into public.bar_ledger_payments(entry_id, amount, paid_at, recorded_by, source, credit_transaction_id, note)
  values(entry.id, applied_value, now(), auth.uid(), 'prepayment', usage.id, 'Tasutud ettemaksest')
  returning * into payment;
  update public.bar_ledger_entries set
    status = case when applied_value = remaining_value then 'paid' else 'open' end,
    paid_at = case when applied_value = remaining_value then payment.paid_at else null end
  where id = entry.id;
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(entry.id, auth.uid(), 'payment_added', jsonb_build_object('payment_id', payment.id, 'amount', applied_value, 'source', 'prepayment'));
  return applied_value;
end $$;
revoke all on function public.apply_bar_credit_to_entry(uuid) from public, anon, authenticated;

create or replace function public.create_bar_ledger_entry(
  target_group uuid,
  target_debtor uuid,
  debtor_name text,
  debtor_contact text,
  entry_occurred_at timestamptz,
  entry_note text,
  entry_items jsonb
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
  insert into public.bar_ledger_entries(group_id, owner_id, debtor_id, occurred_at, note, total_amount)
  values(target_group, auth.uid(), debtor.id, coalesce(entry_occurred_at, now()), trim(coalesce(entry_note, '')), total_value)
  returning * into changed;
  insert into public.bar_ledger_items(entry_id, product_id, product_name, quantity, unit_price)
  select changed.id, nullif(value->>'product_id', '')::uuid, trim(value->>'product_name'), (value->>'quantity')::numeric, round((value->>'unit_price')::numeric, 2)
  from jsonb_array_elements(entry_items);
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(changed.id, auth.uid(), 'created', jsonb_build_object('total_amount', total_value));
  perform public.apply_bar_credit_to_entry(changed.id);
  select * into changed from public.bar_ledger_entries where id = changed.id;
  return changed;
end $$;

create or replace function public.update_bar_ledger_entry(
  target_entry uuid,
  target_debtor uuid,
  debtor_name text,
  debtor_contact text,
  entry_occurred_at timestamptz,
  entry_note text,
  entry_items jsonb
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
    'debtor_id', target.debtor_id, 'occurred_at', target.occurred_at, 'note', target.note, 'total_amount', target.total_amount,
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
    total_amount = total_value,
    status = case when total_value = paid_value then 'paid' else 'open' end,
    paid_at = case when total_value = paid_value then coalesce(paid_at, now()) else null end
  where id = target.id returning * into changed;
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(target.id, auth.uid(), 'updated', jsonb_build_object('before', before_data, 'total_amount', total_value));
  perform public.apply_bar_credit_to_entry(target.id);
  select * into changed from public.bar_ledger_entries where id = target.id;
  return changed;
end $$;

create or replace function public.record_bar_prepayment(
  target_group uuid,
  target_owner uuid,
  target_debtor uuid,
  debtor_name text,
  debtor_contact text,
  amount_value numeric,
  prepayment_occurred_at timestamptz,
  prepayment_note text
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
  if clean_amount <= 0 or length(trim(coalesce(prepayment_note, ''))) > 500 then raise exception 'invalid_bar_credit' using errcode='22023'; end if;

  debtor := public.resolve_bar_debtor(target_group, owner_value, target_debtor, debtor_name, debtor_contact);
  perform 1 from public.bar_debtors where id = debtor.id for update;
  insert into public.bar_credit_transactions(group_id, owner_id, debtor_id, kind, amount, occurred_at, recorded_by, note)
  values(target_group, owner_value, debtor.id, 'deposit', clean_amount, coalesce(prepayment_occurred_at, now()), auth.uid(), trim(coalesce(prepayment_note, '')))
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

create or replace function public.void_bar_prepayment(target_credit uuid)
returns public.bar_credit_transactions
language plpgsql security definer set search_path = '' as $$
declare
  credit public.bar_credit_transactions;
  changed public.bar_credit_transactions;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into credit from public.bar_credit_transactions where id = target_credit for update;
  if credit.id is null or credit.kind <> 'deposit' then raise exception 'bar_credit_not_found' using errcode='P0002'; end if;
  if credit.owner_id <> auth.uid() and not public.is_exact_group_admin(credit.group_id) then raise exception 'bar_permission_denied' using errcode='42501'; end if;
  if credit.voided_at is not null then raise exception 'bar_credit_already_voided' using errcode='P0001'; end if;
  perform 1 from public.bar_debtors where id = credit.debtor_id for update;
  if credit.amount > public.bar_debtor_credit_available(credit.debtor_id) then raise exception 'bar_prepayment_already_used' using errcode='P0001'; end if;
  update public.bar_credit_transactions set voided_at = now(), voided_by = auth.uid()
  where id = credit.id returning * into changed;
  return changed;
end $$;

create or replace function public.void_bar_ledger_payment(target_payment uuid)
returns public.bar_ledger_payments
language plpgsql security definer set search_path = '' as $$
declare
  payment public.bar_ledger_payments;
  target public.bar_ledger_entries;
  changed public.bar_ledger_payments;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into payment from public.bar_ledger_payments where id = target_payment for update;
  if payment.id is null then raise exception 'bar_payment_not_found' using errcode='P0002'; end if;
  select * into target from public.bar_ledger_entries where id = payment.entry_id for update;
  if target.owner_id <> auth.uid() and not public.is_exact_group_admin(target.group_id) then raise exception 'bar_permission_denied' using errcode='42501'; end if;
  if payment.voided_at is not null then raise exception 'bar_payment_already_voided' using errcode='P0001'; end if;
  if payment.credit_transaction_id is not null then
    update public.bar_credit_transactions set voided_at = now(), voided_by = auth.uid()
    where id = payment.credit_transaction_id and voided_at is null;
  end if;
  update public.bar_ledger_payments set voided_at = now(), voided_by = auth.uid() where id = payment.id returning * into changed;
  update public.bar_ledger_entries set status = case when status = 'cancelled' then 'cancelled' else 'open' end, paid_at = null where id = target.id;
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(target.id, auth.uid(), 'payment_voided', jsonb_build_object('payment_id', payment.id, 'amount', payment.amount, 'source', payment.source));
  return changed;
end $$;

create or replace function public.cancel_bar_ledger_entry(target_entry uuid)
returns public.bar_ledger_entries
language plpgsql security definer set search_path = '' as $$
declare
  target public.bar_ledger_entries;
  changed public.bar_ledger_entries;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into target from public.bar_ledger_entries where id = target_entry for update;
  if target.id is null then raise exception 'bar_entry_not_found' using errcode='P0002'; end if;
  if target.owner_id <> auth.uid() and not public.is_exact_group_admin(target.group_id) then raise exception 'bar_permission_denied' using errcode='42501'; end if;
  if target.status = 'cancelled' then raise exception 'bar_entry_cancelled' using errcode='P0001'; end if;

  update public.bar_credit_transactions credit set voided_at = now(), voided_by = auth.uid()
  from public.bar_ledger_payments payment
  where payment.entry_id = target.id and payment.source = 'prepayment' and payment.voided_at is null
    and payment.credit_transaction_id = credit.id and credit.voided_at is null;
  update public.bar_ledger_payments set voided_at = now(), voided_by = auth.uid()
  where entry_id = target.id and source = 'prepayment' and voided_at is null;
  update public.bar_ledger_entries set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
  where id = target.id returning * into changed;
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(target.id, auth.uid(), 'cancelled', jsonb_build_object('total_amount', target.total_amount));
  return changed;
end $$;

revoke all on function public.record_bar_prepayment(uuid,uuid,uuid,text,text,numeric,timestamptz,text), public.void_bar_prepayment(uuid) from public, anon;
grant execute on function public.record_bar_prepayment(uuid,uuid,uuid,text,text,numeric,timestamptz,text), public.void_bar_prepayment(uuid) to authenticated;

alter publication supabase_realtime add table public.bar_credit_transactions;
