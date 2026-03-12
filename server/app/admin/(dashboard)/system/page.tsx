"use client";
import { useEffect, useState } from "react";
import { Wrench, Smartphone, Building2, Settings2, AlertTriangle, CheckCircle2, CircleDot, Activity } from "lucide-react";

interface SysConfig {
  maintenance_mode: string;
  maintenance_message: string;
  maintenance_eta: string;
  min_app_version_ios: string;
  min_app_version_android: string;
  first_charge_bonus_rate: string;
  first_charge_hours: string;
  settlement_day: string;
  withholding_rate: string;
  company_name: string;
  ceo_name: string;
  business_number: string;
  business_address: string;
  cs_phone: string;
  cs_email: string;
  telecom_sale_number: string;
  [key: string]: string;
}

export default function SystemPage() {
  const [cfg, setCfg] = useState<SysConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"maintenance" | "version" | "business" | "operation">("maintenance");

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    const res = await fetch("/admin/api/system");
    if (res.ok) {
      const d = await res.json();
      setCfg(d.config as SysConfig);
    }
  };

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const update = (key: string, value: string) => {
    setCfg((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const save = async (keys: string[]) => {
    if (!cfg) return;
    setIsSaving(true);
    const payload: Record<string, string> = {};
    keys.forEach((k) => { payload[k] = cfg[k] ?? ""; });
    const res = await fetch("/admin/api/system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setIsSaving(false);
    if (res.ok) showToast("저장됐습니다.");
    else showToast("저장 실패", "error");
  };

  const isMaintenance = cfg?.maintenance_mode === "true";

  const toggleMaintenance = async () => {
    if (!cfg) return;
    const newVal = !isMaintenance;
    if (newVal && !confirm("⚠️ 점검 모드를 활성화하면 모든 사용자가 앱을 사용할 수 없습니다. 계속하시겠습니까?")) return;
    update("maintenance_mode", String(newVal));
    setIsSaving(true);
    await fetch("/admin/api/system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maintenance_mode: String(newVal) }),
    });
    setIsSaving(false);
    showToast(newVal ? "점검 모드 활성화됨" : "점검 모드 해제됨", newVal ? "error" : "success");
    loadConfig();
  };

  if (!cfg) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">시스템 설정</h2>
        <div className="topbar-actions">
          <span className="badge badge-red" style={{ fontSize: 11 }}>superadmin 전용</span>
          {isMaintenance && (
            <span className="badge badge-red" style={{ animation: "pulse 1.5s infinite", display: "inline-flex", alignItems: "center", gap: 4 }}><CircleDot size={11} /> 점검 모드 ON</span>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* 점검 모드 빠른 토글 배너 */}
        <div style={{
          background: isMaintenance
            ? "linear-gradient(135deg, #FEF2F2, #FFE4E6)"
            : "linear-gradient(135deg, #F0FDF4, #DCFCE7)",
          border: `1px solid ${isMaintenance ? "#FECDD3" : "#BBF7D0"}`,
          borderRadius: 16, padding: "20px 24px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: isMaintenance ? "#DC2626" : "#15803D", display: "flex", alignItems: "center", gap: 6 }}>
              {isMaintenance ? <><CircleDot size={16} /> 점검 모드 활성화 중</> : <><Activity size={16} /> 서비스 정상 운영 중</>}
            </div>
            <div style={{ fontSize: 13, color: "var(--gray-500)", marginTop: 4 }}>
              {isMaintenance ? `점검 메시지: ${cfg.maintenance_message}` : "앱이 정상적으로 운영되고 있습니다."}
            </div>
          </div>
          <button
            className={`btn ${isMaintenance ? "btn-secondary" : "btn-danger"}`}
            onClick={toggleMaintenance}
            disabled={isSaving}
          >
            {isMaintenance
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} /> 점검 해제</span>
              : <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CircleDot size={15} /> 점검 모드 켜기</span>}
          </button>
        </div>

        {/* 탭 */}
        <div className="tabs">
          {([
            ["maintenance", "점검 설정", Wrench],
            ["version", "앱 버전", Smartphone],
            ["business", "사업자 정보", Building2],
            ["operation", "운영 설정", Settings2],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              className={`tab ${activeTab === key ? "active" : ""}`}
              onClick={() => setActiveTab(key)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* 점검 설정 */}
        {activeTab === "maintenance" && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}><Wrench size={16} /> 점검 설정</span>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">점검 메시지</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={cfg.maintenance_message ?? ""}
                  onChange={(e) => update("maintenance_message", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">예상 완료 시각 (선택)</label>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={cfg.maintenance_eta ?? ""}
                  onChange={(e) => update("maintenance_eta", e.target.value)}
                />
                <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 4 }}>앱 점검 화면에 표시됩니다. 비워두면 미표시.</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => save(["maintenance_message", "maintenance_eta"])}
                disabled={isSaving}
              >
                저장
              </button>
            </div>
          </div>
        )}

        {/* 앱 버전 */}
        {activeTab === "version" && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}><Smartphone size={16} /> 최소 앱 버전 설정</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 20, lineHeight: 1.6 }}>
                최소 버전 미만의 앱은 강제 업데이트 화면으로 이동합니다.<br />
                형식: <strong>1.0.0</strong> (Major.Minor.Patch)
              </p>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">iOS 최소 버전</label>
                  <input
                    className="form-input"
                    placeholder="1.0.0"
                    value={cfg.min_app_version_ios ?? ""}
                    onChange={(e) => update("min_app_version_ios", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Android 최소 버전</label>
                  <input
                    className="form-input"
                    placeholder="1.0.0"
                    value={cfg.min_app_version_android ?? ""}
                    onChange={(e) => update("min_app_version_android", e.target.value)}
                  />
                </div>
              </div>
              <div style={{ background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: "#92400E", display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> 버전 변경 시 해당 버전 미만 사용자는 즉시 강제 업데이트 화면으로 이동됩니다.
                  스토어 심사 완료 후 변경하세요.
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => save(["min_app_version_ios", "min_app_version_android"])}
                disabled={isSaving}
              >
                저장
              </button>
            </div>
          </div>
        )}

        {/* 사업자 정보 */}
        {activeTab === "business" && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}><Building2 size={16} /> 사업자 정보</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 20 }}>
                wantsome.kr 서비스 페이지에 표시되는 사업자 정보입니다.
              </p>
              <div className="grid-2">
                {[
                  ["company_name", "상호명"],
                  ["ceo_name", "대표자"],
                  ["business_number", "사업자등록번호"],
                  ["telecom_sale_number", "통신판매업번호"],
                  ["cs_phone", "고객센터 전화"],
                  ["cs_email", "고객센터 이메일"],
                ].map(([key, label]) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <input
                      className="form-input"
                      value={cfg[key] ?? ""}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">사업장 주소</label>
                <input
                  className="form-input"
                  value={cfg.business_address ?? ""}
                  onChange={(e) => update("business_address", e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => save(["company_name","ceo_name","business_number","telecom_sale_number","cs_phone","cs_email","business_address"])}
                disabled={isSaving}
              >
                저장
              </button>
            </div>
          </div>
        )}

        {/* 운영 설정 */}
        {activeTab === "operation" && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}><Settings2 size={16} /> 운영 설정</span>
            </div>
            <div className="card-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">첫 충전 보너스 비율 (%)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={cfg.first_charge_bonus_rate ?? "100"}
                    onChange={(e) => update("first_charge_bonus_rate", e.target.value)}
                  />
                  <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 4 }}>현재: +{cfg.first_charge_bonus_rate}%</p>
                </div>
                <div className="form-group">
                  <label className="form-label">첫 충전 보너스 유효 시간 (h)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={cfg.first_charge_hours ?? "72"}
                    onChange={(e) => update("first_charge_hours", e.target.value)}
                  />
                  <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 4 }}>가입 후 {cfg.first_charge_hours}시간 이내 첫 충전 시 적용</p>
                </div>
                <div className="form-group">
                  <label className="form-label">정산일 (매월 N일)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1" max="28"
                    value={cfg.settlement_day ?? "15"}
                    onChange={(e) => update("settlement_day", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">원천징수세율 (소수점, 예: 0.033)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.001"
                    value={cfg.withholding_rate ?? "0.033"}
                    onChange={(e) => update("withholding_rate", e.target.value)}
                  />
                  <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 4 }}>현재: {(parseFloat(cfg.withholding_rate ?? "0.033") * 100).toFixed(1)}%</p>
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => save(["first_charge_bonus_rate","first_charge_hours","settlement_day","withholding_rate"])}
                disabled={isSaving}
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
