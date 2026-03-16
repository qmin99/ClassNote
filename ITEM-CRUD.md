# ClassNote Item CRUD System — 섹션 내 아이템 추가/삭제

> 에디터에서 각 섹션의 개별 아이템(핵심 표현 한 칸, 단어 한 칸, 문제 한 개 등)을 추가/삭제하는 시스템.
> 페이지네이션(countPages)과 충돌 없이 안전하게 동작해야 함.

---

## 1. UX 원칙

### 버튼 노출 방식
- **hover-reveal**: 아이템에 마우스 올리면 x 버튼이 fade-in (opacity 0→1, 150ms)
- **add 버튼**: 각 아이템 그룹(리스트/그리드) 하단에 + 버튼. 평소엔 연한 dashed border, hover 시 accent 색
- 모바일: hover 없으므로 항상 연하게 표시 (opacity 0.3)
- **최소 1개 보장**: 아이템이 1개뿐이면 x 버튼 숨김 (삭제 불가)
- **최대 개수 제한**: 아이템 유형별 max 설정 (페이지 넘침 방지). max 도달 시 + 버튼 숨김

### 시각 디자인
- x 버튼: 8×8px 원형, position:absolute top-right, 회색 → hover 시 빨강
- + 버튼: 전체 너비 dashed border 라인, 클릭 시 아이템 추가 후 새 아이템에 focus
- 삭제 시: 아이템이 fade-out (opacity 0, 120ms) 후 DOM에서 제거 + re-render
- 추가 시: 새 아이템이 fade-in (opacity 0→1, 200ms)

---

## 2. 아키텍처

### 핵심 원칙
1. **DOM 직접 조작 금지** — 아이템 추가/삭제 시 데이터(세션 객체)를 수정 → `renderPage()` 호출
2. **renderPage() → paginateContent() → countPages()** 체인이 자동으로 페이지 재계산
3. 섹션(`.ps`)은 원자 단위 유지 — CRUD는 섹션 내부 아이템만 변경
4. 하드코딩 루프(3개, 5개 등)는 **세션 데이터의 배열 길이**로 대체

### 데이터 플로우
```
사용자 + 클릭 → addItem(type, sectionIndex?)
  → session 데이터 배열에 push (기본값 객체)
  → renderPage() 호출
  → paginateContent() → countPages() 자동 재계산
  → 새 아이템에 focus

사용자 x 클릭 → removeItem(type, itemIndex, sectionIndex?)
  → session 데이터 배열에서 splice
  → renderPage() 호출
  → paginateContent() → countPages() 자동 재계산
```

### 하드코딩 루프 → 동적 배열 전환
현재 많은 섹션이 `for (var i = 0; i < 3; i++)` 같은 하드코딩 루프로 렌더링됨.
이를 세션 데이터의 배열로 전환해야 add/remove가 가능해짐.

**전환 패턴:**
```javascript
// BEFORE (하드코딩 3개)
for (var fi = 0; fi < 3; fi++) {
    h += '<div class="prb">...</div>';
}

// AFTER (배열 기반)
var items = ensureArray(s, 'fillblank', 3, function() { return { q: '문장을 입력하세요.' }; });
items.forEach(function(item, i) {
    h += '<div class="prb" data-crud="fillblank:' + i + '">...</div>';
});
h += addBtn('fillblank');
```

### `ensureArray(session, key, defaultCount, factory)` 헬퍼
- 세션에 해당 키 배열이 없으면 factory로 defaultCount개 생성
- 있으면 그대로 반환
- 하드코딩 → 동적 전환의 핵심 브릿지

---

## 3. 아이템 유형 전체 맵

### 3.1 데이터 기반 아이템 (이미 배열 존재)

이 아이템들은 세션 데이터에 배열이 있어서 바로 CRUD 가능.

| 유형 | 렌더러 | 데이터 경로 | 기본값 팩토리 | max |
|------|--------|------------|-------------|-----|
| `phrases` | english | `sections[i].phrases[]` | `'새 표현을 입력하세요.'` | 12 |
| `vocab` | english, reading, korean-lit | `session.vocab[]` | `{term:'단어', def:'뜻'}` | 12 |
| `scenarios` | english | `session.scenarios[]` | `{num:'', title:'상황', prompt:'예문'}` | 6 |
| `homework` | all | `session.homework[]` | `{title:'과제', desc:'설명'}` | 6 |
| `questions` | reading, korean-lit | `session.questions[]` | `{q:'문제를 입력하세요.', answer:''}` | 8 |
| `problems` | grammar, math | `session.problems[]` | `{q:'문제를 입력하세요.'}` | 8 |
| `analysis` | korean-lit | `session.analysis[]` | `['항목', '분석 내용']` | 8 |
| `table-rows` | grammar | `session.table.rows[]` | `['', '', '']` (headers.length) | 10 |

