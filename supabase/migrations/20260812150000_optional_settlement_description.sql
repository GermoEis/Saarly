-- Arvelduse selgitus on valikuline. Tühja selgituse korral teavitusse
-- üleliigset koolonit ei lisata.
alter table public.settlements
  drop constraint if exists settlements_description_check;

alter table public.settlements
  alter column description set default '',
  add constraint settlements_description_check check (length(trim(description)) <= 240);

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
  clean_description text := trim(coalesce(settlement_description,''));
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not public.is_group_member(target_group) then raise exception 'group_member_required' using errcode='42501'; end if;
  if target_debtor = auth.uid() then raise exception 'debtor_must_be_another_user' using errcode='22023'; end if;
  if not exists(select 1 from public.group_members gm where gm.group_id=target_group and gm.profile_id=target_debtor) then
    raise exception 'debtor_not_group_member' using errcode='42501';
  end if;
  if amount_value is null or amount_value <= 0 then raise exception 'invalid_amount' using errcode='22023'; end if;
  if length(clean_description) > 240 then raise exception 'description_too_long' using errcode='22001'; end if;
  if target_list is not null and not exists(select 1 from public.shopping_lists sl where sl.id=target_list and sl.group_id=target_group) then
    raise exception 'list_not_in_group' using errcode='42501';
  end if;

  insert into public.settlements(group_id, created_by, creditor_id, debtor_id, amount, description, shopping_list_id)
  values(target_group, auth.uid(), auth.uid(), target_debtor, amount_value, clean_description, target_list)
  returning * into changed;

  select display_name into creditor_name from public.profiles where id=auth.uid();
  insert into public.notifications(group_id,user_id,actor_id,list_id,type,title,body)
  values(target_group,target_debtor,auth.uid(),target_list,'settlement_created','Uus arveldus',
    coalesce(creditor_name,'Kasutaja')||' lisas sulle arvelduse '||replace(to_char(amount_value,'FM9999999990.00'),'.',',')||' €'||
    case when length(clean_description) > 0 then ': '||clean_description else '' end||'.');
  return changed;
end $$;

revoke all on function public.create_settlement(uuid,uuid,numeric,text,uuid) from public, anon;
grant execute on function public.create_settlement(uuid,uuid,numeric,text,uuid) to authenticated;
