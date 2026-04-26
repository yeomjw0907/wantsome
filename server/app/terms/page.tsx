import { COMPANY_LEGAL_NAME, MODE_LABEL, SERVICE_NAME } from "@/lib/branding";

export const metadata = {
  title: `이용약관 | ${SERVICE_NAME}(wantsome)`,
};

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 14 };
const thStyle: React.CSSProperties = { background: "#F9FAFB", padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #E5E7EB", fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #E5E7EB", verticalAlign: "top" };
const secStyle: React.CSSProperties = { marginBottom: 36 };
const h2Style: React.CSSProperties = { fontSize: 19, fontWeight: 700, marginBottom: 12, color: "#1B2A4A" };
const ulStyle: React.CSSProperties = { paddingLeft: 20 };
const liStyle: React.CSSProperties = { marginBottom: 6 };

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "sans-serif", lineHeight: 1.9, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>서비스 이용약관</h1>
      <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>시행일: 2026년 4월 27일 | 최종 수정일: 2026년 4월 27일</p>

      <div style={{ background: "#FFF5F7", border: "1px solid #FECDD3", borderRadius: 8, padding: "12px 16px", marginBottom: 32, fontSize: 14, color: "#BE123C" }}>
        ⚠️ 본 서비스는 <strong>만 19세 이상 성인만</strong> 이용할 수 있습니다. 미성년자의 이용을 엄격히 금지합니다.
      </div>

      <section style={secStyle}>
        <h2 style={h2Style}>제1조 (목적)</h2>
        <p>본 약관은 {COMPANY_LEGAL_NAME}(이하 &quot;회사&quot;)이 운영하는 {SERVICE_NAME}(wantsome) 서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제2조 (정의)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}><strong>"서비스":</strong> 회사가 제공하는 크리에이터 영상통화 플랫폼 및 관련 부가 서비스 일체</li>
          <li style={liStyle}><strong>"이용자":</strong> 서비스에 접속하여 약관에 따라 서비스를 이용하는 회원 (소비자 및 크리에이터 포함)</li>
          <li style={liStyle}><strong>"소비자":</strong> 크리에이터의 서비스를 이용하는 회원</li>
          <li style={liStyle}><strong>"크리에이터":</strong> 소비자에게 영상통화 서비스를 제공하는 회원</li>
          <li style={liStyle}><strong>"포인트":</strong> 서비스 이용을 위해 인앱 결제로 구매하는 가상 화폐</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제3조 (서비스 이용 자격)</h2>
        <p>본 서비스는 다음 조건을 충족하는 자만 이용할 수 있습니다.</p>
        <ul style={ulStyle}>
          <li style={liStyle}><strong>연령:</strong> 만 19세 이상 성인</li>
          <li style={liStyle}><strong>연령 인증:</strong> 앱 최초 실행 시 생년월일 입력을 통한 연령 확인 필수</li>
          <li style={liStyle}><strong>약관 동의:</strong> 본 약관 및 개인정보처리방침에 동의한 자</li>
        </ul>
        <p>만 19세 미만자가 서비스를 이용하는 경우, 회사는 해당 계정을 즉시 정지하고 법적 조치를 취할 수 있습니다.</p>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제4조 (서비스 내용)</h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>서비스</th>
              <th style={thStyle}>내용</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>영상통화 ({MODE_LABEL.blue} 모드)</td>
              <td style={tdStyle}>크리에이터와의 일반 화상통화 서비스. 분당 포인트 차감.</td>
            </tr>
            <tr>
              <td style={tdStyle}>영상통화 ({MODE_LABEL.red} 모드)</td>
              <td style={tdStyle}>크리에이터와의 프리미엄 화상통화 서비스. 분당 포인트 차감. 만 19세 이상 전용.</td>
            </tr>
            <tr>
              <td style={tdStyle}>크리에이터 예약</td>
              <td style={tdStyle}>크리에이터와의 통화 일정 예약 서비스</td>
            </tr>
            <tr>
              <td style={tdStyle}>쇼핑</td>
              <td style={tdStyle}>크리에이터가 판매하는 굿즈 및 콘텐츠 구매</td>
            </tr>
            <tr>
              <td style={tdStyle}>포인트 충전</td>
              <td style={tdStyle}>App Store / Google Play를 통한 인앱 결제로 포인트 구매</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제5조 (포인트 정책)</h2>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>가. 포인트 충전</p>
        <ul style={ulStyle}>
          <li style={liStyle}>포인트는 App Store(iOS) 또는 Google Play(Android) 인앱 결제로만 구매할 수 있습니다.</li>
          <li style={liStyle}>외부 결제, 계좌이체, 문화상품권 등의 방법으로는 포인트를 구매할 수 없습니다.</li>
          <li style={liStyle}>포인트 구매 전 "구매 확인" 화면에서 상품 정보 및 환불 불가 안내를 확인하고 동의해야 합니다.</li>
        </ul>

        <p style={{ fontWeight: 600, marginBottom: 8, marginTop: 16 }}>나. 포인트 사용</p>
        <ul style={ulStyle}>
          <li style={liStyle}>포인트는 서비스 내에서만 사용 가능하며 현금으로 전환되지 않습니다.</li>
          <li style={liStyle}>영상통화 서비스는 분당 요금이 자동 차감됩니다.</li>
          <li style={liStyle}>잔여 포인트가 부족한 경우 통화가 자동으로 종료됩니다.</li>
        </ul>

        <p style={{ fontWeight: 600, marginBottom: 8, marginTop: 16 }}>다. 환불 정책 (전자상거래법 제17조 준수)</p>
        <p style={{ marginBottom: 8 }}>
          포인트 충전은 디지털콘텐츠 거래에 해당하며, <strong>「전자상거래 등에서의 소비자보호에 관한 법률」 제17조</strong>의 청약철회 규정에 따라 다음과 같이 처리합니다.
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>구분</th>
              <th style={thStyle}>처리 기준</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>미사용 포인트 (충전 후 7일 이내)</td>
              <td style={tdStyle}><strong>100% 환불</strong> — 청약철회 7일 (전상법 17조 1항)</td>
            </tr>
            <tr>
              <td style={tdStyle}>미사용 포인트 (충전 후 7일 초과)</td>
              <td style={tdStyle}>결제대행사 수수료(결제금액의 10%)를 제외하고 환불 — 콘텐츠이용자보호지침 적용</td>
            </tr>
            <tr>
              <td style={tdStyle}>일부 사용 포인트의 잔여분</td>
              <td style={tdStyle}>잔여 미사용 포인트에 한해 환불 신청 가능 (수수료 10% 적용)</td>
            </tr>
            <tr>
              <td style={tdStyle}>이미 사용된 포인트 (통화·라이브 입장·선물·굿즈 결제 등)</td>
              <td style={tdStyle}>
                <strong>환불 불가</strong> — 전상법 제17조 2항 5호 "디지털콘텐츠 제공 개시" 사유.
                결제 직전 별도 동의 수령. 단 회사 귀책 사유(시스템 장애 등)로 통화가 비정상 종료된 경우 그 시간만큼은 환불 처리.
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>보너스 포인트</td>
              <td style={tdStyle}>이벤트/프로모션으로 무상 지급된 보너스 포인트는 환불 대상에서 제외. 차감 순서: 충전 포인트 우선 → 보너스 포인트.</td>
            </tr>
            <tr>
              <td style={tdStyle}>부정 이용</td>
              <td style={tdStyle}>약관 위반·부정 결제·계정 제재 시 잔여 포인트 환불이 제한될 수 있습니다.</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginBottom: 8, marginTop: 12, fontSize: 13, color: "#6B7280" }}>
          <strong>환불 처리 기간:</strong> 환불 신청 접수 후 영업일 기준 3일 이내 (전상법 제17조 6항).
          App Store / Google Play 인앱 결제분의 결제 취소는 각 스토어 정책에 따라 처리되며, 회사는 환불 승인 후 포인트 회수 및 후속 정산을 처리합니다.
        </p>
        <p style={{ marginBottom: 8, fontSize: 13, color: "#6B7280" }}>
          <strong>환불 신청:</strong> 앱 내 [설정 → 고객센터] 또는 cs@wantsome.kr.
        </p>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제6조 (크리에이터 정책)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>크리에이터는 만 19세 이상이어야 하며, 본인 인증이 완료된 경우에만 활동 가능합니다.</li>
          <li style={liStyle}>크리에이터는 서비스 내 통화·라이브 수익에 대해 회사가 정한 정산율(기본 35%, 등급별 별도)로 정산받습니다.</li>
          <li style={liStyle}><strong>원천징수:</strong> 회사는 「소득세법」에 따라 정산금에서 사업소득세 3% + 지방소득세 0.3% (합계 3.3%)를 원천징수한 후 지급합니다. 크리에이터는 매년 5월 종합소득세 신고 의무가 있습니다.</li>
          <li style={liStyle}>크리에이터는 실제 본인이 서비스를 제공해야 하며, 타인을 대리로 내세우는 행위는 금지됩니다.</li>
          <li style={liStyle}>불법·유해 콘텐츠 제공 시 즉시 계정이 정지되며 법적 책임을 질 수 있습니다.</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제7조 (금지 행위)</h2>
        <p>이용자는 다음 행위를 해서는 안 됩니다. 위반 시 즉시 서비스 이용이 제한되며 법적 조치가 취해질 수 있습니다.</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>위반 유형</th>
              <th style={thStyle}>조치</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>만 19세 미만 이용 및 이용 허가</td>
              <td style={tdStyle}>즉시 영구 정지 + 수사 기관 신고</td>
            </tr>
            <tr>
              <td style={tdStyle}>불법 촬영·녹화 (스크린 레코딩 포함)</td>
              <td style={tdStyle}>즉시 영구 정지 + 법적 조치</td>
            </tr>
            <tr>
              <td style={tdStyle}>성매매 유도, 알선, 매개 행위</td>
              <td style={tdStyle}>즉시 영구 정지 + 수사 기관 신고</td>
            </tr>
            <tr>
              <td style={tdStyle}>타인 사칭, 허위 정보 제공</td>
              <td style={tdStyle}>즉시 정지 및 법적 조치</td>
            </tr>
            <tr>
              <td style={tdStyle}>서비스 시스템 해킹, DDoS 공격</td>
              <td style={tdStyle}>즉시 영구 정지 + 법적 조치</td>
            </tr>
            <tr>
              <td style={tdStyle}>타 이용자 괴롭힘, 스토킹, 협박</td>
              <td style={tdStyle}>즉시 정지 및 수사 기관 신고</td>
            </tr>
            <tr>
              <td style={tdStyle}>포인트 부정 취득 (결제 취소 후 사용 등)</td>
              <td style={tdStyle}>영구 정지 및 민사 청구</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제8조 (크리에이터 콘텐츠 가이드라인)</h2>
        <p>크리에이터는 서비스 이용 시 다음 콘텐츠 기준을 준수해야 합니다.</p>
        <ul style={ulStyle}>
          <li style={liStyle}><strong>허용:</strong> 대화, 상담, 취미 공유, 팬과의 소통, 퍼포먼스 등 창작 활동</li>
          <li style={liStyle}><strong>금지:</strong> 만 19세 미만 이용자와의 프리미엄 서비스, 불법 촬영·유포, 성매매 알선, 타인 명예훼손</li>
          <li style={liStyle}>회사는 신고 접수 시 콘텐츠를 검토하고 기준에 위반되는 경우 즉시 조치합니다.</li>
          <li style={liStyle}>크리에이터 프로필, 소개글, 게시물에 직접적인 성적 묘사 표현은 허용되지 않습니다.</li>
          <li style={liStyle}>모든 영상통화는 저장·녹화되지 않으며, 앱 내 화면 캡처는 기술적으로 차단됩니다.</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제9조 (신고 및 제재)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>이용자는 앱 내 신고 기능을 통해 불법·유해 행위를 신고할 수 있습니다.</li>
          <li style={liStyle}>미성년자 이용, 불법 촬영, 성매매 알선 신고는 즉시 해당 계정을 정지하고 수사 기관에 신고합니다.</li>
          <li style={liStyle}>회사는 신고 내용을 검토한 후 7영업일 이내에 처리 결과를 안내합니다.</li>
          <li style={liStyle}>허위 신고로 인해 타인에게 피해를 주는 경우 법적 책임을 질 수 있습니다.</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제10조 (서비스 변경 및 중단)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>회사는 서비스의 일부 또는 전체를 변경·중단할 수 있습니다. 이 경우 최소 7일 전에 공지합니다.</li>
          <li style={liStyle}>긴급한 시스템 점검이나 불가피한 사유 발생 시 사전 공지 없이 서비스가 일시 중단될 수 있습니다.</li>
          <li style={liStyle}>서비스 중단으로 인해 통화가 갑자기 종료된 경우, 해당 통화 시간의 요금은 부과되지 않습니다.</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제11조 (면책 조항)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>회사는 크리에이터와 이용자 간 거래에서 발생하는 분쟁에 대해 중개자 역할만 합니다.</li>
          <li style={liStyle}>크리에이터가 제공하는 서비스 내용에 대한 책임은 해당 크리에이터에게 있습니다.</li>
          <li style={liStyle}>천재지변, 불가항력, 제3자의 귀책 사유로 인한 서비스 장애에 대해 회사는 책임을 지지 않습니다.</li>
          <li style={liStyle}>이용자가 서비스 내 게시한 정보에 대한 책임은 해당 이용자에게 있습니다.</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제12조 (개인정보 보호)</h2>
        <p>이용자의 개인정보 처리에 관한 사항은 <a href="/privacy" style={{ color: "#F43F5E" }}>개인정보처리방침</a>에서 확인할 수 있습니다.</p>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제13조 (약관 변경)</h2>
        <p>회사는 약관을 변경할 경우 시행 7일 전에 앱 및 웹사이트를 통해 공지합니다. 중요한 변경 사항은 30일 전에 공지하며, 변경 후 계속 서비스를 이용하는 경우 변경된 약관에 동의한 것으로 간주합니다.</p>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제14조 (준거법 및 관할법원)</h2>
        <p>본 약관에서 발생하는 분쟁은 대한민국 법률을 준거법으로 합니다. 분쟁에 관한 소송은 「민사소송법」상의 관할 규정에 따라 <strong>이용자(소비자)의 주소지 또는 거소를 관할하는 법원</strong>을 관할 법원으로 합니다. 다만 이용자의 주소 또는 거소가 불명확하거나 외국에 있는 경우 회사 본점 소재지를 관할하는 법원에 제기할 수 있습니다.</p>
      </section>

      <div style={{ marginTop: 60, borderTop: "1px solid #E5E7EB", paddingTop: 24, color: "#888", fontSize: 13 }}>
        <p>본 약관은 <strong>2026년 4월 27일</strong>부터 시행됩니다.</p>
        <p>{SERVICE_NAME}(wantsome) · {COMPANY_LEGAL_NAME} · cs@wantsome.kr · wantsome.kr</p>
      </div>
    </div>
  );
}