### 3.2 하드코딩 → 동적 전환 필요 아이템

이 아이템들은 현재 하드코딩 루프로 렌더링됨. `ensureArray`로 전환.

| 유형 | 렌더러 | 현재 개수 | 새 데이터 키 | 기본값 팩토리 | max |
|------|--------|----------|------------|-------------|-----|
| `wordlist` | english | 5행 | `session._wordlist[]` | `{word:'', pos:'', meaning:''}` | 10 |
| `slang` | english | 3개 | `session._slang[]` | `{expr:'슬랭 표현', usage:'뜻 / 사용 상황'}` | 6 |
| `dialogue` | english | 4줄 | `session._dialogue[]` | `{role:'A', line:'대사를 입력하세요.'}` | 10 |
| `mistakes` | english | 3행 | `session._mistakes[]` | `{wrong:'틀린 표현', right:'올바른 표현'}` | 6 |
| `fillblank` | english, reading, grammar, korean-gr | 3개 | `session._fillblank[]` | `{q:'문장을 입력하세요. _______ 부분을 빈칸으로 남겨주세요.'}` | 6 |
| `writing-prb` | english, grammar | 3개 | `session._writing[]` | `{q:'한국어 문장을 입력하세요.'}` | 6 |
| `dictation` | english | 6줄 | `session._dictation` (숫자) | 6 | 10 |
| `memo` | reading, math, korean | 8줄 | `session._memo` (숫자) | 8 | 12 |
| `correct` | grammar, korean-gr | 3행 | `session._correct[]` | `{wrong:'틀린 문장', right:'올바른 문장'}` | 6 |
| `choice` | grammar, korean-gr | 2개 | `session._choice[]` | `{q:'문제', options:['①','②','③','④']}` | 4 |
| `transform` | grammar | 3개 | `session._transform[]` | `{q:'문장을 변환하세요.'}` | 6 |
| `truefalse` | reading | 3개 | `session._truefalse[]` | `{q:'T/F 문장을 입력하세요.'}` | 6 |
| `structure-q` | reading | 2개 | `session._structure[]` | `{q:'구조 분석 문제'}` | 4 |
| `translate` | reading | 3개 | `session._translate[]` | `{q:'번역 문장을 입력하세요.'}` | 6 |
| `example-steps` | math | 3개 | `session._exampleSteps[]` | `{step:'풀이 과정을 입력하세요.'}` | 6 |
| `guided` | math | 3개 | `session._guided[]` | `{q:'단계별 문제'}` | 6 |
| `word-prb` | math | 2개 | `session._wordProb[]` | `{q:'서술형 문제를 입력하세요.'}` | 4 |
| `speed` | math | 4개 | `session._speed[]` | `{q:'빠른 계산 문제'}` | 8 |
| `mistake-math` | math | 3행 | `session._mistakeMath[]` | `{wrong:'오류', right:'정답', why:'이유'}` | 6 |
| `review-rows` | math | 3행 | `session._review[]` | `{date:'', topic:'', note:''}` | 6 |
| `mock` | math | 3개 | `session._mock[]` | `{q:'모의고사 문제'}` | 6 |
| `examples-kr` | korean-gr | 3개 | `session._examplesKr[]` | `{sentence:'예문을 입력하세요.'}` | 6 |
| `classify-rows` | korean-gr | 4행 | `session._classify[]` | `{word:'', type:'', note:''}` | 8 |
| `compare-rows` | korean-lit | 3행 | `session._compareRows[]` | `{aspect:'', a:'', b:''}` | 6 |
| `structure-wr` | korean-wr | 3파트 | (고정, CRUD 불필요) | — | — |
| `outline-rows` | korean-wr | 4행 | `session._outline[]` | `{part:'', content:''}` | 6 |
| `revise-rows` | korean-wr | 3행 | `session._revise[]` | `{original:'', revised:''}` | 6 |
| `peer-rows` | korean-wr | 3행 | (고정 항목, CRUD 불필요) | — | — |
| `summarize` | reading | 5줄 | `session._summarize` (숫자) | 5 | 8 |
| `opinion` | reading | 5줄 | `session._opinion` (숫자) | 5 | 8 |
| `draft` | korean-wr | 10줄 | `session._draft` (숫자) | 10 | 15 |
| `writing-lines` | korean-lit | 8줄 | `session._writingLines` (숫자) | 8 | 12 |

