# DB — reports (신고/모더레이션)

## reports

```sql
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID REFERENCES users(id),
  target_id       UUID REFERENCES users(id),
  call_session_id UUID REFERENCES call_sessions(id),  -- 통화 중 신고 시
  category        TEXT NOT NULL,
  -- UNDERAGE | ILLEGAL_RECORD | PROSTITUTION | HARASSMENT | FRAUD | OTHER
  description     TEXT,
  status          TEXT DEFAULT 'PENDING',
  -- PENDING | REVIEWING | RESOLVED | DISMISSED
  auto_action     TEXT,                               -- SUSPENDED | NONE
  admin_note      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_reports_status ON reports(status, created_at);
CREATE INDEX idx_reports_target ON reports(target_id);
```

## 자동 조치 로직

```
UNDERAGE        → 즉시 계정 정지 + 슬랙 긴급 알림 + 증거 보존
ILLEGAL_RECORD  → 즉시 계정 정지 + 슬랙 긴급 알림 + 증거 보존
PROSTITUTION    → 즉시 계정 정지
HARASSMENT      → 24시간 내 검토
FRAUD           → 24시간 내 검토
OTHER           → 72시간 내 검토
```

## 계정 정지 처리

```sql
-- 계정 정지 (users 테이블 활용)
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  suspended_until TIMESTAMPTZ;               -- NULL = 정상 / 미래값 = 정지 중 / '9999-12-31' = 영구

-- 영구 정지 시 CI 블랙리스트 등록
INSERT INTO ci_blacklist (ci, reason)
SELECT ci, '영구 정지'
FROM users WHERE id = $target_id;
```

## 관리자 조치 단계

```
WARN        → 경고 메시지 발송
SUSPEND_7D  → suspended_until = NOW() + 7 days
SUSPEND_30D → suspended_until = NOW() + 30 days
BAN         → suspended_until = '9999-12-31' + ci_blacklist 등록
DISMISS     → 신고 기각
```
