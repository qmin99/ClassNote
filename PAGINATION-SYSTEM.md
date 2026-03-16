# ClassNote Pagination & Auto-Fit System

> 이 문서는 `template-app.js`의 페이지네이션 시스템과 auto-fit 로직을 정리한 것.
> 콘텐츠가 A4 한 장을 넘길 때 페이지를 분배하고, 여백을 조절하여 최적화하는 전체 플로우.

---

## 1. 핵심 상수

```
A4_HEIGHT  = 1123px   (A4 전체 높이)
A4_PADDING = 96px     (상하 패딩 48px × 2)
A4_CONTENT = 1027px   (실제 콘텐츠 영역)
```

- 첫 페이지 가용 공간: `A4_CONTENT - headerH(+24px margin) - footerH(+16px margin)`
- 추가 페이지 가용 공간: `A4_CONTENT - footerH` (헤더 없음)
- 섹션 마진 추정치: `+18px` (각 섹션의 offsetHeight에 더해짐)

---

## 2. 전체 플로우

```
renderPage()
  └→ requestAnimationFrame()
       └→ paginateContent()
            ├── 1. Reset fit classes
            ├── 2. Measure true height (scrollHeight)
            ├── 3. Global auto-fit (fit--1 → 2 → 3)
            ├── 4. Single page? → 끝
            ├── 5. Section extraction (header / footer / sections[])
            ├── 6. Section distribution (greedy + smart squeeze)
            ├── 7. Multi-page construction
            └── 8. Page numbering & navigation
```

---

## 3. Auto-Fit 시스템 (CSS 기반 축소)

### 3.1 Global Auto-Fit (기존)

콘텐츠가 A4를 초과할 때, 전체 페이지에 fit 클래스를 순차 적용:

1. `fit--1` → 여백 축소, 폰트 소폭 축소
2. `fit--2` → 여백 추가 축소, 폰트 크기 2단계 축소
3. `fit--3` → 페이지 패딩까지 축소, 최대 압축

**적용 로직:**
- fit--1 적용 → scrollHeight ≤ A4_HEIGHT이면 stop
- 아니면 fit--1 제거 → fit--2 적용 → 체크
- 아니면 fit--2 제거 → fit--3 적용 → 체크
- fit--3에서도 안 들어가면 → 모든 fit 제거 → 멀티페이지 진행

### 3.2 Smart Page Squeeze (신규 추가)

멀티페이지 분배 시, 섹션이 현재 페이지에 "거의" 들어갈 때:

1. **오버플로우 비율 계산**: `overflow / (currentH + secH)`
2. **25% 이하면** squeeze 시도 (너무 큰 초과는 시도하지 않음)
3. 현재 페이지의 모든 섹션 + 후보 섹션에 `fit--1/2/3`를 순차 적용
4. 맞으면 → 해당 페이지에 fit 레벨 기록, 섹션 추가
5. 안 맞으면 → 기존대로 다음 페이지로 이동

**왜 25%?**
- 너무 높은 비율이면 fit--3까지 적용해도 안 들어감
- 25% 이하의 오버플로우는 fit--1~2로 대부분 해결 가능
- 과도한 축소 방지 (fit--3이 적용되면 가독성이 다소 떨어짐)

**per-page fit 적용:**
- `pageFitLevel[]` 배열이 각 페이지의 fit 레벨을 추적
- 페이지 빌드 시 해당 페이지에만 `fit--N` 클래스 적용
- 다른 페이지는 영향받지 않음

---

## 4. 섹션 분배 알고리즘

```
sections[] 순회:
  ├── secH = sec.offsetHeight + 18
  ├── limit = isFirstPage ? page1Available : pageNAvailable
  │
  ├── currentH + secH ≤ limit?
  │     └→ YES: 현재 페이지에 추가
  │
  └── currentH + secH > limit?
        ├── overflow ratio ≤ 25%?
        │     ├→ fit--1로 전체 재측정 → 맞으면 squeeze
        │     ├→ fit--2로 전체 재측정 → 맞으면 squeeze
        │     └→ fit--3로 전체 재측정 → 맞으면 squeeze
        │
        └→ squeeze 실패 or ratio > 25%:
              └→ 새 페이지 시작, 섹션 추가
```

