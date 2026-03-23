"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Radio, Shield, Users } from "lucide-react";

interface LiveRoomListItem {
  id: string;
  title: string;
  host_name: string;
  host_avatar_url: string | null;
  status: string;
  started_at: string | null;
  scheduled_end_at: string;
  ended_at: string | null;
  extension_count: number;
  viewer_count: number;
  admin_count: number;
  entry_fee_points: number;
  entry_revenue_points: number;
  gift_points: number;
  viewer_limit: number;
}

interface LiveRoomDetail {
  room: {
    id: string;
    title: string;
    host_id: string;
    host_name: string;
    host_avatar_url: string | null;
    thumbnail_url: string | null;
    entry_fee_points: number;
    viewer_limit: number;
    planned_duration_min: number;
    scheduled_end_at: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    extension_count: number;
    chat_locked: boolean;
  };
  participants: Array<{
    user_id: string;
    name: string;
    avatar_url: string | null;
    role: string;
    status: string;
    paid_points: number;
    joined_at: string | null;
    left_at: string | null;
    refund_status: string;
    blocked_until_room_end: boolean;
    is_muted: boolean;
  }>;
  chat_messages: Array<{
    id: string;
    sender_id: string;
    sender_role: string;
    sender_name: string;
    message: string;
    created_at: string;
  }>;
  moderation_actions: Array<{
    id: string;
    target_user_id: string | null;
    target_name: string | null;
    actor_user_id: string;
    actor_name: string;
    actor_role: string;
    action: string;
    reason: string | null;
    created_at: string;
  }>;
  gift_points: number;
}

