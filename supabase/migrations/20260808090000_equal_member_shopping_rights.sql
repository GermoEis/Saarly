-- Kõigil grupiliikmetel on ostunimekirjade ja ühise sisu haldamisel võrdsed õigused.
-- Administraatori eriõigused jäävad ainult grupi nime, turvakoodi ja liikmete haldamiseks.

drop policy if exists lists_creator_update on public.shopping_lists;
drop policy if exists lists_creator_delete on public.shopping_lists;
create policy lists_member_update on public.shopping_lists for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));
create policy lists_member_delete on public.shopping_lists for delete to authenticated
  using (public.is_group_member(group_id));

drop policy if exists categories_manager_write on public.categories;
create policy categories_member_write on public.categories for all to authenticated
  using (public.is_group_member(public.list_group(list_id)))
  with check (public.is_group_member(public.list_group(list_id)));

drop policy if exists items_manager_insert on public.items;
drop policy if exists items_manager_update on public.items;
drop policy if exists items_manager_delete on public.items;
create policy items_member_insert on public.items for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(public.list_group(list_id)));
create policy items_member_update on public.items for update to authenticated
  using (public.is_group_member(public.list_group(list_id)))
  with check (public.is_group_member(public.list_group(list_id)));
create policy items_member_delete on public.items for delete to authenticated
  using (public.is_group_member(public.list_group(list_id)));

drop policy if exists assignments_manager_insert on public.item_assignments;
create policy assignments_member_insert on public.item_assignments for insert to authenticated
  with check (
    assigned_by = auth.uid()
    and public.is_group_member(public.item_group(item_id))
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = public.item_group(item_id) and gm.profile_id = user_id
    )
  );

drop policy if exists category_templates_manager_write on public.category_templates;
create policy category_templates_member_insert on public.category_templates for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(group_id));
create policy category_templates_member_update on public.category_templates for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));
create policy category_templates_member_delete on public.category_templates for delete to authenticated
  using (public.is_group_member(group_id));

drop policy if exists notes_group_write on public.notes;
create policy notes_member_insert on public.notes for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(group_id));
create policy notes_member_update on public.notes for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));
create policy notes_member_delete on public.notes for delete to authenticated
  using (public.is_group_member(group_id));

drop policy if exists images_manager_write on public.item_images;
create policy images_member_insert on public.item_images for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(public.item_group(item_id)));
create policy images_member_update on public.item_images for update to authenticated
  using (public.is_group_member(public.item_group(item_id)))
  with check (public.is_group_member(public.item_group(item_id)));
create policy images_member_delete on public.item_images for delete to authenticated
  using (public.is_group_member(public.item_group(item_id)));

drop policy if exists item_images_owner_update on storage.objects;
drop policy if exists item_images_owner_delete on storage.objects;
create policy item_images_member_update on storage.objects for update to authenticated
  using (bucket_id = 'item-images' and public.is_group_member((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'item-images' and public.is_group_member((storage.foldername(name))[1]::uuid));
create policy item_images_member_delete on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and public.is_group_member((storage.foldername(name))[1]::uuid));

create or replace function public.create_quick_item(
  target_group uuid,
  item_name text,
  item_quantity numeric,
  item_unit text default null,
  item_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  quick_list_id uuid;
  quick_category_id uuid;
  saved_item_id uuid;
begin
  if not public.is_group_member(target_group) then
    raise exception 'group_member_required' using errcode = '42501';
  end if;
  if nullif(trim(item_name), '') is null then
    raise exception 'item_name_required' using errcode = '22023';
  end if;
  if item_quantity is null or item_quantity <= 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  select id into quick_list_id
  from public.shopping_lists
  where group_id = target_group and is_quick_list
  limit 1;

  if quick_list_id is null then
    insert into public.shopping_lists(group_id, created_by, name, description, is_quick_list)
      values(target_group, auth.uid(), 'Jooksev list', 'Ilma eraldi ostunimekirjata lisatud kaubad', true)
      returning id into quick_list_id;
  end if;

  select id into quick_category_id
  from public.categories
  where list_id = quick_list_id
  order by sort_order, created_at
  limit 1;

  if quick_category_id is null then
    insert into public.categories(list_id, name, sort_order)
      values(quick_list_id, 'Üldine', 0)
      returning id into quick_category_id;
  end if;

  insert into public.items(list_id, category_id, created_by, name, quantity, unit, note, status, searched_before)
    values(quick_list_id, quick_category_id, auth.uid(), trim(item_name), item_quantity, nullif(trim(item_unit), ''), nullif(trim(item_note), ''), 'unassigned', false)
    returning id into saved_item_id;

  insert into public.activity_log(group_id, actor_id, list_id, item_id, action, new_status)
    values(target_group, auth.uid(), quick_list_id, saved_item_id, 'Lisas toote otse jooksvasse listi', 'unassigned');

  return saved_item_id;
end $$;

revoke all on function public.create_quick_item(uuid, text, numeric, text, text) from public;
grant execute on function public.create_quick_item(uuid, text, numeric, text, text) to authenticated;
