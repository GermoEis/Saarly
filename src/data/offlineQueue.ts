import AsyncStorage from '@react-native-async-storage/async-storage';
import { DemoState, GroupInvite, GroupMembership } from '@/types/domain';

const ACTIONS_KEY = 'saarly-offline-actions-v1';
const cacheKey = (userId: string) => `saarly-cloud-cache-v1:${userId}`;

export interface OfflinePurchaseAction {
  id: string;
  type: 'purchase';
  userId: string;
  groupId: string;
  itemId: string;
  previousStatus: 'assigned' | 'accepted' | 'purchased';
  createdAt: string;
}

export interface CloudWorkspaceCache {
  userId: string;
  activeGroupId: string | null;
  groups: GroupMembership[];
  invites: GroupInvite[];
  state: DemoState;
  savedAt: string;
}

export async function loadOfflineActions(): Promise<OfflinePurchaseAction[]> {
  try { return JSON.parse(await AsyncStorage.getItem(ACTIONS_KEY) ?? '[]') as OfflinePurchaseAction[]; }
  catch { return []; }
}

export async function saveOfflineActions(actions: OfflinePurchaseAction[]) {
  await AsyncStorage.setItem(ACTIONS_KEY, JSON.stringify(actions));
}

export async function saveCloudWorkspaceCache(cache: CloudWorkspaceCache) {
  await AsyncStorage.setItem(cacheKey(cache.userId), JSON.stringify(cache));
}

export async function loadCloudWorkspaceCache(userId: string): Promise<CloudWorkspaceCache | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) as CloudWorkspaceCache : null;
  } catch { return null; }
}

export function applyOfflinePurchase(state: DemoState, itemId: string, changedAt = new Date().toISOString()): DemoState {
  return { ...state, items: state.items.map((item) => item.id === itemId ? { ...item, status: 'purchased', updated_at: changedAt } : item) };
}
