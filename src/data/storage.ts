import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DemoState } from '@/types/domain';

export const STORAGE_KEY = 'saarly-demo-v3';
export const USER_KEY = 'saarly-demo-user-v3';

export async function loadDemo(): Promise<DemoState | null> {
  try {
    const raw = Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as DemoState;
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') state.currentUserId = sessionStorage.getItem(USER_KEY);
    return state;
  } catch { return null; }
}

export async function saveDemo(state: DemoState) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, currentUserId: null }));
    if (state.currentUserId) sessionStorage.setItem(USER_KEY, state.currentUserId); else sessionStorage.removeItem(USER_KEY);
  } else await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
