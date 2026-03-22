# ClassNote 로고 작업 기록

## 로고 원본
- Pencil 디자인에서 추출: `screenshots/C8gy1.png` (800x800, 흰 배경)
- 로고 주변에 큰 whitespace가 있어서 그대로 쓰면 nav에서 거대하게 표시됨

## Whitespace 크롭 과정
- `sips` (macOS 기본 도구)로 시도 → 제대로 안 됨
- Python Pillow 사용: `pip3 install Pillow --user --break-system-packages` (PEP 668 제한 우회)
- `getbbox()` + 수동 픽셀 스캔으로 콘텐츠 영역만 크롭
- 결과물: `screenshots/classnote-logo.png` (442x154)

## 적용 위치 & CSS

### 랜딩페이지 (index.html / styles.css)
- Nav: `<img src="screenshots/classnote-logo.png" class="nav__logo-img">` → `height: 32px`
- Footer: `class="footer__logo-img"` → `height: 22px; filter: brightness(0.8)`

### 템플릿 에디터 (templates.html / template-styles.css)
- Topbar: `<img src="screenshots/classnote-logo.png" class="topbar__logo-img">`
- `height: 30px; mix-blend-mode: multiply` — topbar 배경(rgba(250,248,245,.95) 따뜻한 톤)과 로고의 흰 배경이 seamless하게 섞임
- `padding-left: 15px` on `.topbar__logo`

## 주의사항
- 로고 PNG 배경이 순백(#fff)이라 배경색이 다른 곳에서는 `mix-blend-mode: multiply` 필수
- 크롭 전 원본(C8gy1.png)은 건드리지 말 것 — 원본 백업용
- 랜딩페이지 hero 목업 이미지(`05-onboarding-step3-design.png`)와 혼동 주의 — 이전에 잘못된 이미지를 크롭한 사고 있었음
