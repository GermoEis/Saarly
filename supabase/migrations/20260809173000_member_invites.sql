-- Kõik grupiliikmed võivad saata kutseid. Kutset saab tühistada selle looja
-- või grupi administraator.

drop policy if exists group_invites_admin_read on public.group_invites;
drop policy if exists group_invites_member_read on public.group_invites;
create policy group_invites_member_read on public.group_invites
for select to authenticated
using (public.is_group_member(group_id));

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
  if not public.is_group_member(target_group) then raise exception 'group_member_required' using errcode='42501'; end if;
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

create or replace function public.revoke_group_invite(target_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_group uuid;
  invite_creator uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select group_id, created_by into target_group, invite_creator
  from public.group_invites where id=target_invite;
  if target_group is null then raise exception 'invite_not_found' using errcode='P0002'; end if;
  if invite_creator <> auth.uid() and not public.is_group_manager(target_group) then
    raise exception 'invite_permission_denied' using errcode='42501';
  end if;
  update public.group_invites
  set revoked_at=coalesce(revoked_at, now())
  where id=target_invite and used_at is null;
end $$;

revoke all on function public.create_group_invite(uuid,text), public.revoke_group_invite(uuid) from public, anon;
grant execute on function public.create_group_invite(uuid,text), public.revoke_group_invite(uuid) to authenticated;
