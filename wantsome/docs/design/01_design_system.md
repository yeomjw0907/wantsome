# wantsome — 디자인 시스템 v1.0

> 폰트: Pretendard | 무드: 캐주얼 & 친근 (아자르 모던 레퍼런스)
> 크리에이터 카드: 인스타그램형 2컬럼 정사각 그리드

---

## 컬러 팔레트

### Brand

| 토큰 | HEX | 용도 |
|------|-----|------|
| `navy` | `#1B2A4A` | 텍스트, 헤더, 강조 |
| `pink` | `#FF6B9D` | CTA 버튼, 메인 포인트 |
| `bluebell` | `#D1E4F8` | 파란불 시그니처 — **배경/뱃지 전용** |

> ⚠️ `bluebell(#D1E4F8)`은 버튼/텍스트 사용 금지. 가독성 부족.

### 파란불 🔵 모드

| 토큰 | HEX | 용도 |
|------|-----|------|
| `blue` | `#4D9FFF` | 아이콘, 강조 텍스트, 버튼 테두리 |
| `bluebell` | `#D1E4F8` | 탭 활성 배경, 카드 테두리, 뱃지 배경 |

### 빨간불 🔴 모드

| 토큰 | HEX | 용도 |
|------|-----|------|
| `red` | `#FF5C7A` | 아이콘, 탭 활성 |
| `red-light` | `#FFEEF1` | 탭 배경, 뱃지 배경 |

### 배경 / 중립

| 토큰 | HEX | 용도 |
|------|-----|------|
| `white` | `#FFFFFF` | 메인 배경 |
| `gray-50` | `#F8F8FA` | 카드 배경, 섹션 구분 |
| `gray-100` | `#F0F0F5` | 입력 필드, Ghost 버튼 |
| `gray-900` | `#1A1A2E` | 본문 기본 텍스트 |
| `gray-500` | `#8E8EA0` | 서브텍스트, 플레이스홀더 |
| `gray-300` | `#C8C8D8` | 비활성, 구분선 |

### tailwind.config.js

```js
colors: {
  navy:      '#1B2A4A',
  pink:      '#FF6B9D',
  bluebell:  '#D1E4F8',
  blue:      '#4D9FFF',
  red:       '#FF5C7A',
  'red-light':'#FFEEF1',
  'gray-50': '#F8F8FA',
  'gray-100':'#F0F0F5',
  'gray-500':'#8E8EA0',
  'gray-900':'#1A1A2E',
}
```

---

## 타이포그래피

| 스타일 | 크기 | 굵기 | 용도 |
|--------|------|------|------|
| Display | 32sp | Bold 700 | 스플래시, 온보딩 타이틀 |
| H1 | 24sp | Bold 700 | 화면 제목 |
| H2 | 20sp | SemiBold 600 | 섹션 제목 |
| Body1 | 16sp | Regular 400 | 본문, 카드 내용 |
| Body2 | 14sp | Regular 400 | 서브텍스트 |
| Caption | 12sp | Regular 400 | 배지, 태그 |
| Button | 16sp | SemiBold 600 | 버튼 텍스트 |

```ts
// constants/typography.ts
export const typography = {
  display: { fontSize: 32, fontWeight: '700', fontFamily: 'Pretendard-Bold' },
  h1:      { fontSize: 24, fontWeight: '700', fontFamily: 'Pretendard-Bold' },
  h2:      { fontSize: 20, fontWeight: '600', fontFamily: 'Pretendard-SemiBold' },
  body1:   { fontSize: 16, fontWeight: '400', fontFamily: 'Pretendard-Regular' },
  body2:   { fontSize: 14, fontWeight: '400', fontFamily: 'Pretendard-Regular' },
  caption: { fontSize: 12, fontWeight: '400', fontFamily: 'Pretendard-Regular' },
  button:  { fontSize: 16, fontWeight: '600', fontFamily: 'Pretendard-SemiBold' },
}
```

---

## 간격 & 반경

```ts
// constants/spacing.ts
export const spacing = { xs:4, sm:8, md:16, lg:24, xl:32, '2xl':48 }
export const layout  = { screenPaddingH:16, cardGap:8, sectionGap:24 }
export const radius  = { sm:8, md:12, lg:16, xl:24, full:999 }
```

---

## 버튼

| 유형 | 배경 | 텍스트 | 높이 | 반경 |
|------|------|--------|------|------|
| Primary | `#FF6B9D` | White | 52px | full(999) |
| Secondary | transparent | `#FF6B9D` | 52px | full(999) |
| Ghost | `#F0F0F5` | `#1A1A2E` | 44px | 12px |
| 통화(카드 내) | `#FF6B9D` | White 아이콘 | 36px 원형 | full |

