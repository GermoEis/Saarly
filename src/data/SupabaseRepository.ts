import { supabase } from './supabase';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { BarLedgerEntryInput, BarLedgerPaymentInput, BarPrepaymentInput, BarProductInput, Delivery, DemoState, GroupInvite, GroupMembership, ItemImage, Settlement } from '@/types/domain';

WebBrowser.maybeCompleteAuthSession();

/**
 * Supabase'i adapter. UI kasutab sama domeenimudelit nagu demo; adapteri meetodid
 * koondavad võrguoperatsioonid ja jätavad komponendid backendist sõltumatuks.
 */
export class SupabaseRepository {
  private client() { if (!supabase) throw new Error('Supabase ei ole seadistatud'); return supabase; }

  private friendlyAuthError(message: string) {
    const value = message.toLocaleLowerCase('et-EE');
    if (value.includes('invalid login credentials')) return new Error('E-post või parool ei ole õige.');
    if (value.includes('email not confirmed')) return new Error('Kinnita esmalt oma e-posti aadress.');
    if (value.includes('already registered') || value.includes('already been registered')) return new Error('Selle e-postiga konto on juba olemas. Proovi sisse logida.');
    if (value.includes('provider is not enabled') || value.includes('unsupported provider')) return new Error('Google’iga sisselogimine pole Supabase’is veel aktiveeritud.');
    if (value.includes('password') && (value.includes('short') || value.includes('least'))) return new Error('Parool peab olema vähemalt 8 märki pikk.');
    return new Error(message);
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client().auth.signInWithPassword({ email, password });
    if (error) throw this.friendlyAuthError(error.message); return data.user;
  }
  async register(email: string, password: string, displayName: string) {
    const { data, error } = await this.client().auth.signUp({ email, password, options: { data: { display_name: displayName } } });
    if (error) throw this.friendlyAuthError(error.message);
    if (!data.user) throw new Error('Konto loomine ebaõnnestus.');
    if (!data.session) throw new Error('Konto loodi. Kinnita e-postis saadetud link ja logi seejärel sisse.');
    return data.user;
  }
  async linkEmailAccount(email: string, password: string, displayName: string) {
    const client = this.client();
    const { data: currentData, error: currentError } = await client.auth.getUser();
    if (currentError) throw this.friendlyAuthError(currentError.message);
    if (!currentData.user) throw new Error('Kasutajat ei leitud. Logi uuesti sisse ja proovi veel kord.');

    let user = currentData.user;
    if (user.email !== email || !user.email_confirmed_at) {
      const { data: emailData, error: emailError } = await client.auth.updateUser({
        email,
        data: { display_name: displayName },
      });
      if (emailError) throw this.friendlyAuthError(emailError.message);
      user = emailData.user;
    }

    if (!user.email_confirmed_at) return { user, confirmationRequired: true };

    const { data: passwordData, error: passwordError } = await client.auth.updateUser({ password });
    if (passwordError) throw this.friendlyAuthError(passwordError.message);
    return { user: passwordData.user, confirmationRequired: false };
  }
  async signInWithGoogle() {
    const client = this.client();
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') throw new Error('Google’iga sisselogimist ei saa praegu avada.');
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw this.friendlyAuthError(error.message);
      return undefined;
    }

