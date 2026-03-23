"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Radio, Sprout, Star, Trophy, User, Users } from "lucide-react";

interface Creator {
  id: string;
  display_name: string;
  grade: string;
  is_online: boolean;
  is_live_now: boolean;
  live_enabled: boolean;
  live_enabled_at: string | null;
  mode_blue: boolean;
  mode_red: boolean;
  total_calls: number;
  total_earnings: number;
  created_at: string;
  _pending?: boolean;
  users: {
    nickname: string;
    email: string;
    role: string;
    profile_img: string | null;
    suspended_until: string | null;
    deleted_at: string | null;
  } | null;
}

const GRADE_ICON: Record<string, React.ElementType> = {
  NEWBIE: Sprout,
  NORMAL: Star,
  POPULAR: Flame,
  TOP: Trophy,
};

const GRADE_MAP: Record<string, { label: string; color: string }> = {
  NEWBIE: { label: "새싹", color: "badge-gray" },
  NORMAL: { label: "일반", color: "badge-blue" },
  POPULAR: { label: "인기", color: "badge-pink" },
  TOP: { label: "TOP", color: "badge-yellow" },
};

export default function CreatorsListPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [onlineFilter, setOnlineFilter] = useState("all");
  const [gradeModal, setGradeModal] = useState<Creator | null>(null);
  const [newGrade, setNewGrade] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadCreators = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) {
      params.set("q", search);
    }
    if (gradeFilter !== "all") {
      params.set("grade", gradeFilter);
    }
    if (onlineFilter !== "all") {
      params.set("online", onlineFilter);
    }

    const res = await fetch(`/admin/api/creators?${params}`);
    if (res.ok) {
      const data = await res.json();
      setCreators(data.creators ?? []);
    }
    setIsLoading(false);
  }, [search, gradeFilter, onlineFilter]);

  useEffect(() => {
    const timer = setTimeout(loadCreators, 300);
    return () => clearTimeout(timer);
  }, [loadCreators]);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const stats = useMemo(() => {
    return {
      total: creators.length,
      online: creators.filter((creator) => creator.is_online).length,
      liveEnabled: creators.filter((creator) => creator.live_enabled).length,
      liveNow: creators.filter((creator) => creator.is_live_now).length,
      pending: creators.filter((creator) => creator._pending).length,
    };
  }, [creators]);

  const handleGradeChange = async () => {
    if (!gradeModal || !newGrade) {
      return;
    }

    setIsSaving(true);
    const res = await fetch(`/admin/api/creators/${gradeModal.id}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade: newGrade }),
    });
    setIsSaving(false);

    if (res.ok) {
      showToast("등급을 변경했습니다.");
      setGradeModal(null);
      loadCreators();
      return;
    }

    const data = await res.json().catch(() => ({}));
    showToast(data.message || "등급 변경에 실패했습니다.", "error");
  };

  const handleLiveToggle = async (creator: Creator, enabled: boolean) => {
    setIsSaving(true);
    const res = await fetch(`/admin/api/creators/${creator.id}/live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setIsSaving(false);

    if (res.ok) {
      showToast(enabled ? "라이브 기능을 활성화했습니다." : "라이브 기능을 비활성화했습니다.");
      loadCreators();
      return;
    }

    const data = await res.json().catch(() => ({}));
    showToast(data.message || "라이브 권한 변경에 실패했습니다.", "error");
  };

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">크리에이터 관리</h2>
        <div className="topbar-actions">
          <span className="text-gray text-sm">총 {stats.total}명</span>
          <span className="admin-badge">Creator Ops</span>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          {[
            { label: "전체", value: stats.total, color: "#1B2A4A" },
            { label: "온라인", value: stats.online, color: "#22C55E" },
            { label: "라이브 권한", value: stats.liveEnabled, color: "#FF6B9D" },
            { label: "현재 방송중", value: stats.liveNow, color: "#4D9FFF" },
            { label: "등록 대기", value: stats.pending, color: "#F59E0B" },
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
            <span className="card-title">크리에이터 목록</span>
            <div className="filter-bar" style={{ marginBottom: 0 }}>
              <div className="search-input-wrap">
                <span className="search-icon" style={{ display: "flex", alignItems: "center" }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </span>
                <input
                  className="form-input search-input"
                  placeholder="닉네임 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="form-input form-select"
                style={{ width: 110 }}
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
              >
                <option value="all">전체 등급</option>
                <option value="NEWBIE">새싹</option>
                <option value="NORMAL">일반</option>
                <option value="POPULAR">인기</option>
                <option value="TOP">TOP</option>
              </select>
              <select
                className="form-input form-select"
                style={{ width: 110 }}
                value={onlineFilter}
                onChange={(e) => setOnlineFilter(e.target.value)}
              >
                <option value="all">전체 상태</option>
                <option value="online">온라인만</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : creators.length === 0 ? (
            <div className="empty-state">
              <div className="icon">
                <Users size={32} color="#C8C8D8" />
              </div>
              <p>조건에 맞는 크리에이터가 없습니다.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>크리에이터</th>
                    <th>상태</th>
                    <th>등급</th>
                    <th>라이브</th>
                    <th>모드</th>
                    <th>통화 수</th>
                    <th>총 수익</th>
                    <th>가입일</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((creator) => {
                    const grade = GRADE_MAP[creator.grade] ?? GRADE_MAP.NEWBIE;
                    const GradeIcon = GRADE_ICON[creator.grade] ?? Sprout;

                    return (
                      <tr key={creator.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="avatar">
                              {creator.users?.profile_img ? (
                                <img src={creator.users.profile_img} alt="" />
                              ) : (
                                <User size={18} color="#C8C8D8" />
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{creator.display_name}</div>
                              <div style={{ fontSize: 11, color: "var(--gray-400)" }}>{creator.users?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <span className={`badge ${creator.is_online ? "badge-green" : "badge-gray"}`}>
                              {creator.is_online ? "온라인" : "오프라인"}
                            </span>
                            {creator._pending && <span className="badge badge-orange">등록 대기</span>}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${grade.color}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <GradeIcon size={11} /> {grade.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <span
                              className={`badge ${creator.live_enabled ? "badge-pink" : "badge-gray"}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <Radio size={11} /> {creator.live_enabled ? "권한 활성" : "권한 없음"}
                            </span>
                            {creator.is_live_now && <span className="badge badge-blue">방송중</span>}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {creator.mode_blue && <span className="badge badge-blue">블루</span>}
                            {creator.mode_red && <span className="badge badge-red">레드</span>}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{(creator.total_calls ?? 0).toLocaleString()}</td>
                        <td style={{ fontWeight: 600 }}>{(creator.total_earnings ?? 0).toLocaleString()}P</td>
                        <td style={{ color: "var(--gray-400)", fontSize: 12 }}>
                          {new Date(creator.created_at).toLocaleDateString("ko-KR")}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => {
                                setGradeModal(creator);
                                setNewGrade(creator.grade);
                              }}
                              disabled={isSaving}
                            >
                              등급 변경
                            </button>
                            <button
                              className={`btn btn-sm ${creator.live_enabled ? "btn-secondary" : "btn-primary"}`}
                              onClick={() => handleLiveToggle(creator, !creator.live_enabled)}
                              disabled={isSaving || creator._pending}
                            >
                              {creator.live_enabled ? "라이브 끄기" : "라이브 켜기"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {gradeModal && (
        <div className="modal-backdrop" onClick={() => setGradeModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">등급 변경: {gradeModal.display_name}</span>
              <button
                onClick={() => setGradeModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--gray-400)" }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">현재 등급</label>
                <div style={{ padding: "8px 0" }}>
                  <span className={`badge ${GRADE_MAP[gradeModal.grade]?.color ?? "badge-gray"}`}>
                    {GRADE_MAP[gradeModal.grade]?.label ?? gradeModal.grade}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">변경할 등급</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { key: "NEWBIE", Icon: Sprout, label: "새싹" },
                    { key: "NORMAL", Icon: Star, label: "일반" },
                    { key: "POPULAR", Icon: Flame, label: "인기" },
                    { key: "TOP", Icon: Trophy, label: "TOP" },
                  ].map((gradeOption) => (
                    <button
                      key={gradeOption.key}
                      onClick={() => setNewGrade(gradeOption.key)}
                      style={{
                        padding: "12px 16px",
                        border: `2px solid ${newGrade === gradeOption.key ? "var(--pink)" : "var(--gray-200)"}`,
                        borderRadius: 10,
                        background: newGrade === gradeOption.key ? "rgba(255,107,157,0.05)" : "white",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 600,
                        fontSize: 14,
                        color: newGrade === gradeOption.key ? "var(--pink)" : "var(--gray-700)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        justifyContent: "center",
                      }}
                    >
                      <gradeOption.Icon size={15} /> {gradeOption.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setGradeModal(null)}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleGradeChange} disabled={newGrade === gradeModal.grade || isSaving}>
                적용
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
