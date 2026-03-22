# 클래스노트 — 배포 아키텍처 & 운영 가이드

> 최종 업데이트: 2026-03-19

---

## 1. 전체 배포 구조

```
[로컬 개발]                [GitHub]                 [Netlify]                [Firebase]
 Class_Material/  ──push──▶  qmin99/ClassNote  ──auto deploy──▶  class-note-material   Firestore DB
    │                         (main branch)          .netlify.app             class-note-cc1b5
    │                                                     │
    │              정적 파일 서빙 ◀────────────────────────┘
    │              (HTML/CSS/JS)
    │
    └──── Firebase SDK (클라이언트) ────────────────────────────────▶ Firestore 읽기/쓰기
```

---

## 2. 호스팅 — Netlify

| 항목 | 값 |
|------|-----|
| **사이트 URL** | `https://class-note-material.netlify.app` |
| **GitHub 리포** | `https://github.com/qmin99/ClassNote` |
| **배포 브랜치** | `main` |
| **배포 방식** | GitHub 연동 자동 배포 (Continuous Deployment) |
| **빌드 설정** | 없음 (정적 사이트, 빌드 커맨드 불필요) |
| **설정 파일** | `netlify.toml` 없음, `.netlify/` 없음 |
| **Netlify CLI** | 미설치 (웹 대시보드 + git push로 관리) |

### 배포 흐름

```
1. 로컬에서 코드 수정
2. git add → git commit
3. git push origin main
4. Netlify가 GitHub webhook으로 push 감지
5. main 브랜치의 전체 파일을 정적 사이트로 배포
6. 약 30초~1분 내 라이브 반영
```

### 배포 대상 파일 (정적)

```
Class_Material/
├── templates.html          ← 선생님 에디터 (온보딩 + 편집)
├── template-app.js         ← 에디터 로직
├── template-styles.css     ← 에디터 스타일
├── view.html               ← 학생 뷰어
├── view.js                 ← 뷰어 로직
├── view.css                ← 뷰어 스타일
├── firebase-config.js      ← Firebase 설정
├── index.html              ← 랜딩 페이지 (있는 경우)
└── (기타 정적 자산)
```

---

## 3. 백엔드 — Firebase Firestore

| 항목 | 값 |
|------|-----|
| **프로젝트 ID** | `class-note-cc1b5` |
| **콘솔** | `https://console.firebase.google.com/project/class-note-cc1b5` |
| **SDK** | Firebase Compat SDK v10.12.0 (CDN, `<script>` 태그) |
| **인증** | 없음 (공개 읽기/쓰기, Security Rules로 제어) |

### Firestore 컬렉션

| 컬렉션 | 문서 ID | 용도 |
|---------|---------|------|
| `published_notes` | 6자 랜덤 slug | 학생에게 배포된 렌더링 완료 HTML |
| `courses` | 8자 랜덤 slug | 선생님 에디터 데이터 (raw 세션 + 설정) |

### Firestore Security Rules (현재)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /published_notes/{docId} {
      allow read, write: if true;
    }
    match /courses/{docId} {
      allow read, write: if true;
    }
  }
}
```

> **보안 참고**: 현재 인증 없이 공개 상태. 프로덕션 강화 시 Firebase Auth 도입 또는 rate limiting 고려.

---

## 4. URL 구조

| URL | 용도 | 접근 주체 |
|-----|------|-----------|
| `https://class-note-material.netlify.app/templates.html` | 신규 온보딩 → 에디터 | 선생님 |
| `https://class-note-material.netlify.app/templates.html?c={courseDocId}` | 저장된 과목 에디터 직접 접근 | 선생님 |
| `https://class-note-material.netlify.app/view.html?id={slug}` | 학생 뷰어 | 학생 |
| `https://class-note-material.netlify.app/view.html?id={slug}&s={idx}` | 학생 뷰어 특정 세션 | 학생 |

---

## 5. 데이터 흐름

