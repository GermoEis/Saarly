import AsyncStorage from '@react-native-async-storage/async-storage';
import { GroupMembership } from '@/types/domain';

const ACTIVE_GROUP_KEY = 'saarly.active-group';

export function selectActiveGroupId(groups: GroupMembership[], preferredGroupId?: string | null) {
  if (preferredGroupId && groups.some((group) => group.id === preferredGroupId)) return preferredGroupId;
  return groups[0]?.id ?? null;
}

export async function loadActiveGroupId(userId: string) {
  return AsyncStorage.getItem(`${ACTIVE_GROUP_KEY}:${userId}`);
}

export async function saveActiveGroupId(userId: string, groupId: string | null) {
  const key = `${ACTIVE_GROUP_KEY}:${userId}`;
  if (groupId) await AsyncStorage.setItem(key, groupId);
  else await AsyncStorage.removeItem(key);
}
