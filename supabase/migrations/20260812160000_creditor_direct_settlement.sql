-- Raha saaja võib märkida avatud arvelduse kohe tasutuks. Võlgniku
-- „Märgi makstuks“ ja raha saaja kinnituse kaheastmeline voog jääb samuti alles.
create or replace function public.confirm_settlement_paid(target_settlement uuid)
returns public.settlements
language plpgsql security definer set search_path = '' as $$
declare
  target public.settlements;
  changed public.settlements;
  creditor_name text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into target from public.settlements where id=target_settlement for update;
  if target.id is null then raise exception 'settlement_not_found' using errcode='P0002'; end if;
  if target.creditor_id <> auth.uid() then raise exception 'settlement_permission_denied' using errcode='42501'; end if;
  if target.status not in ('open','marked_paid') then raise exception 'settlement_state_conflict' using errcode='P0001'; end if;

  update public.settlements set status='paid', confirmed_at=now()
  where id=target_settlement returning * into changed;
  select display_name into creditor_name from public.profiles where id=auth.uid();
  insert into public.notifications(group_id,user_id,actor_id,list_id,type,title,body)
  values(target.group_id,target.debtor_id,auth.uid(),target.shopping_list_id,'settlement_paid','Tasumine kinnitatud',
    case when target.status='open'
      then coalesce(creditor_name,'Kasutaja')||' märkis arvelduse '||replace(to_char(target.amount,'FM9999999990.00'),'.',',')||' € tasutuks.'
      else 'Arveldus '||replace(to_char(target.amount,'FM9999999990.00'),'.',',')||' € on kinnitatud tasutuks.' end);
  return changed;
end $$;

revoke all on function public.confirm_settlement_paid(uuid) from public, anon;
grant execute on function public.confirm_settlement_paid(uuid) to authenticated;
