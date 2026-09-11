-- Privaatne baarivihik väliste inimeste võlgade, toodete ja osamaksete jaoks.

create or replace function public.is_exact_group_admin(target_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.group_members gm
    where gm.group_id = target_group and gm.profile_id = auth.uid() and gm.role = 'admin'
  )
$$;
revoke all on function public.is_exact_group_admin(uuid) from public;
grant execute on function public.is_exact_group_admin(uuid) to authenticated;

create table public.bar_debtors (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  contact text not null default '' check (length(trim(contact)) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bar_debtors_owner_idx on public.bar_debtors(group_id, owner_id, lower(name));

create table public.bar_products (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  unit_price numeric(12,2) not null check (unit_price > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index bar_products_group_name_uidx on public.bar_products(group_id, lower(trim(name)));

create table public.bar_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  debtor_id uuid not null references public.bar_debtors(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  note text not null default '' check (length(trim(note)) <= 500),
  total_amount numeric(12,2) not null check (total_amount > 0),
  status text not null default 'open' check (status in ('open','paid','cancelled')),
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bar_ledger_entries_owner_idx on public.bar_ledger_entries(group_id, owner_id, status, occurred_at desc);
create index bar_ledger_entries_debtor_idx on public.bar_ledger_entries(debtor_id, status);

create table public.bar_ledger_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.bar_ledger_entries(id) on delete cascade,
  product_id uuid references public.bar_products(id) on delete set null,
  product_name text not null check (length(trim(product_name)) between 1 and 120),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price > 0),
  line_total numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bar_ledger_items_entry_idx on public.bar_ledger_items(entry_id);

create table public.bar_ledger_payments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.bar_ledger_entries(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  note text not null default '' check (length(trim(note)) <= 500),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bar_ledger_payments_entry_idx on public.bar_ledger_payments(entry_id, voided_at, paid_at desc);

create table public.bar_ledger_events (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.bar_ledger_entries(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('created','updated','payment_added','payment_voided','cancelled')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bar_ledger_events_entry_idx on public.bar_ledger_events(entry_id, created_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['bar_debtors','bar_products','bar_ledger_entries','bar_ledger_items','bar_ledger_payments','bar_ledger_events'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

create or replace function public.can_manage_bar_entry(target_entry uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.bar_ledger_entries entry
    where entry.id = target_entry
      and (entry.owner_id = auth.uid() or public.is_exact_group_admin(entry.group_id))
  )
$$;
revoke all on function public.can_manage_bar_entry(uuid) from public;
grant execute on function public.can_manage_bar_entry(uuid) to authenticated;

alter table public.bar_debtors enable row level security;
alter table public.bar_products enable row level security;
alter table public.bar_ledger_entries enable row level security;
alter table public.bar_ledger_items enable row level security;
alter table public.bar_ledger_payments enable row level security;
alter table public.bar_ledger_events enable row level security;

create policy bar_debtors_private_read on public.bar_debtors for select to authenticated
using (public.is_group_member(group_id) and (owner_id = auth.uid() or public.is_exact_group_admin(group_id)));
create policy bar_products_group_read on public.bar_products for select to authenticated
using (public.is_group_member(group_id));
create policy bar_entries_private_read on public.bar_ledger_entries for select to authenticated
using (public.is_group_member(group_id) and (owner_id = auth.uid() or public.is_exact_group_admin(group_id)));
create policy bar_items_private_read on public.bar_ledger_items for select to authenticated
using (public.can_manage_bar_entry(entry_id));
create policy bar_payments_private_read on public.bar_ledger_payments for select to authenticated
using (public.can_manage_bar_entry(entry_id));
create policy bar_events_private_read on public.bar_ledger_events for select to authenticated
using (public.can_manage_bar_entry(entry_id));

grant select on public.bar_debtors, public.bar_products, public.bar_ledger_entries, public.bar_ledger_items, public.bar_ledger_payments, public.bar_ledger_events to authenticated;
revoke insert, update, delete on public.bar_debtors, public.bar_products, public.bar_ledger_entries, public.bar_ledger_items, public.bar_ledger_payments, public.bar_ledger_events from authenticated, anon;

create or replace function public.upsert_bar_product(
  target_group uuid,
  target_product uuid,
  product_name text,
  price_value numeric,
  product_active boolean default true
) returns public.bar_products
language plpgsql security definer set search_path = '' as $$
declare
  target public.bar_products;
  changed public.bar_products;
  clean_name text := trim(coalesce(product_name, ''));
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not public.is_group_member(target_group) then raise exception 'group_member_required' using errcode='42501'; end if;
  if length(clean_name) not between 1 and 120 then raise exception 'invalid_product_name' using errcode='22023'; end if;
  if price_value is null or round(price_value, 2) <= 0 then raise exception 'invalid_price' using errcode='22023'; end if;

  if target_product is null then
    insert into public.bar_products(group_id, created_by, name, unit_price, active)
    values(target_group, auth.uid(), clean_name, round(price_value, 2), coalesce(product_active, true))
    returning * into changed;
  else
    select * into target from public.bar_products where id = target_product for update;
    if target.id is null or target.group_id <> target_group then raise exception 'bar_product_not_found' using errcode='P0002'; end if;
    if target.created_by <> auth.uid() and not public.is_exact_group_admin(target.group_id) then raise exception 'bar_permission_denied' using errcode='42501'; end if;
    update public.bar_products set name = clean_name, unit_price = round(price_value, 2), active = coalesce(product_active, active)
    where id = target_product returning * into changed;
  end if;
  return changed;
exception when unique_violation then
  raise exception 'bar_product_duplicate' using errcode='23505';
end $$;

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
  clean_name text := trim(coalesce(debtor_name, ''));
  quantity_value numeric;
  price_value numeric;
  total_value numeric := 0;
  line_product uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not public.is_group_member(target_group) then raise exception 'group_member_required' using errcode='42501'; end if;
  if length(clean_name) not between 1 and 120 then raise exception 'invalid_debtor_name' using errcode='22023'; end if;
  if length(trim(coalesce(debtor_contact, ''))) > 240 or length(trim(coalesce(entry_note, ''))) > 500 then raise exception 'bar_text_too_long' using errcode='22023'; end if;
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

  if target_debtor is null then
    insert into public.bar_debtors(group_id, owner_id, name, contact)
    values(target_group, auth.uid(), clean_name, trim(coalesce(debtor_contact, '')))
    returning * into debtor;
  else
    select * into debtor from public.bar_debtors where id = target_debtor for update;
    if debtor.id is null or debtor.group_id <> target_group or debtor.owner_id <> auth.uid() then raise exception 'bar_debtor_not_found' using errcode='P0002'; end if;
    update public.bar_debtors set name = clean_name, contact = trim(coalesce(debtor_contact, '')) where id = debtor.id returning * into debtor;
  end if;

  insert into public.bar_ledger_entries(group_id, owner_id, debtor_id, occurred_at, note, total_amount)
  values(target_group, auth.uid(), debtor.id, coalesce(entry_occurred_at, now()), trim(coalesce(entry_note, '')), total_value)
  returning * into changed;

  insert into public.bar_ledger_items(entry_id, product_id, product_name, quantity, unit_price)
  select changed.id, nullif(value->>'product_id', '')::uuid, trim(value->>'product_name'), (value->>'quantity')::numeric, round((value->>'unit_price')::numeric, 2)
  from jsonb_array_elements(entry_items);
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(changed.id, auth.uid(), 'created', jsonb_build_object('total_amount', total_value));
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
  clean_name text := trim(coalesce(debtor_name, ''));
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
  if length(clean_name) not between 1 and 120 or length(trim(coalesce(debtor_contact, ''))) > 240 or length(trim(coalesce(entry_note, ''))) > 500 then raise exception 'invalid_bar_text' using errcode='22023'; end if;
  if jsonb_typeof(entry_items) <> 'array' or jsonb_array_length(entry_items) not between 1 and 50 then raise exception 'invalid_bar_items' using errcode='22023'; end if;

  if target_debtor is null then
    insert into public.bar_debtors(group_id, owner_id, name, contact)
    values(target.group_id, target.owner_id, clean_name, trim(coalesce(debtor_contact, '')))
    returning * into debtor;
  else
    select * into debtor from public.bar_debtors where id = target_debtor for update;
    if debtor.id is null or debtor.group_id <> target.group_id or debtor.owner_id <> target.owner_id then raise exception 'bar_debtor_not_found' using errcode='P0002'; end if;
  end if;

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

  update public.bar_debtors set name = clean_name, contact = trim(coalesce(debtor_contact, '')) where id = debtor.id;
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
  return changed;
end $$;

create or replace function public.record_bar_ledger_payment(
  target_entry uuid,
  amount_value numeric,
  payment_paid_at timestamptz,
  payment_note text
) returns public.bar_ledger_payments
language plpgsql security definer set search_path = '' as $$
declare
  target public.bar_ledger_entries;
  changed public.bar_ledger_payments;
  paid_value numeric;
  remaining_value numeric;
  clean_amount numeric := round(coalesce(amount_value, 0), 2);
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into target from public.bar_ledger_entries where id = target_entry for update;
  if target.id is null then raise exception 'bar_entry_not_found' using errcode='P0002'; end if;
  if target.owner_id <> auth.uid() and not public.is_exact_group_admin(target.group_id) then raise exception 'bar_permission_denied' using errcode='42501'; end if;
  if target.status <> 'open' then raise exception 'bar_entry_not_open' using errcode='P0001'; end if;
  if clean_amount <= 0 or length(trim(coalesce(payment_note, ''))) > 500 then raise exception 'invalid_bar_payment' using errcode='22023'; end if;
  select coalesce(sum(amount), 0) into paid_value from public.bar_ledger_payments where entry_id = target.id and voided_at is null;
  remaining_value := round(target.total_amount - paid_value, 2);
  if clean_amount > remaining_value then raise exception 'bar_overpayment' using errcode='22023'; end if;

  insert into public.bar_ledger_payments(entry_id, amount, paid_at, recorded_by, note)
  values(target.id, clean_amount, coalesce(payment_paid_at, now()), auth.uid(), trim(coalesce(payment_note, '')))
  returning * into changed;
  update public.bar_ledger_entries set
    status = case when clean_amount = remaining_value then 'paid' else 'open' end,
    paid_at = case when clean_amount = remaining_value then changed.paid_at else null end
  where id = target.id;
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(target.id, auth.uid(), 'payment_added', jsonb_build_object('payment_id', changed.id, 'amount', clean_amount));
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

  update public.bar_ledger_payments set voided_at = now(), voided_by = auth.uid() where id = payment.id returning * into changed;
  update public.bar_ledger_entries set status = case when status = 'cancelled' then 'cancelled' else 'open' end, paid_at = null where id = target.id;
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(target.id, auth.uid(), 'payment_voided', jsonb_build_object('payment_id', payment.id, 'amount', payment.amount));
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
  update public.bar_ledger_entries set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
  where id = target.id returning * into changed;
  insert into public.bar_ledger_events(entry_id, actor_id, event_type, details)
  values(target.id, auth.uid(), 'cancelled', jsonb_build_object('total_amount', target.total_amount));
  return changed;
end $$;

revoke all on function public.upsert_bar_product(uuid,uuid,text,numeric,boolean), public.create_bar_ledger_entry(uuid,uuid,text,text,timestamptz,text,jsonb), public.update_bar_ledger_entry(uuid,uuid,text,text,timestamptz,text,jsonb), public.record_bar_ledger_payment(uuid,numeric,timestamptz,text), public.void_bar_ledger_payment(uuid), public.cancel_bar_ledger_entry(uuid) from public, anon;
grant execute on function public.upsert_bar_product(uuid,uuid,text,numeric,boolean), public.create_bar_ledger_entry(uuid,uuid,text,text,timestamptz,text,jsonb), public.update_bar_ledger_entry(uuid,uuid,text,text,timestamptz,text,jsonb), public.record_bar_ledger_payment(uuid,numeric,timestamptz,text), public.void_bar_ledger_payment(uuid), public.cancel_bar_ledger_entry(uuid) to authenticated;

alter publication supabase_realtime add table public.bar_debtors;
alter publication supabase_realtime add table public.bar_products;
alter publication supabase_realtime add table public.bar_ledger_entries;
alter publication supabase_realtime add table public.bar_ledger_items;
alter publication supabase_realtime add table public.bar_ledger_payments;
alter publication supabase_realtime add table public.bar_ledger_events;
