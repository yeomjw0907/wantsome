import { SupabaseClient } from "@supabase/supabase-js";

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * 단일 유저에게 Expo 푸시 알림 발송
 * users.push_token 컬럼 사용
 */
export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  msg: PushMessage
): Promise<boolean> {
  const { data: user } = await admin
    .from("users")
    .select("push_token")
    .eq("id", userId)
    .single();

  if (!user?.push_token) return false;
  return sendPushRaw([user.push_token], msg);
}

/**
 * 여러 유저에게 Expo 푸시 알림 발송
 */
export async function sendPushToUsers(
  admin: SupabaseClient,
  userIds: string[],
  msg: PushMessage
): Promise<void> {
  if (userIds.length === 0) return;

  const { data: users } = await admin
    .from("users")
    .select("push_token")
    .in("id", userIds)
    .not("push_token", "is", null);

  const tokens = (users ?? []).map((u) => u.push_token as string).filter(Boolean);
  if (tokens.length > 0) {
    await sendPushRaw(tokens, msg);
  }
}

/**
 * 토큰 배열에 직접 Expo push 발송 (100개씩 청크)
 */
async function sendPushRaw(tokens: string[], msg: PushMessage): Promise<boolean> {
  const BATCH_SIZE = 100;
  let success = false;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const messages = batch.map((token) => ({
      to: token,
      title: msg.title,
      body: msg.body,
      sound: "default",
      data: msg.data ?? {},
    }));

    const expoToken = process.env.EXPO_ACCESS_TOKEN;
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
      },
      body: JSON.stringify(messages),
    }).then(null, () => null);

    if (res?.ok) success = true;
  }

  return success;
}
