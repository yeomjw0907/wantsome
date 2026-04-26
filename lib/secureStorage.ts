import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * SecureStore-backed storage adapter (Supabase + Zustand persist 호환).
 *
 * iOS Keychain은 단일 항목 ~2KB 제한 → Supabase 세션 토큰을 chunked 저장.
 *
 * 안전성 (PR-9 재검수 반영):
 *  - 쓰기 순서: 청크 → meta (역순). 중간 크래시 시 meta가 없으니 부분 청크는 무시됨.
 *  - 동시성: 키별 promise queue로 직렬화. Supabase auto-refresh와 zustand persist가
 *    같은 키를 동시 write할 때 데이터 corruption 방지.
 *  - Orphan cleanup: 기존 청크 수보다 적은 새 값을 쓸 때 잔존 청크 제거.
 *  - 마이그레이션: AsyncStorage에 legacy 값이 있으면 한 번만 SecureStore로 이동.
 *  - null/undefined: removeItem으로 안전 처리.
 */

const CHUNK_SIZE = 2000;
const META_SUFFIX = "__meta";
const CHUNK_PREFIX = "__chunk__";

function isSecureStoreAvailable(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

// 키별 직렬화 큐 — 동시 setItem/getItem race 방지
const writeQueues = new Map<string, Promise<unknown>>();
function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeQueues.get(name) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeQueues.set(
    name,
    next.finally(() => {
      if (writeQueues.get(name) === next) writeQueues.delete(name);
    }),
  );
  return next;
}

async function readMeta(name: string): Promise<{ totalChunks: number } | null> {
  const metaRaw = await SecureStore.getItemAsync(`${name}${META_SUFFIX}`);
  if (!metaRaw) return null;
  try {
    const parsed = JSON.parse(metaRaw) as { totalChunks?: unknown };
    if (typeof parsed.totalChunks !== "number" || parsed.totalChunks < 0) return null;
    return { totalChunks: parsed.totalChunks };
  } catch {
    return null;
  }
}

async function deleteChunkRange(name: string, fromIndex: number, toExclusive: number): Promise<void> {
  for (let i = fromIndex; i < toExclusive; i++) {
    await SecureStore.deleteItemAsync(`${name}${CHUNK_PREFIX}${i}`);
  }
}

async function setItemSecureLocked(name: string, value: string): Promise<void> {
  const totalChunks = value.length === 0 ? 0 : Math.ceil(value.length / CHUNK_SIZE);

  // 이전 메타 → 잔존 청크 수 (orphan cleanup용)
  const prevMeta = await readMeta(name);
  const prevTotal = prevMeta?.totalChunks ?? 0;

  // 1) 청크 먼저 — meta는 마지막에 (중간 크래시 시 meta가 없으니 일관)
  for (let i = 0; i < totalChunks; i++) {
    const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await SecureStore.setItemAsync(`${name}${CHUNK_PREFIX}${i}`, chunk);
  }

  // 2) 메타 commit (이 시점부터 새 값이 가시적)
  await SecureStore.setItemAsync(`${name}${META_SUFFIX}`, JSON.stringify({ totalChunks }));

  // 3) Orphan cleanup — 이전 값이 더 길었으면 잔존 청크 제거
  if (prevTotal > totalChunks) {
    await deleteChunkRange(name, totalChunks, prevTotal);
  }
}

async function getItemSecureLocked(name: string): Promise<string | null> {
  const meta = await readMeta(name);
  if (!meta) return null;
  if (meta.totalChunks === 0) return "";
  let result = "";
  for (let i = 0; i < meta.totalChunks; i++) {
    const chunk = await SecureStore.getItemAsync(`${name}${CHUNK_PREFIX}${i}`);
    if (chunk === null) return null; // partial write 의심
    result += chunk;
  }
  return result;
}

async function removeItemSecureLocked(name: string): Promise<void> {
  const meta = await readMeta(name);
  // 메타 먼저 삭제 (이 시점부터 getItem이 null 반환)
  await SecureStore.deleteItemAsync(`${name}${META_SUFFIX}`);
  if (meta) {
    await deleteChunkRange(name, 0, meta.totalChunks);
  }
}

// AsyncStorage → SecureStore 일회성 마이그레이션
// SecureStore에 값 없고 AsyncStorage에 legacy 값이 있으면 이동.
// 이전 빌드에서 로그인된 사용자가 강제 로그아웃되는 것 방지.
const migratedKeys = new Set<string>();
async function migrateFromAsyncStorage(name: string): Promise<string | null> {
  if (migratedKeys.has(name)) return null;
  migratedKeys.add(name);
  try {
    const legacy = await AsyncStorage.getItem(name);
    if (legacy === null) return null;
    await setItemSecureLocked(name, legacy);
    await AsyncStorage.removeItem(name);
    return legacy;
  } catch {
    return null;
  }
}

export const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!isSecureStoreAvailable()) return AsyncStorage.getItem(name);
    return withLock(name, async () => {
      const cur = await getItemSecureLocked(name);
      if (cur !== null) return cur;
      return migrateFromAsyncStorage(name);
    });
  },
  setItem: async (name: string, value: string | null | undefined): Promise<void> => {
    if (value === null || value === undefined) {
      await secureStorage.removeItem(name);
      return;
    }
    if (!isSecureStoreAvailable()) {
      await AsyncStorage.setItem(name, value);
      return;
    }
    await withLock(name, () => setItemSecureLocked(name, value));
  },
  removeItem: async (name: string): Promise<void> => {
    if (!isSecureStoreAvailable()) {
      await AsyncStorage.removeItem(name);
      return;
    }
    await withLock(name, () => removeItemSecureLocked(name));
  },
};
