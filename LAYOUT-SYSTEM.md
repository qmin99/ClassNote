# ClassNote Layout System — CSS Architecture Reference

> 이 문서는 `template-styles.css`의 3-레이아웃 시스템 (Classic / Modern / Compact) 구조를 정리한 것.
> 새 콘텐츠 타입이나 UI 요소 추가 시 **반드시 3개 레이아웃 모두에 대한 CSS 오버라이드를 작성**해야 함.

---

## 1. 레이아웃 개요

| Layout | CSS Class | 배경 | 디자인 컨셉 |
|--------|-----------|------|------------|
| **Classic** | (기본, 클래스 없음) | `var(--surface)` (white) | 교과서 스타일. 하단 보더 구분선, accent 번호 배지, 깔끔한 구조 |
| **Modern** | `.layout--modern` | `var(--ac-l)` (연한 accent) | M3 카드 스타일. 백색 카드 위 accent 테두리, 그림자 최소화, 아이템에 `rgba(255,255,255,.85)` + `var(--ac-m)` 보더 |
| **Compact** | `.layout--compact` | `var(--surface)` (white) | C1 Inline Tag. 태그 칩 헤더, · 불릿 리스트, 수평 구분선, 최소 여백 |

레이아웃 클래스는 `.page` 또는 `.ob__preview-page` 요소에 적용됨.
에디터 콘텐츠와 프리뷰 모두 동일한 CSS를 공유.

---

## 2. 테마 시스템

6개 테마, `data-theme` 속성으로 적용. CSS 변수 3개를 세팅:

| Theme | `--ac` (accent) | `--ac-l` (light bg) | `--ac-m` (medium border) |
|-------|-----------------|---------------------|--------------------------|
| `ink` | `#111` | `#f8f8f8` | `#e2e2e2` |
| `teal` | `#2da5b6` | `#f7fcfd` | `#d5edf1` |
| `forest` | `#1d8a5e` | `#f5fcf8` | `#c4e8d6` |
| `plum` | `#8b3a8b` | `#faf5fa` | `#e4cce4` |
| `ember` | `#d4572a` | `#fdf7f5` | `#f2d4c6` |
| `steel` | `#506d85` | `#f5f7f9` | `#cdd7e0` |

**규칙**: 모든 레이아웃의 스타일은 하드코딩 색상 대신 `var(--ac)`, `var(--ac-l)`, `var(--ac-m)` 사용.
예외: `var(--white)`, `var(--text)`, `var(--t2)`~`var(--t5)`, `var(--bd)`, `var(--bd2)` 등 기본 변수.

---

## 3. 전환 애니메이션

### 색상 전환 (테마 변경)
- **C5 — Instant**: 모션 없음. CSS `transition: background .3s ease`만으로 색상 자연 전환.

### 레이아웃 전환 (템플릿 변경)
- **L4 — Micro Scale**: `scale(0.98) + opacity 0.1` 150ms out → `scale(1) + opacity 1` 200ms in.
- JS에서 `_prevLayout` 변수로 레이아웃 변경 여부 감지, 변경 시에만 애니메이션 적용.

---

## 4. 콘텐츠 요소 전체 맵

아래 표는 모든 CSS 클래스와 각 레이아웃에서의 스타일 상태.
새 요소 추가 시 이 표에 추가하고 3개 레이아웃 모두 CSS 작성.

### 4.1 Page Header

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.p-header` | 헤더 컨테이너 | flex, border-bottom 2px accent | border-bottom:none | border-bottom 1px solid text, 축소 여백 |
| `.p-header__left` | 좌측 영역 | flex:1 | flex:1 | flex:1 |
| `.p-header__right` | 우측 영역 | flex-col, align-end, gap:8px | gap:6px | gap:5px |
| `.p-brand` | 브랜드명 | 9px, uppercase, color t3 | 8px, color t4 | 7px, color t4 |
| `.p-logo` | 로고 이미지 | 28px height | (기본 상속) | (기본 상속) |
| `.p-series` | 시리즈명 | 10px, accent color | 9px, opacity .5 | 7.5px, opacity .45 |
| `.p-title` | 제목 | serif 21px | sans 21px 800 tight | sans 16px 800 |
| `.p-subtitle` | 부제 | 11.5px, color t3 | 11px, color t3 | 9.5px, color t3 |
| `.p-badge` | 레벨 뱃지 | border accent, 11px | filled accent bg, white text | 8px, thin border |
| `.p-meta` | 메타 정보 | 10.5px, color t3 | 10px, color t3 | 9px, color t3 |
| `.p-nav` | 네비 버튼 | 28x28, radius 4px | radius 6px | 22x22, radius 2px |

### 4.2 Section Structure

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.ps` | 섹션 컨테이너 | margin-bottom:18px | 백색 카드 + ac-l border + radius 8px + shadow | border-bottom 구분선 |
| `.psh` | 섹션 헤더 | flex, gap:8px | flex, ::after 제거 | inline-flex, gap:0 (칩 형태) |
| `.psh::after` | 수평선 | flex:1 1px line | display:none | content:none, display:none |
| `.psh__n` | 섹션 번호 | 10px, accent, opacity .6 | 11px 900 accent, opacity 1 | 8px 칩 좌측 (ac-l 배경) |
| `.psh__t` | 섹션 제목 | 11px 700 uppercase, kr font | 12px 700, text color | 9px 800 칩 우측 (ac-l 배경, accent 색) |