### 3.3 CRUD 불필요 (단일 블록)

이 섹션들은 단일 콘텐츠 블록이라 add/remove가 불필요:

| 유형 | 렌더러 | 이유 |
|------|--------|------|
| `passage` | reading | 지문 1개 (contenteditable로 편집) |
| `rule` / `concept` / `theory` | grammar, math, korean | 개념 설명 1개 (contenteditable) |
| `formula` / `strategy` / `proof` | math | 공식/전략 1개 |
| `visual` | math | 그래프 영역 1개 |
| `tip` | math | 팁 박스 1개 |
| `summary` | all | 요약 박스 1개 |
| `comment` | all | 피드백 박스 1개 |
| `sample` | korean-wr | 예시 글 1개 |
| `prompt` | korean-wr | 작문 주제 1개 |
| `background` | korean-lit | 배경 지식 1개 |
| `text` | korean-lit | 작품 원문 1개 |
| `exceptions` | grammar | 예외 설명 1개 |
| `challenge` | math | 도전 문제 1개 |
| `compare` (A/B 고정) | english, grammar | 항상 2개 고정 비교 |

---

## 4. HTML 구조 — data 속성

### 아이템에 data 속성 부여
```html
<!-- 개별 아이템 -->
<li data-crud-type="phrases" data-crud-sec="0" data-crud-idx="2" contenteditable>
  표현 텍스트
</li>

<!-- 삭제 버튼 (아이템 내부, hover로 표시) -->
<button class="crud-x" data-crud-action="remove" aria-label="삭제">×</button>

<!-- 추가 버튼 (그룹 하단) -->
<button class="crud-add" data-crud-action="add" data-crud-type="phrases" data-crud-sec="0">
  + 추가
</button>
```

### data 속성 설명
- `data-crud-type`: 아이템 유형 (phrases, vocab, fillblank, ...)
- `data-crud-sec`: 섹션 인덱스 (phrases처럼 sections[] 안에 중첩된 경우)
- `data-crud-idx`: 배열 내 인덱스
- `data-crud-action`: "add" 또는 "remove"

---

## 5. CSS 클래스

```css
/* 아이템 wrapper — 상대 위치 (x 버튼 기준점) */
[data-crud-type] { position: relative; }

/* x 버튼 — hover reveal */
.crud-x {
    position: absolute; top: -4px; right: -4px;
    width: 16px; height: 16px; border-radius: 50%;
    background: var(--surface); border: 1px solid var(--bd2);
    color: var(--t4); font-size: 10px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 150ms ease;
    z-index: 2;
}
[data-crud-type]:hover .crud-x { opacity: 1; }
.crud-x:hover { background: #fee; border-color: #e55; color: #c33; }

/* + 버튼 */
.crud-add {
    width: 100%; padding: 6px; margin-top: 4px;
    border: 1.5px dashed var(--bd2); border-radius: 4px;
    background: none; color: var(--t4); font-size: 10px;
    cursor: pointer; transition: all 150ms ease;
    text-align: center;
}
.crud-add:hover { border-color: var(--ac); color: var(--ac); background: var(--ac-l); }

/* 삭제 애니메이션 */
.crud-removing { opacity: 0; transform: scale(0.95); transition: all 120ms ease; }

/* 최소 1개 — x 숨김 */
.crud-solo .crud-x { display: none !important; }

/* max 도달 — + 숨김 */
.crud-maxed { display: none !important; }
```

Modern/Compact 레이아웃에서도 동일하게 작동 (position:relative는 레이아웃 무관).

---

## 6. JavaScript 구현

### 핵심 함수

