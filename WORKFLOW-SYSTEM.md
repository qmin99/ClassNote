# 선생 독립 워크플로우 시스템 — 구현 명세서

> **목표**: 선생에게 에디터 링크, 학생에게 뷰어 링크를 제공하여 선생이 메인 사이트 재방문 없이 독립적으로 세션을 생성·편집·배포할 수 있게 한다.

---

## 1. Firestore 데이터 모델

### 1.1 에디터 데이터 — `courses/{courseDocId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `courseId` | string | 과목 식별자 (예: `"biz-english"`, `"daily-english"`) |
| `classnote` | object | 온보딩에서 설정한 전체 설정값 |
| `classnote.brand` | string | 학원/브랜드명 |
| `classnote.sections` | object | 섹션 on/off 맵 (예: `{ sec01: true, vocab: true }`) |
| `classnote.sectionNames` | object | 커스텀 섹션명 |
| `classnote.layout` | string | `"classic"` \| `"modern"` \| `"compact"` |
| `classnote.font` | string | `"sans"` \| `"serif"` \| `"mono"` |
| `classnote.subject` | string | `"english"` \| `"math"` \| `"korean"` |
| `classnote.type` | string | `"conversation"` \| `"daily"` \| `"reading"` 등 |
| `classnote.level` | string | `"elementary"` \| `"middle"` \| `"high"` \| `"adult"` |
| `classnote.difficulty` | string | `"beginner"` \| `"intermediate"` \| `"advanced"` |
| `state` | object | 에디터 런타임 상태 |
| `state.theme` | string | 현재 테마 (`"ink"`, `"teal"`, `"forest"`, `"plum"`, `"ember"`, `"steel"`) |
| `state.teacherName` | string | 선생님 이름 |
| `state.studentName` | string | 학생 이름 |
| `state.date` | string | 포맷된 날짜 (예: `"2026년 3월 19일"`) |
| `sessions` | array | 전체 세션 배열 (raw data, 렌더링 전 상태) |
| `publishedSlug` | string \| null | 연결된 배포 slug (배포 이력 있으면) |
| `createdAt` | timestamp | 최초 생성 시각 |
| `updatedAt` | timestamp | 마지막 수정 시각 |

**`courseDocId`**: 8자 랜덤 slug (a-z, 0-9). `generateSlug()` 방식 동일.

**`sessions` 배열 구조** (과목별 상이, 비즈니스 영어 예시):
```javascript
[
    {
        num: 1,
        title: "First Day at a Company",
        subtitle: "첫 출근 — ...",
        sections: [
            { num: "01", name: "첫 인사", phrases: ["...", "..."] },
            { num: "02", name: "자기소개", phrases: ["...", "..."] }
        ],
        vocab: [{ term: "Meet in person", def: "직접 만나다" }],
        scenarios: [{ num: "01", title: "...", prompt: "..." }],
        homework: [{ title: "...", desc: "..." }]
    },
    { num: 2, title: "Session 2", ... },
    { num: 3, title: "Session 3", ... }
]
```

**logoData 제외 이유**: base64 인코딩된 이미지는 300KB~1MB+ → Firestore 1MB 문서 제한 위험. logoData는 localStorage에만 유지.

---

### 1.2 배포 데이터 — `published_notes/{slug}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `sessions` | array | 세션별 렌더된 HTML 배열 |
| `sessions[].html` | string | 해당 세션의 렌더된 HTML (contenteditable, CRUD 버튼 제거됨) |
| `sessions[].title` | string | 세션 제목 |
| `sessions[].subtitle` | string | 세션 부제목 |
| `settings` | object | 테마·레이아웃·폰트·이름·날짜 등 (기존과 동일) |
| `courseDocId` | string | 에디터 문서 역링크 |
| `createdAt` | timestamp | 최초 배포 시각 |
| `updatedAt` | timestamp | 마지막 재배포 시각 |

**하위호환**: 기존 `published_notes`는 `html` (단일 string) 필드. 뷰어에서 `sessions` 배열이 없으면 `html`을 단일 세션으로 래핑하여 처리.

---

## 2. URL 구조

| URL | 용도 | 예시 |
|-----|------|------|
| `templates.html` | 신규 온보딩 → 에디터 | 기존 그대로 |
| `templates.html?c={courseDocId}` | 저장된 과목 에디터 직접 접근 | `templates.html?c=a1b2c3d4` |
| `view.html?id={slug}` | 학생 뷰어 (기존) | `view.html?id=xyz789` |
| `view.html?id={slug}&s={idx}` | 학생 뷰어 특정 세션 | `view.html?id=xyz789&s=2` |

