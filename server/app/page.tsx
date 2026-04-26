import type { Metadata } from "next";
import { createSupabaseAdmin } from "@/lib/supabase";
import { COMPANY_LEGAL_NAME, MODE_LABEL, SERVICE_NAME } from "@/lib/branding";

export const metadata: Metadata = {
  title: `${SERVICE_NAME}(wantsome) — 크리에이터와 실시간 영상통화`,
  description: `내가 원하는 사람과 1:1 영상통화. ${MODE_LABEL.blue}(일상·취미)부터 ${MODE_LABEL.red}(프리미엄)까지, 크리에이터와 지금 바로 연결하세요.`,
};

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

export default async function HomePage() {
  const cfg = await getSystemConfig();

  const companyName = cfg.company_name || COMPANY_LEGAL_NAME;
  const ceoName = cfg.ceo_name || "-";
  const businessNumber = cfg.business_number || "-";
  const address = cfg.business_address || "-";
  const csPhone = cfg.cs_phone || "-";
  const csEmail = cfg.cs_email || "cs@wantsome.kr";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --navy: #1B2A4A; --pink: #FF6B9D; --pink-light: #FF8FB3;
          --blue: #4D9FFF; --gray-50: #F9FAFB; --gray-100: #F3F4F6;
          --gray-200: #E5E7EB; --gray-400: #9CA3AF; --gray-500: #6B7280;
          --gray-600: #4B5563; --gray-700: #374151; --gray-900: #111827;
        }
        body { font-family: 'Noto Sans KR', -apple-system, sans-serif; background: white; color: var(--gray-900); line-height: 1.6; }
        a { color: inherit; text-decoration: none; }
        .header-wrap { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid var(--gray-100); }
        .header-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
        .logo span { color: var(--pink); }
        .nav-links { display: flex; gap: 24px; font-size: 14px; font-weight: 500; color: var(--gray-600); }
        .nav-links a:hover { color: var(--navy); }
        .btn-dl { background: var(--navy); color: white; padding: 8px 18px; border-radius: 20px; font-size: 13px; font-weight: 600; }
        .btn-dl:hover { background: #243660; }
        .hero { background: linear-gradient(135deg, #1B2A4A 0%, #2D3F6B 45%, #1a1a3e 100%); padding: 80px 24px 96px; text-align: center; position: relative; overflow: hidden; }
        .hero::before { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 50%, rgba(255,107,157,0.15), transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(77,159,255,0.12), transparent 60%); }
        .hero-inner { position: relative; max-width: 720px; margin: 0 auto; }
        .hero-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,107,157,0.15); border: 1px solid rgba(255,107,157,0.3); color: var(--pink-light); padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 24px; }
        .hero h1 { font-size: clamp(34px, 6vw, 60px); font-weight: 900; color: white; line-height: 1.15; letter-spacing: -1px; margin-bottom: 20px; }
        .hero h1 em { color: var(--pink); font-style: normal; }
        .hero p { font-size: clamp(14px, 2vw, 17px); color: rgba(255,255,255,0.65); margin-bottom: 36px; line-height: 1.8; }
        .hero-cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .btn-hp { background: var(--pink); color: white; padding: 14px 28px; border-radius: 12px; font-size: 15px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; }
        .btn-hp:hover { background: #ff5a8d; transform: translateY(-1px); }
        .btn-hs { background: rgba(255,255,255,0.1); color: white; padding: 14px 28px; border-radius: 12px; font-size: 15px; font-weight: 600; border: 1px solid rgba(255,255,255,0.15); }
        .btn-hs:hover { background: rgba(255,255,255,0.15); }
        .hero-stats { display: flex; gap: 40px; justify-content: center; margin-top: 56px; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap; }
        .hs-num { font-size: 28px; font-weight: 800; color: white; }
        .hs-label { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 2px; }
        .sec { padding: 72px 24px; max-width: 1100px; margin: 0 auto; }
        .sec-center { text-align: center; }
        .sec-tag { display: inline-block; background: linear-gradient(135deg,#FF6B9D20,#4D9FFF20); color: var(--pink); font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase; }
        .sec-title { font-size: clamp(22px, 4vw, 34px); font-weight: 800; color: var(--navy); letter-spacing: -0.5px; margin-bottom: 12px; }
        .sec-sub { font-size: 15px; color: var(--gray-500); max-width: 500px; margin: 0 auto 48px; line-height: 1.7; }
        .feat-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(260px,1fr)); gap: 20px; }
        .feat-card { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 16px; padding: 28px; transition: all 0.2s; }
        .feat-card:hover { border-color: var(--pink); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,107,157,0.1); }
        .feat-icon { font-size: 30px; margin-bottom: 14px; }
        .feat-title { font-size: 15px; font-weight: 700; color: var(--navy); margin-bottom: 8px; }
        .feat-desc { font-size: 13px; color: var(--gray-500); line-height: 1.6; }
        .modes-wrap { background: var(--gray-50); padding: 72px 24px; }
        .modes-inner { max-width: 1100px; margin: 0 auto; }
        .modes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .mode-card { border-radius: 20px; padding: 32px; }
        .mode-blue { background: linear-gradient(135deg,#EFF6FF,#DBEAFE); border: 1px solid #BFDBFE; }
        .mode-red { background: linear-gradient(135deg,#FFF1F2,#FFE4E6); border: 1px solid #FECDD3; }
        .mode-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
        .mb-blue { background: #DBEAFE; color: #1D4ED8; }
        .mb-red { background: #FFE4E6; color: #BE123C; }
        .mode-title { font-size: 20px; font-weight: 800; color: var(--navy); margin-bottom: 8px; }
        .mode-desc { font-size: 14px; color: var(--gray-600); line-height: 1.6; }
        .price-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(180px,1fr)); gap: 16px; }
        .price-card { background: white; border: 2px solid var(--gray-200); border-radius: 16px; padding: 24px 20px; text-align: center; position: relative; transition: all 0.2s; }
        .price-card:hover { border-color: var(--pink); }
        .price-card.pop { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(255,107,157,0.1); }
        .pop-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--pink); color: white; font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 20px; white-space: nowrap; }
        .p-pts { font-size: 26px; font-weight: 900; color: var(--navy); }
        .p-pts span { font-size: 13px; font-weight: 600; color: var(--gray-400); }
        .p-amt { font-size: 14px; color: var(--gray-500); margin: 4px 0 12px; }
        .p-bonus { background: linear-gradient(135deg,#FF6B9D15,#4D9FFF15); color: var(--pink); font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 8px; display: inline-block; }
        .p-per { font-size: 12px; color: var(--gray-400); margin-top: 10px; }
        .policy-box { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 16px; padding: 32px; }
        .policy-item { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--gray-100); }
        .policy-item:last-child { border-bottom: none; }
        .p-num { width: 28px; height: 28px; background: var(--navy); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; margin-top: 2px; }
        .p-ttl { font-size: 14px; font-weight: 700; color: var(--navy); margin-bottom: 4px; }
        .p-dsc { font-size: 13px; color: var(--gray-500); line-height: 1.6; }
        .biz-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(280px,1fr)); gap: 1px; background: var(--gray-200); border: 1px solid var(--gray-200); border-radius: 16px; overflow: hidden; }
        .biz-item { background: white; padding: 20px 24px; }
        .biz-key { font-size: 11px; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .biz-val { font-size: 14px; font-weight: 600; color: var(--gray-900); }
        .footer { background: var(--navy); padding: 48px 24px 32px; }
        .footer-inner { max-width: 1100px; margin: 0 auto; color: rgba(255,255,255,0.5); }
        .f-logo { font-size: 20px; font-weight: 900; color: white; margin-bottom: 6px; }
        .f-logo span { color: var(--pink); }
        .f-desc { font-size: 13px; margin-bottom: 24px; line-height: 1.7; }
        .f-links { display: flex; gap: 20px; flex-wrap: wrap; font-size: 13px; margin-bottom: 28px; }
        .f-links a:hover { color: white; }
        .f-biz { font-size: 12px; line-height: 2; }
        .f-copy { margin-top: 20px; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; }
        @media (max-width: 640px) { .modes-grid { grid-template-columns: 1fr; } .nav-links { display: none; } .hero-stats { gap: 24px; } }
      `}</style>

      {/* HEADER */}
      <div className="header-wrap">
        <div className="header-inner">
          <div className="logo">원<span>썸</span></div>
          <nav className="nav-links">
            <a href="#service">서비스</a>
            <a href="#pricing">요금</a>
            <a href="#refund">환불</a>
            <a href="#company">회사 정보</a>
          </nav>
          <a href="https://apps.apple.com" className="btn-dl">앱 다운로드</a>
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">📱 iOS · Android 무료 다운로드</div>
          <h1>내가 <em>원하는 사람</em>과<br />지금 바로 연결</h1>
          <p>{MODE_LABEL.blue}부터 {MODE_LABEL.red}까지 — 취향에 맞는 크리에이터와<br />1:1 실시간 영상통화를 즐겨보세요.</p>
          <div className="hero-cta">
            <a href="https://apps.apple.com" className="btn-hp">🍎 App Store</a>
            <a href="https://play.google.com" className="btn-hs">🤖 Google Play</a>
          </div>
          <div className="hero-stats">
            {[["1,000+","등록 크리에이터"],["50,000+","누적 통화"],["4.8★","앱스토어 평점"],["24/7","실시간 운영"]].map(([n,l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div className="hs-num">{n}</div>
                <div className="hs-label">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="sec sec-center" id="service">
        <div className="sec-tag">Service</div>
        <h2 className="sec-title">{SERVICE_NAME}이 특별한 이유</h2>
        <p className="sec-sub">엄격한 신원 인증을 통과한 크리에이터와 안전하고 프라이빗하게 대화하세요.</p>
        <div className="feat-grid">
          {[
            ["🔐","100% 신원 인증","모든 크리에이터는 신분증+CI 본인인증을 통과한 성인만 활동합니다."],
            ["⚡","실시간 매칭","지금 온라인 중인 크리에이터와 즉시 연결. 대기 없이 바로 통화하세요."],
            ["🛡️","화면 캡처 차단","통화 중 화면 캡처와 녹화를 자동으로 차단해 프라이버시를 보호합니다."],
            ["💎","2가지 모드",`일상 대화(${MODE_LABEL.blue})부터 프리미엄 콘텐츠(${MODE_LABEL.red})까지, 원하는 모드를 선택하세요.`],
            ["📅","예약 통화","원하는 크리에이터와 원하는 시간을 미리 예약하고 확정 받으세요."],
            ["⭐","크리에이터 등급","신규→일반→인기→탑 등급으로 검증된 퀄리티를 보장합니다."],
          ].map(([icon,title,desc]) => (
            <div key={title} className="feat-card">
              <div className="feat-icon">{icon}</div>
              <div className="feat-title">{title}</div>
              <div className="feat-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* MODES */}
      <div className="modes-wrap">
        <div className="modes-inner">
          <div style={{ textAlign:"center", marginBottom:48 }}>
            <div className="sec-tag">두 가지 모드</div>
            <h2 className="sec-title">나에게 맞는 모드를 선택하세요</h2>
          </div>
          <div className="modes-grid">
            <div className="mode-card mode-blue">
              <div className="mode-badge mb-blue">🔵 {MODE_LABEL.blue}</div>
              <div className="mode-title">일상 · 취미 · 대화</div>
              <div className="mode-desc">언어 교환, 게임 파트너, 일상 수다 등 부담 없는 대화 콘텐츠. 누구나 편하게 즐길 수 있는 일반 모드입니다.</div>
            </div>
            <div className="mode-card mode-red">
              <div className="mode-badge mb-red">⭐ {MODE_LABEL.red}</div>
              <div className="mode-title">프리미엄 전용 콘텐츠</div>
              <div className="mode-desc">19세 이상 본인인증 완료 사용자만 이용 가능. 모든 크리에이터의 신원이 철저히 검증됩니다.</div>
            </div>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <section className="sec sec-center" id="pricing">
        <div className="sec-tag">Pricing</div>
        <h2 className="sec-title">포인트 요금제</h2>
        <p className="sec-sub">포인트를 충전해 사용하는 선불 방식. 미사용 포인트는 환불 가능합니다.</p>
        <div className="price-grid">
          {([
            [1000,"1,100원",null,"분당 약 110원",false],
            [5000,"5,500원",null,"분당 약 110원",false],
            [10000,"11,000원","10% 보너스","분당 약 100원",true],
            [30000,"33,000원","15% 보너스","분당 약 95원",false],
            [50000,"55,000원","20% 보너스","분당 약 91원",false],
            [100000,"110,000원","25% 보너스","분당 약 88원",false],
          ] as [number,string,string|null,string,boolean][]).map(([pts,amt,bonus,per,pop]) => (
            <div key={pts} className={`price-card${pop?" pop":""}`}>
              {pop && <div className="pop-badge">🔥 인기</div>}
              <div className="p-pts">{pts.toLocaleString()}<span>P</span></div>
              <div className="p-amt">{amt}</div>
              {bonus && <div className="p-bonus">+{bonus}</div>}
              <div className="p-per">{per}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop:24, fontSize:13, color:"var(--gray-400)" }}>
          * 첫 충전 시 100% 보너스 포인트 지급 (72시간 한정) · 1포인트 = 1원
        </p>
      </section>

      {/* REFUND */}
      <div className="modes-wrap" id="refund">
        <div className="modes-inner">
          <div style={{ textAlign:"center", marginBottom:40 }}>
            <div className="sec-tag">Refund Policy</div>
            <h2 className="sec-title">환불 정책</h2>
            <p className="sec-sub">소비자 보호를 위한 명확한 환불 정책을 운영합니다.</p>
          </div>
          <div className="policy-box">
            {[
              ["1","미사용 포인트 환불","충전 후 사용하지 않은 포인트는 충전일로부터 7일 이내 100% 환불됩니다. 7일 초과 시 결제대행사 수수료(결제금액의 10%)를 제외하고 환불됩니다."],
              ["2","부분 사용 포인트 환불","일부 사용된 포인트의 경우, 미사용 잔여 포인트에 대해 환불 신청 가능합니다. 단, 결제대행사 수수료(10%)가 적용됩니다."],
              ["3","보너스 포인트","이벤트/프로모션으로 지급된 보너스 포인트는 환불 대상에서 제외됩니다. 충전 포인트 먼저 차감 후, 보너스 포인트가 차감됩니다."],
              ["4","환불 제한","크리에이터에게 이미 지급된 포인트(통화 완료)는 환불 불가. 부정 이용으로 인한 계정 제재 시 잔여 포인트는 환불되지 않을 수 있습니다."],
              ["5","환불 신청 방법","앱 내 [설정 → 고객센터] 또는 cs@wantsome.kr로 문의. 처리 기간은 환불 신청 접수 후 영업일 기준 3일 이내입니다 (전자상거래법 제17조 6항)."],
            ].map(([num,title,desc]) => (
              <div key={num} className="policy-item">
                <div className="p-num">{num}</div>
                <div>
                  <div className="p-ttl">{title}</div>
                  <div className="p-dsc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COMPANY */}
      <section className="sec" id="company">
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div className="sec-tag">Company</div>
          <h2 className="sec-title">사업자 정보</h2>
        </div>
        <div className="biz-grid">
          {[
            ["상호명", companyName],
            ["대표자", ceoName],
            ["사업자등록번호", businessNumber],
            ["사업장 주소", address],
            ["고객센터 전화", csPhone],
            ["고객센터 이메일", csEmail],
            ["서비스 유형", "전자상거래 (비실물 — 포인트 서비스)"],
            ["통신판매업번호", cfg.telecom_sale_number || "-"],
          ].map(([k,v]) => (
            <div key={k} className="biz-item">
              <div className="biz-key">{k}</div>
              <div className="biz-val">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="f-logo">원<span>썸</span></div>
          <div className="f-desc">크리에이터와 팬을 잇는 실시간 1:1 영상통화<br />본 서비스는 만 19세 이상 회원만 전체 기능을 이용할 수 있습니다.</div>
          <div className="f-links">
            <a href="/terms">이용약관</a>
            <a href="/privacy">개인정보처리방침</a>
            <a href="/youth">청소년 보호 정책</a>
            <a href={`mailto:${csEmail}`}>고객센터</a>
          </div>
          <div className="f-biz">
            {companyName} · 대표자: {ceoName} · 사업자등록번호: {businessNumber}<br />
            주소: {address} · 고객센터: {csEmail}
          </div>
          <div className="f-copy">© 2026 {companyName}. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
