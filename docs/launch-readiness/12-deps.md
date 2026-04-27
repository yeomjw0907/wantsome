# 12. Dependencies 감사

요약: 🟢 출시 블로커 없음. Expo SDK 패치 마이너 불일치 + 일부 transitive moderate 취약점.
범위: `npm audit` + `expo-doctor` (루트 React Native 앱). 서버(`server/`)는 별도 점검 필요.

---

## expo-doctor 결과

**17/18 통과**. 1건 실패:

### 🟡 Patch 버전 불일치 (Medium — 출시 블로커 아님)

| 패키지 | 현재 | Expo SDK 55 권장 |
|---|---|---|
| expo | 55.0.5 | ~55.0.17 |
| expo-constants | 55.0.9 | ~55.0.15 |
| expo-font | 55.0.4 | ~55.0.6 |
| expo-image-picker | 55.0.13 | ~55.0.19 |
| expo-linking | 55.0.8 | ~55.0.14 |
| expo-notifications | 55.0.13 | ~55.0.20 |
| expo-router | 55.0.7 | ~55.0.13 |
| expo-screen-capture | 55.0.9 | ~55.0.13 |
| expo-status-bar | 55.0.4 | ~55.0.5 |
| expo-web-browser | 55.0.10 | ~55.0.14 |
| react-native | 0.83.2 | 0.83.6 |

**조치**:
```bash
npx expo install --check
```
모두 SDK 55 패치 업데이트라 breaking change 없음. 출시 직전 PR로 일괄 업데이트 권장.

---

## npm audit 결과

총 **moderate 취약점** 다수 (모두 Expo SDK transitive deps). Critical/High 없음.

### 주요 취약점 (요약)
- @expo/cli, @expo/config, @expo/config-plugins, @expo/metro-config, @expo/prebuild-config — 모두 SDK 55에 묶인 transitive
- xcode (build-time only, 런타임 노출 X)
- postcss (dev dependency)

### 평가
- 🟢 **런타임 노출 없음** — 빌드 도구·CLI 의존성만
- 🟢 **direct dependency 직접 취약점 없음**
- 🟡 **fix 방법**: `expo` 자체 SemVer major 업그레이드 (SDK 56)이 fix 권장 (현재 55) — 이건 출시 후 작업

### 권장
- 출시 전: 변경 불필요 (run-time 위험 없음)
- 출시 후 1개월: SDK 56 마이그레이션 검토

---

## 서버(`server/`) 의존성

별도 `server/package.json` 존재. 본 단계에선 미검증. Phase 3G에서 `server/`도 동일 감사 실행.

---

## 발견 요약

| 분류 | 항목 | 조치 |
|:---:|---|---|
| 🟡 Medium | Expo SDK 55 패치 불일치 11개 | `npx expo install --check` 일괄 업데이트 |
| 🟢 Info | npm audit transitive moderate | 출시 후 SDK 56 검토 |