### 4.3 Phrase List

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.pl` | 리스트 컨테이너 | border, radius 4px, shadow, overflow:hidden | border:none, flex-col gap:4px | border:none, padding-left:12px |
| `.pl li` | 리스트 아이템 | 12.5px, border-bottom, white bg | ac-m border, radius 6px, rgba bg | · 불릿, 10.5px, no border |
| `.pl li::before` | 불릿 | (없음) | (없음) | `·` absolute positioned |
| `.pl li:last-child` | 마지막 아이템 | border-bottom:none | border-bottom: ac-m (유지) | border:none |

### 4.4 Vocab Grid

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.vg` | 그리드 컨테이너 | 3col, gap:6px | 3col, gap:6px | 2col, gap:0 |
| `.vi` | 단어 카드 | border, radius 4px, shadow, white bg | ac-m border, radius 6px, rgba bg | border-bottom만, flex row |
| `.vi__t` | 단어 | 11.5px 600, text color | 11px 700, accent color | 10px 700, inline |
| `.vi__d` | 뜻 | 10.5px, t3 color | 10px | 9px |
| `.vi:nth-child(odd/even)` | 홀짝 구분 | (없음) | (없음) | 홀수 오른쪽 border-right, 짝수 padding-left |

### 4.5 Scenarios

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.scs` | 시나리오 그리드 | 2col, gap:8px | 2col, gap:8px | 1col, gap:0 |
| `.sc` | 시나리오 카드 | border, radius 4px, shadow, white bg | ac-l border, radius 6px, rgba bg | border-bottom만, no bg |
| `.sc__n` | 라벨 | 9px 700, t4 color | accent, opacity .6 | 7px, opacity .4 |
| `.sc__t` | 제목 | 12px 600, text color, kr font | 12px 600 | 10px 600, inherit font |
| `.sc__p` | 예문 | serif italic, border-left 2px accent | border ac-m, radius 6px, no border-left | 9.5px, no border, no style |

### 4.6 Homework

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.hwl` | 숙제 그리드 | 3col, gap:6px | 3col, gap:0 | 1col, gap:0 |
| `.hwl li` | 숙제 아이템 | border, radius 4px, shadow, white bg | no border/shadow, border-bottom | border-bottom만, no bg |
| `.hw__n` | 번호 배지 | 18x18 accent bg, radius 2px | radius 4px | 14x14, 8px font |
| `.hw__t` | 제목 | 11.5px 600 | 11.5px 600 | 10px 600 |
| `.hw__d` | 설명 | 10.5px, t3 | 10.5px, t3 | 8.5px, t3 |

