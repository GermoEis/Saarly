-- Grupist eemaldatud kasutaja ei saa varem teada olnud arvelduse ID-ga
-- SECURITY DEFINER RPC kaudu enam olekut muuta.
create or replace function public.guard_settlement_group_membership()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_group_member(old.group_id) then
    raise exception 'group_member_required' using errcode='42501';
  end if;
  return new;
end $$;

create trigger guard_settlement_group_membership
before update on public.settlements
for each row execute function public.guard_settlement_group_membership();
