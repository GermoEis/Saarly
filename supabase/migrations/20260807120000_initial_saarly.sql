-- Saarly algskeem. Käivita Supabase CLI-ga: supabase db push
create extension if not exists pgcrypto;

create type public.group_role as enum ('creator', 'buyer', 'admin');
create type public.item_status as enum ('unassigned', 'assigned', 'accepted', 'purchased', 'unavailable', 'delivered', 'cancelled');
create type public.assignment_status as enum ('pending', 'accepted', 'declined', 'released');
create type public.delivery_status as enum ('planned', 'delivered');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 80),
  avatar_color text not null default '#176B4D',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.groups (
  id uuid primary key default gen_random_uuid(), name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.group_members (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade, role public.group_role not null default 'buyer',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(group_id, profile_id)
);
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id), name text not null, description text, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(list_id, name)
);
create table public.items (
  id uuid primary key default gen_random_uuid(), list_id uuid not null references public.shopping_lists(id) on delete cascade,
  category_id uuid not null references public.categories(id), created_by uuid not null references public.profiles(id),
  name text not null, quantity numeric(10,2) not null default 1 check (quantity > 0), unit text, note text,
  assigned_to uuid references public.profiles(id), status public.item_status not null default 'unassigned',
  searched_before boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((status in ('unassigned','unavailable','cancelled') and assigned_to is null) or status not in ('unassigned','unavailable','cancelled'))
);
create table public.item_assignments (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references public.profiles(id), assigned_by uuid not null references public.profiles(id),
  status public.assignment_status not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.item_attempts (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references public.profiles(id), outcome text not null check (outcome = 'not_found'), note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.deliveries (
  id uuid primary key default gen_random_uuid(), list_id uuid not null references public.shopping_lists(id) on delete cascade,
  created_by uuid not null references public.profiles(id), courier_id uuid not null references public.profiles(id),
  ship_name text not null, departure_date date not null, departure_time time not null, port text not null,
  handover_place text not null, note text, status public.delivery_status not null default 'planned',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.delivery_items (
  id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.deliveries(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(delivery_id, item_id)
);
create table public.notes (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id), title text not null, content text not null, phone text, url text,
  image_url text, pinned boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, actor_id uuid references public.profiles(id),
  list_id uuid references public.shopping_lists(id) on delete cascade, item_id uuid references public.items(id) on delete cascade,
  type text not null, title text not null, body text not null, read_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.activity_log (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid not null references public.profiles(id), list_id uuid references public.shopping_lists(id) on delete cascade,
  item_id uuid references public.items(id) on delete cascade, action text not null,
  previous_status public.item_status, new_status public.item_status, explanation text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.item_images (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.items(id) on delete cascade,
  created_by uuid not null references public.profiles(id), storage_path text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique, platform text not null check (platform in ('ios','android','web')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index items_list_idx on public.items(list_id);
create index items_floating_idx on public.items(list_id, status) where assigned_to is null;
create index notifications_user_idx on public.notifications(user_id, read_at, created_at desc);
create index activity_item_idx on public.activity_log(item_id, created_at);
create index members_profile_idx on public.group_members(profile_id, group_id);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name) values(new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(coalesce(new.email,'Kasutaja'),'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['profiles','groups','group_members','shopping_lists','categories','items','item_assignments','item_attempts','deliveries','delivery_items','notes','notifications','activity_log','item_images','push_tokens'] loop execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t); end loop; end $$;

-- Turvalisuse abifunktsioonid väldivad RLS-i rekursiooni.
create function public.is_group_member(target_group uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_members gm where gm.group_id = target_group and gm.profile_id = auth.uid())
$$;
create function public.is_group_manager(target_group uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_members gm where gm.group_id = target_group and gm.profile_id = auth.uid() and gm.role in ('creator','admin'))
$$;
create function public.list_group(target_list uuid) returns uuid language sql stable security definer set search_path = '' as $$
  select group_id from public.shopping_lists where id = target_list
$$;
create function public.item_group(target_item uuid) returns uuid language sql stable security definer set search_path = '' as $$
  select sl.group_id from public.items i join public.shopping_lists sl on sl.id=i.list_id where i.id = target_item
$$;
revoke all on function public.is_group_member(uuid), public.is_group_manager(uuid), public.list_group(uuid), public.item_group(uuid) from public;
grant execute on function public.is_group_member(uuid), public.is_group_manager(uuid), public.list_group(uuid), public.item_group(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.item_assignments enable row level security;
alter table public.item_attempts enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;
alter table public.notes enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;
alter table public.item_images enable row level security;
alter table public.push_tokens enable row level security;

create policy profiles_group_read on public.profiles for select to authenticated using (id=auth.uid() or exists(select 1 from public.group_members mine join public.group_members theirs on theirs.group_id=mine.group_id where mine.profile_id=auth.uid() and theirs.profile_id=profiles.id));
create policy profiles_own_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy groups_member_read on public.groups for select to authenticated using (public.is_group_member(id));
create policy groups_owner_insert on public.groups for insert to authenticated with check (created_by=auth.uid());
create policy groups_manager_update on public.groups for update to authenticated using (public.is_group_manager(id)) with check (public.is_group_manager(id));
create policy members_group_read on public.group_members for select to authenticated using (public.is_group_member(group_id));
create policy members_manager_write on public.group_members for all to authenticated using (public.is_group_manager(group_id)) with check (public.is_group_manager(group_id));
create policy members_first_owner_insert on public.group_members for insert to authenticated with check (profile_id=auth.uid() and role in ('creator','admin') and exists(select 1 from public.groups g where g.id=group_id and g.created_by=auth.uid()));
create policy lists_group_read on public.shopping_lists for select to authenticated using (public.is_group_member(group_id));
create policy lists_member_create on public.shopping_lists for insert to authenticated with check (public.is_group_member(group_id) and created_by=auth.uid());
create policy lists_creator_update on public.shopping_lists for update to authenticated using (created_by=auth.uid() or public.is_group_manager(group_id)) with check (created_by=auth.uid() or public.is_group_manager(group_id));
create policy lists_creator_delete on public.shopping_lists for delete to authenticated using (created_by=auth.uid() or public.is_group_manager(group_id));
create policy categories_group_read on public.categories for select to authenticated using (public.is_group_member(public.list_group(list_id)));
create policy categories_manager_write on public.categories for all to authenticated using (public.is_group_manager(public.list_group(list_id))) with check (public.is_group_manager(public.list_group(list_id)));
create policy items_group_read on public.items for select to authenticated using (public.is_group_member(public.list_group(list_id)));
create policy items_manager_insert on public.items for insert to authenticated with check (public.is_group_manager(public.list_group(list_id)) and created_by=auth.uid());
create policy items_manager_update on public.items for update to authenticated using (public.is_group_manager(public.list_group(list_id))) with check (public.is_group_manager(public.list_group(list_id)));
create policy items_manager_delete on public.items for delete to authenticated using (public.is_group_manager(public.list_group(list_id)));
-- Viija toote olekumuudatused tehakse allolevate SECURITY DEFINER RPC-de kaudu, mitte piiramatu tabeli UPDATE-iga.
create policy assignments_group_read on public.item_assignments for select to authenticated using (public.is_group_member(public.item_group(item_id)));
create policy assignments_manager_insert on public.item_assignments for insert to authenticated with check (public.is_group_manager(public.item_group(item_id)) and assigned_by=auth.uid());
create policy attempts_group_read on public.item_attempts for select to authenticated using (public.is_group_member(public.item_group(item_id)));
create policy deliveries_group_read on public.deliveries for select to authenticated using (public.is_group_member(public.list_group(list_id)));
create policy deliveries_courier_write on public.deliveries for all to authenticated using (courier_id=auth.uid() and public.is_group_member(public.list_group(list_id))) with check (courier_id=auth.uid() and created_by=auth.uid() and public.is_group_member(public.list_group(list_id)));
create policy delivery_items_group_read on public.delivery_items for select to authenticated using (exists(select 1 from public.deliveries d where d.id=delivery_id and public.is_group_member(public.list_group(d.list_id))));
create policy delivery_items_courier_write on public.delivery_items for all to authenticated using (exists(select 1 from public.deliveries d where d.id=delivery_id and d.courier_id=auth.uid())) with check (exists(select 1 from public.deliveries d where d.id=delivery_id and d.courier_id=auth.uid()));
create policy notes_group_read on public.notes for select to authenticated using (public.is_group_member(group_id));
create policy notes_group_write on public.notes for all to authenticated using (created_by=auth.uid() and public.is_group_member(group_id)) with check (created_by=auth.uid() and public.is_group_member(group_id));
create policy notifications_own_read on public.notifications for select to authenticated using (user_id=auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy activity_group_read on public.activity_log for select to authenticated using (public.is_group_member(group_id));
create policy images_group_read on public.item_images for select to authenticated using (public.is_group_member(public.item_group(item_id)));
create policy images_manager_write on public.item_images for all to authenticated using (created_by=auth.uid() and public.is_group_member(public.item_group(item_id))) with check (created_by=auth.uid() and public.is_group_member(public.item_group(item_id)));
create policy push_tokens_own on public.push_tokens for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Atomaarne ujuva toote võtmine: UPDATE õnnestub ainult siis, kui rida on veel vaba.
create function public.claim_floating_item(target_item uuid) returns public.items
language plpgsql security definer set search_path = '' as $$
declare claimed public.items; target_group uuid;
begin
  target_group := public.item_group(target_item);
  if not public.is_group_member(target_group) then raise exception 'not_a_group_member' using errcode='42501'; end if;
  update public.items set assigned_to=auth.uid(), status='accepted', updated_at=now()
    where id=target_item and assigned_to is null and status in ('unassigned','unavailable') returning * into claimed;
  if claimed.id is null then raise exception 'item_already_claimed' using errcode='P0001'; end if;
  insert into public.item_assignments(item_id,user_id,assigned_by,status) values(target_item,auth.uid(),auth.uid(),'accepted');
  insert into public.activity_log(group_id,actor_id,list_id,item_id,action,new_status)
    values(target_group,auth.uid(),claimed.list_id,target_item,'Võttis ujuva toote endale','accepted');
  insert into public.notifications(group_id,user_id,actor_id,list_id,item_id,type,title,body)
    select target_group,claimed.created_by,auth.uid(),claimed.list_id,target_item,'item_claimed','Toode võeti endale','Teine viija võttis toote „'||claimed.name||'“.' where claimed.created_by<>auth.uid();
  return claimed;
end $$;
revoke all on function public.claim_floating_item(uuid) from public;
grant execute on function public.claim_floating_item(uuid) to authenticated;

create function public.respond_to_assignment(target_item uuid, accept boolean) returns public.items
language plpgsql security definer set search_path = '' as $$
declare changed public.items; old_status public.item_status; action_name text;
begin
  select status into old_status from public.items where id=target_item and assigned_to=auth.uid() for update;
  if old_status is null then raise exception 'not_assigned_to_you' using errcode='42501'; end if;
  if accept then update public.items set status='accepted' where id=target_item returning * into changed; action_name := 'Võttis ülesande vastu';
  else update public.items set status='unassigned',assigned_to=null where id=target_item returning * into changed; action_name := 'Keeldus tootest'; end if;
  update public.item_assignments set status=case when accept then 'accepted'::public.assignment_status else 'declined'::public.assignment_status end where item_id=target_item and user_id=auth.uid() and status='pending';
  insert into public.activity_log(group_id,actor_id,list_id,item_id,action,previous_status,new_status) values(public.item_group(target_item),auth.uid(),changed.list_id,target_item,action_name,old_status,changed.status);
  insert into public.notifications(group_id,user_id,actor_id,list_id,item_id,type,title,body)
    select public.item_group(target_item),changed.created_by,auth.uid(),changed.list_id,target_item,case when accept then 'item_accepted' else 'item_declined' end,case when accept then 'Ülesanne võeti vastu' else 'Tootest keelduti' end,case when accept then 'Viija võttis toote „'||changed.name||'“ vastu.' else 'Viija ei saa toodet „'||changed.name||'“ võtta. Toode on jälle ujuv.' end where changed.created_by<>auth.uid();
  return changed;
end $$;
revoke all on function public.respond_to_assignment(uuid,boolean) from public; grant execute on function public.respond_to_assignment(uuid,boolean) to authenticated;

create function public.mark_item_unavailable(target_item uuid, attempt_note text default null) returns public.items
language plpgsql security definer set search_path = '' as $$
declare changed public.items; old_status public.item_status;
begin
  select status into old_status from public.items where id=target_item and assigned_to=auth.uid() for update;
  if old_status is null then raise exception 'not_assigned_to_you' using errcode='42501'; end if;
  insert into public.item_attempts(item_id,user_id,outcome,note) values(target_item,auth.uid(),'not_found',attempt_note);
  update public.items set status='unassigned',assigned_to=null,searched_before=true where id=target_item returning * into changed;
  insert into public.activity_log(group_id,actor_id,list_id,item_id,action,previous_status,new_status,explanation) values(public.item_group(target_item),auth.uid(),changed.list_id,target_item,'Ei leidnud toodet poest',old_status,'unassigned',attempt_note);
  insert into public.notifications(group_id,user_id,actor_id,list_id,item_id,type,title,body)
    select public.item_group(target_item),changed.created_by,auth.uid(),changed.list_id,target_item,'item_unavailable','Toodet ei olnud poes','Toodet „'||changed.name||'“ ei olnud poes ja see on jälle ujuv.' where changed.created_by<>auth.uid();
  return changed;
end $$;
revoke all on function public.mark_item_unavailable(uuid,text) from public; grant execute on function public.mark_item_unavailable(uuid,text) to authenticated;

create function public.set_item_status(target_item uuid, target_status public.item_status) returns public.items
language plpgsql security definer set search_path = '' as $$
declare changed public.items; old_status public.item_status; action_name text;
begin
  if target_status not in ('purchased','delivered') then raise exception 'unsupported_status' using errcode='22023'; end if;
  select status into old_status from public.items where id=target_item and assigned_to=auth.uid() for update;
  if old_status is null then raise exception 'not_assigned_to_you' using errcode='42501'; end if;
  update public.items set status=target_status where id=target_item returning * into changed;
  action_name := case when target_status='purchased' then 'Märkis toote ostetuks' else 'Märkis toote laevale viiduks' end;
  insert into public.activity_log(group_id,actor_id,list_id,item_id,action,previous_status,new_status) values(public.item_group(target_item),auth.uid(),changed.list_id,target_item,action_name,old_status,target_status);
  insert into public.notifications(group_id,user_id,actor_id,list_id,item_id,type,title,body)
    select public.item_group(target_item),changed.created_by,auth.uid(),changed.list_id,target_item,case when target_status='purchased' then 'item_purchased' else 'item_delivered' end,case when target_status='purchased' then 'Toode ostetud' else 'Kaup laevale viidud' end,'Toote „'||changed.name||'“ olek muutus: '||target_status::text where changed.created_by<>auth.uid();
  return changed;
end $$;
revoke all on function public.set_item_status(uuid,public.item_status) from public; grant execute on function public.set_item_status(uuid,public.item_status) to authenticated;

create function public.notify_item_inserted() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_group uuid;
begin
  target_group := public.list_group(new.list_id);
  insert into public.notifications(group_id,user_id,actor_id,list_id,item_id,type,title,body)
    select target_group,gm.profile_id,new.created_by,new.list_id,new.id,'item_added','Uus toode','Nimekirja lisati „'||new.name||'“.' from public.group_members gm where gm.group_id=target_group and gm.profile_id<>new.created_by;
  return new;
end $$;
create trigger notify_item_insert after insert on public.items for each row execute function public.notify_item_inserted();

create function public.notify_assignment_inserted() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_item public.items; target_group uuid;
begin
  select * into target_item from public.items where id=new.item_id; target_group := public.item_group(new.item_id);
  if new.user_id<>new.assigned_by then insert into public.notifications(group_id,user_id,actor_id,list_id,item_id,type,title,body) values(target_group,new.user_id,new.assigned_by,target_item.list_id,new.item_id,'item_assigned','Uus ülesanne','Sulle määrati toode „'||target_item.name||'“.'); end if;
  return new;
end $$;
create trigger notify_assignment_insert after insert on public.item_assignments for each row when (new.status='pending') execute function public.notify_assignment_inserted();

create function public.sync_manager_assignment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and new.status='assigned' and (tg_op='INSERT' or old.assigned_to is distinct from new.assigned_to) then
    update public.item_assignments set status='released' where item_id=new.id and status in ('pending','accepted');
    insert into public.item_assignments(item_id,user_id,assigned_by,status) values(new.id,new.assigned_to,auth.uid(),'pending');
  end if;
  return new;
end $$;
create trigger sync_manager_assignment after insert or update of assigned_to on public.items for each row execute function public.sync_manager_assignment();

create function public.notify_delivery_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_list public.shopping_lists; actor_name text;
begin
  select * into target_list from public.shopping_lists where id=new.list_id; select display_name into actor_name from public.profiles where id=new.courier_id;
  if target_list.created_by<>new.courier_id then insert into public.notifications(group_id,user_id,actor_id,list_id,type,title,body) values(target_list.group_id,target_list.created_by,new.courier_id,new.list_id,case when new.status='delivered' then 'delivery_completed' else 'delivery_updated' end,case when new.status='delivered' then 'Kaubad laevale viidud' else 'Laevainfo muudetud' end,case when new.status='delivered' then actor_name||' märkis kaubad laevale viiduks.' else actor_name||' viib kaubad '||to_char(new.departure_date,'DD.MM.YYYY')||' kell '||to_char(new.departure_time,'HH24.MI')||' laevale '||new.ship_name||'. Kaubad antakse üle '||new.handover_place||'.' end); end if;
  return new;
end $$;
create trigger notify_delivery after insert or update of ship_name,departure_date,departure_time,port,handover_place,status on public.deliveries for each row execute function public.notify_delivery_change();

-- Realtime: kliendid filtreerivad sündmusi list_id / group_id alusel, RLS kehtib ka lugemisel.
alter publication supabase_realtime add table public.shopping_lists, public.categories, public.items, public.item_assignments, public.item_attempts, public.deliveries, public.notifications, public.activity_log;

-- Privaatne Storage bucket; objekti esimene kaust peab olema group_id.
insert into storage.buckets(id,name,public) values('item-images','item-images',false) on conflict(id) do nothing;
create policy item_images_member_read on storage.objects for select to authenticated using (bucket_id='item-images' and public.is_group_member((storage.foldername(name))[1]::uuid));
create policy item_images_member_insert on storage.objects for insert to authenticated with check (bucket_id='item-images' and public.is_group_member((storage.foldername(name))[1]::uuid));
create policy item_images_owner_update on storage.objects for update to authenticated using (bucket_id='item-images' and owner_id=auth.uid()::text) with check (bucket_id='item-images' and owner_id=auth.uid()::text);
create policy item_images_owner_delete on storage.objects for delete to authenticated using (bucket_id='item-images' and owner_id=auth.uid()::text);