### 4.7 Callout Box (개념/공식)

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.cb` | 박스 컨테이너 | border-left 4px accent, radius 0 4px, shadow | ac-l border all sides, radius 6px, rgba bg | 1px bd2 border all sides, radius 3px, no bg |
| `.cb__t` | 제목 | 12.5px 700, accent | accent 700 | 10px 700, text color |
| `.cb__b` | 본문 | 12px, t2, line-height 1.85 | 11.5px, t2, line-height 1.8 | 9.5px, line-height 1.65 |

### 4.8 Problems (문제)

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.prb` | 문제 컨테이너 | margin-bottom:14px | margin-bottom:14px | margin-bottom:5px |
| `.prb__h` | 문제 헤더 (번호+질문) | flex, gap:9px | flex, gap:9px | flex, gap:6px |
| `.prb__n` | 번호 배지 | 20x20 accent bg, radius 2px | radius 4px | 15x15, 8px font, radius 2px |
| `.prb__q` | 질문 텍스트 | 12.5px, text color | 12px, text color | 10px, line-height 1.55 |
| `.prb__ch` | 선택지 그리드 | 2col, padding-left:29px | 2col, padding-left:29px, gap 4px 16px | 2col, padding-left:21px, gap 2px 12px |
| `.prb__c` | 선택지 텍스트 | 12px, t2 | 11.5px, t2 | 9.5px, t2 |
| `.prb__cm` | 선택지 마커 (ⓐⓑ) | 11px accent 600 | 10.5px accent 700 | 9px accent 700 |
| `.prb__a` | 답안 영역 | dashed border, margin-left:29px | radius 6px, dashed ac-m, rgba bg | 28px min-h, margin-left:21px, radius 2px |
| `.prb__sub` | 보충 설명 | 11px, margin-left:29px | 10.5px, margin-left:29px | 9px, margin-left:21px |

### 4.9 Passage (지문)

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.psg` | 지문 박스 | border-left 3px accent, ac-l bg, radius 0 4px | ac-l border, radius 6px, rgba bg, no border-left | no border/bg, border-bottom 구분선만, 10px |
| `.psg mark` | 하이라이트 | rgba bg, radius 2px | (상속) | (상속) |

### 4.10 Table

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.ptb` | 테이블 | border, radius 4px, overflow:hidden | ac-l border, radius 6px | 1px bd border |
| `.ptb th` | 헤더 셀 | ac-l bg, accent text, 10.5px | accent bg, white text, 10px | 8.5px, letter-spacing |
| `.ptb td` | 데이터 셀 | white bg, bd2 borders | white bg, bd2 borders | padding 3px 8px |

