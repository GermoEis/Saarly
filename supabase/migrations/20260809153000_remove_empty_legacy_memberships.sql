-- Eemalda vana lihtkonto ajast jäänud tühjad anonüümsed liikmesused ainult siis,
-- kui samas grupis on juba sama nimega püsiv konto. Ajaloo või sisuga seotud
-- anonüümseid kasutajaid see puhastus ei puuduta.
delete from public.group_members legacy_member
using public.profiles legacy_profile, auth.users legacy_user
where legacy_member.profile_id = legacy_profile.id
  and legacy_member.profile_id = legacy_user.id
  and legacy_user.is_anonymous = true
  and exists (
    select 1
    from public.group_members permanent_member
    join public.profiles permanent_profile on permanent_profile.id = permanent_member.profile_id
    join auth.users permanent_user on permanent_user.id = permanent_member.profile_id
    where permanent_member.group_id = legacy_member.group_id
      and permanent_member.profile_id <> legacy_member.profile_id
      and permanent_user.is_anonymous = false
      and lower(trim(permanent_profile.display_name)) = lower(trim(legacy_profile.display_name))
  )
  and not exists (select 1 from public.groups value where value.created_by = legacy_member.profile_id)
  and not exists (select 1 from public.shopping_lists value where value.created_by = legacy_member.profile_id)
  and not exists (select 1 from public.category_templates value where value.created_by = legacy_member.profile_id)
  and not exists (select 1 from public.group_access_codes value where value.created_by = legacy_member.profile_id)
  and not exists (select 1 from public.group_invites value where value.created_by = legacy_member.profile_id or value.used_by = legacy_member.profile_id)
  and not exists (select 1 from public.items value where value.created_by = legacy_member.profile_id or value.assigned_to = legacy_member.profile_id)
  and not exists (select 1 from public.item_assignments value where value.user_id = legacy_member.profile_id or value.assigned_by = legacy_member.profile_id)
  and not exists (select 1 from public.item_attempts value where value.user_id = legacy_member.profile_id)
  and not exists (select 1 from public.deliveries value where value.created_by = legacy_member.profile_id or value.courier_id = legacy_member.profile_id)
  and not exists (select 1 from public.notes value where value.created_by = legacy_member.profile_id)
  and not exists (select 1 from public.notifications value where value.user_id = legacy_member.profile_id or value.actor_id = legacy_member.profile_id)
  and not exists (select 1 from public.activity_log value where value.actor_id = legacy_member.profile_id)
  and not exists (select 1 from public.item_images value where value.created_by = legacy_member.profile_id);
