export interface LiveEligibilityResponse {
  eligible: boolean;
  live_enabled: boolean;
  is_live_now: boolean;
  reason: string | null;
}

export interface LiveRoomListItem {
  id: string;
  host_id: string;
  host_name: string;
  host_avatar_url: string | null;
  title: string;
  thumbnail_url: string | null;
  entry_fee_points: number;
  viewer_limit: number;
  viewer_count: number;
  planned_duration_min: number;
  scheduled_end_at: string;
  status: "ready" | "live" | "ended" | "cancelled";
  started_at: string | null;
}

export interface LiveRoomsResponse {
  rooms: LiveRoomListItem[];
}

export interface LiveRoomDetailResponse {
  id: string;
  host: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  title: string;
  thumbnail_url: string | null;
  entry_fee_points: number;
  viewer_limit: number;
  viewer_count: number;
  planned_duration_min: number;
  scheduled_end_at: string;
  status: "ready" | "live" | "ended" | "cancelled";
  extension_count: number;
  can_join: boolean;
  is_kicked: boolean;
  is_joined: boolean;
  role: "host" | "viewer" | "admin" | null;
  chat_locked: boolean;
  is_muted: boolean;
}

export interface LiveCreateRoomResponse {
  room_id: string;
  entry_fee_points: number;
  viewer_limit: number;
  status: "ready";
}

export interface LiveStartRoomResponse {
  room_id: string;
  status: "live";
  agora_channel: string;
  agora_token: string;
  agora_app_id: string;
  scheduled_end_at: string;
}

export interface LiveJoinResponse {
  room_id: string;
  role: "viewer" | "admin";
  charged_points: number;
  remaining_points: number;
  agora_channel: string;
  agora_token: string;
  agora_app_id: string;
  join_ack_deadline_sec: number;
}

export interface LiveParticipantsResponse {
  participants: Array<{
    user_id: string;
    name: string;
    role: "host" | "viewer" | "admin";
    status: "joined" | "left" | "kicked";
    joined_at: string | null;
    left_at?: string | null;
    is_muted?: boolean;
    refund_status?: string;
  }>;
}

export interface LiveChatMessage {
  id: string;
  sender_id: string;
  sender_role: "host" | "viewer" | "admin";
  sender_name: string;
  message: string;
  created_at: string;
}

export interface LiveChatResponse {
  messages: LiveChatMessage[];
}
