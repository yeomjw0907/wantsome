"use client";
import { useEffect, useState } from "react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  type: "PROMO" | "NOTICE" | "EVENT";
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_at: string;
}

const TYPE_MAP = {
  PROMO:  { label: "프로모션", color: "badge-pink" },
  NOTICE: { label: "공지",    color: "badge-blue" },
  EVENT:  { label: "이벤트",  color: "badge-orange" },
};

const EMPTY_FORM = {
  title: "", subtitle: "", image_url: "", link_url: "",
  type: "PROMO" as Banner["type"], is_active: true,
  starts_at: "", ends_at: "", sort_order: 0,
};

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<"add" | Banner | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => { loadBanners(); }, []);

  const loadBanners = async () => {
    setIsLoading(true);
    const res = await fetch("/admin/api/banners");
    if (res.ok) { const d = await res.json(); setBanners(d.banners ?? []); }
    setIsLoading(false);
  };

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, sort_order: banners.length + 1 });
    setModal("add");
  };

  const openEdit = (b: Banner) => {
    setForm({
      title: b.title, subtitle: b.subtitle ?? "", image_url: b.image_url ?? "",
      link_url: b.link_url ?? "", type: b.type, is_active: b.is_active,
      starts_at: b.starts_at ? b.starts_at.slice(0, 16) : "",
      ends_at: b.ends_at ? b.ends_at.slice(0, 16) : "",
      sort_order: b.sort_order,
    });
    setModal(b);
  };

  const handleToggle = async (b: Banner) => {
    await fetch(`/admin/api/banners/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !b.is_active }),
    });
    loadBanners();
  };

  const handleDelete = async (b: Banner) => {
    if (!confirm(`"${b.title}" 배너를 삭제하시겠습니까?`)) return;
    await fetch(`/admin/api/banners/${b.id}`, { method: "DELETE" });
    showToast("삭제됐습니다.");
    loadBanners();
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast("제목을 입력하세요.", "error"); return; }
    setIsSaving(true);

    const payload = {
      ...form,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };

    if (modal === "add") {
      const res = await fetch("/admin/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { showToast("배너가 추가됐습니다."); setModal(null); loadBanners(); }
      else showToast("추가 실패", "error");
    } else if (modal && typeof modal === "object") {
      const res = await fetch(`/admin/api/banners/${modal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { showToast("저장됐습니다."); setModal(null); loadBanners(); }
      else showToast("저장 실패", "error");
    }
    setIsSaving(false);
  };

  const F = (key: keyof typeof form, value: string | boolean | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">배너 / 프로모션 관리</h2>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ 배너 추가</button>
        </div>
      </div>

      <div className="page-content">
        {isLoading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : banners.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🎨</div>
            <p>등록된 배너가 없습니다.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>첫 배너 추가하기</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {banners.map((b) => {
              const type = TYPE_MAP[b.type] ?? TYPE_MAP.PROMO;
              const isExpired = b.ends_at && new Date(b.ends_at) < new Date();
              return (
                <div
                  key={b.id}
                  style={{
                    background: "white",
                    border: `1px solid ${b.is_active && !isExpired ? "var(--gray-200)" : "var(--gray-100)"}`,
                    borderRadius: 16,
                    padding: "20px 24px",
                    display: "flex", alignItems: "center", gap: 20,
                    opacity: b.is_active && !isExpired ? 1 : 0.6,
                    transition: "all 0.2s",
                  }}
                >
                  {/* 순서 번호 */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--gray-100)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 13, color: "var(--gray-500)",
                    flexShrink: 0,
                  }}>
                    {b.sort_order}
                  </div>

                  {/* 이미지 미리보기 */}
                  {b.image_url ? (
                    <div style={{ width: 80, height: 48, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                      <img src={b.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ) : (
                    <div style={{
                      width: 80, height: 48, borderRadius: 8,
                      background: "var(--gray-100)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, flexShrink: 0,
                    }}>
                      🖼️
                    </div>
                  )}

                  {/* 정보 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{b.title}</span>
                      <span className={`badge ${type.color}`}>{type.label}</span>
                      {isExpired && <span className="badge badge-gray">만료</span>}
                    </div>
                    {b.subtitle && (
                      <div style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 4 }}>{b.subtitle}</div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--gray-400)", display: "flex", gap: 12 }}>
                      {b.link_url && <span>🔗 {b.link_url}</span>}
                      {b.starts_at && <span>시작: {new Date(b.starts_at).toLocaleDateString("ko-KR")}</span>}
                      {b.ends_at && <span>종료: {new Date(b.ends_at).toLocaleDateString("ko-KR")}</span>}
                    </div>
                  </div>

                  {/* 액션 */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    {/* ON/OFF 토글 */}
                    <div
                      onClick={() => handleToggle(b)}
                      style={{
                        width: 48, height: 26,
                        background: b.is_active ? "var(--green)" : "var(--gray-200)",
                        borderRadius: 13, cursor: "pointer",
                        position: "relative", transition: "background 0.2s",
                      }}
                    >
                      <div style={{
                        width: 22, height: 22,
                        background: "white", borderRadius: "50%",
                        position: "absolute", top: 2,
                        left: b.is_active ? 24 : 2,
                        transition: "left 0.2s",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: b.is_active ? "var(--green)" : "var(--gray-400)", minWidth: 30 }}>
                      {b.is_active ? "ON" : "OFF"}
                    </span>
                    <button className="btn btn-sm btn-outline" onClick={() => openEdit(b)}>편집</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(b)}>삭제</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 추가/수정 모달 */}
      {modal !== null && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{modal === "add" ? "배너 추가" : "배너 수정"}</span>
              <button
                onClick={() => setModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--gray-400)" }}
              >×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">제목 *</label>
                <input className="form-input" value={form.title} onChange={(e) => F("title", e.target.value)} placeholder="배너 제목" />
              </div>
              <div className="form-group">
                <label className="form-label">부제목</label>
                <input className="form-input" value={form.subtitle} onChange={(e) => F("subtitle", e.target.value)} placeholder="배너 설명 (선택)" />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">타입</label>
                  <select className="form-input form-select" value={form.type} onChange={(e) => F("type", e.target.value as Banner["type"])}>
                    <option value="PROMO">프로모션</option>
                    <option value="NOTICE">공지</option>
                    <option value="EVENT">이벤트</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">노출 순서</label>
                  <input className="form-input" type="number" value={form.sort_order} onChange={(e) => F("sort_order", parseInt(e.target.value))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">이미지 URL</label>
                <input className="form-input" value={form.image_url} onChange={(e) => F("image_url", e.target.value)} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label className="form-label">링크 URL (클릭 시 이동)</label>
                <input className="form-input" value={form.link_url} onChange={(e) => F("link_url", e.target.value)} placeholder="앱 내 딥링크 또는 URL" />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">노출 시작</label>
                  <input className="form-input" type="datetime-local" value={form.starts_at} onChange={(e) => F("starts_at", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">노출 종료</label>
                  <input className="form-input" type="datetime-local" value={form.ends_at} onChange={(e) => F("ends_at", e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input
                  type="checkbox" id="is_active"
                  checked={form.is_active}
                  onChange={(e) => F("is_active", e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <label htmlFor="is_active" style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)", cursor: "pointer" }}>
                  배너 활성화 (앱에 즉시 노출)
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "저장 중..." : modal === "add" ? "추가" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
