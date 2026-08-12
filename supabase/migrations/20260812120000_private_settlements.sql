-- Privaatsed arveldused kahe sama grupi liikme vahel.
-- Kuupäeva kasutaja ei sisesta: created_at ja oleku ajatemplid täidetakse serveris.

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  creditor_id uuid not null references public.profiles(id) on delete cascade,
  debtor_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  description text not null default '' check (length(trim(description)) <= 240),
  shopping_list_id uuid references public.shopping_lists(id) on delete set null,
  status text not null default 'open' check (status in ('open','marked_paid','paid','cancelled')),
  marked_paid_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (creditor_id <> debtor_id),
  check (created_by = creditor_id)
);

create index settlements_party_idx on public.settlements(group_id, creditor_id, debtor_id, status);
create trigger set_updated_at before update on public.settlements
for each row execute function public.set_updated_at();

alter table public.settlements enable row level security;

-- Ka grupi administraator ei näe võõrast arveldust: ainult raha saaja ja võlgnik.
create policy settlements_parties_read on public.settlements
for select to authenticated
using (
  public.is_group_member(group_id)
  and auth.uid() in (creditor_id, debtor_id)
);

grant select on public.settlements to authenticated;
revoke insert, update, delete on public.settlements from authenticated, anon;

create or replace function public.create_settlement(
  target_group uuid,
  target_debtor uuid,
  amount_value numeric,
  settlement_description text,
  target_list uuid default null
) returns public.settlements
language plpgsql security definer set search_path = '' as $$
declare
  changed public.settlements;
  creditor_name text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not public.is_group_member(target_group) then raise exception 'group_member_required' using errcode='42501'; end if;
  if target_debtor = auth.uid() then raise exception 'debtor_must_be_another_user' using errcode='22023'; end if;
  if not exists(select 1 from public.group_members gm where gm.group_id=target_group and gm.profile_id=target_debtor) then
    raise exception 'debtor_not_group_member' using errcode='42501';
  end if;
  if amount_value is null or amount_value <= 0 then raise exception 'invalid_amount' using errcode='22023'; end if;
  if target_list is not null and not exists(select 1 from public.shopping_lists sl where sl.id=target_list and sl.group_id=target_group) then
    raise exception 'list_not_in_group' using errcode='42501';
  end if;

  insert into public.settlements(group_id, created_by, creditor_id, debtor_id, amount, description, shopping_list_id)
  values(target_group, auth.uid(), auth.uid(), target_debtor, amount_value, trim(coalesce(settlement_description,'')), target_list)
  returning * into changed;

  select display_name into creditor_name from public.profiles where id=auth.uid();
  insert into public.notifications(group_id,user_id,actor_id,list_id,type,title,body)
  values(target_group,target_debtor,auth.uid(),target_list,'settlement_created','Uus arveldus',
    coalesce(creditor_name,'Kasutaja')||' lisas sulle arvelduse '||replace(to_char(amount_value,'FM9999999990.00'),'.',',')||' €'||
    case when length(trim(coalesce(settlement_description,''))) > 0 then ': '||trim(settlement_description) else '' end||'.');
  return changed;
end $$;

create or replace function public.mark_settlement_paid(target_settlement uuid)
returns public.settlements
language plpgsql security definer set search_path = '' as $$
declare
  target public.settlements;
  changed public.settlements;
  debtor_name text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into target from public.settlements where id=target_settlement for update;
  if target.id is null then raise exception 'settlement_not_found' using errcode='P0002'; end if;
  if target.debtor_id <> auth.uid() then raise exception 'settlement_permission_denied' using errcode='42501'; end if;
  if target.status <> 'open' then raise exception 'settlement_state_conflict' using errcode='P0001'; end if;

  update public.settlements set status='marked_paid', marked_paid_at=now()
  where id=target_settlement returning * into changed;
  select display_name into debtor_name from public.profiles where id=auth.uid();
  insert into public.notifications(group_id,user_id,actor_id,list_id,type,title,body)
  values(target.group_id,target.creditor_id,auth.uid(),target.shopping_list_id,'settlement_marked_paid','Arveldus märgiti makstuks',
    coalesce(debtor_name,'Kasutaja')||' märkis arvelduse '||replace(to_char(target.amount,'FM9999999990.00'),'.',',')||' € makstuks. Palun kinnita raha laekumine.');
  return changed;
end $$;

create or replace function public.confirm_settlement_paid(target_settlement uuid)
returns public.settlements
language plpgsql security definer set search_path = '' as $$
declare
  target public.settlements;
  changed public.settlements;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into target from public.settlements where id=target_settlement for update;
  if target.id is null then raise exception 'settlement_not_found' using errcode='P0002'; end if;
  if target.creditor_id <> auth.uid() then raise exception 'settlement_permission_denied' using errcode='42501'; end if;
  if target.status not in ('open','marked_paid') then raise exception 'settlement_state_conflict' using errcode='P0001'; end if;

  update public.settlements set status='paid', confirmed_at=now()
  where id=target_settlement returning * into changed;
  insert into public.notifications(group_id,user_id,actor_id,list_id,type,title,body)
  values(target.group_id,target.debtor_id,auth.uid(),target.shopping_list_id,'settlement_paid','Tasumine kinnitatud',
    case when target.status='open'
      then coalesce((select display_name from public.profiles where id=auth.uid()),'Kasutaja')||' märkis arvelduse '||replace(to_char(target.amount,'FM9999999990.00'),'.',',')||' € tasutuks.'
      else 'Arveldus '||replace(to_char(target.amount,'FM9999999990.00'),'.',',')||' € on kinnitatud tasutuks.' end);
  return changed;
end $$;

create or replace function public.cancel_settlement(target_settlement uuid)
returns public.settlements
language plpgsql security definer set search_path = '' as $$
declare
  target public.settlements;
  changed public.settlements;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into target from public.settlements where id=target_settlement for update;
  if target.id is null then raise exception 'settlement_not_found' using errcode='P0002'; end if;
  if target.creditor_id <> auth.uid() then raise exception 'settlement_permission_denied' using errcode='42501'; end if;
  if target.status not in ('open','marked_paid') then raise exception 'settlement_state_conflict' using errcode='P0001'; end if;

  update public.settlements set status='cancelled', cancelled_at=now()
  where id=target_settlement returning * into changed;
  insert into public.notifications(group_id,user_id,actor_id,list_id,type,title,body)
  values(target.group_id,target.debtor_id,auth.uid(),target.shopping_list_id,'settlement_cancelled','Arveldus tühistatud',
    'Arveldus '||replace(to_char(target.amount,'FM9999999990.00'),'.',',')||' € tühistati.');
  return changed;
end $$;

revoke all on function public.create_settlement(uuid,uuid,numeric,text,uuid), public.mark_settlement_paid(uuid), public.confirm_settlement_paid(uuid), public.cancel_settlement(uuid) from public, anon;
grant execute on function public.create_settlement(uuid,uuid,numeric,text,uuid), public.mark_settlement_paid(uuid), public.confirm_settlement_paid(uuid), public.cancel_settlement(uuid) to authenticated;

alter publication supabase_realtime add table public.settlements;
