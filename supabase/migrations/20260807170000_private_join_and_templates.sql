-- Privaatne nime järgi liitumine, grupi turvakood ja püsivad kategooriamallid.
alter table public.deliveries alter column departure_time drop not null;

create table public.category_templates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  name text not null check (length(trim(name)) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(group_id, name)
);
create trigger set_updated_at before update on public.category_templates for each row execute function public.set_updated_at();
alter table public.category_templates enable row level security;
create policy category_templates_group_read on public.category_templates for select to authenticated using (public.is_group_member(group_id));
create policy category_templates_manager_write on public.category_templates for all to authenticated using (public.is_group_manager(group_id)) with check (public.is_group_manager(group_id) and created_by=auth.uid());

insert into public.category_templates(group_id,created_by,name,sort_order)
select sl.group_id, sl.created_by, c.name, min(c.sort_order)
from public.categories c join public.shopping_lists sl on sl.id=c.list_id
group by sl.group_id,sl.created_by,c.name on conflict(group_id,name) do nothing;

create table public.group_access_codes (
  group_id uuid primary key references public.groups(id) on delete cascade,
  code_hash text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.group_access_codes for each row execute function public.set_updated_at();
alter table public.group_access_codes enable row level security;
create policy access_codes_admin_read on public.group_access_codes for select to authenticated using (public.is_group_manager(group_id));

create function public.set_group_security_code(target_group uuid, new_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_group_manager(target_group) then raise exception 'admin_required' using errcode='42501'; end if;
  if length(trim(new_code)) < 6 then raise exception 'code_too_short' using errcode='22023'; end if;
  insert into public.group_access_codes(group_id,code_hash,created_by)
    values(target_group,extensions.crypt(trim(new_code),extensions.gen_salt('bf')),auth.uid())
    on conflict(group_id) do update set code_hash=excluded.code_hash,created_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.set_group_security_code(uuid,text) from public;
grant execute on function public.set_group_security_code(uuid,text) to authenticated;

create function public.redeem_group_code(supplied_code text, supplied_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare matched_group uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if length(trim(supplied_name)) < 2 then raise exception 'name_too_short' using errcode='22023'; end if;
  select group_id into matched_group from public.group_access_codes where code_hash=extensions.crypt(trim(supplied_code),code_hash) limit 1;
  if matched_group is null then raise exception 'invalid_security_code' using errcode='P0001'; end if;
  update public.profiles set display_name=trim(supplied_name) where id=auth.uid();
  insert into public.group_members(group_id,profile_id,role) values(matched_group,auth.uid(),'buyer') on conflict(group_id,profile_id) do nothing;
  return matched_group;
end $$;
revoke all on function public.redeem_group_code(text,text) from public;
grant execute on function public.redeem_group_code(text,text) to authenticated;

alter publication supabase_realtime add table public.category_templates;
