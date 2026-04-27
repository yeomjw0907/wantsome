# Windows에서 Android 에뮬레이터로 앱 실행하기

Mac이 아닌 Windows PC에서 Expo 앱의 **Android 화면**을 PC 모니터에서 보려면 Android Studio와 에뮬레이터(AVD)를 설치한 뒤, Expo에서 `a` 키로 실행하면 됩니다.

---

## 1. Android Studio 설치

1. **다운로드**
   - https://developer.android.com/studio
   - "Download Android Studio" 클릭 후 Windows용 설치 파일(.exe) 다운로드

2. **설치**
   - 설치 파일 실행
   - 기본 옵션으로 진행 (Android SDK, Android Virtual Device 포함되는 항목 체크 유지)
   - 설치 경로는 기본값(`C:\Program Files\Android\Android Studio`) 사용 권장

3. **첫 실행**
   - Android Studio 실행 → "Next"로 초기 설정 마법사 진행
   - "Standard" 설치 선택
   - 테마 선택 후 "Finish"로 완료

---

## 2. Android SDK 설치 확인

1. Android Studio에서 **More Actions** → **SDK Manager** (또는 **File** → **Settings** → **Languages & Frameworks** → **Android SDK**)
2. **SDK Platforms** 탭
   - **Android 14.0 (API 34)** 또는 최신 안정 버전 체크 후 적용
3. **SDK Tools** 탭
   - **Android SDK Build-Tools**
   - **Android Emulator**
   - **Android SDK Platform-Tools**
   - **Intel x86 Emulator Accelerator (HAXM)** 또는 **Windows Hypervisor Platform** (가상화 가속용)
   - 필요 시 "Apply"로 설치

---

## 3. 환경 변수 설정 (ANDROID_HOME)

Expo/React Native가 Android SDK 위치를 찾을 수 있도록 환경 변수를 설정합니다.

1. **시스템 환경 변수 열기**
   - Windows 키 → "환경 변수" 검색 → **시스템 환경 변수 편집**
   - 또는 **제어판** → **시스템** → **고급 시스템 설정** → **환경 변수**

2. **새 사용자 변수 추가**
   - **변수 이름**: `ANDROID_HOME`
   - **변수 값**: SDK 설치 경로  
     - 기본값 예: `C:\Users\본인사용자명\AppData\Local\Android\Sdk`  
     - SDK Manager 창 상단 "Android SDK Location"에 표시된 경로와 동일하게 입력

3. **Path에 추가**
   - **Path** 변수 편집 → **새로 만들기** → 아래 두 줄 추가  
     - `%ANDROID_HOME%\platform-tools`  
     - `%ANDROID_HOME%\emulator`  
   - (이미 있으면 생략)

4. **확인**
   - 터미널(PowerShell 또는 CMD)을 **새로 연 뒤** 아래 입력  
   - `echo %ANDROID_HOME%` → 설정한 경로가 출력되면 성공  
   - `emulator -version` → 에뮬레이터 버전이 나오면 정상

---

## 4. 가상 디바이스(AVD) 만들기

1. Android Studio에서 **More Actions** → **Virtual Device Manager** (또는 **Tools** → **Device Manager**)
2. **Create Device** 클릭
3. **Phone** 카테고리에서 기기 선택 (예: Pixel 7) → **Next**
4. **System Image** 선택
   - **Release Name**에서 **API 34** (Android 14) 등 원하는 버전 선택
   - 옆 **Download** 클릭해 이미지 다운로드 후 **Next**
5. **AVD Name** 확인 후 **Finish**
6. 목록에 생성된 기기가 보이면 완료

---

## 5. Expo에서 에뮬레이터로 실행

1. **에뮬레이터 미리 실행 (선택)**
   - Device Manager에서 방금 만든 기기 옆 **재생 버튼** 클릭  
   - 에뮬레이터 창이 켜지면 그대로 두기

2. **프로젝트에서 Expo 실행**
   - 프로젝트 루트에서 터미널 열기
   - `npx expo start` 실행

3. **Android 앱 띄우기**
   - 터미널에 **`a`** 입력 후 Enter  
   - 에뮬레이터가 꺼져 있으면 자동으로 켜지고, 앱이 에뮬레이터 안에 로드됨  
   - **PC 화면의 에뮬레이터 창**에서 Android 앱 화면 확인

---

## 6. 자주 나오는 문제

| 현상 | 확인/해결 |
|------|------------|
| `ANDROID_HOME` not set | 환경 변수 `ANDROID_HOME`이 SDK 경로로 설정됐는지 확인. 터미널을 **다시 연 뒤** `npx expo start` 다시 실행. |
| `a` 눌러도 반응 없음 | 에뮬레이터를 Device Manager에서 먼저 켠 다음, Expo 터미널에서 다시 `a` 입력. |
| 에뮬레이터가 너무 느림 | SDK Manager에서 **Windows Hypervisor Platform** 또는 **HAXM** 설치 후 PC 재부팅. BIOS에서 가상화(Virtualization) 활성화 여부 확인. |
| "Unable to locate adb" | `ANDROID_HOME`과 Path에 `platform-tools`, `emulator`가 들어갔는지 확인. |

---

## 7. 요약

1. Android Studio 설치 (Windows)
2. SDK Manager로 SDK + Emulator + Platform-Tools 설치
3. `ANDROID_HOME` 환경 변수 설정, Path에 `platform-tools`, `emulator` 추가
4. Virtual Device Manager에서 AVD 한 대 생성
5. `npx expo start` 후 터미널에서 **`a`** → PC 화면의 에뮬레이터에서 Android 앱 확인

이 문서는 wantsome 프로젝트의 **docs** 에 두었으며, Windows에서 Android 화면을 PC에서 보기 위한 기준 가이드입니다.
