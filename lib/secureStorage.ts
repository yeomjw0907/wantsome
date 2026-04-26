import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * SecureStore-backed storage adapter (Supabase + Zustand persist 호환).
 *
 * iOS Keychain은 단일 항목 ~2KB 제한 + 큰 값에 대한 성능 저하가 있어
 * Supabase 세션(refresh + access token + user metadata)이 저장 안 될 수 있음.
 *
 * 해결: chunking 패턴 — value를 2KB 청크로 분할 후 메타(청크 수)와 함께 저장.
 * 키는 `${name}__chunk__${i}` 형태. 메타는 `${name}__meta`.
 *
 * 웹/SecureStore 미지원 환경에선 AsyncStorage로 fallback.
 */

const CHUNK_SIZE = 2000;
const META_SUFFIX = "__meta";
const CHUNK_PREFIX = "__chunk__";

function isSecureStoreAvailable(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

async function setItemSecure(name: string, value: string): Promise<void> {
  const totalChunks = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(`${name}${META_SUFFIX}`, JSON.stringify({ totalChunks }));
  for (let i = 0; i < totalChunks; i++) {
    const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await SecureStore.setItemAsync(`${name}${CHUNK_PREFIX}${i}`, chunk);
  }
}

async function getItemSecure(name: string): Promise<string | null> {
  const metaRaw = await SecureStore.getItemAsync(`${name}${META_SUFFIX}`);
  if (!metaRaw) return null;
  let meta: { totalChunks: number };
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return null;
  }
  let result = "";
  for (let i = 0; i < meta.totalChunks; i++) {
    const chunk = await SecureStore.getItemAsync(`${name}${CHUNK_PREFIX}${i}`);
    if (chunk === null) return null;
    result += chunk;
  }
  return result;
}

async function removeItemSecure(name: string): Promise<void> {
  const metaRaw = await SecureStore.getItemAsync(`${name}${META_SUFFIX}`);
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw) as { totalChunks: number };
      for (let i = 0; i < meta.totalChunks; i++) {
        await SecureStore.deleteItemAsync(`${name}${CHUNK_PREFIX}${i}`);
      }
    } catch {
      /* meta 손상 — 메타만 삭제 */
    }
  }
  await SecureStore.deleteItemAsync(`${name}${META_SUFFIX}`);
}

export const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!isSecureStoreAvailable()) return AsyncStorage.getItem(name);
    return getItemSecure(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!isSecureStoreAvailable()) {
      await AsyncStorage.setItem(name, value);
      return;
    }
    await setItemSecure(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (!isSecureStoreAvailable()) {
      await AsyncStorage.removeItem(name);
      return;
    }
    await removeItemSecure(name);
  },
};
