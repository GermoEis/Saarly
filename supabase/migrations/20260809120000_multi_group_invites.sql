-- Mitme grupi tugi: konto loomine on grupist sõltumatu ning gruppi liitutakse
-- administraatori loodud ühekordse ja aeguva kutsekoodiga.
create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  invitee_name text,
  code_digest text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (invitee_name is null or length(trim(invitee_name)) between 1 and 80)
);

create index group_invites_group_idx on public.group_invites(group_id, created_at desc);
create trigger set_updated_at before update on public.group_invites
for each row execute function public.set_updated_at();

alter table public.group_invites enable row level security;

create policy group_invites_admin_read on public.group_invites
for select to authenticated
using (public.is_group_manager(group_id));

create or replace function public.create_group(group_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  new_group_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if length(trim(group_name)) < 2 then raise exception 'group_name_too_short' using errcode='22023'; end if;
  if length(trim(group_name)) > 80 then raise exception 'group_name_too_long' using errcode='22023'; end if;
  if not exists (select 1 from public.profiles where id=auth.uid()) then
    raise exception 'profile_not_found' using errcode='P0002';
  end if;

  insert into public.groups(name, created_by)
    values(trim(group_name), auth.uid())
    returning id into new_group_id;

  insert into public.group_members(group_id, profile_id, role)
    values(new_group_id, auth.uid(), 'admin');

  insert into public.category_templates(group_id, created_by, name, sort_order) values
    (new_group_id, auth.uid(), 'Toidukaubad', 0),
    (new_group_id, auth.uid(), 'Alkohol', 1),
    (new_group_id, auth.uid(), 'Apteek', 2);

  return new_group_id;
end $$;

create or replace function public.create_group_invite(target_group uuid, supplied_invitee_name text default null)
returns table(invite_id uuid, invite_code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  raw_random text;
  raw_code text;
  normalized_code text;
  invitation_id uuid;
  expiration timestamptz := now() + interval '30 days';
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not public.is_group_manager(target_group) then raise exception 'admin_required' using errcode='42501'; end if;
  if supplied_invitee_name is not null and length(trim(supplied_invitee_name)) < 1 then supplied_invitee_name := null; end if;

  loop
    raw_random := upper(encode(extensions.gen_random_bytes(8), 'hex'));
    raw_code := 'SAARLY-' || substr(raw_random, 1, 4) || '-' || substr(raw_random, 5, 4) || '-' || substr(raw_random, 9, 4) || '-' || substr(raw_random, 13, 4);
    normalized_code := regexp_replace(upper(raw_code), '[^A-Z0-9]', '', 'g');
    begin
      insert into public.group_invites(group_id, created_by, invitee_name, code_digest, expires_at)
        values(target_group, auth.uid(), nullif(trim(supplied_invitee_name), ''), encode(extensions.digest(normalized_code, 'sha256'), 'hex'), expiration)
        returning id into invitation_id;
      exit;
    exception when unique_violation then
      -- Väga ebatõenäolise koodikokkupõrke korral loo uus kood.
    end;
  end loop;

  return query select invitation_id, raw_code, expiration;
end $$;

create or replace function public.redeem_group_invite(invite_code text, supplied_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  matched public.group_invites%rowtype;
  normalized_code text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if length(trim(supplied_name)) < 2 then raise exception 'name_too_short' using errcode='22023'; end if;
  normalized_code := regexp_replace(upper(trim(invite_code)), '[^A-Z0-9]', '', 'g');

  select * into matched
  from public.group_invites
  where code_digest=encode(extensions.digest(normalized_code, 'sha256'), 'hex')
  for update;

  if matched.id is null then raise exception 'invalid_invite_code' using errcode='P0001'; end if;
  if matched.revoked_at is not null then raise exception 'invite_revoked' using errcode='P0001'; end if;
  if matched.used_at is not null then raise exception 'invite_used' using errcode='P0001'; end if;
  if matched.expires_at < now() then raise exception 'invite_expired' using errcode='P0001'; end if;

  if exists (
    select 1 from public.group_members
    where group_id=matched.group_id and profile_id=auth.uid()
  ) then
    return matched.group_id;
  end if;

  update public.profiles set display_name=trim(supplied_name) where id=auth.uid();
  insert into public.group_members(group_id, profile_id, role)
    values(matched.group_id, auth.uid(), 'buyer');
  update public.group_invites set used_at=now(), used_by=auth.uid() where id=matched.id;
  return matched.group_id;
end $$;

create or replace function public.revoke_group_invite(target_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_group uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select group_id into target_group from public.group_invites where id=target_invite;
  if target_group is null then raise exception 'invite_not_found' using errcode='P0002'; end if;
  if not public.is_group_manager(target_group) then raise exception 'admin_required' using errcode='42501'; end if;
  update public.group_invites set revoked_at=coalesce(revoked_at, now()) where id=target_invite and used_at is null;
end $$;

revoke all on function public.create_group(text), public.create_group_invite(uuid,text), public.redeem_group_invite(text,text), public.revoke_group_invite(uuid) from public, anon;
grant execute on function public.create_group(text), public.create_group_invite(uuid,text), public.redeem_group_invite(text,text), public.revoke_group_invite(uuid) to authenticated;

alter publication supabase_realtime add table public.group_invites;
