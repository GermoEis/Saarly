import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { createDemoState } from '@/data/demoSeed';
import { acceptItem, categoriesForNewList, claimItem, declineItem, releaseAllItems, removeBuyerMember, saveDeliveryInDemo, setItemOutcome, setProfileThemePreference, statusForAssignment } from '@/data/business';
import { loadDemo, saveDemo } from '@/data/storage';
import { hasSupabaseConfig, supabase } from '@/data/supabase';
import { SupabaseRepository } from '@/data/SupabaseRepository';
import { canManageShoppingContent } from '@/data/access';
import { loadActiveGroupId, saveActiveGroupId, selectActiveGroupId } from '@/data/groups';
import { cancelSettlementInDemo, confirmSettlementPaidInDemo, createSettlementInDemo, markSettlementPaidInDemo } from '@/data/settlements';
import { Category, Delivery, DemoState, GroupInvite, GroupMembership, Item, Note, Settlement, ThemeMode } from '@/types/domain';
import { colorsFor, ThemeColors } from '@/theme';

type NewItem = Pick<Item, 'name' | 'quantity' | 'category_id'> & Partial<Pick<Item, 'unit' | 'note' | 'assigned_to'>>;
type NewItemPhoto = { uri: string; mimeType?: string | null; base64?: string | null };
type AuthAccount = { email?: string; displayName?: string; isAnonymous: boolean } | null;
interface AppContextValue {
  state: DemoState;
  mode: 'demo' | 'supabase';
  ready: boolean;
  currentUser: DemoState['profiles'][number] | undefined;
  isMember: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  hasAuthSession: boolean;
  authEmail?: string;
  authDisplayName?: string;
  isAnonymousAccount: boolean;
  availableGroups: GroupMembership[];
  activeGroupId: string | null;
  groupInvites: GroupInvite[];
  themeMode: ThemeMode;
  themeColors: ThemeColors;
  setThemeMode: (theme: ThemeMode) => Promise<void>;
  renameGroup: (name: string) => Promise<void>;
  removeMember: (profileId: string) => Promise<void>;
  createGroup: (name: string) => Promise<void>;
  switchGroup: (groupId: string) => Promise<void>;
  createInvite: (inviteeName?: string) => Promise<{ code: string; expiresAt: string }>;
  revokeInvite: (inviteId: string) => Promise<void>;
  signIn: (id: string) => void;
  signInEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (name: string, email: string, password: string) => Promise<void>;
  linkEmailAccount: (email: string, password: string) => Promise<{ confirmationRequired: boolean }>;
  signInGoogle: () => Promise<void>;
  joinGroup: (name: string, securityCode: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetDemo: () => void;
  claim: (itemId: string) => void;
  accept: (itemId: string) => void;
  decline: (itemId: string) => void;
  releaseAll: () => void;
  outcome: (itemId: string, value: 'purchased' | 'unavailable' | 'delivered', note?: string) => void;
  addList: (name: string, description?: string) => Promise<string>;
  archiveList: (id: string) => void;
  deleteList: (id: string) => void;
  addCategory: (listId: string, name: string) => void;
  toggleCategory: (id: string) => void;
  renameCategory: (id: string, name: string) => void;
  reorderCategory: (id: string, direction: -1 | 1) => void;
  addItem: (listId: string, input: NewItem, photo?: NewItemPhoto) => Promise<boolean>;
  addQuickItem: (input: Pick<Item, 'name' | 'quantity'> & Partial<Pick<Item, 'unit' | 'note'>>, photo?: NewItemPhoto) => Promise<boolean>;
  updateItem: (id: string, values: Partial<Pick<Item, 'name' | 'quantity' | 'unit' | 'note' | 'category_id' | 'assigned_to'>>) => void;
  deleteItem: (id: string) => void;
  markAllRead: () => void;
  addNote: (input: Pick<Note, 'title' | 'content'> & Partial<Pick<Note, 'phone' | 'url' | 'pinned'>>) => void;
  updateNote: (id: string, input: Pick<Note, 'title' | 'content'> & Partial<Pick<Note, 'phone' | 'url'>>) => void;
  deleteNote: (id: string) => void;
  setItemImage: (itemId: string, uri: string, mimeType?: string | null, base64?: string | null) => Promise<void>;
  removeItemImage: (itemId: string) => Promise<void>;
  saveDelivery: (listId: string, input: Pick<Delivery, 'ship_name' | 'departure_date' | 'departure_time' | 'port' | 'handover_place'> & Partial<Pick<Delivery, 'note'>>, delivered?: boolean) => void;
  createSettlement: (input: Pick<Settlement, 'debtor_id' | 'amount' | 'description'> & Partial<Pick<Settlement, 'shopping_list_id'>>) => Promise<void>;
  markSettlementPaid: (id: string) => Promise<void>;
  confirmSettlementPaid: (id: string) => Promise<void>;
  cancelSettlement: (id: string) => Promise<void>;
}

const Context = createContext<AppContextValue | null>(null);
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();
const cloud = new SupabaseRepository();
const DEMO_SECURITY_CODE = 'DEMO2026';

function accountFromUser(user: { email?: string | null; is_anonymous?: boolean; user_metadata?: { display_name?: unknown; full_name?: unknown; name?: unknown } } | null | undefined): AuthAccount {
  if (!user) return null;
  const metadataName = [user.user_metadata?.display_name, user.user_metadata?.full_name, user.user_metadata?.name]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return { email: user.email ?? undefined, displayName: metadataName, isAnonymous: Boolean(user.is_anonymous) };
}

async function photoBytes(photo: NewItemPhoto) {
  if (photo.base64) {
    const binary = atob(photo.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }
  const response = await fetch(photo.uri);
  if (!response.ok) throw new Error('Foto lugemine ebaõnnestus. Proovi foto uuesti valida.');
  return response.arrayBuffer();
}

export function AppProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState(createDemoState);
  const [ready, setReady] = useState(false);
  const [authAccount, setAuthAccount] = useState<AuthAccount>(null);
  const [availableGroups, setAvailableGroups] = useState<GroupMembership[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const channel = useRef<BroadcastChannel | null>(null);
  const cloudGroupId = useRef<string | null>(null);
  const cloudUserId = useRef<string | null>(null);
  const cloudUnsubscribe = useRef<(() => void) | null>(null);
  const refreshRequest = useRef(0);
  const refreshCloudRef = useRef<(userId?: string, preferredGroupId?: string | null) => Promise<void>>(async () => undefined);

  const refreshCloud = useCallback(async (userId?: string, preferredGroupId?: string | null) => {
    const activeUser = userId ?? cloudUserId.current; if (!activeUser) return;
    const request = ++refreshRequest.current;
    const groups = await cloud.groupsForUser(activeUser);
    const storedGroupId = preferredGroupId === undefined ? await loadActiveGroupId(activeUser) : preferredGroupId;
    const groupId = selectActiveGroupId(groups, storedGroupId ?? cloudGroupId.current);
    if (request !== refreshRequest.current) return;
    setAvailableGroups(groups);
    if (!groupId) {
      cloudUnsubscribe.current?.(); cloudUnsubscribe.current = null;
      cloudGroupId.current = null; setActiveGroupId(null); setGroupInvites([]);
      await saveActiveGroupId(activeUser, null);
      setState({ ...createDemoState(), currentUserId: activeUser, profiles: [], groups: [], groupMembers: [], lists: [], categories: [], categoryTemplates: [], items: [], assignments: [], attempts: [], deliveries: [], deliveryItems: [], notes: [], notifications: [], activity: [], images: [], settlements: [] });
      return;
    }
    const data = await cloud.loadWorkspace(groupId);
    const membership = groups.find((group) => group.id === groupId);
    const invites = membership ? await cloud.groupInvites(groupId) : [];
    if (request !== refreshRequest.current) return;
    if (cloudGroupId.current !== groupId) {
      cloudUnsubscribe.current?.();
      cloudUnsubscribe.current = cloud.subscribe(groupId, () => { void refreshCloudRef.current(activeUser, groupId); });
    }
    cloudGroupId.current = groupId; setActiveGroupId(groupId); setGroupInvites(invites);
    await saveActiveGroupId(activeUser, groupId);
    setState({ ...createDemoState(), ...data, currentUserId: activeUser });
  }, []);
  useEffect(() => { refreshCloudRef.current = refreshCloud; }, [refreshCloud]);

  useEffect(() => {
    if (hasSupabaseConfig && supabase) {
      supabase.auth.getSession().then(async ({ data }) => { const user = data.session?.user; setAuthAccount(accountFromUser(user)); if (user) { cloudUserId.current = user.id; await refreshCloud(user.id); } setReady(true); }).catch(() => setReady(true));
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        // Algse seansi laadib ülal olev getSession. Sama töö teist korda käivitamine
        // võis Google OAuthi järel kuvada hetkeks eksliku „Vali, kuidas jätkata“ vaate.
        if (event === 'INITIAL_SESSION') return;
        cloudUserId.current = session?.user.id ?? null;
        setAuthAccount(accountFromUser(session?.user));
        if (!session?.user) {
          setAvailableGroups([]); setActiveGroupId(null); setGroupInvites([]);
          setState({ ...createDemoState(), currentUserId: null });
        }
      });
      return () => { authListener.subscription.unsubscribe(); cloudUnsubscribe.current?.(); cloudUnsubscribe.current = null; };
    }
    loadDemo().then((saved) => {
      if (saved?.version === 2) setState({ ...saved, settlements: saved.settlements ?? [], items: saved.items.map((item) => item.status === 'assigned' ? { ...item, status: 'accepted' } : item), assignments: saved.assignments.map((assignment) => assignment.status === 'pending' ? { ...assignment, status: 'accepted' } : assignment) });
      setReady(true);
    });
    if (Platform.OS === 'web' && typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('saarly-demo-sync');
      channel.current.onmessage = (event) => { if (event.data?.type === 'state') setState((current) => ({ ...event.data.state, settlements: event.data.state.settlements ?? [], currentUserId: current.currentUserId })); };
    }
    return () => channel.current?.close();
  }, [refreshCloud]);

