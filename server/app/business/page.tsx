import type { Metadata } from "next";
import { SERVICE_NAME } from "@/lib/branding";
import { BUSINESS_INFO } from "@/lib/businessInfo";

export const metadata: Metadata = {
  title: `사업자 정보 | ${SERVICE_NAME}(wantsome)`,
  description: `${SERVICE_NAME}(wantsome) 서비스를 운영하는 주식회사 98점7도의 사업자 정보입니다.`,
};

const rows: [string, string][] = [
  ["상호(법인명)", BUSINESS_INFO.companyName],
  ["대표자", BUSINESS_INFO.ceoName],
  ["사업자등록번호", BUSINESS_INFO.businessNumber],
  ["사업장 주소", BUSINESS_INFO.address],
  ["고객센터 전화", BUSINESS_INFO.phone],
  ["고객센터 이메일", BUSINESS_INFO.email],
];

export default function BusinessPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "sans-serif", lineHeight: 1.8, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6, color: "#1B2A4A" }}>사업자 정보</h1>
      <p style={{ color: "#6B7280", marginBottom: 36, fontSize: 14 }}>
        {SERVICE_NAME}(wantsome) 서비스를 운영하는 사업자 정보입니다.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 40, fontSize: 14 }}>
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key} style={{ borderBottom: "1px solid #E5E7EB" }}>
              <th style={{
                padding: "14px 16px", textAlign: "left", fontWeight: 600,
                color: "#6B7280", width: 180, fontSize: 12,
                background: "#F9FAFB", whiteSpace: "nowrap",
              }}>
                {key}
              </th>
              <td style={{ padding: "14px 16px", color: "#111827" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontSize: 13, color: "#9CA3AF", display: "flex", gap: 20, flexWrap: "wrap" }}>
        <a href="/" style={{ color: "#FF6B9D" }}>홈으로</a>
        <a href="/terms" style={{ color: "#9CA3AF" }}>이용약관</a>
        <a href="/privacy" style={{ color: "#9CA3AF" }}>개인정보처리방침</a>
      </div>
    </div>
  );
}