    const redirectTo = makeRedirectUri({ scheme: 'saarly', path: 'auth/callback' });
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw this.friendlyAuthError(error.message);
    if (!data.url) throw new Error('Google’i sisselogimisakna avamine ebaõnnestus.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return undefined;
    const { params, errorCode } = QueryParams.getQueryParams(result.url);
    if (errorCode) throw new Error('Google’i sisselogimine ebaõnnestus. Proovi uuesti.');
    if (!params.access_token || !params.refresh_token) throw new Error('Google ei tagastanud kehtivat sisselogimisseanssi.');

    const { data: sessionData, error: sessionError } = await client.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (sessionError) throw this.friendlyAuthError(sessionError.message);
    return sessionData.user;
  }
  async signOut() { const { error } = await this.client().auth.signOut({ scope: 'local' }); if (error) throw error; }
  async joinWithSecurityCode(displayName: string, securityCode: string) {
    const { data, error: userError } = await this.client().auth.getUser();
    if (userError || !data.user) throw new Error('Logi esmalt e-posti või Google’i kontoga sisse.');
    const user = data.user;
    const { data: inviteGroupId, error: inviteError } = await this.client().rpc('redeem_group_invite', { invite_code: securityCode, supplied_name: displayName });
    let groupId = inviteGroupId as string | null;
    if (inviteError) {
      const canTryLegacyCode = inviteError.message.includes('invalid_invite_code') || inviteError.message.includes('Could not find the function');
      if (!canTryLegacyCode) {
        if (inviteError.message.includes('invite_expired')) throw new Error('Kutse on aegunud. Küsi grupi administraatorilt uus kutse.');
        if (inviteError.message.includes('invite_used')) throw new Error('Seda kutset on juba kasutatud. Küsi grupi administraatorilt uus kutse.');
        if (inviteError.message.includes('invite_revoked')) throw new Error('See kutse on tühistatud. Küsi grupi administraatorilt uus kutse.');
        throw new Error(inviteError.message);
      }
      const { data: legacyGroupId, error: legacyError } = await this.client().rpc('redeem_group_code', { supplied_code: securityCode, supplied_name: displayName });
      if (legacyError) throw new Error(legacyError.message.includes('invalid_security_code') ? 'Turvakood või kutsekood ei ole õige.' : legacyError.message);
      groupId = legacyGroupId as string;
    }
    if (!groupId) throw new Error('Grupiga liitumine ebaõnnestus.');
    return { user, groupId };
  }