### 선생님 워크플로우

```
1. templates.html 접속 (신규) 또는 ?c=slug 접속 (재방문)
2. 온보딩 → 에디터 진입 (또는 Firestore에서 기존 데이터 로드)
3. 세션 편집 (메모리 + localStorage에 저장)
4. "배포" 클릭:
   a. 모든 세션을 오프스크린 렌더링 → HTML 캡처
   b. courseDocId 생성 (첫 배포 시)
   c. Firestore batch write:
      - courses/{courseDocId} ← 에디터 raw 데이터
      - published_notes/{slug} ← 렌더된 HTML
   d. URL에 ?c={courseDocId} 추가 (history.replaceState)
   e. 배포 모달: 학생 링크 + 에디터 링크 표시
5. 이후 편집 → 자동 저장 (Firestore 디바운스 3초)
6. 재배포 → 기존 slug에 덮어쓰기 (학생 링크 유지)
```

### 학생 워크플로우

```
1. view.html?id={slug} 접속
2. Firestore에서 published_notes/{slug} 로드
3. 다중 세션이면 헤더에 세션 드롭다운 표시
4. 다중 페이지면 헤더에 페이지 네비게이터(prev/next + 1/N 배지) 표시
5. 세션 전환: 드롭다운에서 선택 → URL에 ?s={idx} 반영
6. 페이지 전환: 화살표 버튼, 키보드 좌우, 모바일 스와이프 지원
7. 다크모드, 전체화면, PDF 저장, 인쇄, 공유 기능 제공
```

---

## 6. 로컬 개발 → 배포 체크리스트

### 코드 변경 후 배포

```bash
# 1. 변경 확인
git status
git diff

# 2. 스테이징 & 커밋
git add <changed-files>
git commit -m "설명"

# 3. 푸시 → Netlify 자동 배포
git push origin main

# 4. 배포 확인 (30초~1분 대기)
# https://class-note-material.netlify.app 에서 확인
```

### Netlify 배포 상태 확인

- Netlify 대시보드: `https://app.netlify.com` (qmin99 계정 로그인)
- GitHub 커밋 상태에서 Netlify 배포 상태 확인 가능 (체크마크/X)

---

## 7. 환경별 구성

| 환경 | 호스팅 | DB | 용도 |
|------|--------|-----|------|
| **로컬** | `file://` 또는 Live Server | Firebase (프로덕션 동일) | 개발/테스트 |
| **프로덕션** | Netlify (`class-note-material.netlify.app`) | Firebase (`class-note-cc1b5`) | 실서비스 |

> **참고**: 별도 스테이징 환경 없음. 로컬과 프로덕션이 동일한 Firebase 프로젝트를 사용.

---

## 8. 주요 기술 스택

| 카테고리 | 기술 |
|----------|------|
| **프론트엔드** | Vanilla JS (ES5), HTML5, CSS3 |
| **호스팅** | Netlify (정적 사이트, GitHub 연동 CD) |
| **데이터베이스** | Firebase Firestore (NoSQL) |
| **SDK** | Firebase JS SDK v10.12.0 (Compat, CDN) |
| **빌드 도구** | 없음 (번들러/트랜스파일러 미사용) |
| **패키지 매니저** | 없음 |
| **버전 관리** | Git + GitHub |

---

## 9. 알려진 제한 사항

1. **Firestore 1MB 문서 제한**: 세션 수가 많거나 HTML이 길면 배포 문서가 1MB 초과 가능
2. **인증 없음**: Firestore rules가 공개 상태 — slug를 아는 누구나 읽기/쓰기 가능
3. **단일 환경**: 개발/프로덕션이 같은 Firebase 사용 — 테스트 데이터가 프로덕션에 섞임
4. **logoData 미저장**: base64 이미지는 용량 문제로 Firestore 제외, localStorage에만 보관 (기기 간 이동 불가)
5. **오프라인 미지원**: Firestore 오프라인 persistence 미활성화 상태
