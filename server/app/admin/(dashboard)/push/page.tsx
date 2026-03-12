"use client";
import { useState } from "react";

const TARGET_OPTIONS = [
  { value: "all", label: "전체 유저" },
  { value: "consumer", label: "소비자만" },
  { value: "CREATOR", label: "크리에이터만" },
];

export default function PushPage() {
  const [target, setTarget] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      showToast("제목과 내용을 입력해주세요.", "error");
      return;
    }
    if (!confirm(`"${TARGET_OPTIONS.find(t => t.value === target)?.label}"에게 푸시 알림을 발송하시겠습니까?`)) return;

    setIsSending(true);
    const res = await fetch("/admin/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, title, body }),
    });

    if (res.ok) {
      const data = await res.json();
      showToast(`발송 완료: ${data.sentCount ?? 0}명에게 발송됐습니다.`);
      setTitle("");
      setBody("");
    } else {
      showToast("발송 실패", "error");
    }
    setIsSending(false);
  };

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">푸시 알림 발송</h2>
      </div>

      <div className="page-content">
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-header">
            <span className="card-title">새 푸시 알림</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">발송 대상</label>
              <select
                className="form-input form-select"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {TARGET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">제목</label>
              <input
                type="text"
                className="form-input"
                placeholder="푸시 알림 제목..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
              />
              <div style={{ fontSize: "11px", color: "#9CA3AF", textAlign: "right", marginTop: "4px" }}>{title.length}/50</div>
            </div>

            <div className="form-group">
              <label className="form-label">내용</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="푸시 알림 내용..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={200}
              />
              <div style={{ fontSize: "11px", color: "#9CA3AF", textAlign: "right", marginTop: "4px" }}>{body.length}/200</div>
            </div>

            {/* 미리보기 */}
            {(title || body) && (
              <div style={{
                background: "#F9FAFB",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px",
                border: "1px solid #E5E7EB",
              }}>
                <div style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "8px" }}>미리보기</div>
                <div style={{ background: "white", borderRadius: "10px", padding: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1B2A4A", marginBottom: "4px" }}>
                    🔔 {title || "(제목)"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6B7280" }}>{body || "(내용)"}</div>
                </div>
              </div>
            )}

            <button
              className="btn btn-primary w-full"
              style={{ justifyContent: "center", height: "44px" }}
              onClick={handleSend}
              disabled={isSending}
            >
              {isSending ? "발송 중..." : "🔔 즉시 발송"}
            </button>
          </div>
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
