import { COMPANY_LEGAL_NAME, SERVICE_NAME } from "@/lib/branding";
import { createSupabaseAdmin } from "@/lib/supabase";

export const metadata = {
  title: `청소년보호정책 | ${SERVICE_NAME}(wantsome)`,
};

const secStyle: React.CSSProperties = { marginBottom: 36 };
const h2Style: React.CSSProperties = { fontSize: 19, fontWeight: 700, marginBottom: 12, color: "#1B2A4A" };
const ulStyle: React.CSSProperties = { paddingLeft: 20 };
const liStyle: React.CSSProperties = { marginBottom: 6 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 14 };
const thStyle: React.CSSProperties = { background: "#F9FAFB", padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #E5E7EB", fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #E5E7EB", verticalAlign: "top" };

async function getSystemConfig() {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin.from("system_config").select("key, value");
    const cfg: Record<string, string> = {};
    (data ?? []).forEach((r) => { cfg[r.key] = r.value; });
    return cfg;
  } catch {
    return {} as Record<string, string>;
  }
}

export default async function YouthProtectionPage() {
  const cfg = await getSystemConfig();
  const youthOfficer = cfg.youth_protection_officer || "박○○";
  const youthOfficerEmail = cfg.youth_protection_email || "youth@wantsome.kr";
  const youthOfficerPhone = cfg.youth_protection_phone || "고객센터로 연락 부탁드립니다";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "sans-serif", lineHeight: 1.9, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>청소년보호정책</h1>
      <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>시행일: 2026년 4월 27일</p>

      <div style={{ background: "#FFF5F7", border: "1px solid #FECDD3", borderRadius: 8, padding: "12px 16px", marginBottom: 32, fontSize: 14, color: "#BE123C" }}>
        ⚠️ {SERVICE_NAME}(wantsome)는 <strong>만 19세 이상 성인만 이용할 수 있는 서비스</strong>입니다.
        만 19세 미만의 청소년은 본 서비스에 가입하거나 이용할 수 없으며, 회사는 청소년의 접근을 차단하기 위해 다음과 같은 조치를 시행합니다.
      </div>

      <section style={secStyle}>
        <h2 style={h2Style}>제1조 (목적)</h2>
        <p>
          본 정책은 「청소년 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」, 「전기통신사업법」 등 관련 법령에 따라
          {COMPANY_LEGAL_NAME}이 운영하는 {SERVICE_NAME}(wantsome) 서비스에서 청소년(만 19세 미만)을 유해 정보·환경으로부터 보호하기 위한
          기본 원칙과 절차를 정함을 목적으로 합니다.
        </p>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제2조 (청소년 접근 차단 조치)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>가입 시 생년월일 입력을 통해 만 19세 미만 사용자의 가입을 차단합니다.</li>
          <li style={liStyle}>만 19세 이상 본인인증(통신사 PASS 또는 이에 준하는 방식)을 통과한 사용자만 프리미엄 콘텐츠(레드 모드)에 접근할 수 있습니다.</li>
          <li style={liStyle}>App Store / Google Play의 연령 등급은 <strong>17+ (Mature)</strong>로 등록하여 미성년자의 앱 다운로드를 1차 차단합니다.</li>
          <li style={liStyle}>모바일 앱 외부에서 본 서비스의 유해 정보가 노출되지 않도록 검색엔진 인덱싱을 제한합니다.</li>
          <li style={liStyle}>크리에이터 활동도 만 19세 이상 + 신분증 본인인증을 완료한 자에 한합니다.</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제3조 (유해 정보로부터의 청소년 보호 활동)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>회사는 청소년 유해정보로 분류될 수 있는 콘텐츠 게시·전송을 약관 및 운영 정책으로 엄격히 금지하고 있습니다.</li>
          <li style={liStyle}>운영자는 신고 접수, 자동화 모니터링, 모더레이션 도구를 통해 24시간 콘텐츠를 검토하며, 위반 시 즉시 콘텐츠 삭제 및 계정 정지를 시행합니다.</li>
          <li style={liStyle}>크리에이터 프로필·소개글에 직접적 성적 묘사, 성매매 알선, 미성년자를 암시하는 표현 등은 절대 허용되지 않습니다.</li>
          <li style={liStyle}>모든 영상통화·라이브 콘텐츠는 회사 서버에 저장되지 않으며, 화면 캡처·녹화는 OS 수준에서 차단됩니다.</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제4조 (청소년보호 책임자)</h2>
        <p>회사는 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제42조의3에 따라 청소년보호 책임자를 다음과 같이 지정·운영합니다.</p>
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600, width: 180 }}>성명</td>
              <td style={tdStyle}>{youthOfficer}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600 }}>소속·직위</td>
              <td style={tdStyle}>{COMPANY_LEGAL_NAME} 운영팀 / 청소년보호 책임자</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600 }}>이메일</td>
              <td style={tdStyle}>{youthOfficerEmail}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600 }}>연락처</td>
              <td style={tdStyle}>{youthOfficerPhone}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#6B7280" }}>청소년보호 책임자는 청소년 유해정보 차단·관리 업무, 신고 접수·처리, 청소년 유해정보로 인한 피해 상담·구제 업무를 총괄합니다.</p>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제5조 (신고 및 구제 절차)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>이용자는 앱 내 [신고] 버튼 또는 청소년보호 책임자 이메일({youthOfficerEmail})로 청소년 유해정보 의심 사례를 신고할 수 있습니다.</li>
          <li style={liStyle}>회사는 신고 접수 후 24시간 이내 1차 검토하며, 심각한 위반(미성년자 가입 의심·성매매 알선 등)은 즉시 차단 조치합니다.</li>
          <li style={liStyle}>신고 결과는 신고자에게 7영업일 이내 안내합니다.</li>
          <li style={liStyle}>외부 신고 채널: 방송통신심의위원회 불법·유해정보 신고 (국번없이 1377, www.kocsc.or.kr), 경찰청 사이버수사국 (cyberbureau.police.go.kr).</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제6조 (모니터링 정책)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>운영팀은 신고 채널, 자동화된 키워드 필터, 라이브 모더레이션 도구를 통해 상시 모니터링을 수행합니다.</li>
          <li style={liStyle}>상습 위반 사용자는 영구 정지되며, 형사 처벌 대상 행위는 즉시 수사기관에 신고합니다.</li>
          <li style={liStyle}>회사는 청소년 유해정보 차단을 위해 필요한 경우 정보통신서비스 제공 기록을 보관·열람할 수 있습니다 (개인정보처리방침 제3조 참조).</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제7조 (정책 변경)</h2>
        <p>본 정책 변경 시 시행 7일 전 앱 및 웹사이트를 통해 공지하며, 청소년 보호와 관련된 중요한 변경 사항은 30일 전에 별도 공지합니다.</p>
      </section>

      <div style={{ marginTop: 60, borderTop: "1px solid #E5E7EB", paddingTop: 24, color: "#888", fontSize: 13 }}>
        <p>본 청소년보호정책은 <strong>2026년 4월 27일</strong>부터 시행됩니다.</p>
        <p>{SERVICE_NAME}(wantsome) · {COMPANY_LEGAL_NAME} · 청소년보호 책임자: {youthOfficer} ({youthOfficerEmail})</p>
      </div>
    </div>
  );
}