  useEffect(() => {
    if (!ready || hasSupabaseConfig) return;
    saveDemo(state);
  }, [ready, state]);

  const update = useCallback((change: (current: DemoState) => DemoState) => {
    setState((current) => {
      const next = change(current);
      channel.current?.postMessage({ type: 'state', state: next });
      return next;
    });
  }, []);

  const signIn = (id: string) => update((current) => ({ ...current, currentUserId: id }));
  const signInEmail = async (email: string, password: string) => { const user = await cloud.signIn(email, password); setAuthAccount(accountFromUser(user)); cloudUserId.current = user.id; await refreshCloud(user.id); };
  const registerEmail = async (name: string, email: string, password: string) => {
    const user = await cloud.register(email, password, name);
    setAuthAccount(accountFromUser(user)); cloudUserId.current = user.id;
    await refreshCloud(user.id);
  };
  const linkEmailAccount = async (email: string, password: string) => {
    if (!state.currentUserId || !currentUser) throw new Error('Kasutajat ei leitud.');
    const result = await cloud.linkEmailAccount(email, password, currentUser.display_name);
    setAuthAccount(accountFromUser(result.user));
    return { confirmationRequired: result.confirmationRequired };
  };
  const signInGoogle = async () => {
    const user = await cloud.signInWithGoogle();
    if (!user) return;
    setAuthAccount(accountFromUser(user)); cloudUserId.current = user.id;
    await refreshCloud(user.id);
  };
  const setThemeMode = async (theme: ThemeMode) => {
    if (!state.currentUserId) return;
    if (hasSupabaseConfig) { await cloud.setProfileTheme(state.currentUserId, theme); await refreshCloud(); return; }
    update((current) => setProfileThemePreference(current, current.currentUserId!, theme));
  };
  const renameGroup = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Grupi nimi ei tohi olla tühi.');
    if (hasSupabaseConfig) { await cloud.renameGroup(cloudGroupId.current!, cleanName); await refreshCloud(); return; }
    update((current) => ({ ...current, groups: current.groups.map((group, index) => index === 0 ? { ...group, name: cleanName, updated_at: now() } : group) }));
  };
  const removeMember = async (profileId: string) => {
    if (hasSupabaseConfig) { await cloud.removeGroupMember(cloudGroupId.current!, profileId); await refreshCloud(); return; }
    const member = state.groupMembers.find((value) => value.profile_id === profileId);
    if (!member || member.role !== 'buyer') throw new Error('Seda kasutajat ei saa grupist eemaldada.');
    update((current) => removeBuyerMember(current, profileId, current.currentUserId!));
  };
  const createGroup = async (name: string) => {
    if (!hasSupabaseConfig || !cloudUserId.current) throw new Error('Uue grupi saab luua pärast kontoga sisselogimist.');
    const groupId = await cloud.createGroup(name.trim());
    await refreshCloud(cloudUserId.current, groupId);
  };
  const switchGroup = async (groupId: string) => {
    if (!hasSupabaseConfig || !cloudUserId.current) return;
    if (!availableGroups.some((group) => group.id === groupId)) throw new Error('Sul ei ole sellele grupile ligipääsu.');
    await refreshCloud(cloudUserId.current, groupId);
  };
  const createInvite = async (inviteeName?: string) => {
    if (!cloudGroupId.current) throw new Error('Aktiivset gruppi ei leitud.');
    const invite = await cloud.createGroupInvite(cloudGroupId.current, inviteeName);
    if (cloudUserId.current) await refreshCloud(cloudUserId.current, cloudGroupId.current);
    return { code: invite.invite_code, expiresAt: invite.expires_at };
  };
  const revokeInvite = async (inviteId: string) => {
    await cloud.revokeGroupInvite(inviteId);
    if (cloudUserId.current && cloudGroupId.current) await refreshCloud(cloudUserId.current, cloudGroupId.current);
  };
  const joinGroup = async (name: string, securityCode: string) => {
    if (hasSupabaseConfig) { const result = await cloud.joinWithSecurityCode(name, securityCode); setAuthAccount(accountFromUser(result.user)); cloudUserId.current = result.user.id; await refreshCloud(result.user.id, result.groupId); return; }
    if (securityCode.trim() !== (state.groups[0]?.security_code ?? DEMO_SECURITY_CODE)) throw new Error('Turvakood ei ole õige. Kontrolli koodi või küsi uus kutse.');
    update((current) => {
      const existing = current.profiles.find((profile) => profile.display_name.trim().toLocaleLowerCase('et-EE') === name.trim().toLocaleLowerCase('et-EE'));
      if (existing) {
        const isAlreadyMember = current.groupMembers.some((member) => member.profile_id === existing.id && member.group_id === current.groups[0]?.id);
        const membership = { id: uid('member'), group_id: current.groups[0]?.id ?? 'family', profile_id: existing.id, role: 'buyer' as const, created_at: now(), updated_at: now() };
        return { ...current, currentUserId: existing.id, groupMembers: isAlreadyMember ? current.groupMembers : [...current.groupMembers, membership] };
      }
      const id = uid('user'); const at = now();
      return { ...current, currentUserId: id, profiles: [...current.profiles, { id, display_name: name.trim(), avatar_color: '#176B4D', theme_preference: 'light', created_at: at, updated_at: at }], groupMembers: [...current.groupMembers, { id: uid('member'), group_id: 'family', profile_id: id, role: 'buyer', created_at: at, updated_at: at }] };
    });
  };
  const signOut = async () => { if (hasSupabaseConfig) { await cloud.signOut(); cloudUnsubscribe.current?.(); cloudUnsubscribe.current = null; cloudUserId.current = null; cloudGroupId.current = null; setAvailableGroups([]); setActiveGroupId(null); setGroupInvites([]); setAuthAccount(null); setState({ ...createDemoState(), currentUserId: null }); } else update((current) => ({ ...current, currentUserId: null })); };
  const resetDemo = () => {
    const fresh = createDemoState();
    update(() => fresh);
  };
  const show = (message: string) => Platform.OS === 'web' ? window.alert(message) : Alert.alert('Saarly', message);
  const claim = (itemId: string) => { if (hasSupabaseConfig) { void cloud.claimFloatingItem(itemId).then(() => refreshCloud()).catch((error) => show(error.message)); return; } update((current) => {
    const result = claimItem(current, itemId, current.currentUserId!);
    if (!result.ok) setTimeout(() => show(result.message!), 0);
    return result.state;
  }); };
  const accept = (itemId: string) => { if (hasSupabaseConfig) void cloud.respondToAssignment(itemId, true).then(() => refreshCloud()).catch((error) => show(error.message)); else update((current) => acceptItem(current, itemId, current.currentUserId!)); };
  const decline = (itemId: string) => { if (hasSupabaseConfig) void cloud.respondToAssignment(itemId, false).then(() => refreshCloud()).catch((error) => show(error.message)); else update((current) => declineItem(current, itemId, current.currentUserId!)); };
  const releaseAll = () => { if (hasSupabaseConfig) { const releasable = state.items.filter((item) => item.assigned_to === state.currentUserId && ['assigned', 'accepted'].includes(item.status)); void Promise.all(releasable.map((item) => cloud.respondToAssignment(item.id, false))).then(() => refreshCloud()).catch((error) => show(error.message)); } else update((current) => releaseAllItems(current, current.currentUserId!)); };
  const outcome = (itemId: string, value: 'purchased' | 'unavailable' | 'delivered', note?: string) => { if (hasSupabaseConfig) { const action = value === 'unavailable' ? cloud.markUnavailable(itemId, note) : cloud.setItemStatus(itemId, value); void action.then(() => refreshCloud()).catch((error) => show(error.message)); } else update((current) => setItemOutcome(current, itemId, current.currentUserId!, value, note)); };

  const addList = async (name: string, description?: string) => {
    if (hasSupabaseConfig) { const id = await cloud.createList(cloudGroupId.current!, state.currentUserId!, name, description); await refreshCloud(); return id; }
    const id = uid('list'); const at = now();
    update((current) => {
      const list = { id, group_id: 'family', created_by: current.currentUserId!, name, description, created_at: at, updated_at: at };
      const categories = categoriesForNewList(current.categoryTemplates, id, at, () => uid('category'));
      return { ...current, lists: [...current.lists, list], categories: [...current.categories, ...categories] };
    });
    return id;
  };
  const archiveList = (id: string) => { if (hasSupabaseConfig) void cloud.archiveList(id).then(() => refreshCloud()).catch((error) => show(error.message)); else update((current) => ({ ...current, lists: current.lists.map((list) => list.id === id ? { ...list, archived_at: now(), updated_at: now() } : list) })); };
  const deleteList = (id: string) => { if (hasSupabaseConfig) void cloud.deleteList(id).then(() => refreshCloud()).catch((error) => show(error.message)); else update((current) => { const itemIds = new Set(current.items.filter((item) => item.list_id === id).map((item) => item.id)); const deliveryIds = new Set(current.deliveries.filter((delivery) => delivery.list_id === id).map((delivery) => delivery.id)); return { ...current, lists: current.lists.filter((list) => list.id !== id), categories: current.categories.filter((category) => category.list_id !== id), items: current.items.filter((item) => item.list_id !== id), assignments: current.assignments.filter((assignment) => !itemIds.has(assignment.item_id)), attempts: current.attempts.filter((attempt) => !itemIds.has(attempt.item_id)), deliveries: current.deliveries.filter((delivery) => delivery.list_id !== id), deliveryItems: current.deliveryItems.filter((value) => !deliveryIds.has(value.delivery_id)), notifications: current.notifications.filter((value) => value.list_id !== id), activity: current.activity.filter((value) => value.list_id !== id), images: current.images.filter((image) => !itemIds.has(image.item_id)) }; }); };
  const addCategory = (listId: string, name: string) => { if (hasSupabaseConfig) { const order = state.categories.filter((value) => value.list_id === listId).length; void cloud.createCategory(listId, cloudGroupId.current!, state.currentUserId!, name, order).then(() => refreshCloud()).catch((error) => show(error.message)); return; } update((current) => {
    const at = now(); const sort_order = current.categories.filter((category) => category.list_id === listId).length;
    const category: Category = { id: uid('category'), list_id: listId, name, sort_order, created_at: at, updated_at: at };
    const exists = current.categoryTemplates.some((template) => template.name.trim().toLocaleLowerCase('et-EE') === name.trim().toLocaleLowerCase('et-EE'));
    const template = { id: uid('template'), group_id: 'family', created_by: current.currentUserId!, name: name.trim(), sort_order: current.categoryTemplates.length, created_at: at, updated_at: at };
    return { ...current, categories: [...current.categories, category], categoryTemplates: exists ? current.categoryTemplates : [...current.categoryTemplates, template] };
  }); };
  const toggleCategory = (id: string) => update((current) => ({ ...current, categories: current.categories.map((category) => category.id === id ? { ...category, collapsed: !category.collapsed, updated_at: now() } : category) }));
  const renameCategory = (id: string, name: string) => { if (hasSupabaseConfig) void cloud.updateCategory(id, { name }).then(() => refreshCloud()).catch((error) => show(error.message)); else update((current) => ({ ...current, categories: current.categories.map((category) => category.id === id ? { ...category, name, updated_at: now() } : category) })); };
  const reorderCategory = (id: string, direction: -1 | 1) => { const targetNow = state.categories.find((category) => category.id === id); const orderedNow = state.categories.filter((category) => category.list_id === targetNow?.list_id).sort((a, b) => a.sort_order - b.sort_order); const swapNow = orderedNow[orderedNow.findIndex((category) => category.id === id) + direction]; if (hasSupabaseConfig) { if (targetNow && swapNow) void Promise.all([cloud.updateCategory(id, { sort_order: swapNow.sort_order }), cloud.updateCategory(swapNow.id, { sort_order: targetNow.sort_order })]).then(() => refreshCloud()).catch((error) => show(error.message)); return; } update((current) => {
    const target = current.categories.find((category) => category.id === id); if (!target) return current;
    const ordered = current.categories.filter((category) => category.list_id === target.list_id).sort((a, b) => a.sort_order - b.sort_order); const index = ordered.findIndex((category) => category.id === id); const swap = ordered[index + direction]; if (!swap) return current;
    return { ...current, categories: current.categories.map((category) => category.id === target.id ? { ...category, sort_order: swap.sort_order, updated_at: now() } : category.id === swap.id ? { ...category, sort_order: target.sort_order, updated_at: now() } : category) };
  }); };
  const addItem = async (listId: string, input: NewItem, photo?: NewItemPhoto) => { if (hasSupabaseConfig) {
    let itemId: string | undefined;
    try {
      itemId = await cloud.createItem({ list_id: listId, created_by: state.currentUserId, ...input, status: statusForAssignment(input.assigned_to), searched_before: false });
      if (photo) await cloud.saveItemImage(cloudGroupId.current!, itemId, state.currentUserId!, await photoBytes(photo), photo.mimeType ?? 'image/jpeg');
      await refreshCloud();
      return true;
    } catch (error) {
      if (itemId && photo) await cloud.deleteItem(itemId).catch(() => undefined);
      show(error instanceof Error ? error.message : 'Toote lisamine ebaõnnestus.');
      return false;
    }
  } update((current) => {
    const at = now(); const id = uid('item');
    const item: Item = { id, list_id: listId, created_by: current.currentUserId!, name: input.name, quantity: input.quantity, unit: input.unit, note: input.note, category_id: input.category_id, assigned_to: input.assigned_to, status: statusForAssignment(input.assigned_to), searched_before: false, created_at: at, updated_at: at };
    const activity = { id: uid('activity'), group_id: 'family', actor_id: current.currentUserId!, list_id: listId, item_id: id, action: 'Lisas toote', new_status: item.status, created_at: at, updated_at: at } as const;
    const assignment = input.assigned_to ? { id: uid('assignment'), item_id: id, user_id: input.assigned_to, assigned_by: current.currentUserId!, status: 'accepted' as const, created_at: at, updated_at: at } : null;
    const notification = input.assigned_to && input.assigned_to !== current.currentUserId ? { id: uid('notification'), group_id: 'family', user_id: input.assigned_to, actor_id: current.currentUserId!, list_id: listId, item_id: id, type: 'item_assigned', title: 'Uus ülesanne', body: `Sulle määrati toode „${item.name}“.`, created_at: at, updated_at: at } : null;
    const previewUri = photo?.base64 ? `data:${photo.mimeType ?? 'image/jpeg'};base64,${photo.base64}` : photo?.uri;
    const image = photo ? { id: uid('image'), item_id: id, created_by: current.currentUserId!, storage_path: `demo/${id}/${Date.now()}`, preview_uri: previewUri, created_at: at, updated_at: at } : null;
    return { ...current, items: [...current.items, item], assignments: assignment ? [...current.assignments, assignment] : current.assignments, notifications: notification ? [notification, ...current.notifications] : current.notifications, activity: [...current.activity, activity], images: image ? [...current.images, image] : current.images };
  }); return true; };
  const addQuickItem = async (input: Pick<Item, 'name' | 'quantity'> & Partial<Pick<Item, 'unit' | 'note'>>, photo?: NewItemPhoto) => { if (hasSupabaseConfig) {
    let itemId: string | undefined;
    try {
      itemId = await cloud.createQuickItem(cloudGroupId.current!, input);
      if (photo) await cloud.saveItemImage(cloudGroupId.current!, itemId, state.currentUserId!, await photoBytes(photo), photo.mimeType ?? 'image/jpeg');
      await refreshCloud();
      return true;
    } catch (error) {
      if (itemId && photo) await cloud.deleteItem(itemId).catch(() => undefined);
      show(error instanceof Error ? error.message : 'Toote lisamine ebaõnnestus.');
      return false;
    }
  } update((current) => {
    const at = now();
    const existingList = current.lists.find((list) => list.is_quick_list);
    const listId = existingList?.id ?? uid('quick-list');
    const existingCategory = current.categories.find((category) => category.list_id === listId);
    const categoryId = existingCategory?.id ?? uid('quick-category');
    const id = uid('item');
    const list = existingList ?? { id: listId, group_id: current.groups[0]?.id ?? 'family', created_by: current.currentUserId!, name: 'Jooksev list', description: 'Ilma eraldi ostunimekirjata lisatud kaubad', is_quick_list: true, created_at: at, updated_at: at };
    const category = existingCategory ?? { id: categoryId, list_id: listId, name: 'Üldine', sort_order: 0, created_at: at, updated_at: at };
    const item: Item = { id, list_id: listId, category_id: categoryId, created_by: current.currentUserId!, name: input.name, quantity: input.quantity, unit: input.unit, note: input.note, status: 'unassigned', searched_before: false, created_at: at, updated_at: at };
    const activity = { id: uid('activity'), group_id: current.groups[0]?.id ?? 'family', actor_id: current.currentUserId!, list_id: listId, item_id: id, action: 'Lisas toote otse jooksvasse listi', new_status: 'unassigned' as const, created_at: at, updated_at: at };
    const previewUri = photo?.base64 ? `data:${photo.mimeType ?? 'image/jpeg'};base64,${photo.base64}` : photo?.uri;
    const image = photo ? { id: uid('image'), item_id: id, created_by: current.currentUserId!, storage_path: `demo/${id}/${Date.now()}`, preview_uri: previewUri, created_at: at, updated_at: at } : null;
    return { ...current, lists: existingList ? current.lists : [...current.lists, list], categories: existingCategory ? current.categories : [...current.categories, category], items: [...current.items, item], activity: [...current.activity, activity], images: image ? [...current.images, image] : current.images };
  }); return true; };
  const deleteItem = (id: string) => { if (hasSupabaseConfig) void cloud.deleteItem(id).then(() => refreshCloud()).catch((error) => show(error.message)); else update((current) => ({ ...current, items: current.items.filter((item) => item.id !== id), images: current.images.filter((image) => image.item_id !== id) })); };
  const updateItem = (id: string, values: Partial<Pick<Item, 'name' | 'quantity' | 'unit' | 'note' | 'category_id' | 'assigned_to'>>) => { if (hasSupabaseConfig) { const current = state.items.find((value) => value.id === id); const assignmentChanged = Object.prototype.hasOwnProperty.call(values, 'assigned_to') && values.assigned_to !== current?.assigned_to; void cloud.updateItem(id, { ...values, ...(assignmentChanged ? { status: statusForAssignment(values.assigned_to) } : {}) }).then(() => refreshCloud()).catch((error) => show(error.message)); return; } update((current) => {
    const previous = current.items.find((item) => item.id === id); if (!previous) return current;
    const assignmentChanged = Object.prototype.hasOwnProperty.call(values, 'assigned_to') && values.assigned_to !== previous.assigned_to;
    const at = now(); const nextStatus = assignmentChanged ? statusForAssignment(values.assigned_to) : previous.status;
    const items = current.items.map((item) => item.id === id ? { ...item, ...values, status: nextStatus, updated_at: at } : item);
    if (!assignmentChanged) return { ...current, items };
    const releasedAssignments = current.assignments.map((assignment) => assignment.item_id === id && ['pending', 'accepted'].includes(assignment.status) ? { ...assignment, status: 'released' as const, updated_at: at } : assignment);
    const assignment = values.assigned_to ? { id: uid('assignment'), item_id: id, user_id: values.assigned_to, assigned_by: current.currentUserId!, status: 'accepted' as const, created_at: at, updated_at: at } : null;
    const notification = values.assigned_to && values.assigned_to !== current.currentUserId ? { id: uid('notification'), group_id: 'family', user_id: values.assigned_to, actor_id: current.currentUserId!, list_id: previous.list_id, item_id: id, type: 'item_assigned', title: 'Uus ülesanne', body: `Sulle määrati toode „${previous.name}“.`, created_at: at, updated_at: at } : null;
    const activity = { id: uid('activity'), group_id: 'family', actor_id: current.currentUserId!, list_id: previous.list_id, item_id: id, action: values.assigned_to ? `Määras toote kasutajale ${current.profiles.find((profile) => profile.id === values.assigned_to)?.display_name ?? 'viija'}` : 'Liigutas toote jooksvasse listi', previous_status: previous.status, new_status: nextStatus, created_at: at, updated_at: at };
    return { ...current, items, assignments: assignment ? [...releasedAssignments, assignment] : releasedAssignments, notifications: notification ? [notification, ...current.notifications] : current.notifications, activity: [...current.activity, activity] };
  }); };
  const markAllRead = () => { if (hasSupabaseConfig) void cloud.markNotificationsRead(state.currentUserId!).then(() => refreshCloud()).catch((error) => show(error.message)); else update((current) => ({ ...current, notifications: current.notifications.map((value) => value.user_id === current.currentUserId ? { ...value, read_at: value.read_at ?? now() } : value) })); };
  const addNote = (input: Pick<Note, 'title' | 'content'> & Partial<Pick<Note, 'phone' | 'url' | 'pinned'>>) => { if (hasSupabaseConfig) { void cloud.createNote({ ...input, group_id: cloudGroupId.current, created_by: state.currentUserId, pinned: input.pinned ?? false }).then(() => refreshCloud()).catch((error) => show(error.message)); return; } update((current) => {
    const at = now(); return { ...current, notes: [{ ...input, pinned: input.pinned ?? false, id: uid('note'), group_id: 'family', created_by: current.currentUserId!, created_at: at, updated_at: at }, ...current.notes] };
  }); };
  const updateNote = (id: string, input: Pick<Note, 'title' | 'content'> & Partial<Pick<Note, 'phone' | 'url'>>) => {
    if (hasSupabaseConfig) { void cloud.updateNote(id, { ...input, phone: input.phone ?? null, url: input.url ?? null }).then(() => refreshCloud()).catch((error) => show(error.message)); return; }
    update((current) => ({ ...current, notes: current.notes.map((value) => value.id === id ? { ...value, ...input, updated_at: now() } : value) }));
  };
  const deleteNote = (id: string) => {
    if (hasSupabaseConfig) { void cloud.deleteNote(id).then(() => refreshCloud()).catch((error) => show(error.message)); return; }
    update((current) => ({ ...current, notes: current.notes.filter((value) => value.id !== id) }));
  };
  const setItemImage = async (itemId: string, uri: string, mimeType?: string | null, base64?: string | null) => { if (hasSupabaseConfig) {
    try { await cloud.saveItemImage(cloudGroupId.current!, itemId, state.currentUserId!, await photoBytes({ uri, mimeType, base64 }), mimeType ?? 'image/jpeg'); await refreshCloud(); }
    catch (error) { show(error instanceof Error ? error.message : 'Foto salvestamine ebaõnnestus.'); }
    return;
  } update((current) => {
    const at = now(); const previous = current.images.find((image) => image.item_id === itemId);
    const previewUri = base64 ? `data:${mimeType ?? 'image/jpeg'};base64,${base64}` : uri;
    const image = { id: previous?.id ?? uid('image'), item_id: itemId, created_by: current.currentUserId!, storage_path: `demo/${itemId}/${Date.now()}`, preview_uri: previewUri, created_at: previous?.created_at ?? at, updated_at: at };
    return { ...current, images: [...current.images.filter((value) => value.item_id !== itemId), image] };
  }); };
  const removeItemImage = async (itemId: string) => { if (hasSupabaseConfig) { try { await cloud.removeItemImage(itemId, state.currentUserId!); await refreshCloud(); } catch (error) { show(error instanceof Error ? error.message : 'Foto eemaldamine ebaõnnestus.'); } return; } update((current) => ({ ...current, images: current.images.filter((value) => value.item_id !== itemId) })); };
  const saveDelivery = (listId: string, input: Pick<Delivery, 'ship_name' | 'departure_date' | 'departure_time' | 'port' | 'handover_place'> & Partial<Pick<Delivery, 'note'>>, delivered = false) => { if (hasSupabaseConfig) { const previous = state.deliveries.find((value) => value.list_id === listId && value.courier_id === state.currentUserId); const operation = delivered ? cloud.completeDelivery({ ...(previous ? { delivery_id: previous.id } : {}), ...input, target_list: listId }) : cloud.upsertDelivery({ ...(previous ? { id: previous.id } : {}), ...input, list_id: listId, created_by: state.currentUserId, courier_id: state.currentUserId, status: 'planned' }); void operation.then(() => refreshCloud()).catch((error) => show(error.message)); return; } update((current) => saveDeliveryInDemo(current, listId, current.currentUserId!, input, delivered)); };
  const createSettlement = async (input: Pick<Settlement, 'debtor_id' | 'amount' | 'description'> & Partial<Pick<Settlement, 'shopping_list_id'>>) => {
    if (!state.currentUserId) throw new Error('Kasutajat ei leitud.');
    if (hasSupabaseConfig) { await cloud.createSettlement(cloudGroupId.current!, input); await refreshCloud(); return; }
    update((current) => createSettlementInDemo(current, current.currentUserId!, input));
  };
  const markSettlementPaid = async (id: string) => {
    if (!state.currentUserId) throw new Error('Kasutajat ei leitud.');
    if (hasSupabaseConfig) { await cloud.markSettlementPaid(id); await refreshCloud(); return; }
    update((current) => markSettlementPaidInDemo(current, id, current.currentUserId!));
  };
  const confirmSettlementPaid = async (id: string) => {
    if (!state.currentUserId) throw new Error('Kasutajat ei leitud.');
    if (hasSupabaseConfig) { await cloud.confirmSettlementPaid(id); await refreshCloud(); return; }
    update((current) => confirmSettlementPaidInDemo(current, id, current.currentUserId!));
  };
  const cancelSettlement = async (id: string) => {
    if (!state.currentUserId) throw new Error('Kasutajat ei leitud.');
    if (hasSupabaseConfig) { await cloud.cancelSettlement(id); await refreshCloud(); return; }
    update((current) => cancelSettlementInDemo(current, id, current.currentUserId!));
  };

  const currentUser = state.profiles.find((profile) => profile.id === state.currentUserId);
  const themeMode: ThemeMode = currentUser?.theme_preference === 'dark' ? 'dark' : 'light';
  const themeColors = colorsFor(themeMode);
  const isMember = state.groupMembers.some((member) => member.profile_id === state.currentUserId);
  // Kõigil grupiliikmetel on ostunimekirjade, kategooriate ja toodete haldamisel võrdsed õigused.
  const isCreator = canManageShoppingContent(state, state.currentUserId);
  const isAdmin = state.groupMembers.some((member) => member.profile_id === state.currentUserId && member.role === 'admin');
  const demoGroups: GroupMembership[] = state.groups.map((group) => ({ ...group, role: state.groupMembers.find((member) => member.group_id === group.id && member.profile_id === state.currentUserId)?.role ?? 'buyer' }));
  const value: AppContextValue = { state, mode: hasSupabaseConfig ? 'supabase' : 'demo', ready, currentUser, isMember, isCreator, isAdmin, hasAuthSession: Boolean(authAccount), authEmail: authAccount?.email, authDisplayName: authAccount?.displayName, isAnonymousAccount: Boolean(authAccount?.isAnonymous), availableGroups: hasSupabaseConfig ? availableGroups : demoGroups, activeGroupId: hasSupabaseConfig ? activeGroupId : (state.groups[0]?.id ?? null), groupInvites, themeMode, themeColors, setThemeMode, renameGroup, removeMember, createGroup, switchGroup, createInvite, revokeInvite, signIn, signInEmail, registerEmail, linkEmailAccount, signInGoogle, joinGroup, signOut, resetDemo, claim, accept, decline, releaseAll, outcome, addList, archiveList, deleteList, addCategory, toggleCategory, renameCategory, reorderCategory, addItem, addQuickItem, updateItem, deleteItem, markAllRead, addNote, updateNote, deleteNote, setItemImage, removeItemImage, saveDelivery, createSettlement, markSettlementPaid, confirmSettlementPaid, cancelSettlement };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('useApp peab olema AppProvideri sees');
  return value;
}
