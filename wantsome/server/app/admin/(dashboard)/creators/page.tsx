"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Sprout, Star, Flame, Trophy, Users, User } from "lucide-react";

interface Creator {
  id: string;
  display_name: string;
  profile_img: string | null;
  grade: string;
  is_online: boolean;
  mode_blue: boolean;
  mode_red: boolean;
  total_calls: number;
  total_earnings: number;
  created_at: string;
  _pending?: boolean;
  users: { nickname: string; email: string; profile_img: string | null; suspended_until: string | null; deleted_at: string | null } | null;
}

const GRADE_ICON: Record<string, React.ElementType> = {
  NEWBIE: Sprout,
  NORMAL: Star,
  POPULAR: Flame,
  TOP: Trophy,
};

const GRADE_MAP: Record<string, { label: string; color: string }> = {
  NEWBIE:  { label: "신규",  color: "badge-gray" },
  NORMAL:  { label: "일반",  color: "badge-blue" },
  POPULAR: { label: "인기",  color: "badge-pink" },
  TOP:     { label: "탑",   color: "badge-yellow" },
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

  const loadCreators = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (gradeFilter !== "all") params.set("grade", gradeFilter);
    if (onlineFilter !== "all") params.set("online", onlineFilter);
    const res = await fetch(`/admin/api/creators?${params}`);
    if (res.ok) {
      const data = await res.json();
      setCreators(data.creators ?? []);
    }
    setIsLoading(false);
  }, [search, gradeFilter, onlineFilter]);

  useEffect(() => {
    const t = setTimeout(loadCreators, 300);
    return () => clearTimeout(t);
  }, [loadCreators]);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleGradeChange = async () => {
    if (!gradeModal || !newGrade) return;
    const res = await fetch(`/admin/api/creators/${gradeModal.id}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade: newGrade }),
    });
    if (res.ok) {
      showToast("등급이 변경됐습니다.");
      setGradeModal(null);
      loadCreators();
    } else {
      const d = await res.json();
      showToast(d.message || "처리 실패", "error");
    }
  };

  const onlineCount = creators.filter((c) => c.is_online).length;

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">크리에이터 전체 목록</h2>
        <div className="topbar-actions">
          <span className="text-gray text-sm">총 {creators.length}명 · 온라인 {onlineCount}명</span>
          <span className="admin-badge">목록</span>
        </div>
      </div>

      <div className="page-content">
        {/* 요약 카드 */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          {[
            { label: "전체", value: creators.length, color: "#1B2A4A" },
            { label: "온라인", value: onlineCount, color: "#22C55E" },
            { label: "신규", value: creators.filter(c => c.grade === "NEWBIE").length, color: "#9CA3AF" },
            { label: "인기", value: creators.filter(c => c.grade === "POPULAR").length, color: "#FF6B9D" },
            { label: "탑", value: creators.filter(c => c.grade === "TOP").length, color: "#F59E0B" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="card">
          {/* 필터 */}
          <div className="card-header">
            <span className="card-title">크리에이터 목록</span>
            <div className="filter-bar" style={{ marginBottom: 0 }}>
              <div className="search-input-wrap">
                <span className="search-icon" style={{ display: "flex", alignItems: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </span>
                <input
                  className="form-input search-input"
                  placeholder="닉네임 검색..."
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
                <option value="NEWBIE">신규</option>
                <option value="NORMAL">일반</option>
                <option value="POPULAR">인기</option>
                <option value="TOP">탑</option>
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
            <div className="loading-center"><div className="spinner" /></div>
          ) : creators.length === 0 ? (
            <div className="empty-state"><div className="icon"><Users size={32} color="#C8C8D8" /></div><p>조건에 맞는 크리에이터가 없습니다.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>크리에이터</th>
                    <th>상태</th>
                    <th>등급</th>
                    <th>모드</th>
                    <th>통화수</th>
                    <th>총 수익</th>
                    <th>가입일</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((c) => {
                    const grade = GRADE_MAP[c.grade] ?? GRADE_MAP.NEWBIE;
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="avatar">
                              {c.users?.profile_img
                                ? <img src={c.users.profile_img} alt="" />
                                : <User size={18} color="#C8C8D8" />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.display_name}</div>
                              <div style={{ fontSize: 11, color: "var(--gray-400)" }}>{c.users?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{
                              width: 7, height: 7, borderRadius: "50%",
                              background: c.is_online ? "#22C55E" : "#D1D5DB"
                            }} />
                            <span style={{ fontSize: 12, color: c.is_online ? "#15803D" : "var(--gray-400)" }}>
                              {c.is_online ? "온라인" : "오프라인"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {(() => { const GIcon = GRADE_ICON[c.grade] ?? Sprout; return (
                              <span className={`badge ${grade.color}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <GIcon size={11} /> {grade.label}
                              </span>
                            ); })()}
                            {c._pending && (
                              <span className="badge badge-orange" style={{ fontSize: 10 }}>미승인</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            {c.mode_blue && <span className="badge badge-blue" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4D9FFF", display: "inline-block" }} /> 파란불</span>}
                            {c.mode_red && <span className="badge badge-red" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF5C7A", display: "inline-block" }} /> 빨간불</span>}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{(c.total_calls ?? 0).toLocaleString()}</td>
                        <td style={{ fontWeight: 600 }}>{(c.total_earnings ?? 0).toLocaleString()}P</td>
                        <td style={{ color: "var(--gray-400)", fontSize: 12 }}>
                          {new Date(c.created_at).toLocaleDateString("ko-KR")}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => { setGradeModal(c); setNewGrade(c.grade); }}
                          >
                            등급 변경
                          </button>
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

      {/* 등급 변경 모달 */}
      {gradeModal && (
        <div className="modal-backdrop" onClick={() => setGradeModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">등급 변경 — {gradeModal.display_name}</span>
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
                  {(() => { const GIcon = GRADE_ICON[gradeModal.grade] ?? Sprout; return (
                    <span className={`badge ${GRADE_MAP[gradeModal.grade]?.color ?? "badge-gray"}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <GIcon size={11} /> {GRADE_MAP[gradeModal.grade]?.label}
                    </span>
                  ); })()}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">변경할 등급</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { key: "NEWBIE", Icon: Sprout, label: "신규" },
                    { key: "NORMAL", Icon: Star, label: "일반" },
                    { key: "POPULAR", Icon: Flame, label: "인기" },
                    { key: "TOP", Icon: Trophy, label: "탑" },
                  ].map((g) => (
                    <button
                      key={g.key}
                      onClick={() => setNewGrade(g.key)}
                      style={{
                        padding: "12px 16px",
                        border: `2px solid ${newGrade === g.key ? "var(--pink)" : "var(--gray-200)"}`,
                        borderRadius: 10,
                        background: newGrade === g.key ? "rgba(255,107,157,0.05)" : "white",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 600,
                        fontSize: 14,
                        color: newGrade === g.key ? "var(--pink)" : "var(--gray-700)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        justifyContent: "center",
                      }}
                    >
                      <g.Icon size={15} /> {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 8 }}>
                superadmin 전용 기능입니다. 등급 변경은 즉시 반영됩니다.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setGradeModal(null)}>취소</button>
              <button
                className="btn btn-primary"
                onClick={handleGradeChange}
                disabled={newGrade === gradeModal.grade}
              >
                변경 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
