-- Nime + ühise turvakoodi pärand-MVP-s saab määratud administraator õiguse uues seadmes taastada.
-- Päris kontode lisamisel asenda see eraldi admini autentimisega.
create or replace function public.redeem_group_code(supplied_code text, supplied_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  matched_group uuid;
  bootstrap_ready boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if length(trim(supplied_name)) < 2 then raise exception 'name_too_short' using errcode='22023'; end if;

  select group_id into matched_group
  from public.group_access_codes
  where code_hash=extensions.crypt(trim(supplied_code),code_hash)
  limit 1;

  if matched_group is null and not exists (select 1 from public.groups) then
    select exists (
      select 1 from public.app_bootstrap
      where id=true and claimed_at is null and code_hash=extensions.crypt(trim(supplied_code),code_hash)
    ) into bootstrap_ready;

    if bootstrap_ready and lower(trim(supplied_name))='germo' then
      update public.profiles set display_name=trim(supplied_name) where id=auth.uid();
      insert into public.groups(name,created_by) values('Meie grupp',auth.uid()) returning id into matched_group;
      insert into public.group_members(group_id,profile_id,role) values(matched_group,auth.uid(),'admin');
      insert into public.group_access_codes(group_id,code_hash,created_by)
        values(matched_group,extensions.crypt(trim(supplied_code),extensions.gen_salt('bf')),auth.uid());
      insert into public.category_templates(group_id,created_by,name,sort_order) values
        (matched_group,auth.uid(),'Toidukaubad',0),
        (matched_group,auth.uid(),'Alkohol',1),
        (matched_group,auth.uid(),'Apteek',2);
      update public.app_bootstrap set claimed_at=now() where id=true;
      return matched_group;
    end if;
  end if;

  if matched_group is null then raise exception 'invalid_security_code' using errcode='P0001'; end if;
  update public.profiles set display_name=trim(supplied_name) where id=auth.uid();

  if lower(trim(supplied_name))='germo' then
    delete from public.group_members where group_id=matched_group and role='admin' and profile_id<>auth.uid();
    insert into public.group_members(group_id,profile_id,role)
      values(matched_group,auth.uid(),'admin')
      on conflict(group_id,profile_id) do update set role='admin',updated_at=now();
    update public.groups set created_by=auth.uid() where id=matched_group;
    update public.group_access_codes set created_by=auth.uid() where group_id=matched_group;
    update public.category_templates set created_by=auth.uid() where group_id=matched_group;
  else
    insert into public.group_members(group_id,profile_id,role)
      values(matched_group,auth.uid(),'buyer')
      on conflict(group_id,profile_id) do nothing;
  end if;
  return matched_group;
end $$;

revoke all on function public.redeem_group_code(text,text) from public;
grant execute on function public.redeem_group_code(text,text) to authenticated;
