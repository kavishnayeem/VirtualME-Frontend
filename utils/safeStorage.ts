// utils/safeStorage.ts
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const canUseSecure = Platform.OS !== 'web';

export async function setItem(key: string, value: string) {
  try {
    if (canUseSecure && (await SecureStore.isAvailableAsync())) {
      await SecureStore.setItemAsync(key, value, { keychainService: 'vm', requireAuthentication: false });
      return;
    }
  } catch (e) {
    console.warn('[secure-store setItem failed]', e);
  }
  await AsyncStorage.setItem(key, value);
}

export async function getItem(key: string) {
  try {
    if (canUseSecure && (await SecureStore.isAvailableAsync())) {
      const v = await SecureStore.getItemAsync(key, { keychainService: 'vm', requireAuthentication: false });
      if (v != null) return v;
    }
  } catch (e) {
    console.warn('[secure-store getItem failed]', e);
  }
  return AsyncStorage.getItem(key);
}

export async function deleteItem(key: string) {
  try {
    if (canUseSecure && (await SecureStore.isAvailableAsync())) {
      await SecureStore.deleteItemAsync(key, { keychainService: 'vm' });
    }
  } catch (e) {
    console.warn('[secure-store deleteItem failed]', e);
  }
  await AsyncStorage.removeItem(key);
}