**핵심 원칙: 섹션은 절대 분할하지 않음.**
섹션(`.ps`)은 원자 단위로, 한 섹션의 일부만 한 페이지에 넣는 것은 불가.
대신 squeeze로 여백/폰트를 줄여서 통째로 끼워넣음.

---

## 5. Fit 레벨별 CSS 변화 요약

### fit--1 (경미한 축소)
| 요소 | 변화 |
|------|------|
| `.ps` | margin-bottom: 18→10px |
| `.p-header` | margin-bottom: 24→16px, padding-bottom: 16→10px |
| `.pl li` | padding: 9px→6px, font-size: 12.5→11px |
| `.vg` | gap: 6→4px |
| `.vi` | padding: 9px→5px |
| `.sc` | padding: 12px→8px |
| `.hwl li` | padding: 9px→6px |
| `.psh` | margin-bottom: 8→4px |
| `.prb` | margin-bottom: 14→6px |
| `.wl` | height: 30→24px |

### fit--2 (중간 축소)
| 요소 | 변화 |
|------|------|
| `.ps` | margin-bottom: →6px |
| `.p-header` | margin-bottom: →10px |
| `.p-title` | font-size: 21→17px |
| `.pl li` | padding: →4px, font-size: →10.5px, line-height: →1.5 |
| `.vi__t/d` | font-size: →10/9px |
| `.sc__t/p` | font-size: →11/10px |
| `.hw__t/d` | font-size: →11/9px |
| `.prb` | margin-bottom: →4px |
| `.prb__q` | font-size: →10.5px |
| `.cb` | padding: →10px 14px |
| `.ptb` | font-size: →10px |
| `.wl` | height: →20px |

### fit--3 (최대 축소)
| 요소 | 변화 |
|------|------|
| 페이지 패딩 | 48px→36px 48px |
| `.ps` | margin-bottom: →4px |
| `.p-title` | font-size: →15px |
| `.pl li` | padding: →3px, font-size: →10px, line-height: →1.4 |
| 모든 요소 | 최소 크기까지 축소 |
| `.wl` | height: →16px |

---

## 6. 페이지 구조

### HTML 구조
```html
<div id="pageWrap">
  <!-- 첫 페이지 -->
  <div class="page layout--{classic|modern|compact} [fit--N]" data-theme="teal">
    <div class="p-header">...</div>        <!-- 헤더: 첫 페이지만 -->
    <div class="ps">...</div>              <!-- 섹션 1 -->
    <div class="ps">...</div>              <!-- 섹션 2 -->
    <div class="pf">...</div>              <!-- 푸터 -->
    <div class="p-page-num">1 / 3</div>   <!-- 페이지 번호 -->
  </div>

  <!-- 추가 페이지 -->
  <div class="page page--extra layout--{...} [fit--N]" data-theme="teal">
    <div class="ps">...</div>              <!-- 섹션 3 -->
    <div class="ps">...</div>              <!-- 섹션 4 -->
    <div class="p-page-num">2 / 3</div>
  </div>

  <!-- 마지막 페이지 -->
  <div class="page page--extra layout--{...} [fit--N]" data-theme="teal">
    <div class="ps">...</div>              <!-- 섹션 5 -->
    <div class="pf">...</div>              <!-- 푸터: 마지막만 -->
    <div class="p-page-num">3 / 3</div>
  </div>
</div>
```

### 페이지별 특성
| | 첫 페이지 | 중간 페이지 | 마지막 페이지 |
|---|-----------|------------|-------------|
| 클래스 | `.page` | `.page.page--extra` | `.page.page--extra` |
| 헤더 | O (clone) | X | X |
| 푸터 | O (clone) | X | O (clone) |
| 페이지 번호 | O | O | O |
| fit 클래스 | 개별 적용 | 개별 적용 | 개별 적용 |

---

## 7. 네비게이션

```javascript
pageState = { pages: [DOM, DOM, ...], current: 0, total: N }
```