---

## 3. 파일별 변경 상세

### 3.1 template-app.js

#### 신규 함수: `saveCourseToFirestore()`
```
위치: PUBLISH / DEPLOY 섹션 부근
트리거: 편집 후 3초 디바운스 (기존 autosave 타이머와 병행)
동작:
  1. syncEditablesToSession()
  2. course = getCourse(), session data 수집
  3. __classnote에서 classnote 필드 수집
  4. state에서 theme/teacherName/studentName/date 수집
  5. courseDocId 없으면 generateCourseDocId() → 8자 slug 생성
  6. db.collection('courses').doc(courseDocId).set({ ... }, { merge: true })
  7. 첫 저장이면: history.replaceState로 URL에 ?c= 추가
  8. 상태바에 "저장됨" 표시 (기존 autosave 상태 UI 재활용)
```

#### 신규 함수: `loadCourseFromFirestore(courseDocId)`
```
위치: INIT 섹션 상단
트리거: 페이지 로드 시 ?c= 파라미터 감지
동작:
  1. db.collection('courses').doc(courseDocId).get()
  2. 성공 시:
     a. doc.data().sessions → 해당 course의 sessions 교체
        - ALL_COURSES에서 courseId로 course 찾기
        - course.sessions = doc.data().sessions
     b. doc.data().classnote → window.__classnote 교체
     c. doc.data().state → state 객체 교체
     d. state.courseId = doc.data().courseId
     e. state.sessionIdx = 0
     f. doc.data().publishedSlug → currentPublishedSlug 설정
  3. 실패 시: 에러 토스트 표시, 온보딩으로 폴백
```

#### 신규: 페이지 로드 시 `?c=` 감지 로직
```
위치: INIT 섹션 (renderNav() / renderPage() 호출 전)
동작:
  1. var urlParams = new URLSearchParams(location.search)
  2. var courseParam = urlParams.get('c')
  3. if (courseParam):
     a. 온보딩 즉시 숨김: obOverlay.classList.add('ob--hidden')
     b. 로딩 화면 표시
     c. loadCourseFromFirestore(courseParam).then → renderNav() + renderPage()
  4. else:
     a. 기존 온보딩 흐름 그대로
```

#### 수정: `publishNote()`
```
기존: captureNoteData() → 현재 페이지 HTML만 캡처
변경:
  1. syncEditablesToSession()
  2. var course = getCourse()
  3. var sessionsData = []
  4. course.sessions.forEach(function(session, i) {
       // 오프스크린 렌더: hidden div에 렌더 → HTML 캡처
       a. 임시로 state.sessionIdx = i
       b. hidden div에 renderer(session, course, getCtx()) 실행
       c. paginateContent() 적용 (hidden div 대상)
       d. HTML 캡처 (contenteditable/CRUD 제거)
       e. sessionsData.push({ html, title: session.title, subtitle: session.subtitle })
     })
  5. state.sessionIdx 원래 값 복원
  6. Firestore 저장: { sessions: sessionsData, settings, courseDocId }
  7. 배포 모달에 학생 링크 + 에디터 링크 표시
```

#### 수정: 온보딩 `launchEditor()` 후 처리
```
기존: localStorage에 onboarding state 저장
추가: launchEditor() 완료 후 saveCourseToFirestore() 호출
  → 첫 Firestore 저장 → URL에 ?c= 추가
  → "이 링크를 북마크하세요" 토스트 표시
```

#### 수정: 편집 시 자동 저장 연동
```
기존: hasEdited 플래그 + localStorage autosave (5초 디바운스)
추가: Firestore 저장도 디바운스 3초로 병행
  - localStorage는 오프라인 폴백 역할
  - Firestore가 primary 저장소
```

---

### 3.2 templates.html

#### 배포 모달 수정
```
기존 구조:
  #deploySuccess 내부:
    - 링크 input + 복사 버튼 + 열기 버튼
    - QR 코드

추가:
  - 에디터 링크 input + 복사 버튼 (학생 링크 아래)
  - 라벨: "선생님 편집 링크" / "학생 보기 링크"
```

#### 온보딩 완료 후 안내
```
추가: #editorLinkToast 요소
  - "에디터 링크가 생성되었습니다. 북마크하세요!"
  - 링크 표시 + 복사 버튼
  - 10초 후 자동 dismiss
```

---

### 3.3 view.js