```javascript
// 배열 보장 헬퍼
function ensureArray(session, key, defaultCount, factory) {
    if (!session[key] || !Array.isArray(session[key])) {
        session[key] = [];
        for (var i = 0; i < defaultCount; i++) session[key].push(factory(i));
    }
    return session[key];
}

// 추가
function addItem(type, secIdx) {
    var session = getSession();
    var arr = resolveArray(session, type, secIdx);
    var factory = ITEM_FACTORIES[type];
    var max = ITEM_MAX[type];
    if (!arr || !factory || arr.length >= max) return;
    arr.push(factory(arr.length));
    renderPage(); // → paginateContent() → countPages() 자동
}

// 삭제
function removeItem(type, itemIdx, secIdx) {
    var session = getSession();
    var arr = resolveArray(session, type, secIdx);
    if (!arr || arr.length <= 1) return; // 최소 1개 보장
    arr.splice(itemIdx, 1);
    renderPage();
}

// 배열 찾기 (type + secIdx → 실제 배열 참조)
function resolveArray(session, type, secIdx) {
    switch(type) {
        case 'phrases': return session.sections[secIdx].phrases;
        case 'vocab': return session.vocab;
        case 'scenarios': return session.scenarios;
        case 'homework': return session.homework;
        case 'questions': return session.questions;
        case 'problems': return session.problems;
        case 'analysis': return session.analysis;
        case 'table-rows': return session.table.rows;
        default: return session['_' + type]; // 하드코딩→동적 전환된 것들
    }
}
```

### 이벤트 위임 (단일 리스너)

```javascript
document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-crud-action]');
    if (!btn) return;

    var action = btn.getAttribute('data-crud-action');
    var type = btn.getAttribute('data-crud-type')
             || btn.closest('[data-crud-type]').getAttribute('data-crud-type');
    var secIdx = parseInt(btn.getAttribute('data-crud-sec') || '0', 10);

    if (action === 'add') {
        addItem(type, secIdx);
    } else if (action === 'remove') {
        var itemEl = btn.closest('[data-crud-idx]');
        var idx = parseInt(itemEl.getAttribute('data-crud-idx'), 10);
        // Fade-out animation before remove
        itemEl.classList.add('crud-removing');
        setTimeout(function() { removeItem(type, idx, secIdx); }, 130);
    }
});
```

---

## 7. 렌더러 수정 패턴

### Before/After 예시: fillblank (english renderer)

**BEFORE (하드코딩):**
```javascript
if (secOn('fillblank')) {
    h += '<div class="ps">' + secHdr(sn++, '빈칸 채우기');
    for (var fi = 0; fi < 3; fi++) {
        h += '<div class="prb"><div class="prb__h"><div class="prb__n">' + (fi + 1) + '</div>';
        h += '<div class="prb__q"' + E + '>문장을 입력하세요.</div></div>';
        h += '<div class="prb__sub">답: _____________</div></div>';
    }
    h += '</div>';
}
```

**AFTER (동적):**
```javascript
if (secOn('fillblank')) {
    var items = ensureArray(s, '_fillblank', 3, function() { return { q: '문장을 입력하세요. _______ 부분을 빈칸으로 남겨주세요.' }; });
    var solo = items.length <= 1 ? ' crud-solo' : '';
    h += '<div class="ps">' + secHdr(sn++, '빈칸 채우기');
    items.forEach(function(item, i) {
        h += '<div class="prb' + solo + '" data-crud-type="fillblank" data-crud-idx="' + i + '">';
        h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
        h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
        h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
        h += '<div class="prb__sub">답: _____________</div></div>';
    });
    h += crudAdd('fillblank', items.length);
    h += '</div>';
}
```

### 헬퍼 함수 (렌더러 공용)

```javascript
// + 버튼 HTML 생성
function crudAdd(type, currentLen, secIdx) {
    var max = ITEM_MAX[type] || 6;
    var cls = currentLen >= max ? ' crud-maxed' : '';
    var sec = secIdx !== undefined ? ' data-crud-sec="' + secIdx + '"' : '';
    return '<button class="crud-add' + cls + '" data-crud-action="add" data-crud-type="' + type + '"' + sec + '>+ 추가</button>';
}
```

---

## 8. 줄 수 전용 아이템 (dictation, memo, write lines)

`dictation`, `memo`, `summarize`, `opinion`, `draft`, `writingLines` 등은 빈 줄(`.wl`)만 있는 섹션.
배열이 아니라 **숫자(줄 수)**로 관리:

```javascript
// 세션에 숫자 저장
session._dictation = session._dictation || 6;

// 렌더링
for (var i = 0; i < session._dictation; i++) {
    h += '<div class="wl wl--t"></div>';
}

// +/- 버튼은 줄 수 증감
// addItem → session._dictation++
// removeItem → session._dictation-- (min 2)
```

이 유형은 x 버튼 대신 그룹 하단에 `+줄` / `-줄` 버튼 2개를 배치.

---