- `#pagePrev` / `#pageNext` 버튼으로 페이지 이동
- `scrollIntoView({ behavior: 'smooth' })` 로 스크롤
- `.page-nav--show` 클래스로 네비 표시/숨김

---

## 8. 온보딩 프리뷰 페이지 수 예측

온보딩 위자드에서 "총 N장으로 구성됩니다" 표시할 때:
- 숨겨진 DOM 요소에 콘텐츠를 렌더링하여 높이 측정
- 동일한 auto-fit + 분배 로직 사용
- 실제 페이지네이션과 동일한 결과를 예측

---

## 9. 이벤트 트리거

| 이벤트 | 함수 | 결과 |
|--------|------|------|
| 콘텐츠 편집 (input) | `onInputChange()` → `renderPage()` | 전체 리렌더 + 페이지네이션 |
| 테마 변경 | `renderPage()` | 리렌더 (높이 변경 없을 수 있음) |
| 레이아웃 변경 | `renderPage()` | 리렌더 (높이 크게 변경될 수 있음) |
| 폰트 변경 | `renderPage()` | 리렌더 (높이 변경 가능) |
| 세션 전환 | `renderPage()` | 전체 콘텐츠 교체 |

---

## 10. 디버깅 & 주의사항

### 측정 타이밍
- `scrollHeight` 측정은 **반드시** DOM이 그려진 후 (`requestAnimationFrame` 내부)
- `maxHeight:none; overflow:visible` 상태에서 측정해야 실제 높이 확인 가능
- 측정 후 반드시 원복: `maxHeight:''; overflow:''`

### Fit 클래스와 Layout 클래스 상호작용
- Fit 클래스는 Layout과 독립적으로 작동
- `.page.fit--1 .pl li`는 classic/modern/compact 모두에 적용됨
- Modern/Compact의 고유 크기가 fit보다 작을 경우, fit이 무시될 수 있음 (CSS specificity)
- **TODO**: Modern/Compact 전용 fit 오버라이드가 필요할 수 있음 (`.layout--modern.fit--1 .pl li` 등)

### Smart Squeeze 핵심
- **fit 클래스는 반드시 PAGE 요소에** 적용해야 함 (`.page.fit--1 .ps`). 개별 섹션에 넣으면 작동 안 함.
- `measurePageAtFit()`은 `firstPage`에 fit 클래스를 임시 적용 → 측정 → 제거
- fit 레벨별 margin 추정치도 달라짐: 18→10→6→4px (CSS와 동기화)
- 25% 초과 오버플로우는 squeeze 시도하지 않음
- DOM reflow가 발생하지만 섹션 수가 적어서 (보통 3~6개) 성능 이슈 없음

### 온보딩 예측과 실제 pagination 동기화
- 온보딩 프리뷰와 실제 `paginateContent()` 모두 **동일한 `countPages(pageEl)` 함수**를 호출
- 별도 추정 로직 없음. 하나의 함수가 진실의 원천 (single source of truth)
- 온보딩은 hidden DOM에, pagination은 실제 DOM에 `countPages()`를 호출할 뿐

### 섹션 = 원자 단위
- 섹션 내부를 분할하여 두 페이지에 걸치는 것은 **지원하지 않음**
- 한 섹션이 페이지 전체보다 큰 경우 (이론적으로 불가능하지만) → 현재 페이지에 그냥 추가됨
- 이 경우 콘텐츠가 잘릴 수 있음 → 콘텐츠 설계 시 한 섹션이 A4 한 장을 넘지 않도록 주의

---

## 11. 새 fit 레벨 추가 체크리스트

fit--1/2/3에 새 요소를 추가하거나 fit--4를 만들 때:

1. `template-styles.css`의 `/* AUTO-FIT SHRINK LEVELS */` 섹션에 CSS 추가
2. JS의 `fitLevels` 배열에 새 레벨 추가 (필요 시)
3. 축소 순서: 여백 → 패딩 → 폰트 크기 → 줄 간격 → 페이지 패딩
4. 각 레벨에서 모든 콘텐츠 타입 포함되었는지 확인 (LAYOUT-SYSTEM.md 섹션 4 참조)
5. Modern/Compact 레이아웃에서 fit 결과가 자연스러운지 확인