### 4.11 Write Lines (작문)

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.wl` | 쓰기 줄 | height:30px, border-bottom bd | border-bottom bd | height:20px |
| `.wl--t` | 높은 쓰기 줄 | height:42px | height:42px | height:28px |

### 4.12 Footer

| CSS Class | 역할 | Classic (base) | Modern | Compact |
|-----------|------|----------------|--------|---------|
| `.pf` | 푸터 | border-top bd2, 9px, flex space-between | border-top:none, opacity .4 | border-top bd2, opacity .35, 축소 패딩 |

---

## 5. 디자인 원칙 요약

### Modern 레이아웃 패턴
- **컨테이너** (`.ps`, `.cb`, `.psg`): `background:var(--white); border:1px solid var(--ac-l); border-radius:6~8px; box-shadow:0 1px 4px rgba(0,0,0,.03)`
- **아이템** (`.pl li`, `.vi`, `.prb__a`): `background:rgba(255,255,255,.85); border:1px solid var(--ac-m); border-radius:5~6px`
- **번호/배지** (`.prb__n`, `.hw__n`): `background:var(--ac); border-radius:4px`
- **수평선/구분**: 제거 (`::after{display:none}`, `border-bottom:none`)
- **그라디언트 금지**: 학생 프린트 가능해야 함

### Compact 레이아웃 패턴
- **컨테이너**: `border:none; background:none; border-bottom:1px solid var(--bd2)` (구분선만)
- **아이템**: `border:none; background:none; padding 최소화`
- **리스트**: `·` 불릿 (`::before{content:'·'}`)
- **섹션 헤더**: 인라인 칩 형태 (좌: 번호, 우: 제목, `var(--ac-l)` 배경)
- **크기**: 모든 폰트 ~80% 축소, 여백 최소화
- **accent bar 금지**: `border-left` accent 스타일 전부 제거

### Classic 레이아웃 패턴
- CSS 기본값 (오버라이드 없음)
- 교과서 스타일: 보더 구분, accent 배지, serif 제목

---

## 6. 새 콘텐츠 타입 추가 체크리스트

새 CSS 클래스를 추가할 때 반드시:

1. **Classic (base)** 스타일 작성 — `/* PAGE CONTENT */` 섹션에
2. **Modern** 오버라이드 작성 — `/* LAYOUT: MODERN */` 섹션에
   - 컨테이너면 → 백색 카드 + ac-l 테두리 + radius 6~8px
   - 아이템이면 → rgba 배경 + ac-m 테두리 + radius 5~6px
   - 수평선/border-left → 제거
3. **Compact** 오버라이드 작성 — `/* LAYOUT: COMPACT */` 섹션에
   - 테두리/그림자/배경 → 전부 제거, border-bottom 구분선만
   - 폰트 크기 ~80% 축소
   - 여백 최소화
   - accent bar → 절대 사용 금지
4. **이 문서의 섹션 4 테이블에 추가**
5. **Auto-fit shrink** (`fit--1`, `fit--2`, `fit--3`) 에도 축소 규칙 필요 시 추가

---

## 7. 파일 구조

```
template-styles.css
├── CSS Variables & Base
├── PAGE CONTENT (Classic = base styles)
│   ├── .p-header, .p-brand, .p-title, etc.
│   ├── .ps, .psh (section)
│   ├── .pl, .pl li (phrase list)
│   ├── .vg, .vi (vocab)
│   ├── .scs, .sc (scenarios)
│   ├── .hwl, .hw (homework)
│   ├── .cb (callout box)
│   ├── .prb (problems)
│   ├── .psg (passage)
│   ├── .ptb (table)
│   ├── .wl (write lines)
│   └── .pf (footer)
├── THEMES (data-theme → --ac, --ac-l, --ac-m)
├── LAYOUT: MODERN (.layout--modern overrides)
│   ├── Page background
│   ├── Header overrides
│   ├── Section overrides
│   ├── Phrase/Vocab/Scenario/Homework/Callout/Problem/Passage/Table/Write/Footer
│   └── (모든 base 요소에 대응하는 오버라이드 필수)
├── LAYOUT: COMPACT (.layout--compact overrides)
│   ├── Page padding
│   ├── Header overrides
│   ├── Section overrides (inline tag chip)
│   ├── Phrase/Vocab/Scenario/Homework/Callout/Problem/Passage/Table/Write/Footer
│   └── (모든 base 요소에 대응하는 오버라이드 필수)
└── AUTO-FIT SHRINK LEVELS
```

---

## 8. 프리뷰 함수 참조 (template-app.js)

| 함수 | 과목 | 사용하는 CSS 클래스 |
|------|------|-------------------|
| `previewHeader(L, d, teacher, brand, badge)` | 공통 | `.p-header`, `.p-header__left/right`, `.p-brand`, `.p-series`, `.p-title`, `.p-subtitle`, `.p-badge`, `.p-meta` |
| `pvSec(L, num, label)` | 공통 헬퍼 | `.psh`, `.psh__n`, `.psh__t` |
| `pvVocab(L, items, label)` | 공통 헬퍼 | `.ps`, `.vg`, `.vi`, `.vi__t`, `.vi__d` |
| `previewConv(L, d)` | 회화 (conv) | `.ps`, `.pl li`, `.vg`, `.vi`, `.scs`, `.sc`, `.sc__n/t/p` |
| `previewRead(L, d)` | 독해 (read) | `.ps`, `.psg`, `.vg`, `.vi`, `.prb`, `.prb__h/n/q/a` |
| `previewGram(L, d)` | 문법 (gram) | `.ps`, `.pl li`, `.vi`, `.prb`, `.prb__h/n/q/a` |
| `previewMath(L, d)` | 수학 (math) | `.ps`, `.pl li`, `.cb`, `.cb__t/b`, `.prb`, `.prb__h/n/q/a` |
| `previewLit(L, d)` | 문학 (lit) | `.ps`, `.psg`, `.vg`, `.vi`, `.prb`, `.prb__h/n/q/a` |
| `previewWrite(L, d)` | 작문 (write) | `.ps`, `.pl li`, `.psg`, `.prb`, `.prb__h/n/q/a` |

**참고**: `L` 파라미터는 현재 HTML 분기에 사용되지 않음. 모든 레이아웃 차이는 CSS로만 처리.
향후 레이아웃별 HTML 구조 자체가 달라져야 하면 이 파라미터를 활용할 수 있음.

---

## 9. 에디터 본문 vs 프리뷰 차이

에디터 본문 (`.page` 내부)과 온보딩 프리뷰 (`.ob__preview-page` 내부) 모두 동일한 CSS 클래스를 사용.
프리뷰 전용 CSS:

```css
.ob__preview-page { background:var(--surface); transition:background .3s ease; }
.ob__preview-page.layout--modern { background:var(--ac-l) }
.ob__preview-page.layout--compact { background:var(--surface) }
```

프리뷰에서 레이아웃 클래스는 JS `updatePreview()`에서 `.ob__preview-page`에 직접 추가됨.