#### `loadNote()` 수정
```
기존: doc.data() → { html, settings }
변경: doc.data() → { sessions, settings } 또는 { html, settings } (하위호환)

하위호환 로직:
  if (data.sessions && data.sessions.length) {
    // 새 형식: 다중 세션
    callback(data);
  } else if (data.html) {
    // 구 형식: 단일 세션 → sessions 배열로 래핑
    data.sessions = [{ html: data.html, title: data.settings.title, subtitle: data.settings.subtitle }];
    callback(data);
  }
```

#### `renderNote()` 수정
```
기존: container.innerHTML = cleanHtml (단일)
변경:
  1. 세션 탭 바 생성 (sessions.length > 1일 때만 표시)
  2. 첫 세션 (또는 ?s= 파라미터 세션) HTML 렌더
  3. 탭 클릭 핸들러: 해당 세션 HTML로 교체 + 페이지 네비 리셋
```

#### 신규: 세션 탭 전환
```
var viewSessions = [];  // { html, title, subtitle }[]
var currentSession = 0;

function switchSession(idx) {
  currentSession = idx;
  container.innerHTML = stripInteractive(viewSessions[idx].html);
  // 테마/레이아웃/폰트 재적용
  // 페이지 네비게이션 리셋
  setupPageNav();
  // 탭 active 상태 업데이트
  updateSessionTabs();
  // URL ?s= 파라미터 업데이트 (history.replaceState)
}
```

---

### 3.4 view.html

#### 세션 탭 바 HTML
```html
<!-- view-header 아래, view-body 위 -->
<div class="view-sessions" id="viewSessions" style="display:none">
    <div class="view-sessions__list" id="viewSessionList">
        <!-- JS에서 동적 생성 -->
    </div>
</div>
```

---

### 3.5 view.css

#### 세션 탭 스타일
```
.view-sessions: 상단 고정, 가로 스크롤, 배경 흰색, 하단 보더
.view-sessions__list: display flex, gap 0, overflow-x auto, -webkit-overflow-scrolling touch
.view-sessions__tab: padding 10px 20px, font 13px 500, 커서 포인터, 하단 보더 2px transparent
.view-sessions__tab--active: 하단 보더 accent 컬러, 폰트 볼드
다크모드: [data-dark="true"] 대응
모바일: 탭 축소 (padding 8px 14px, font 12px)
```

---

## 4. 구현 순서

| Phase | 작업 | 의존성 |
|-------|------|--------|
| **1** | `saveCourseToFirestore()` + `loadCourseFromFirestore()` | Firebase db 객체 (이미 존재) |
| **2** | `?c=` 파라미터 감지 + 온보딩 스킵 + 에디터 링크 안내 | Phase 1 |
| **3** | `publishNote()` 다중 세션 + 배포 모달 수정 | Phase 1 |
| **4** | 뷰어 세션 탭 (view.html + view.js + view.css) | Phase 3 |

---

## 5. 변경하지 않는 것

- 사이드바 구조/스타일 (320px, 3-Zone 유지)
- cbar (breadcrumb + 테마 dots + 이름/날짜 inputs + autosave 상태)
- topbar (프린트/PDF/배포 버튼)
- 온보딩 UI/플로우 (신규 진입 시)
- 렌더러 함수들 (`renderers` 객체)
- 페이지 피팅/페이지네이션 로직 (`paginateContent()`, `countPages()`)
- CRUD 시스템 (아이템 추가/삭제)
- A4 페이지 상수 / print CSS

---

## 6. 검증 체크리스트

- [ ] 온보딩 → 에디터 → 편집 → 새로고침 → 데이터 유지됨
- [ ] `?c=slug` 직접 접속 → 온보딩 스킵, 저장된 데이터 로드됨
- [ ] 세션 추가/삭제/편집/리네임 → Firestore에 자동 저장됨
- [ ] 드래그 리오더 → Firestore에 저장됨
- [ ] 배포 → 전체 세션 HTML 캡처됨
- [ ] 학생 뷰어: 세션 탭 바 표시, 탭 전환 정상
- [ ] 학생 뷰어: `?s=2` → 해당 세션 직접 표시
- [ ] 기존 단일 세션 배포 URL → 뷰어에서 하위호환 정상 (탭 없이 표시)
- [ ] 배포 모달: 학생 링크 + 에디터 링크 둘 다 표시
- [ ] 오프라인: Firestore 실패 시 localStorage 폴백
- [ ] 에디터 링크 분실 시: localStorage에 최근 courseDocId 저장 → 복구 가능
