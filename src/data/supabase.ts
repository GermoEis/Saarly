import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const hasSupabaseConfig = Boolean(url && key && process.env.EXPO_PUBLIC_APP_MODE !== 'demo');
export const googleAuthEnabled = process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

const nativeSecureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const createSaarlyClient = () => createClient(url!, key!, {
  auth: {
    storage: Platform.OS === 'web' ? AsyncStorage : nativeSecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

type SaarlyClient = ReturnType<typeof createSaarlyClient>;
type SaarlyGlobals = typeof globalThis & { __saarlySupabase?: SaarlyClient };

const globals = globalThis as SaarlyGlobals;
export const supabase = url && key ? (globals.__saarlySupabase ?? createSaarlyClient()) : null;

if (supabase) globals.__saarlySupabase = supabase;
