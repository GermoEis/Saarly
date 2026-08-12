-- Grupi haldamine: nime muutmine, liikme turvaline eemaldamine ja Realtime.
create function public.remove_group_member(target_group uuid, target_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_role public.group_role;
  released record;
begin
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group and gm.profile_id = auth.uid() and gm.role = 'admin'
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  select gm.role into target_role
  from public.group_members gm
  where gm.group_id = target_group and gm.profile_id = target_user;

  if target_role is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if target_role <> 'buyer' then
    raise exception 'protected_member' using errcode = '42501';
  end if;

  -- Kõik vabastamised ja liikme eemaldamine toimuvad samas tehingus.
  for released in
    select i.id, i.list_id, i.name, i.created_by, i.status
    from public.items i
    join public.shopping_lists sl on sl.id = i.list_id
    where sl.group_id = target_group
      and i.assigned_to = target_user
      and i.status in ('assigned', 'accepted')
    for update of i
  loop
    update public.item_assignments
      set status = 'released'
      where item_id = released.id and user_id = target_user and status in ('pending', 'accepted');

    update public.items
      set assigned_to = null, status = 'unassigned'
      where id = released.id;

    insert into public.activity_log(group_id, actor_id, list_id, item_id, action, previous_status, new_status, explanation)
      values(target_group, auth.uid(), released.list_id, released.id, 'Eemaldas kasutaja ja vabastas toote', released.status, 'unassigned', 'Kasutaja eemaldati grupist.');

    if released.created_by <> auth.uid() then
      insert into public.notifications(group_id, user_id, actor_id, list_id, item_id, type, title, body)
        values(target_group, released.created_by, auth.uid(), released.list_id, released.id, 'member_removed_item_released', 'Toode liikus jooksvasse listi', 'Toode „' || released.name || '“ vabastati, sest kasutaja eemaldati grupist.');
    end if;
  end loop;

  delete from public.group_members
  where group_id = target_group and profile_id = target_user;
end $$;

revoke all on function public.remove_group_member(uuid, uuid) from public;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

alter publication supabase_realtime add table public.groups, public.group_members;