## 9. 페이지네이션 안전 보장

### 왜 안전한가
1. CRUD는 **데이터만 수정** → `renderPage()` 호출 → DOM 전체 재생성
2. `renderPage()`는 항상 `paginateContent()` 호출
3. `paginateContent()`는 `countPages()` 사용 — smart squeeze + 멀티페이지 분배
4. 섹션(`.ps`) 단위는 변경 없음 — 내부 아이템 수만 변경

### 주의사항
- `renderPage()` 호출 시 contenteditable 포커스가 사라짐 → 추가 후 새 아이템에 자동 focus 필요
- max 제한으로 한 섹션이 A4 한 장을 넘는 상황 방지
- 삭제 시 fade-out 애니메이션(130ms) 후 `renderPage()` → 약간의 지연 있지만 자연스러움

### focus 복원
```javascript
function addItem(type, secIdx) {
    // ... push ...
    renderPage();
    // 새로 추가된 마지막 아이템에 focus
    requestAnimationFrame(function() {
        var items = document.querySelectorAll('[data-crud-type="' + type + '"]');
        var last = items[items.length - 1];
        if (last) {
            var editable = last.querySelector('[contenteditable]');
            if (editable) editable.focus();
        }
    });
}
```

---

## 10. 구현 순서

1. CSS 추가 (`.crud-x`, `.crud-add`, `.crud-removing`, `.crud-solo`, `.crud-maxed`)
2. JS 공용 함수 (`ensureArray`, `addItem`, `removeItem`, `resolveArray`, `crudAdd`, 이벤트 위임)
3. 렌더러별 수정 (english → reading → grammar → math → korean)
4. 줄 수 전용 아이템 처리
5. 테스트: 추가/삭제 → 페이지 수 변화 확인, 에디터↔미리보기 동기화 확인

---

## 11. contenteditable 데이터 동기화 주의

현재 시스템은 contenteditable로 편집한 내용이 **세션 데이터에 자동 반영되지 않음**.
사용자가 텍스트를 편집해도 `session.vocab[0].term`은 원래 값 그대로.

**이 문제는 CRUD와 직접 관련 없지만, CRUD로 renderPage()를 호출하면 편집 내용이 사라질 수 있음.**

### 해결 방안: renderPage 전 데이터 수집
```javascript
function syncEditablesToSession() {
    // 모든 [data-crud-type][data-crud-idx] 요소를 순회
    // contenteditable 요소의 현재 텍스트를 세션 데이터에 반영
    // 이후 renderPage() 호출
}
```

**이 함수는 addItem/removeItem에서 renderPage() 호출 직전에 실행해야 함.**
이것이 CRUD 시스템의 가장 중요한 기술적 과제.

### syncEditablesToSession 상세 구현

각 `[data-crud-type]` 요소를 순회하면서:
1. `data-crud-type`, `data-crud-idx`, `data-crud-sec` 읽기
2. 해당 배열의 해당 인덱스 객체에 contenteditable 텍스트 반영
3. 유형별로 어떤 필드에 매핑되는지 알아야 함:

| type | contenteditable 요소 → 데이터 필드 |
|------|----------------------------------|
| phrases | `li` textContent → `string` (배열 원소 자체) |
| vocab | `.vi__t` → `term`, `.vi__d` → `def` |
| scenarios | `.sc__t` → `title`, `.sc__p` → `prompt` |
| homework | `.hw__t` → `title`, `.hw__d` → `desc` |
| fillblank | `.prb__q` → `q` |
| writing-prb | `.prb__q` → `q`, `.prb__a` → `answer` |
| dialogue | 대사 div → `line` |
| mistakes | 틀린 div → `wrong`, 올바른 div → `right` |
| correct | 같음 |
| slang | 표현 div → `expr`, 설명 div → `usage` |
| wordlist | td 3개 → `word`, `pos`, `meaning` |
| questions | `.prb__q` → `q`, choices → `choices[]`, `.prb__a` → `answer` |
| problems | 같음 |

---

## 12. 파일 변경 요약

| 파일 | 변경 |
|------|------|
| `template-styles.css` | `.crud-x`, `.crud-add`, `.crud-removing`, `.crud-solo`, `.crud-maxed` + 레이아웃별 오버라이드 |
| `template-app.js` | `ensureArray`, `addItem`, `removeItem`, `resolveArray`, `crudAdd`, `syncEditablesToSession`, 이벤트 위임, 모든 렌더러 수정 |