```tsx
// Primary
<TouchableOpacity className="bg-pink h-[52px] rounded-full items-center justify-center px-6">
  <Text className="text-white text-base font-semibold">통화하기</Text>
</TouchableOpacity>

// Secondary
<TouchableOpacity className="border-[1.5px] border-pink h-[52px] rounded-full items-center justify-center px-6">
  <Text className="text-pink text-base font-semibold">프로필 보기</Text>
</TouchableOpacity>

// Ghost
<TouchableOpacity className="bg-gray-100 h-[44px] rounded-xl items-center justify-center px-5">
  <Text className="text-gray-900 text-base font-semibold">취소</Text>
</TouchableOpacity>
```

---

## 크리에이터 카드

**레이아웃:** 2컬럼 그리드 | 비율 1:1 | 간격 8px | 수평 패딩 16px

```
┌─────────────────┐
│                 │ ← 사진 (resizeMode: cover)
│ 🟢      [🔵]  │ ← 온라인 점(좌상단) / 모드 뱃지(우상단)
│                 │
│ ░░ 그라데이션  │ ← transparent → rgba(0,0,0,0.65)
│ 닉네임 ✅      │
│ 900P/분   [📹] │ ← 통화 버튼(우하단 36px Pink 원형)
└─────────────────┘
```

```tsx
// components/CreatorCard.tsx 핵심 구조
<View className="flex-1 aspect-square rounded-2xl overflow-hidden">
  <Image source={{ uri: creator.photo }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} className="absolute bottom-0 left-0 right-0 h-20" />

  {/* 온라인 뱃지 */}
  {creator.isOnline && <View className="absolute top-2 left-2 w-2 h-2 rounded-full bg-green-400" />}

  {/* 모드 뱃지 */}
  <View className="absolute top-2 right-2 px-2 py-0.5 rounded-full"
    style={{ backgroundColor: creator.mode === 'blue' ? '#D1E4F8' : '#FFEEF1' }}>
    <Text style={{ color: creator.mode === 'blue' ? '#4D9FFF' : '#FF5C7A', fontSize: 11 }}>
      {creator.mode === 'blue' ? '🔵' : '🔴'}
    </Text>
  </View>

  {/* 하단 정보 */}
  <View className="absolute bottom-0 left-0 right-0 px-2 pb-2">
    <Text className="text-white text-sm font-semibold">{creator.nickname} {creator.isVerified && '✅'}</Text>
    <View className="flex-row items-center justify-between mt-0.5">
      <Text className="text-white text-xs opacity-80">{creator.ratePerMin}P/분</Text>
      <TouchableOpacity className="bg-pink w-8 h-8 rounded-full items-center justify-center">
        <Ionicons name="videocam" size={16} color="white" />
      </TouchableOpacity>
    </View>
  </View>
</View>
```

---

## 모드 탭

| 상태 | 배경 | 텍스트 | 하단 Border |
|------|------|--------|------------|
| 비활성 | `#F0F0F5` | `#8E8EA0` | 없음 |
| 파란불 활성 | `#D1E4F8` | `#4D9FFF` | 2px `#4D9FFF` |
| 빨간불 활성 | `#FFEEF1` | `#FF5C7A` | 2px `#FF5C7A` |

전환 애니메이션: 200ms ease

---

## 핵심 화면 무드

| 화면 | 배경 | 포인트 | 무드 |
|------|------|--------|------|
| 스플래시 | `#1B2A4A` Navy | `#FF6B9D` 로고 | 고급스러운 첫인상 |
| 온보딩 | `#FFFFFF` | `#D1E4F8` 일러스트 배경 | 부드럽고 친근 |
| 메인 피드 | `#F8F8FA` | 모드별 컬러 | 밝고 깔끔 |
| 통화 | `#000000` | `#FF6B9D` 컨트롤 | 풀스크린 집중 |
| 충전 | `#FFFFFF` | `#FF6B9D` CTA | 쇼핑앱 느낌 |
| 대시보드 | `#F8F8FA` | `#1B2A4A` Navy | 전문적 |

---

## 그림자

```ts
export const shadows = {
  card:  { shadowColor:'#1B2A4A', shadowOffset:{width:0,height:2}, shadowOpacity:0.08, shadowRadius:8,  elevation:3 },
  modal: { shadowColor:'#000',    shadowOffset:{width:0,height:-4}, shadowOpacity:0.12, shadowRadius:16, elevation:8 },
}
```

## 아이콘

```
라이브러리: @expo/vector-icons (Ionicons)
크기: 기본 20px / 탭바 24px / 통화 컨트롤 28px / 카드 내 16~18px
색상: 비활성 #8E8EA0 / 활성 #1B2A4A / CTA 위 #FFFFFF
```
