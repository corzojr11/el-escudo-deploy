import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE_URL_STORAGE_KEY = '@elescudo.apiBaseUrl';
export const isLocalhostUrl = (value: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value.trim());
const DEFAULT_API_BASE_URL = (
  (Platform.OS !== 'web' && isLocalhostUrl(process.env.EXPO_PUBLIC_API_BASE_URL || '') ? '' : process.env.EXPO_PUBLIC_API_BASE_URL)
  || (Platform.OS === 'web' ? 'http://localhost:8001' : '')
).replace(/\/+$/, '');

let cachedApiBaseUrl = DEFAULT_API_BASE_URL;

const normalizeApiBaseUrl = (value: string) => {
  const normalized = value.trim().replace(/\/+$/, '');
  return normalized || DEFAULT_API_BASE_URL;
};

export const getApiBaseUrl = () => cachedApiBaseUrl;

export const loadApiBaseUrl = async () => {
  try {
    const stored = await AsyncStorage.getItem(API_BASE_URL_STORAGE_KEY);
    if (stored && Platform.OS !== 'web' && isLocalhostUrl(stored)) {
      cachedApiBaseUrl = DEFAULT_API_BASE_URL;
      await AsyncStorage.removeItem(API_BASE_URL_STORAGE_KEY);
    } else {
      cachedApiBaseUrl = stored ? normalizeApiBaseUrl(stored) : DEFAULT_API_BASE_URL;
    }
  } catch {
    cachedApiBaseUrl = DEFAULT_API_BASE_URL;
  }

  return cachedApiBaseUrl;
};

export const setApiBaseUrl = async (value: string) => {
  const nextValue = normalizeApiBaseUrl(value);
  const safeValue = Platform.OS !== 'web' && isLocalhostUrl(nextValue) ? DEFAULT_API_BASE_URL : nextValue;
  cachedApiBaseUrl = safeValue;

  try {
    if (Platform.OS !== 'web' && isLocalhostUrl(nextValue)) {
      await AsyncStorage.removeItem(API_BASE_URL_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(API_BASE_URL_STORAGE_KEY, safeValue);
    }
  } catch {
    // Ignore storage errors; the in-memory value still applies for this session.
  }

  return cachedApiBaseUrl;
};

export const resetApiBaseUrl = async () => {
  cachedApiBaseUrl = DEFAULT_API_BASE_URL;
  try {
    await AsyncStorage.removeItem(API_BASE_URL_STORAGE_KEY);
  } catch {
    // Ignore storage errors; the default value remains in memory.
  }
  return cachedApiBaseUrl;
};