export default function AdminLivePage() {
  const [status, setStatus] = useState("live");
  const [rooms, setRooms] = useState<LiveRoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LiveRoomDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const loadRooms = async () => {
    setLoading(true);
    const res = await fetch(`/admin/api/live/rooms?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      setRooms(data.rooms ?? []);
    }
    setLoading(false);
  };

  const loadDetail = async (roomId: string) => {
    setSelectedRoomId(roomId);
    setDetailLoading(true);
    const res = await fetch(`/admin/api/live/rooms/${roomId}`);
    if (res.ok) {
      const data = await res.json();
      setDetail(data);
    }
    setDetailLoading(false);
  };

  useEffect(() => {
    loadRooms();
  }, [status]);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const stats = useMemo(() => {
    return {
      total: rooms.length,
      live: rooms.filter((room) => room.status === "live").length,
      viewers: rooms.reduce((sum, room) => sum + room.viewer_count, 0),
      revenue: rooms.reduce((sum, room) => sum + room.entry_revenue_points, 0),
    };
  }, [rooms]);

  const handleForceEnd = async (roomId: string) => {
    if (!confirm("이 라이브를 강제 종료하시겠습니까?")) {
      return;
    }

    setActionLoading(true);
    const res = await fetch(`/admin/api/live/rooms/${roomId}/end`, { method: "POST" });
    setActionLoading(false);

    if (res.ok) {
      showToast("라이브를 강제 종료했습니다.");
      loadRooms();
      if (selectedRoomId === roomId) {
        setSelectedRoomId(null);
        setDetail(null);
      }
      return;
    }

    const data = await res.json().catch(() => ({}));
    showToast(data.message || "강제 종료에 실패했습니다.", "error");
  };

  const handleModeration = async (
    roomId: string,
    action: "kick" | "mute_user" | "unmute_user" | "lock_chat" | "unlock_chat",
    targetUserId?: string,
  ) => {
    const reason =
      action === "kick" || action === "mute_user" || action === "lock_chat"
        ? prompt("사유를 입력하세요. 비워두면 기록 없이 처리합니다.") || ""
        : "";

    setActionLoading(true);
    const res = await fetch(`/admin/api/live/rooms/${roomId}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        target_user_id: targetUserId,
        reason,
      }),
    });
    setActionLoading(false);

    if (res.ok) {
      showToast("운영 조치를 반영했습니다.");
      loadRooms();
      if (selectedRoomId) {
        loadDetail(selectedRoomId);
      }
      return;
    }

    const data = await res.json().catch(() => ({}));
    showToast(data.message || "운영 조치에 실패했습니다.", "error");
  };

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">라이브 관리</h2>
        <div className="topbar-actions">
          <span className="text-gray text-sm">현재 목록 {stats.total}건</span>
          <span className="admin-badge">Live Ops</span>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "목록 수", value: stats.total, color: "#1B2A4A" },
            { label: "진행 중", value: stats.live, color: "#FF6B9D" },
            { label: "현재 시청자", value: stats.viewers, color: "#4D9FFF" },
            { label: "입장 매출", value: `${stats.revenue.toLocaleString()}P`, color: "#22C55E" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value" style={{ color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">라이브 목록</span>
            <div className="tabs" style={{ borderBottom: "none", marginBottom: 0 }}>
              {[
                { value: "live", label: "진행 중" },
                { value: "ended", label: "종료 이력" },
                { value: "all", label: "전체" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  className={`tab ${status === tab.value ? "active" : ""}`}
                  onClick={() => setStatus(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="empty-state">
              <div className="icon">
                <Radio size={32} color="#C8C8D8" />
              </div>
              <p>표시할 라이브가 없습니다.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>방송</th>
                    <th>상태</th>
                    <th>인원</th>
                    <th>시간</th>
                    <th>매출</th>
                    <th>선물</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <strong>{room.title}</strong>
                          <span style={{ fontSize: 12, color: "var(--gray-500)" }}>{room.host_name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <span className={`badge ${room.status === "live" ? "badge-pink" : "badge-gray"}`}>
                            {room.status}
                          </span>
                          {room.extension_count > 0 && <span className="badge badge-blue">연장 {room.extension_count}회</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className="badge badge-blue">
                            시청자 {room.viewer_count}/{room.viewer_limit}
                          </span>
                          <span className="badge badge-gray">관리자 {room.admin_count}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--gray-500)" }}>
                        <div>시작: {room.started_at ? new Date(room.started_at).toLocaleString("ko-KR") : "-"}</div>
                        <div>종료 예정: {new Date(room.scheduled_end_at).toLocaleString("ko-KR")}</div>
                      </td>
                      <td>{room.entry_revenue_points.toLocaleString()}P</td>
                      <td>{room.gift_points.toLocaleString()}P</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn btn-sm btn-outline" onClick={() => loadDetail(room.id)}>
                            상세
                          </button>
                          {room.status === "live" && (
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleForceEnd(room.id)}
                              disabled={actionLoading}
                            >
                              강제 종료
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {(selectedRoomId || detailLoading) && (
        <div className="modal-backdrop" onClick={() => { setSelectedRoomId(null); setDetail(null); }}>
          <div className="modal" style={{ maxWidth: 960 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{detail?.room.title ?? "라이브 상세"}</span>
              <button
                onClick={() => {
                  setSelectedRoomId(null);
                  setDetail(null);
                }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--gray-400)" }}
              >
                ×
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="loading-center" style={{ padding: 40 }}>
                <div className="spinner" />
              </div>
            ) : (
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
                  <div style={{ background: "var(--gray-50)", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 12, color: "var(--gray-500)", marginBottom: 8 }}>기본 정보</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div className="stat-label">호스트</div>
                        <div style={{ fontWeight: 600 }}>{detail.room.host_name}</div>
                      </div>
                      <div>
                        <div className="stat-label">상태</div>
                        <div style={{ fontWeight: 600 }}>{detail.room.status}</div>
                      </div>
                      <div>
                        <div className="stat-label">입장료</div>
                        <div style={{ fontWeight: 600 }}>{detail.room.entry_fee_points.toLocaleString()}P</div>
                      </div>
                      <div>
                        <div className="stat-label">연장 횟수</div>
                        <div style={{ fontWeight: 600 }}>{detail.room.extension_count}회</div>
                      </div>
                      <div>
                        <div className="stat-label">예정 시간</div>
                        <div style={{ fontWeight: 600 }}>{detail.room.planned_duration_min}분</div>
                      </div>
                      <div>
                        <div className="stat-label">채팅 잠금</div>
                        <div style={{ fontWeight: 600 }}>{detail.room.chat_locked ? "잠금" : "열림"}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "var(--gray-50)", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 12, color: "var(--gray-500)", marginBottom: 12 }}>운영 액션</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button
                        className={`btn ${detail.room.chat_locked ? "btn-secondary" : "btn-primary"}`}
                        onClick={() =>
                          handleModeration(
                            detail.room.id,
                            detail.room.chat_locked ? "unlock_chat" : "lock_chat",
                          )
                        }
                        disabled={actionLoading}
                      >
                        {detail.room.chat_locked ? "전체 채팅 열기" : "전체 채팅 잠그기"}
                      </button>
                      {detail.room.status === "live" && (
                        <button
                          className="btn btn-danger"
                          onClick={() => handleForceEnd(detail.room.id)}
                          disabled={actionLoading}
                        >
                          라이브 강제 종료
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
                  <div className="card" style={{ borderRadius: 12 }}>
                    <div className="card-header">
                      <span className="card-title">참여자</span>
                      <span className="badge badge-blue">{detail.participants.length}명</span>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>닉네임</th>
                            <th>역할</th>
                            <th>상태</th>
                            <th>채팅</th>
                            <th>관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.participants.map((participant) => (
                            <tr key={participant.user_id}>
                              <td>{participant.name}</td>
                              <td>
                                <span className={`badge ${participant.role === "viewer" ? "badge-gray" : "badge-blue"}`}>
                                  {participant.role}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${participant.status === "joined" ? "badge-green" : participant.status === "kicked" ? "badge-red" : "badge-gray"}`}>
                                  {participant.status}
                                </span>
                              </td>
                              <td>
                                {participant.role === "viewer" ? (
                                  <span className={`badge ${participant.is_muted ? "badge-orange" : "badge-green"}`}>
                                    {participant.is_muted ? "mute" : "가능"}
                                  </span>
                                ) : (
                                  <span className="badge badge-gray">예외</span>
                                )}
                              </td>
                              <td>
                                {participant.role === "viewer" && participant.status === "joined" ? (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <button
                                      className="btn btn-sm btn-secondary"
                                      onClick={() =>
                                        handleModeration(
                                          detail.room.id,
                                          participant.is_muted ? "unmute_user" : "mute_user",
                                          participant.user_id,
                                        )
                                      }
                                      disabled={actionLoading}
                                    >
                                      {participant.is_muted ? "mute 해제" : "mute"}
                                    </button>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      onClick={() => handleModeration(detail.room.id, "kick", participant.user_id)}
                                      disabled={actionLoading}
                                    >
                                      강퇴
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-gray text-sm">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div className="card" style={{ borderRadius: 12 }}>
                      <div className="card-header">
                        <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <MessageSquare size={16} /> 최근 채팅
                        </span>
                      </div>
                      <div style={{ maxHeight: 280, overflowY: "auto", padding: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {detail.chat_messages.slice(-20).map((message) => (
                            <div key={message.id} style={{ background: "var(--gray-50)", borderRadius: 10, padding: 10 }}>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>
                                {message.sender_name} <span style={{ color: "var(--gray-400)" }}>({message.sender_role})</span>
                              </div>
                              <div style={{ fontSize: 13, color: "var(--gray-700)", marginTop: 4 }}>{message.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="card" style={{ borderRadius: 12 }}>
                      <div className="card-header">
                        <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Shield size={16} /> 운영 로그
                        </span>
                      </div>
                      <div style={{ maxHeight: 220, overflowY: "auto", padding: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {detail.moderation_actions.length === 0 ? (
                            <span className="text-gray text-sm">운영 이력이 없습니다.</span>
                          ) : (
                            detail.moderation_actions.map((action) => (
                              <div key={action.id} style={{ background: "var(--gray-50)", borderRadius: 10, padding: 10 }}>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>
                                  {action.actor_name} · {action.action}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 4 }}>
                                  대상: {action.target_name ?? "-"}
                                </div>
                                {action.reason && (
                                  <div style={{ fontSize: 12, color: "var(--gray-700)", marginTop: 4 }}>{action.reason}</div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