  async groupsForUser(userId: string): Promise<GroupMembership[]> {
    const { data, error } = await this.client()
      .from('group_members')
      .select('role, groups!inner(*)')
      .eq('profile_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({ ...(row.groups as unknown as GroupMembership), role: row.role })) as GroupMembership[];
  }
  async createGroup(name: string) {
    const { data, error } = await this.client().rpc('create_group', { group_name: name });
    if (error) throw new Error(error.message.includes('group_name_too_short') ? 'Grupi nimi peab olema vähemalt 2 märki pikk.' : error.message);
    return data as string;
  }
  async createGroupInvite(groupId: string, inviteeName?: string) {
    const { data, error } = await this.client().rpc('create_group_invite', { target_group: groupId, supplied_invitee_name: inviteeName?.trim() || null });
    if (error) throw new Error(error.message.includes('group_member_required') ? 'Kutseid saavad luua ainult selle grupi liikmed.' : error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.invite_code) throw new Error('Kutse loomine ebaõnnestus.');
    return result as { invite_id: string; invite_code: string; expires_at: string };
  }
  async groupInvites(groupId: string): Promise<GroupInvite[]> {
    const { data, error } = await this.client().from('group_invites').select('id,group_id,created_by,invitee_name,expires_at,used_at,revoked_at,created_at,updated_at').eq('group_id', groupId).order('created_at', { ascending: false });
    if (error) {
      if (error.message.includes('group_invites')) return [];
      throw error;
    }
    return (data ?? []) as GroupInvite[];
  }
  async revokeGroupInvite(inviteId: string) {
    const { error } = await this.client().rpc('revoke_group_invite', { target_invite: inviteId });
    if (error) throw new Error(error.message.includes('invite_permission_denied') ? 'Saad tühistada enda loodud kutseid.' : error.message);
  }
  async setProfileTheme(profileId: string, theme: 'light' | 'dark') { const { error } = await this.client().from('profiles').update({ theme_preference: theme }).eq('id', profileId); if (error) throw error; }
  async renameGroup(groupId: string, name: string) { const { error } = await this.client().from('groups').update({ name }).eq('id', groupId); if (error) throw error; }
  async removeGroupMember(groupId: string, profileId: string) { const { error } = await this.client().rpc('remove_group_member', { target_group: groupId, target_user: profileId }); if (error) throw error; }

  async loadWorkspace(groupId: string): Promise<Partial<DemoState>> {
    const client = this.client();
    const { error: purgeError } = await client.rpc('purge_group_trash', { target_group: groupId });
    if (purgeError && !purgeError.message.includes('Could not find the function')) throw purgeError;
    const [profiles, groups, members, lists, categories, templates, items, assignments, attempts, deliveries, deliveryItems, notes, notifications, activity, images, settlements, barDebtors, barProducts, barEntries, barItems, barPayments, barCredits, barEvents] = await Promise.all([
      client.from('profiles').select('*'), client.from('groups').select('*').eq('id', groupId),
      client.from('group_members').select('*').eq('group_id', groupId),
      client.from('shopping_lists').select('*').eq('group_id', groupId),
      client.from('categories').select('*, shopping_lists!inner(group_id)').eq('shopping_lists.group_id', groupId),
      client.from('category_templates').select('*').eq('group_id', groupId),
      client.from('items').select('*, shopping_lists!inner(group_id)').eq('shopping_lists.group_id', groupId),
      client.from('item_assignments').select('*, items!inner(shopping_lists!inner(group_id))').eq('items.shopping_lists.group_id', groupId),
      client.from('item_attempts').select('*, items!inner(shopping_lists!inner(group_id))').eq('items.shopping_lists.group_id', groupId),
      client.from('deliveries').select('*, shopping_lists!inner(group_id)').eq('shopping_lists.group_id', groupId),
      client.from('delivery_items').select('*, deliveries!inner(shopping_lists!inner(group_id))').eq('deliveries.shopping_lists.group_id', groupId),
      client.from('notes').select('*').eq('group_id', groupId), client.from('notifications').select('*').eq('group_id', groupId),
      client.from('activity_log').select('*').eq('group_id', groupId),
      client.from('item_images').select('*, items!inner(shopping_lists!inner(group_id))').eq('items.shopping_lists.group_id', groupId).order('updated_at', { ascending: false }),
      client.from('settlements').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
      client.from('bar_debtors').select('*').eq('group_id', groupId).order('name'),
      client.from('bar_products').select('*').eq('group_id', groupId).order('name'),
      client.from('bar_ledger_entries').select('*').eq('group_id', groupId).order('occurred_at', { ascending: false }),
      client.from('bar_ledger_items').select('*, bar_ledger_entries!inner(group_id)').eq('bar_ledger_entries.group_id', groupId),
      client.from('bar_ledger_payments').select('*, bar_ledger_entries!inner(group_id)').eq('bar_ledger_entries.group_id', groupId).order('paid_at', { ascending: false }),
      client.from('bar_credit_transactions').select('*').eq('group_id', groupId).order('occurred_at', { ascending: false }),
      client.from('bar_ledger_events').select('*, bar_ledger_entries!inner(group_id)').eq('bar_ledger_entries.group_id', groupId).order('created_at', { ascending: false }),
    ]);
    const failed = [profiles, groups, members, lists, categories, templates, items, assignments, attempts, deliveries, deliveryItems, notes, notifications, activity, images, settlements, barDebtors, barProducts, barEntries, barItems, barPayments, barCredits, barEvents].find((result) => result.error);
    if (failed?.error) throw failed.error;
    const clean = <T extends Record<string, unknown>>(rows: T[] | null, relations: string[]) => (rows ?? []).map((row) => { const result = { ...row }; relations.forEach((key) => delete result[key]); return result; });
    const cleanImages = clean(images.data, ['items']) as ItemImage[];
    let hydratedImages = cleanImages;
    if (cleanImages.length) {
      const paths = cleanImages.map((image) => image.storage_path);
      const { data: signedImages, error: signedImagesError } = await client.storage.from('item-images').createSignedUrls(paths, 60 * 60);
      if (signedImagesError) throw signedImagesError;
      const urls = new Map((signedImages ?? []).map((image) => [image.path, image.signedUrl]));
      hydratedImages = cleanImages.map((image) => ({ ...image, preview_uri: urls.get(image.storage_path) ?? undefined }));
    }
    return {
      profiles: profiles.data ?? [], groups: groups.data ?? [], groupMembers: members.data ?? [], lists: lists.data ?? [],
      categories: clean(categories.data, ['shopping_lists']), categoryTemplates: templates.data ?? [], items: clean(items.data, ['shopping_lists']),
      assignments: clean(assignments.data, ['items']), attempts: clean(attempts.data, ['items']),
      deliveries: clean(deliveries.data, ['shopping_lists']), deliveryItems: clean(deliveryItems.data, ['deliveries']),
      notes: notes.data ?? [], notifications: notifications.data ?? [], activity: activity.data ?? [], images: hydratedImages,
      settlements: settlements.data ?? [],
      barDebtors: barDebtors.data ?? [], barProducts: barProducts.data ?? [], barLedgerEntries: barEntries.data ?? [],
      barLedgerItems: clean(barItems.data, ['bar_ledger_entries']), barLedgerPayments: clean(barPayments.data, ['bar_ledger_entries']),
      barCreditTransactions: barCredits.data ?? [],
      barLedgerEvents: clean(barEvents.data, ['bar_ledger_entries']),
    } as Partial<DemoState>;
  }

  async claimFloatingItem(itemId: string) {
    const { data, error } = await this.client().rpc('claim_floating_item', { target_item: itemId });
    if (error?.message.includes('item_already_claimed')) throw new Error('Selle toote võttis juba teine viija.');
    if (error) throw error; return data;
  }
  async respondToAssignment(itemId: string, accept: boolean) {
    const { data, error } = await this.client().rpc('respond_to_assignment', { target_item: itemId, accept });
    if (error) throw error; return data;
  }
  async markUnavailable(itemId: string, note?: string) {
    const { data, error } = await this.client().rpc('mark_item_unavailable', { target_item: itemId, attempt_note: note });
    if (error) throw error; return data;
  }
  async setItemStatus(itemId: string, status: 'purchased' | 'delivered') {
    const { data, error } = await this.client().rpc('set_item_status', { target_item: itemId, target_status: status });
    if (error) throw error; return data;
  }
  async createList(groupId: string, userId: string, name: string, description?: string) {
    const { data, error } = await this.client().from('shopping_lists').insert({ group_id: groupId, created_by: userId, name, description }).select('id').single();
    if (error) throw error;
    const { data: templates, error: templateError } = await this.client().from('category_templates').select('name,sort_order').eq('group_id', groupId).order('sort_order');
    if (templateError) throw templateError;
    if (templates?.length) { const { error: categoryError } = await this.client().from('categories').insert(templates.map((template) => ({ list_id: data.id, name: template.name, sort_order: template.sort_order }))); if (categoryError) throw categoryError; }
    return data.id as string;
  }
  async updateList(id: string, name: string, description?: string) { const { error } = await this.client().from('shopping_lists').update({ name, description: description ?? null }).eq('id', id); if (error) throw error; }
  async archiveList(id: string) { const { error } = await this.client().from('shopping_lists').update({ archived_at: new Date().toISOString() }).eq('id', id); if (error) throw error; }
  async unarchiveList(id: string) { const { error } = await this.client().rpc('unarchive_shopping_list', { target_list: id }); if (error) throw error; }
  async deleteList(id: string) { const { error } = await this.client().rpc('trash_shopping_list', { target_list: id }); if (error) throw error; }
  async restoreList(id: string) { const { error } = await this.client().rpc('restore_trashed_shopping_list', { target_list: id }); if (error) throw error; }
  async createCategory(listId: string, groupId: string, userId: string, name: string, sortOrder: number) { const { error } = await this.client().from('categories').insert({ list_id: listId, name, sort_order: sortOrder }); if (error) throw error; const { error: templateError } = await this.client().from('category_templates').upsert({ group_id: groupId, created_by: userId, name, sort_order: sortOrder }, { onConflict: 'group_id,name', ignoreDuplicates: true }); if (templateError) throw templateError; }
  async createSharedCategory(groupId: string, name: string) { const { error } = await this.client().rpc('create_shared_category', { target_group: groupId, category_name: name }); if (error) throw error; }
  async deleteSharedCategory(groupId: string, name: string) { const { error } = await this.client().rpc('delete_shared_category', { target_group: groupId, category_name: name }); if (error) throw error; }
  async assignItemsCategory(groupId: string, itemIds: string[], name: string) { const { error } = await this.client().rpc('assign_items_category', { target_group: groupId, target_items: itemIds, category_name: name }); if (error) throw error; }
  async updateCategory(id: string, values: Record<string, unknown>) { const { error } = await this.client().from('categories').update(values).eq('id', id); if (error) throw error; }
  async createItem(values: Record<string, unknown>) { const { data, error } = await this.client().from('items').insert(values).select('id').single(); if (error) throw error; return data.id as string; }
  async createQuickItem(groupId: string, values: { name: string; quantity: number; unit?: string; note?: string; category_name?: string }) {
    const { data, error } = await this.client().rpc('create_quick_item', { target_group: groupId, item_name: values.name, item_quantity: values.quantity, item_unit: values.unit ?? null, item_note: values.note ?? null, item_category_name: values.category_name ?? null });
    if (error) throw error; return data as string;
  }
  async updateItem(id: string, values: Record<string, unknown>) { const { error } = await this.client().from('items').update(values).eq('id', id); if (error) throw error; }
  async deleteItem(id: string) { const { error } = await this.client().rpc('trash_item', { target_item: id }); if (error) throw error; }
  async restoreItem(id: string) { const { error } = await this.client().rpc('restore_trashed_item', { target_item: id }); if (error) throw error; }
  async undoItemStatus(id: string, previousStatus: 'assigned' | 'accepted' | 'purchased') { const { error } = await this.client().rpc('undo_item_status', { target_item: id, previous_status: previousStatus }); if (error) throw error; }
  async createNote(values: Record<string, unknown>) { const { error } = await this.client().from('notes').insert(values); if (error) throw error; }
  async updateNote(id: string, values: Record<string, unknown>) { const { error } = await this.client().from('notes').update(values).eq('id', id); if (error) throw error; }
  async deleteNote(id: string) { const { error } = await this.client().from('notes').delete().eq('id', id); if (error) throw error; }
  async createSettlement(groupId: string, input: Pick<Settlement, 'debtor_id' | 'amount' | 'description'> & Partial<Pick<Settlement, 'shopping_list_id'>>) {
    const { data, error } = await this.client().rpc('create_settlement', { target_group: groupId, target_debtor: input.debtor_id, amount_value: input.amount, settlement_description: input.description, target_list: input.shopping_list_id ?? null });
    if (error) throw new Error(error.message.includes('debtor_not_group_member') ? 'Valitud kasutaja ei kuulu sellesse gruppi.' : error.message.includes('invalid_amount') ? 'Sisesta nullist suurem summa.' : error.message);
    return data;
  }
  private settlementError(message: string) {
    if (message.includes('settlement_state_conflict')) return new Error('Arvelduse olek on juba muutunud. Vaade värskendatakse.');
    if (message.includes('settlement_permission_denied') || message.includes('group_member_required')) return new Error('Sul ei ole lubatud seda arveldust muuta.');
    if (message.includes('settlement_not_found')) return new Error('Arveldust ei leitud.');
    return new Error(message);
  }
  async markSettlementPaid(id: string) { const { data, error } = await this.client().rpc('mark_settlement_paid', { target_settlement: id }); if (error) throw this.settlementError(error.message); return data; }
  async confirmSettlementPaid(id: string) { const { data, error } = await this.client().rpc('confirm_settlement_paid', { target_settlement: id }); if (error) throw this.settlementError(error.message); return data; }
  async cancelSettlement(id: string) { const { data, error } = await this.client().rpc('cancel_settlement', { target_settlement: id }); if (error) throw this.settlementError(error.message); return data; }
  private barLedgerError(message: string) {
    if (message.includes('bar_permission_denied') || message.includes('group_member_required')) return new Error('Sul ei ole lubatud seda vihikukirjet muuta.');
    if (message.includes('bar_entry_not_found')) return new Error('Vihikukirjet ei leitud.');
    if (message.includes('bar_debtor_not_found')) return new Error('Valitud inimest ei leitud.');
    if (message.includes('bar_product_not_found')) return new Error('Valitud toodet ei leitud.');
    if (message.includes('bar_product_duplicate')) return new Error('Sellise nimega toode on juba olemas.');
    if (message.includes('bar_total_below_paid')) return new Error('Uus summa ei saa olla väiksem juba tasutud summast. Tühista esmalt vigane makse.');
    if (message.includes('bar_overpayment')) return new Error('Makse ei saa olla suurem kui tasumata jääk.');
    if (message.includes('bar_entry_cancelled')) return new Error('Tühistatud kirjet ei saa muuta.');
    if (message.includes('bar_entry_not_open')) return new Error('Sellele kirjele ei saa praegu makset lisada.');
    if (message.includes('bar_payment_already_voided')) return new Error('Makse on juba tühistatud.');
    if (message.includes('bar_prepayment_already_used')) return new Error('Ettemaksest on juba osa kasutatud. Tühista esmalt vastav ost või ettemakse kasutus.');
    if (message.includes('bar_credit_already_voided')) return new Error('Ettemakse on juba tühistatud.');
    if (message.includes('bar_credit_not_found')) return new Error('Ettemakset ei leitud.');
    if (message.includes('invalid_')) return new Error('Kontrolli sisestatud nime, kogust ja summasid.');
    return new Error(message);
  }
  async createBarLedgerEntry(groupId: string, input: BarLedgerEntryInput) {
    const { data, error } = await this.client().rpc('create_bar_ledger_entry', { target_group: groupId, target_debtor: input.debtor_id ?? null, debtor_name: input.debtor_name, debtor_contact: input.debtor_contact ?? '', entry_occurred_at: input.occurred_at, entry_note: input.note ?? '', entry_items: input.items, entry_payment_method: input.payment_method ?? 'cash' });
    if (error) throw this.barLedgerError(error.message); return data;
  }
  async updateBarLedgerEntry(id: string, input: BarLedgerEntryInput) {
    const { data, error } = await this.client().rpc('update_bar_ledger_entry', { target_entry: id, target_debtor: input.debtor_id ?? null, debtor_name: input.debtor_name, debtor_contact: input.debtor_contact ?? '', entry_occurred_at: input.occurred_at, entry_note: input.note ?? '', entry_items: input.items, entry_payment_method: input.payment_method ?? 'cash' });
    if (error) throw this.barLedgerError(error.message); return data;
  }
  async recordBarLedgerPayment(id: string, input: BarLedgerPaymentInput) {
    const { data, error } = await this.client().rpc('record_bar_ledger_payment', { target_entry: id, amount_value: input.amount, payment_paid_at: input.paid_at, payment_note: input.note ?? '' });
    if (error) throw this.barLedgerError(error.message); return data;
  }
  async voidBarLedgerPayment(id: string) { const { data, error } = await this.client().rpc('void_bar_ledger_payment', { target_payment: id }); if (error) throw this.barLedgerError(error.message); return data; }
  async recordBarPrepayment(groupId: string, input: BarPrepaymentInput) {
    const { data, error } = await this.client().rpc('record_bar_prepayment', { target_group: groupId, target_owner: input.owner_id ?? null, target_debtor: input.debtor_id ?? null, debtor_name: input.debtor_name, debtor_contact: input.debtor_contact ?? '', amount_value: input.amount, prepayment_occurred_at: input.occurred_at, prepayment_note: input.note ?? '', prepayment_method: input.payment_method ?? 'cash' });
    if (error) throw this.barLedgerError(error.message); return data;
  }
  async voidBarPrepayment(id: string) { const { data, error } = await this.client().rpc('void_bar_prepayment', { target_credit: id }); if (error) throw this.barLedgerError(error.message); return data; }
  async cancelBarLedgerEntry(id: string) { const { data, error } = await this.client().rpc('cancel_bar_ledger_entry', { target_entry: id }); if (error) throw this.barLedgerError(error.message); return data; }
  async saveBarProduct(groupId: string, input: BarProductInput) {
    const { data, error } = await this.client().rpc('upsert_bar_product', { target_group: groupId, target_product: input.id ?? null, product_name: input.name, price_value: input.unit_price, product_active: input.active ?? true });
    if (error) throw this.barLedgerError(error.message); return data;
  }
  async markNotificationsRead(userId: string) { const { error } = await this.client().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null); if (error) throw error; }
  async saveWebPushSubscription(userId: string, subscription: PushSubscription) { const { error } = await this.client().from('push_tokens').upsert({ user_id: userId, token: JSON.stringify(subscription.toJSON()), platform: 'web' }, { onConflict: 'token' }); if (error) throw error; }
  async upsertDelivery(values: Record<string, unknown>) { const { data, error } = await this.client().from('deliveries').upsert(values, { onConflict: 'id' }).select().single(); if (error) throw error; return data as Delivery; }
  async addDeliveryItems(deliveryId: string, itemIds: string[]) { if (!itemIds.length) return; const { error } = await this.client().from('delivery_items').upsert(itemIds.map((item_id) => ({ delivery_id: deliveryId, item_id })), { onConflict: 'delivery_id,item_id', ignoreDuplicates: true }); if (error) throw error; }
  async completeDelivery(values: Record<string, unknown>) { const { data, error } = await this.client().rpc('complete_delivery', { target_list: values.target_list, target_delivery: values.delivery_id ?? null, delivery_ship: values.ship_name, delivery_date: values.departure_date, delivery_time: values.departure_time ?? null, delivery_port: values.port, delivery_place: values.handover_place, delivery_note: values.note ?? null }); if (error) throw error; return data; }
  async removeItemFromDelivery(itemId: string) {
    await this.undoItemStatus(itemId, 'purchased');
    const { error } = await this.client().from('delivery_items').delete().eq('item_id', itemId);
    if (error) throw error;
  }
  async undoCompletedDelivery(id: string) { const { error } = await this.client().rpc('undo_completed_delivery', { target_delivery: id }); if (error) throw error; }
  subscribe(groupId: string, refresh: () => void) {
    const channel = this.client().channel(`saarly:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_invites', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_debtors', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_products', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_ledger_entries', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_ledger_items' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_ledger_payments' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_credit_transactions', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_ledger_events' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, refresh)
      .subscribe();
    return () => { void this.client().removeChannel(channel); };
  }
  async saveItemImage(groupId: string, itemId: string, userId: string, bytes: ArrayBuffer, contentType: string) {
    const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const randomId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const path = `${groupId}/${itemId}/${randomId}.${extension}`;
    const storage = this.client().storage.from('item-images');
    const { error: uploadError } = await storage.upload(path, bytes, { contentType });
    if (uploadError) throw uploadError;

    const { data: existing, error: existingError } = await this.client().from('item_images').select('id,storage_path,created_by').eq('item_id', itemId).order('updated_at', { ascending: false });
    if (existingError) { await storage.remove([path]); throw existingError; }
    const current = existing?.[0];
    const saveResult = current
      ? await this.client().from('item_images').update({ storage_path: path }).eq('id', current.id)
      : await this.client().from('item_images').insert({ item_id: itemId, created_by: userId, storage_path: path });
    if (saveResult.error) { await storage.remove([path]); throw saveResult.error; }

    const oldPaths = (existing ?? []).map((image) => image.storage_path).filter((oldPath) => oldPath !== path);
    if ((existing?.length ?? 0) > 1) await this.client().from('item_images').delete().eq('item_id', itemId).neq('id', current!.id);
    if (oldPaths.length) await storage.remove(oldPaths);
    await this.client().from('items').update({ updated_at: new Date().toISOString() }).eq('id', itemId);
  }
  async removeItemImage(itemId: string, _userId: string) {
    const { data: images, error } = await this.client().from('item_images').select('id,storage_path').eq('item_id', itemId);
    if (error) throw error;
    if (images?.length) {
      const { error: deleteError } = await this.client().from('item_images').delete().in('id', images.map((image) => image.id));
      if (deleteError) throw deleteError;
      await this.client().storage.from('item-images').remove(images.map((image) => image.storage_path));
      await this.client().from('items').update({ updated_at: new Date().toISOString() }).eq('id', itemId);
    }
  }
}
