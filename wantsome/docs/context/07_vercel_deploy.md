# wantsome — Vercel 배포 설정

---

## vercel.json

```json
{
  "crons": [
    {
      "path": "/api/calls/tick",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/settlements/run",
      "schedule": "0 9 15 * *"
    },
    {
      "path": "/api/creators/update-grades",
      "schedule": "0 0 1 * *"
    },
    {
      "path": "/api/reports/daily-summary",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### Cron 스케줄 설명

| 경로 | 스케줄 | 설명 |
|------|--------|------|
| `/api/calls/tick` | 매 분 | 통화 중 포인트 차감 |
| `/api/settlements/run` | 매월 15일 오전 9시 | 크리에이터 정산 계산 |
| `/api/creators/update-grades` | 매월 1일 자정 | 등급 갱신 + monthly_minutes 초기화 |
| `/api/reports/daily-summary` | 매일 오전 9시 | 미처리 신고 슬랙 요약 |

---

## Next.js 미들웨어 (middleware.ts)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const pathname = req.nextUrl.pathname

  // 1. Cron 경로 보호 (Vercel Cron Secret)
  if (pathname.startsWith('/api/calls/tick') ||
      pathname.startsWith('/api/settlements/run') ||
      pathname.startsWith('/api/creators/update-grades') ||
      pathname.startsWith('/api/reports/daily-summary')) {
    const cronSecret = req.headers.get('authorization')
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return res
  }

  // 2. 공개 API (인증 불필요)
  const publicPaths = [
    '/api/system/status',
    '/api/auth/social-login',
    '/api/auth/verify-identity',
  ]
  if (publicPaths.some(p => pathname.startsWith(p))) return res

  // 3. 관리자 페이지 보호
  if (pathname.startsWith('/admin')) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.redirect(new URL('/admin/login', req.url))

    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!['admin', 'superadmin'].includes(user?.role ?? '')) {
      return NextResponse.redirect(new URL('/admin/unauthorized', req.url))
    }

    // superadmin 전용 경로
    const superonlyPaths = ['/admin/points', '/admin/system', '/admin/admins']
    if (superonlyPaths.some(p => pathname.startsWith(p)) && user?.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/admin/unauthorized', req.url))
    }

    return res
  }

  // 4. 일반 API 인증 체크
  if (pathname.startsWith('/api/')) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return res
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*']
}
```

---

## CORS 설정

```ts
// lib/cors.ts
export function corsHeaders(origin: string = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

// API Route에서 사용
export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() })
}
```

---

## 환경변수 (Vercel 대시보드에 설정)

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Agora
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=

# PortOne
PORTONE_API_SECRET=
PORTONE_STORE_ID=
PORTONE_CHANNEL_KEY=

# Slack
SLACK_WEBHOOK_URGENT=        # #긴급-신고
SLACK_WEBHOOK_CREATOR=       # #크리에이터-심사
SLACK_WEBHOOK_POINTS=        # #포인트-로그
SLACK_WEBHOOK_SETTLEMENT=    # #정산-알림
SLACK_WEBHOOK_REPORT=        # #매출-리포트
SLACK_WEBHOOK_OPS=           # #운영-알림

# Cron 보호
CRON_SECRET=                 # 랜덤 문자열

# 암호화
ENCRYPTION_KEY=              # AES-256 계좌번호 암호화용 (32바이트)

# Apple IAP
APPLE_IAP_SHARED_SECRET=     # App Store Connect에서 발급

# Google IAP
GOOGLE_SERVICE_ACCOUNT_JSON= # Google Play Console 서비스 계정 JSON
```

---

## 도메인 구조

| 도메인 | 용도 |
|--------|------|
| `api.wantsome.kr` | Next.js API 서버 |
| `admin.wantsome.kr` | 관리자 페이지 |
| `wantsome.kr` | 랜딩 페이지 (추후) |
