/* ============================================
   클래스노트 — Session-Based System v4
   contenteditable + nested courses + themes
   ============================================ */

(function () {
    'use strict';

    // =========================================
    // ONBOARDING WIZARD
    // =========================================

    var obState = {
        step: 0,
        totalSteps: 4,
        teacher: '',
        hasBrand: false,
        brand: '',
        logoData: null, // base64 data URL
        subject: '',
        type: '',
        level: 'middle',
        difficulty: 'intermediate',
        theme: 'ink',
        layout: 'classic',
        font: 'sans',
        sections: {},
        sectionNames: {}
    };

    // ---- Page count: measure real DOM (same approach as editor's paginateContent) ----

    // Maps subject+type → renderer key
    var OB_RENDERER_MAP = {
        'english|conversation': 'english',
        'english|daily': 'english',
        'english|reading': 'eng-reading',
        'english|grammar': 'eng-grammar',
        'math|basic': 'math',
        'math|advanced-math': 'math',
        'math|problem-solving': 'math',
        'korean|literature': 'korean',
        'korean|grammar-kr': 'korean',
        'korean|writing-kr': 'korean'
    };

    // Maps subject+type → courseId (same as launchEditor's courseMap)
    var OB_COURSE_MAP = {
        'english|conversation': 'biz-english',
        'english|daily': 'daily-english',
        'english|reading': 'eng-reading',
        'english|grammar': 'eng-grammar',
        'math|basic': 'math-main',
        'math|advanced-math': 'math-main',
        'math|problem-solving': 'math-main',
        'korean|literature': 'korean-main',
        'korean|grammar-kr': 'korean-main',
        'korean|writing-kr': 'korean-main'
    };

    function checkSectionOverflow() {
        var warn = document.getElementById('obOverflowWarn');
        var msg = document.getElementById('obOverflowMsg');
        if (!warn) return;

        // Only show on content configuration step (step index 3)
        if (obState.step !== 3) {
            warn.classList.remove('ob__page-hint--show');
            return;
        }

        // Wait for web fonts before measuring
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                _doCheckSectionOverflow(warn, msg);
            });
        } else {
            _doCheckSectionOverflow(warn, msg);
        }
    }

    function _doCheckSectionOverflow(warn, msg) {

        // We need renderers to be defined — they're defined later in the file.
        // On first call (before renderers exist), skip silently.
        if (typeof renderers === 'undefined' || !renderers) {
            warn.classList.remove('ob__page-hint--show');
            return;
        }

        var subj = obState.subject || 'english';
        var typeVal = obState.type;
        if (!typeVal) {
            var types = subjectTypes[subj] || subjectTypes.english;
            typeVal = types[0].val;
        }
        var mapKey = subj + '|' + typeVal;

        // Find the real course + session data that the editor will use
        var courseId = OB_COURSE_MAP[mapKey] || 'biz-english';
        var course = null;
        if (typeof ALL_COURSES !== 'undefined') {
            course = ALL_COURSES.find(function (c) { return c.id === courseId; });
        }
        if (!course) { warn.classList.remove('ob__page-hint--show'); return; }

        var session = course.sessions[0];
        var renderer = renderers[course.renderer];
        if (!session || !renderer) { warn.classList.remove('ob__page-hint--show'); return; }

        // Temporarily set __classnote so secOn() reads current onboarding toggles
        var prevCN = window.__classnote;
        window.__classnote = {
            sections: obState.sections,
            layout: obState.layout || 'classic',
            font: obState.font || 'sans',
            type: typeVal
        };

        // Render into a hidden page using the real renderer + real session data
        var mockCtx = {
            teacherName: obState.teacher || 'T',
            studentName: '',
            date: '',
            brand: obState.brand || '',
            logoData: null
        };

        var html;
        try {
            html = renderer(session, course, mockCtx);
        } catch (e) {
            window.__classnote = prevCN;
            warn.classList.remove('ob__page-hint--show');
            return;
        }

        // Restore __classnote
        window.__classnote = prevCN;

        // Create an offscreen page element with the same dimensions as the real page
        var hidden = document.createElement('div');
        hidden.className = 'page layout--' + (obState.layout || 'classic');
        hidden.setAttribute('data-theme', obState.theme || 'ink');
        hidden.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;min-height:1123px;max-height:none;overflow:visible;visibility:hidden;';
        // Let CSS handle padding via .page and .layout-- classes (compact=36px 44px, others=48px 60px)
        if (obState.font === 'serif') hidden.style.fontFamily = 'var(--serif)';
        else if (obState.font === 'mono') hidden.style.fontFamily = 'var(--mono)';
        hidden.innerHTML = html;
        document.body.appendChild(hidden);

        // Use the exact same counting logic as paginateContent()
        var result = countPages(hidden);

        // Clean up
        document.body.removeChild(hidden);

        warn.classList.add('ob__page-hint--show');
        msg.innerHTML = '총 <strong>' + result.count + '</strong>장으로 구성됩니다';
    }

    // Subject-type map
    var subjectTypes = {
        english: [
            { val: 'conversation', label: '비즈니스 회화' },
            { val: 'daily', label: '일상 회화' },
            { val: 'reading', label: '독해' },
            { val: 'grammar', label: '문법' }
        ],
        math: [
            { val: 'basic', label: '기본' },
            { val: 'advanced-math', label: '심화' },
            { val: 'problem-solving', label: '문제풀이' }
        ],
        korean: [
            { val: 'literature', label: '문학' },
            { val: 'grammar-kr', label: '문법' },
            { val: 'writing-kr', label: '작문' }
        ]
    };

    // ---- Dynamic sections per subject+type ----
    var TYPE_SECTIONS = {
        english: {
            conversation: [
                { key:'phrases', name:'핵심 문장', desc:'각 상황별 핵심 영어 표현', cat:'learn', on:true },
                { key:'vocab', name:'핵심 표현', desc:'주요 단어와 뜻 정리', cat:'learn', on:true },
                { key:'dialogue', name:'대화문', desc:'A/B 형식 전체 대화 예시', cat:'learn', on:false },
                { key:'compare', name:'유사 표현 비교', desc:'"I think" vs "I believe" 뉘앙스 차이', cat:'learn', on:false },
                { key:'mistakes', name:'틀리기 쉬운 표현', desc:'자주 틀리는 표현 교정', cat:'learn', on:false },
                { key:'scenarios', name:'롤플레이 시나리오', desc:'실전 대화 연습 상황', cat:'practice', on:true },
                { key:'fillblank', name:'빈칸 채우기', desc:'문장 속 핵심 표현 빈칸 연습', cat:'practice', on:false },
                { key:'writing', name:'영작 연습', desc:'한국어 → 영어 문장 작성', cat:'practice', on:false },
                { key:'dictation', name:'딕테이션', desc:'듣고 받아쓰기 칸', cat:'practice', on:false },
                { key:'homework', name:'숙제', desc:'복습용 과제', cat:'wrap', on:true },
                { key:'summary', name:'오늘의 요약', desc:'배운 내용 한눈에 정리', cat:'wrap', on:false },
                { key:'comment', name:'선생님 코멘트', desc:'학생별 피드백 작성란', cat:'wrap', on:false }
            ],
            daily: [
                { key:'phrases', name:'핵심 문장', desc:'일상 상황별 핵심 표현', cat:'learn', on:true },
                { key:'vocab', name:'핵심 표현', desc:'주요 단어와 뜻 정리', cat:'learn', on:true },
                { key:'dialogue', name:'대화문', desc:'A/B 형식 일상 대화 예시', cat:'learn', on:false },
                { key:'slang', name:'구어체·슬랭', desc:'원어민이 자주 쓰는 캐주얼 표현', cat:'learn', on:false },
                { key:'compare', name:'유사 표현 비교', desc:'비슷한 표현의 뉘앙스 차이', cat:'learn', on:false },
                { key:'scenarios', name:'롤플레이 시나리오', desc:'일상 상황 연습', cat:'practice', on:true },
                { key:'fillblank', name:'빈칸 채우기', desc:'문장 속 핵심 표현 빈칸 연습', cat:'practice', on:false },
                { key:'writing', name:'영작 연습', desc:'한국어 → 영어 문장 작성', cat:'practice', on:false },
                { key:'dictation', name:'딕테이션', desc:'듣고 받아쓰기 칸', cat:'practice', on:false },
                { key:'homework', name:'숙제', desc:'복습용 과제', cat:'wrap', on:true },
                { key:'summary', name:'오늘의 요약', desc:'배운 내용 한눈에 정리', cat:'wrap', on:false },
                { key:'comment', name:'선생님 코멘트', desc:'학생별 피드백 작성란', cat:'wrap', on:false }
            ],
            reading: [
                { key:'passage', name:'독해 지문', desc:'본문 읽기 + 핵심 구문 하이라이트', cat:'learn', on:true },
                { key:'vocab', name:'어휘 정리', desc:'지문 속 핵심 단어와 뜻', cat:'learn', on:true },
                { key:'structure', name:'문장 구조 분석', desc:'복잡한 문장의 구조 파악', cat:'learn', on:false },
                { key:'translate', name:'해석 연습', desc:'문장 단위 한→영/영→한 해석', cat:'learn', on:false },
                { key:'questions', name:'독해 문제', desc:'내용 이해 확인 문제', cat:'practice', on:true },
                { key:'truefalse', name:'True / False', desc:'본문 내용 참/거짓 판별', cat:'practice', on:false },
                { key:'fillblank', name:'빈칸 채우기', desc:'지문 속 핵심 어휘 빈칸', cat:'practice', on:false },
                { key:'summarize', name:'요약하기', desc:'본문 내용을 자신의 말로 요약', cat:'practice', on:false },
                { key:'opinion', name:'의견 쓰기', desc:'주제에 대한 자신의 생각 쓰기', cat:'practice', on:false },
                { key:'homework', name:'숙제', desc:'복습용 과제', cat:'wrap', on:true },
                { key:'summary', name:'오늘의 요약', desc:'배운 내용 정리', cat:'wrap', on:false },
                { key:'memo', name:'메모란', desc:'자유 필기 공간', cat:'wrap', on:false }
            ],
            grammar: [
                { key:'rule', name:'문법 규칙', desc:'핵심 문법 포인트 정리', cat:'learn', on:true },
                { key:'examples', name:'예문', desc:'문법 적용 예문 모음', cat:'learn', on:true },
                { key:'compare', name:'비교 정리', desc:'헷갈리는 문법 비교 (예: 현재완료 vs 과거)', cat:'learn', on:false },
                { key:'exceptions', name:'예외·주의사항', desc:'틀리기 쉬운 예외 케이스', cat:'learn', on:false },
                { key:'fillblank', name:'빈칸 채우기', desc:'올바른 형태 채우기', cat:'practice', on:true },
                { key:'correct', name:'오류 수정', desc:'틀린 문장 찾아 고치기', cat:'practice', on:false },
                { key:'writing', name:'문장 만들기', desc:'배운 문법으로 직접 문장 작성', cat:'practice', on:false },
                { key:'choice', name:'객관식 문제', desc:'4지선다형 문법 문제', cat:'practice', on:true },
                { key:'transform', name:'문장 변환', desc:'능동↔수동, 직접↔간접 변환', cat:'practice', on:false },
                { key:'homework', name:'숙제', desc:'복습용 과제', cat:'wrap', on:true },
                { key:'summary', name:'오늘의 요약', desc:'핵심 문법 한줄 정리', cat:'wrap', on:false },
                { key:'comment', name:'선생님 코멘트', desc:'학생별 피드백', cat:'wrap', on:false }
            ]
        },
        math: {
            basic: [
                { key:'concept', name:'핵심 개념', desc:'이번 단원의 핵심 공식·정의', cat:'learn', on:true },
                { key:'formula', name:'공식 정리', desc:'관련 공식 모아보기', cat:'learn', on:true },
                { key:'visual', name:'그림·도식', desc:'개념을 시각적으로 이해', cat:'learn', on:false },
                { key:'example', name:'풀이 예제', desc:'선생님과 함께 풀어보는 예제', cat:'practice', on:true },
                { key:'practice', name:'연습 문제', desc:'기본 유형 반복 연습', cat:'practice', on:true },
                { key:'word', name:'서술형 문제', desc:'문장형 응용 문제', cat:'practice', on:false },
                { key:'mistake', name:'오답 노트', desc:'자주 틀리는 유형 정리', cat:'practice', on:false },
                { key:'homework', name:'숙제', desc:'복습 문제', cat:'wrap', on:true },
                { key:'summary', name:'오늘의 요약', desc:'핵심 개념 한줄 정리', cat:'wrap', on:false },
                { key:'memo', name:'풀이 메모', desc:'자유 풀이 공간', cat:'wrap', on:false },
                { key:'comment', name:'선생님 코멘트', desc:'학생 피드백', cat:'wrap', on:false }
            ],
            'advanced-math': [
                { key:'concept', name:'심화 개념', desc:'심화 이론과 증명', cat:'learn', on:true },
                { key:'formula', name:'공식·정리', desc:'핵심 공식 + 유도 과정', cat:'learn', on:true },
                { key:'proof', name:'증명', desc:'정리의 증명 과정', cat:'learn', on:false },
                { key:'visual', name:'그래프·도식', desc:'함수 그래프, 도형 시각화', cat:'learn', on:false },
                { key:'example', name:'풀이 예제', desc:'심화 유형 상세 풀이', cat:'practice', on:true },
                { key:'practice', name:'연습 문제', desc:'심화 유형 연습', cat:'practice', on:true },
                { key:'challenge', name:'도전 문제', desc:'최고 난이도 문제', cat:'practice', on:false },
                { key:'mistake', name:'오답 분석', desc:'자주 틀리는 포인트 분석', cat:'practice', on:false },
                { key:'homework', name:'숙제', desc:'심화 복습 문제', cat:'wrap', on:true },
                { key:'summary', name:'핵심 정리', desc:'이번 수업 핵심 한눈에', cat:'wrap', on:false },
                { key:'memo', name:'풀이 메모', desc:'자유 풀이 공간', cat:'wrap', on:false },
                { key:'comment', name:'선생님 코멘트', desc:'학생 피드백', cat:'wrap', on:false }
            ],
            'problem-solving': [
                { key:'strategy', name:'풀이 전략', desc:'문제 유형별 접근법', cat:'learn', on:true },
                { key:'formula', name:'필수 공식', desc:'꼭 알아야 할 공식 모음', cat:'learn', on:true },
                { key:'tip', name:'풀이 팁', desc:'시간 단축·실수 방지 노하우', cat:'learn', on:false },
                { key:'guided', name:'유도 풀이', desc:'단계별로 풀어보는 문제', cat:'practice', on:true },
                { key:'practice', name:'유형 연습', desc:'유형별 반복 연습', cat:'practice', on:true },
                { key:'mock', name:'실전 모의', desc:'시험 형식 문제', cat:'practice', on:false },
                { key:'review', name:'오답 복기', desc:'틀린 문제 분석·복기', cat:'practice', on:false },
                { key:'speed', name:'시간 측정', desc:'제한 시간 내 풀기 연습', cat:'practice', on:false },
                { key:'homework', name:'숙제', desc:'풀이 연습 과제', cat:'wrap', on:true },
                { key:'summary', name:'풀이 요약', desc:'오늘 배운 전략 정리', cat:'wrap', on:false },
                { key:'memo', name:'풀이 메모', desc:'자유 풀이 공간', cat:'wrap', on:false },
                { key:'comment', name:'선생님 코멘트', desc:'학생 피드백', cat:'wrap', on:false }
            ]
        },
        korean: {
            literature: [
                { key:'text', name:'작품 본문', desc:'원문 읽기 + 핵심 구절 표시', cat:'learn', on:true },
                { key:'background', name:'작품 배경', desc:'작가·시대·장르 소개', cat:'learn', on:true },
                { key:'analysis', name:'작품 분석', desc:'주제·표현기법·구조 분석', cat:'learn', on:false },
                { key:'vocab', name:'어휘·어구', desc:'어려운 단어·고어 풀이', cat:'learn', on:true },
                { key:'questions', name:'감상 문제', desc:'내용 이해·감상 문제', cat:'practice', on:true },
                { key:'compare', name:'작품 비교', desc:'유사 작품과의 비교 분석', cat:'practice', on:false },
                { key:'writing', name:'감상문 쓰기', desc:'느낀 점이나 비평 작성', cat:'practice', on:false },
                { key:'homework', name:'숙제', desc:'복습 과제', cat:'wrap', on:true },
                { key:'summary', name:'오늘의 요약', desc:'핵심 내용 정리', cat:'wrap', on:false },
                { key:'memo', name:'메모란', desc:'자유 필기 공간', cat:'wrap', on:false },
                { key:'comment', name:'선생님 코멘트', desc:'학생 피드백', cat:'wrap', on:false }
            ],
            'grammar-kr': [
                { key:'rule', name:'문법 규칙', desc:'국어 문법 핵심 정리', cat:'learn', on:true },
                { key:'examples', name:'예시', desc:'문법 규칙 적용 예시', cat:'learn', on:true },
                { key:'compare', name:'혼동 구분', desc:'헷갈리는 문법 비교 (예: 되/돼)', cat:'learn', on:false },
                { key:'exceptions', name:'예외·주의', desc:'불규칙·예외 케이스', cat:'learn', on:false },
                { key:'fillblank', name:'빈칸 채우기', desc:'올바른 표현 채우기', cat:'practice', on:true },
                { key:'correct', name:'맞춤법 교정', desc:'틀린 부분 찾아 고치기', cat:'practice', on:true },
                { key:'classify', name:'분류하기', desc:'품사·문장성분 분류', cat:'practice', on:false },
                { key:'choice', name:'객관식 문제', desc:'4지선다형 문법 문제', cat:'practice', on:false },
                { key:'homework', name:'숙제', desc:'복습 과제', cat:'wrap', on:true },
                { key:'summary', name:'오늘의 요약', desc:'핵심 정리', cat:'wrap', on:false },
                { key:'memo', name:'메모란', desc:'자유 필기 공간', cat:'wrap', on:false },
                { key:'comment', name:'선생님 코멘트', desc:'학생 피드백', cat:'wrap', on:false }
            ],
            'writing-kr': [
                { key:'theory', name:'작문 이론', desc:'글쓰기 원칙·구성법', cat:'learn', on:true },
                { key:'structure', name:'글 구조', desc:'서론·본론·결론 짜기', cat:'learn', on:true },
                { key:'sample', name:'모범 글', desc:'잘 쓴 글 예시 분석', cat:'learn', on:false },
                { key:'vocab', name:'표현·어휘', desc:'격식체·비격식체, 접속어 정리', cat:'learn', on:false },
                { key:'outline', name:'개요 작성', desc:'주제에 맞는 개요 짜기', cat:'practice', on:true },
                { key:'draft', name:'초고 쓰기', desc:'본문 작성 연습', cat:'practice', on:true },
                { key:'revise', name:'퇴고 연습', desc:'글 다듬기·문장 교정', cat:'practice', on:false },
                { key:'peer', name:'동료 평가', desc:'서로의 글 읽고 피드백', cat:'practice', on:false },
                { key:'prompt', name:'글감 제시', desc:'주제·상황 카드', cat:'practice', on:false },
                { key:'homework', name:'숙제', desc:'작문 과제', cat:'wrap', on:true },
                { key:'summary', name:'오늘의 요약', desc:'핵심 작문 원칙 정리', cat:'wrap', on:false },
                { key:'memo', name:'메모란', desc:'아이디어 메모 공간', cat:'wrap', on:false },
                { key:'comment', name:'선생님 코멘트', desc:'학생 피드백', cat:'wrap', on:false }
            ]
        }
    };

    function getTypeSections() {
        var subj = obState.subject || 'english';
        var type = obState.type;
        var subjSections = TYPE_SECTIONS[subj];
        if (!subjSections) subjSections = TYPE_SECTIONS.english;
        if (!type || !subjSections[type]) type = Object.keys(subjSections)[0];
        return subjSections[type] || [];
    }

    var _sectionToggleHandler = null;

    function buildSectionToggles() {
        var container = document.getElementById('obSections');
        if (!container) return;

        // Remove previous delegated listener to prevent accumulation
        if (_sectionToggleHandler) {
            container.removeEventListener('change', _sectionToggleHandler);
        }

        var sections = getTypeSections();

        // Rebuild obState.sections from type-specific defaults
        var newSections = {};
        sections.forEach(function(s) { newSections[s.key] = s.on; });
        obState.sections = newSections;

        // Group by category
        var catLabels = { learn:'📖 학습', practice:'✏️ 연습', wrap:'📋 마무리' };
        var groups = { learn:[], practice:[], wrap:[] };
        sections.forEach(function(s) {
            var g = groups[s.cat] || groups.learn;
            g.push(s);
        });

        var html = '';
        ['learn','practice','wrap'].forEach(function(cat) {
            if (groups[cat].length === 0) return;
            html += '<div class="ob__toggle-group">';
            html += '<div class="ob__toggle-group-label">' + catLabels[cat] + '</div>';
            groups[cat].forEach(function(s) {
                html += '<label class="ob__toggle">';
                html += '<span class="ob__toggle-info">';
                html += '<span class="ob__toggle-name">' + s.name + '</span>';
                html += '<span class="ob__toggle-desc">' + s.desc + '</span>';
                html += '</span>';
                html += '<input type="checkbox"' + (s.on ? ' checked' : '') + ' data-section="' + s.key + '"><span class="ob__switch"></span>';
                html += '</label>';
            });
            html += '</div>';
        });

        container.innerHTML = html;

        // Single delegated listener on container (replaces per-checkbox binding)
        _sectionToggleHandler = function(e) {
            if (e.target.type !== 'checkbox') return;
            var key = e.target.getAttribute('data-section');
            if (key) obState.sections[key] = e.target.checked;
            checkSectionOverflow();
            updateSectionSidebar();
        };
        container.addEventListener('change', _sectionToggleHandler);

        checkSectionOverflow();
        updateSectionSidebar();
    }

    // ===== Stagger entrance animation helper =====
    function triggerStagger(parent) {
        if (!parent) return;
        var items = parent.querySelectorAll('.ob__stagger');
        items.forEach(function (el) { el.classList.remove('ob__stagger--in'); });
        items.forEach(function (el, i) {
            setTimeout(function () { el.classList.add('ob__stagger--in'); }, 150 + i * 140);
        });
    }

    var obEl = document.getElementById('onboarding');
    if (obEl) { initOnboarding(); }

    function initOnboarding() {
        var bar = document.getElementById('obBar');
        var steps = document.getElementById('obSteps');
        var backBtn = document.getElementById('obBack');
        var nextBtn = document.getElementById('obNext');

        updateStep();

        // Back
        backBtn.addEventListener('click', function () {
            if (obState.step > 0) {
                clearStepError();
                obState.step--;
                updateStep();
            }
        });

        // Next
        nextBtn.addEventListener('click', function () {
            collectStepData();
            var err = validateStep(obState.step);
            if (err) {
                showStepError(err);
                return;
            }
            clearStepError();
            if (obState.step < obState.totalSteps - 1) {
                obState.step++;
                updateStep();
            } else {
                launchEditor();
            }
        });

        // Enter key on teacher name → advance to next step
        var obTeacherInput = document.getElementById('obTeacher');
        if (obTeacherInput) {
            obTeacherInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); nextBtn.click(); }
            });

            // Real-time name preview
            var namePreview = document.getElementById('obNamePreview');
            var nameValue = document.getElementById('obNameValue');
            if (namePreview && nameValue) {
                obTeacherInput.addEventListener('input', function () {
                    var val = this.value.trim();
                    if (val) {
                        nameValue.textContent = val;
                        namePreview.classList.add('ob__name-preview--visible');
                    } else {
                        namePreview.classList.remove('ob__name-preview--visible');
                    }
                });
            }
        }

        // Step indicator clicks
        steps.querySelectorAll('.ob__step').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var target = parseInt(this.getAttribute('data-step'));
                if (target <= obState.step) {
                    clearStepError();
                    collectStepData();
                    obState.step = target;
                    updateStep();
                }
            });
        });

        // Subject labels for summary card
        var SUBJECT_LABELS = { english: '영어', math: '수학', korean: '국어' };
        var SUBJECT_DOTS = { english: '#1a6fb5', math: '#e85d2c', korean: '#8b3a8b' };
        var SUBJECT_IND_CLASS = { english: 'ob__seg-indicator--blue', math: 'ob__seg-indicator--orange', korean: 'ob__seg-indicator--purple' };

        window.__updateSelectionSummary = updateSelectionSummary;
        function updateSelectionSummary() {
            var el = document.getElementById('obSelectionSummary');
            var textEl = document.getElementById('obSummaryText');
            if (!el || !textEl) return;
            if (!obState.subject) { el.classList.remove('ob__config-summary--visible'); return; }

            var subjectName = SUBJECT_LABELS[obState.subject] || obState.subject;
            var dot = SUBJECT_DOTS[obState.subject] || '#888';
            var parts = [];

            if (obState.type && subjectTypes[obState.subject]) {
                var types = subjectTypes[obState.subject];
                for (var i = 0; i < types.length; i++) {
                    if (types[i].val === obState.type) { parts.push(types[i].label); break; }
                }
            }

            var levelLabel = LEVEL_LABELS[obState.level] || '중등';
            var diffLabel = DIFF_LABELS[obState.difficulty] || '중급';
            var summary = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dot + ';margin-right:8px;vertical-align:middle"></span>';
            summary += subjectName;
            if (parts.length) summary += ' · ' + parts[0];
            summary += ' · ' + levelLabel + ' · ' + diffLabel;
            textEl.innerHTML = summary;
            el.classList.add('ob__config-summary--visible');
        }

        // ===== Segmented control helper =====
        function initSeg(containerId, indicatorId, defaultVal, onChange) {
            var container = document.getElementById(containerId);
            var indicator = document.getElementById(indicatorId);
            if (!container || !indicator) return;
            var buttons = container.querySelectorAll('.ob__seg-btn');

            function update(btn) {
                if (!btn) { indicator.style.opacity = '0'; return; }
                indicator.style.opacity = '1';
                indicator.style.left = btn.offsetLeft + 'px';
                indicator.style.width = btn.offsetWidth + 'px';
                buttons.forEach(function (b) { b.classList.remove('ob__seg-btn--active'); });
                btn.classList.add('ob__seg-btn--active');
            }

            function setIndicatorColor(subj) {
                indicator.className = 'ob__seg-indicator';
                var cls = SUBJECT_IND_CLASS[subj];
                if (cls) indicator.classList.add(cls);
            }

            buttons.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    update(this);
                    if (onChange) onChange(this.getAttribute('data-val'));
                });
            });

            // Set default
            var defaultBtn = defaultVal ? container.querySelector('[data-val="' + defaultVal + '"]') : null;
            setTimeout(function () {
                if (defaultBtn) update(defaultBtn);
            }, 60);

            return { update: update, setIndicatorColor: setIndicatorColor, container: container, buttons: buttons };
        }

        // ===== Build type segment buttons dynamically =====
        window.__buildTypeSegment = buildTypeSegment;
        function buildTypeSegment() {
            var seg = document.getElementById('obTypeSeg');
            if (!seg) return;
            var types = subjectTypes[obState.subject] || subjectTypes.english;
            // Keep indicator, remove old buttons
            var ind = document.getElementById('obTypeInd');
            seg.innerHTML = '';
            seg.appendChild(ind);
            types.forEach(function (t) {
                var btn = document.createElement('button');
                btn.className = 'ob__seg-btn';
                btn.setAttribute('data-val', t.val);
                btn.textContent = t.label;
                btn.addEventListener('click', function () {
                    obState.type = t.val;
                    clearStepError();
                    updateTypeIndicator(this);
                    updateSelectionSummary();
                });
                seg.appendChild(btn);
            });
            obState.type = '';
            ind.style.opacity = '0';
            // Apply subject color to type indicator
            ind.className = 'ob__seg-indicator';
            var cls = SUBJECT_IND_CLASS[obState.subject];
            if (cls) ind.classList.add(cls);
        }
        function updateTypeIndicator(btn) {
            var ind = document.getElementById('obTypeInd');
            var seg = document.getElementById('obTypeSeg');
            if (!ind || !seg) return;
            seg.querySelectorAll('.ob__seg-btn').forEach(function (b) { b.classList.remove('ob__seg-btn--active'); });
            btn.classList.add('ob__seg-btn--active');
            ind.style.opacity = '1';
            ind.style.left = btn.offsetLeft + 'px';
            ind.style.width = btn.offsetWidth + 'px';
        }

        // ===== Subject cards =====
        var subjectCards = document.querySelectorAll('#obSubjectCards .ob__subject-card');
        subjectCards.forEach(function (card) {
            card.addEventListener('click', function () {
                subjectCards.forEach(function (c) { c.classList.remove('ob__subject-card--active'); });
                this.classList.add('ob__subject-card--active');
                obState.subject = this.getAttribute('data-val');
                clearStepError();
                buildTypeSegment();

                // Reveal config card
                var config = document.getElementById('obConfigCard');
                if (config) {
                    config.classList.remove('ob__config--hidden');
                    // Trigger stagger on config children
                    triggerStagger(config);
                }

                // Update level/diff indicator colors
                var indLevel = document.getElementById('obLevelInd');
                var indDiff = document.getElementById('obDiffInd');
                if (indLevel) { indLevel.className = 'ob__seg-indicator'; var c = SUBJECT_IND_CLASS[obState.subject]; if (c) indLevel.classList.add(c); }
                if (indDiff) { indDiff.className = 'ob__seg-indicator'; var c2 = SUBJECT_IND_CLASS[obState.subject]; if (c2) indDiff.classList.add(c2); }

                updateSelectionSummary();

                // Focus first type seg after reveal
                setTimeout(function () {
                    var firstSeg = document.querySelector('#obTypeSeg .ob__seg-btn');
                    if (firstSeg) firstSeg.focus();
                }, 400);
            });
        });

        // ===== Level & Difficulty segments =====
        initSeg('obLevelSeg', 'obLevelInd', 'middle', function (val) {
            obState.level = val;
            updateSelectionSummary();
        });
        initSeg('obDiffSeg', 'obDiffInd', 'intermediate', function (val) {
            obState.difficulty = val;
            updateSelectionSummary();
        });

        // Color picker
        document.getElementById('obColors').querySelectorAll('.ob__color').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.ob__color').forEach(function (b) { b.classList.remove('ob__color--active'); });
                this.classList.add('ob__color--active');
                obState.theme = this.getAttribute('data-theme');
                updatePreview();
            });
        });

        // Layout selector
        document.getElementById('obLayout').querySelectorAll('.ob__layout').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.ob__layout').forEach(function (b) { b.classList.remove('ob__layout--active'); });
                this.classList.add('ob__layout--active');
                obState.layout = this.getAttribute('data-layout');
                updatePreview();
            });
        });

        // Font chips
        bindChips('obFont', function (val) {
            obState.font = val;
            updatePreview();
        });

        // Brand toggle (switch)
        var brandCheck = document.getElementById('obBrandCheck');
        var brandReveal = document.getElementById('obBrandReveal');
        if (brandCheck && brandReveal) {
            brandCheck.addEventListener('change', function () {
                var isYes = this.checked;
                obState.hasBrand = isYes;
                brandReveal.setAttribute('aria-hidden', isYes ? 'false' : 'true');
                if (isYes) {
                    brandReveal.classList.add('ob__brand-reveal--open');
                    setTimeout(function () {
                        var brandInput = document.getElementById('obBrand');
                        if (brandInput) brandInput.focus();
                    }, 350);
                } else {
                    brandReveal.classList.remove('ob__brand-reveal--open');
                    obState.brand = '';
                    obState.logoData = null;
                    var brandInput = document.getElementById('obBrand');
                    if (brandInput) brandInput.value = '';
                    var logoPreview = document.getElementById('obLogoPreview');
                    var logoPlaceholder = document.getElementById('obLogoPlaceholder');
                    if (logoPreview) logoPreview.style.display = 'none';
                    if (logoPlaceholder) logoPlaceholder.style.display = '';
                }
            });
        }

        // Logo upload
        var logoUpload = document.getElementById('obLogoUpload');
        var logoFile = document.getElementById('obLogoFile');
        var logoPlaceholder = document.getElementById('obLogoPlaceholder');
        var logoPreview = document.getElementById('obLogoPreview');
        var logoImg = document.getElementById('obLogoImg');
        var logoRemove = document.getElementById('obLogoRemove');

        if (logoPlaceholder && logoFile) {
            logoPlaceholder.addEventListener('click', function () { logoFile.click(); });

            // Drag & drop
            logoPlaceholder.addEventListener('dragover', function (e) {
                e.preventDefault(); this.style.borderColor = 'var(--text)';
            });
            logoPlaceholder.addEventListener('dragleave', function () {
                this.style.borderColor = '';
            });
            logoPlaceholder.addEventListener('drop', function (e) {
                e.preventDefault(); this.style.borderColor = '';
                if (e.dataTransfer.files.length) handleLogoFile(e.dataTransfer.files[0]);
            });

            logoFile.addEventListener('change', function () {
                if (this.files.length) handleLogoFile(this.files[0]);
            });
        }

        if (logoRemove) {
            logoRemove.addEventListener('click', function () {
                obState.logoData = null;
                if (logoPreview) logoPreview.style.display = 'none';
                if (logoPlaceholder) logoPlaceholder.style.display = '';
                if (logoFile) logoFile.value = '';
            });
        }

        function handleLogoFile(file) {
            if (!file || !file.type.startsWith('image/')) {
                alert('이미지 파일만 업로드 가능합니다. (PNG, JPG, WebP, GIF)');
                return;
            }
            var allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
            if (allowedTypes.indexOf(file.type) === -1) {
                alert('지원하지 않는 이미지 형식입니다.\nPNG, JPG, WebP, GIF만 가능합니다.');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert('파일 크기가 5MB를 초과합니다.\n더 작은 이미지를 선택해주세요.');
                return;
            }
            var reader = new FileReader();
            reader.onload = function (e) {
                obState.logoData = e.target.result;
                if (logoImg) logoImg.src = e.target.result;
                if (logoPreview) logoPreview.style.display = '';
                if (logoPlaceholder) logoPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }

        // Build initial section toggles (will be rebuilt when entering step 3)
        buildSectionToggles();
    }

    function updateSectionSidebar() {
        // Build catMap dynamically from current type sections
        var catMap = {};
        var sections = getTypeSections();
        sections.forEach(function(s) { catMap[s.key] = s.cat; });
        var list = document.getElementById('obSidebarList');
        var empty = document.getElementById('obSidebarEmpty');
        var countEl = document.getElementById('obSidebarCount');
        if (!list) return;
        var checked = document.querySelectorAll('#obSections input[type="checkbox"]:checked');
        list.innerHTML = '';
        if (countEl) countEl.textContent = checked.length;
        if (checked.length === 0) {
            if (empty) empty.classList.add('ob__sidebar-empty--show');
            return;
        }
        if (empty) empty.classList.remove('ob__sidebar-empty--show');
        checked.forEach(function (input) {
            var toggle = input.closest('.ob__toggle');
            var name = toggle ? toggle.querySelector('.ob__toggle-name') : null;
            if (!name) return;
            var sec = input.getAttribute('data-section') || '';
            var cat = catMap[sec] || 'learn';
            var chip = document.createElement('div');
            chip.className = 'ob__sidebar-chip';
            chip.innerHTML = '<span class="ob__sidebar-chip-dot ob__sidebar-chip-dot--' + cat + '"></span>' + name.textContent;
            list.appendChild(chip);
        });
    }

    function initDropdown(id, callback) {
        var drop = document.getElementById(id);
        if (!drop) return;
        var btn = drop.querySelector('.ob__dropdown-btn');
        var valEl = drop.querySelector('.ob__dropdown-val');
        var items = drop.querySelectorAll('.ob__dropdown-item');

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            // Close other dropdowns
            document.querySelectorAll('.ob__dropdown--open').forEach(function (d) {
                if (d !== drop) d.classList.remove('ob__dropdown--open');
            });
            drop.classList.toggle('ob__dropdown--open');
            // Auto-scroll panel so dropdown menu is fully visible
            if (drop.classList.contains('ob__dropdown--open')) {
                var panel = drop.closest('.ob__panel');
                if (panel) {
                    setTimeout(function () {
                        var menu = drop.querySelector('.ob__dropdown-menu');
                        if (!menu) return;
                        var menuRect = menu.getBoundingClientRect();
                        var panelRect = panel.getBoundingClientRect();
                        if (menuRect.bottom > panelRect.bottom) {
                            panel.scrollTop += (menuRect.bottom - panelRect.bottom) + 16;
                        }
                    }, 20);
                }
            }
        });

        items.forEach(function (item) {
            item.addEventListener('click', function (e) {
                e.stopPropagation();
                items.forEach(function (i) { i.classList.remove('ob__dropdown-item--active'); });
                this.classList.add('ob__dropdown-item--active');
                valEl.textContent = this.textContent;
                drop.classList.remove('ob__dropdown--open');
                callback(this.getAttribute('data-val'));
            });
        });
    }

    function bindChips(containerId, callback) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('.ob__chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                container.querySelectorAll('.ob__chip').forEach(function (c) { c.classList.remove('ob__chip--active'); });
                this.classList.add('ob__chip--active');
                callback(this.getAttribute('data-val'));
            });
        });
    }

    function bindPills(containerId, callback) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('.ob__pill').forEach(function (pill) {
            pill.addEventListener('click', function () {
                container.querySelectorAll('.ob__pill').forEach(function (p) { p.classList.remove('ob__pill--active'); });
                this.classList.add('ob__pill--active');
                callback(this.getAttribute('data-val'));
            });
        });
    }

    function updateTypeChips() {
        // Now handled by buildTypeSegment() in Hybrid design
        if (window.__buildTypeSegment) window.__buildTypeSegment();
    }

    function collectStepData() {
        var teacher = document.getElementById('obTeacher');
        var brand = document.getElementById('obBrand');

        if (teacher) obState.teacher = teacher.value;
        if (brand && obState.hasBrand) obState.brand = brand.value;
        else if (!obState.hasBrand) { obState.brand = ''; obState.logoData = null; }
        // level & difficulty updated via initDropdown callbacks

        // Collect section toggles
        var toggles = document.querySelectorAll('#obSections input[type="checkbox"]');
        toggles.forEach(function (t) {
            var key = t.getAttribute('data-section');
            if (key) obState.sections[key] = t.checked;
        });
    }

    function validateStep(step) {
        if (step === 0) {
            var name = (obState.teacher || '').trim();
            if (!name) return '선생님 이름을 입력해주세요.';
        }
        if (step === 1) {
            if (!obState.subject) return '과목을 선택해주세요.';
            if (!obState.type) return '수업 유형을 선택해주세요.';
        }
        if (step === 3) {
            var hasAny = Object.keys(obState.sections).some(function (k) { return obState.sections[k]; });
            if (!hasAny) return '최소 1개 이상의 섹션을 선택해주세요.';
        }
        return null;
    }

    var _stepErrorTimer = null;
    function showStepError(msg) {
        var el = document.getElementById('obStepError');
        if (!el) {
            el = document.createElement('div');
            el.id = 'obStepError';
            el.className = 'ob__step-error';
            var nav = document.querySelector('.ob__nav');
            if (nav) nav.parentNode.insertBefore(el, nav);
        }
        el.textContent = msg;
        el.style.display = '';
        el.classList.remove('ob__step-error--fade');
        // shake
        el.classList.remove('ob__step-error--shake');
        void el.offsetWidth;
        el.classList.add('ob__step-error--shake');
        // auto-dismiss after 2.5s
        if (_stepErrorTimer) clearTimeout(_stepErrorTimer);
        _stepErrorTimer = setTimeout(function () {
            el.classList.add('ob__step-error--fade');
            setTimeout(function () { el.style.display = 'none'; }, 300);
        }, 2500);
    }

    function clearStepError() {
        var el = document.getElementById('obStepError');
        if (el) el.style.display = 'none';
    }

    function updateStep() {
        var bar = document.getElementById('obBar');
        var backBtn = document.getElementById('obBack');
        var nextBtn = document.getElementById('obNext');

        // Progress bar
        bar.style.width = ((obState.step + 1) / obState.totalSteps * 100) + '%';

        // Step indicators
        document.querySelectorAll('.ob__step').forEach(function (s) {
            var idx = parseInt(s.getAttribute('data-step'));
            s.classList.remove('ob__step--active', 'ob__step--done');
            if (idx === obState.step) s.classList.add('ob__step--active');
            else if (idx < obState.step) s.classList.add('ob__step--done');
        });

        // Panels
        document.querySelectorAll('.ob__panel').forEach(function (p) {
            var idx = parseInt(p.getAttribute('data-panel'));
            p.classList.toggle('ob__panel--active', idx === obState.step);
        });

        // Back button visibility + tab order
        if (obState.step === 0) {
            backBtn.style.visibility = 'hidden';
            backBtn.setAttribute('tabindex', '-1');
        } else {
            backBtn.style.visibility = 'visible';
            backBtn.removeAttribute('tabindex');
        }

        // Next button text
        if (obState.step === obState.totalSteps - 1) {
            nextBtn.innerHTML = '시작하기 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m0 0l-7-7m7 7l-7 7"/></svg>';
            nextBtn.className = 'ob__btn ob__btn--start';
        } else {
            nextBtn.innerHTML = '다음 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m0 0l-7-7m7 7l-7 7"/></svg>';
            nextBtn.className = 'ob__btn ob__btn--next';
        }

        // Personalize Step 2 hero title with teacher name (creative emphasis)
        if (obState.step === 1) {
            var step2Title = document.getElementById('obStep2Title');
            var name = (obState.teacher || '').trim();
            if (step2Title && name) {
                step2Title.innerHTML = '<span class="ob__title-name">' + name + '</span> 선생님, 어떤 수업을 맡고 계세요?';
            }
        }

        // Trigger stagger entrance animations
        triggerStagger(document.querySelector('.ob__panel--active'));

        // Autofocus first input or first seg-btn on current step
        setTimeout(function () {
            var panel = document.querySelector('.ob__panel--active');
            if (panel) {
                var firstInput = panel.querySelector('input:not([hidden]):not([type="file"]):not([type="checkbox"])');
                if (firstInput) { firstInput.focus(); return; }
                var firstCard = panel.querySelector('.ob__subject-card');
                if (firstCard) { firstCard.focus(); return; }
                var firstPill = panel.querySelector('.ob__pill');
                if (firstPill) firstPill.focus();
            }
        }, 400);

        // Update preview if on design step
        if (obState.step === 2) {
            setTimeout(updatePreview, 50);
        }
        // Build dynamic section toggles when entering content step
        if (obState.step === 3) {
            setTimeout(buildSectionToggles, 50);
        }

        // Hide page hint when leaving content step
        var pageHint = document.getElementById('obOverflowWarn');
        if (pageHint && obState.step !== 3) {
            pageHint.classList.remove('ob__page-hint--show');
        }
    }

    // Sample content per subject/type for preview — each type has unique structure
    var PREVIEW_DATA = {
        english: {
            conversation: { mode:'conv', tag:'영어 회화', title:'First Day at a Company', sub:'첫 출근 — 첫 인사, 자기소개',
                phrases:[ '"Hey, I just joined the team. I\'m [name]."', '"Nice to finally meet you in person."', '"I\'m not sure at the moment, but I\'ll get back to you."' ],
                vocab:[ {t:'Meet in person',d:'실제로 만나다'}, {t:'Dive into',d:'본격적으로 시작하다'}, {t:'Get the hang of',d:'감을 잡다'} ],
                scene:'첫 출근날 아침', dialog:'"Hey! You must be the new hire, welcome!"' },
            daily: { mode:'conv', tag:'일상 회화', title:'At a Coffee Shop', sub:'카페에서 — 주문, 요청, 스몰톡',
                phrases:[ '"Can I get a large iced americano, please?"', '"Could you make it with oat milk instead?"', '"Do you guys have Wi-Fi here?"' ],
                vocab:[ {t:'For here or to go?',d:'여기서 드실 건가요, 가져가실 건가요?'}, {t:'On the house',d:'서비스(무료)'}, {t:'Regular',d:'단골, 보통 사이즈'} ],
                scene:'카페 주문', dialog:'"Hi! What can I get for you today?"' },
            reading: { mode:'read', tag:'영어 독해', title:'The Power of Habit', sub:'Reading Comprehension · Intermediate',
                passage:'Every morning, millions of people follow the same routine without thinking. These <u>automatic behaviors</u>, known as habits, account for about <u>40%</u> of our daily actions. According to researcher Charles Duhigg, every habit follows a simple loop: a cue, a routine, and a reward.',
                vocab:[ {t:'automatic',d:'자동적인'}, {t:'account for',d:'~을 차지하다'}, {t:'compound',d:'복합적인'}, {t:'remarkable',d:'놀라운'} ],
                questions:[ 'What percentage of daily actions are habits?', 'What are the three parts of a habit loop?', 'Summarize the main idea in 1-2 sentences.' ] },
            grammar: { mode:'gram', tag:'영어 문법', title:'Present Perfect vs Past Simple', sub:'현재완료와 과거시제 비교',
                rules:[ {r:'현재완료: have/has + p.p.',e:'"I <u>have lived</u> here for 5 years."'}, {r:'과거시제: 과거 시점 명시',e:'"I <u>lived</u> in Seoul in 2020."'} ],
                compare:{a:'I have been to Japan.',b:'I went to Japan last year.',diff:'경험 vs 특정 과거'},
                exercises:[ '"I _____ (live) here since 2019."', '"She _____ (go) to school yesterday."', '"We _____ (know) each other for 10 years."' ] }
        },
        math: {
            basic: { mode:'math', tag:'수학 기본', title:'일차방정식의 풀이', sub:'미지수와 등식의 성질',
                concepts:[ '방정식: 미지수를 포함한 등식', '등식의 성질: 양변에 같은 수를 더하거나 빼도 등식 성립' ],
                formula:'ax + b = 0 → x = −b/a',
                steps:[ '3x + 6 = 0', '3x = −6', 'x = −2' ],
                problem:'"사과 3개의 가격이 귤 5개 가격보다 200원 비쌀 때, 사과 한 개의 가격은?"' },
            'advanced-math': { mode:'math', tag:'수학 심화', title:'이차함수의 최대·최소', sub:'꼭짓점과 축의 방정식',
                concepts:[ '표준형: y = a(x−p)² + q', '꼭짓점 (p, q), 축의 방정식: x = p' ],
                formula:'y = a(x−p)² + q (a>0 → 최솟값 q, a<0 → 최댓값 q)',
                steps:[ 'y = 2x² − 12x + 20', 'y = 2(x² − 6x) + 20', 'y = 2(x−3)² + 2 → 최솟값: 2' ],
                problem:'"y = −x² + 4x + 1 의 최댓값을 구하시오."' },
            'problem-solving': { mode:'math', tag:'수학 문제풀이', title:'경우의 수와 확률', sub:'순열과 조합 기초',
                concepts:[ '순열 nPr = n!/(n−r)! — 순서 O', '조합 nCr = n!/r!(n−r)! — 순서 X' ],
                formula:'nCr = nPr / r!',
                steps:[ '5C3 = 5!/(3!·2!)', '= 120/(6·2)', '= 10' ],
                problem:'"5명 중 반장, 부반장을 뽑는 경우의 수는?"' }
        },
        korean: {
            literature: { mode:'lit', tag:'국어 문학', title:'윤동주 「서시」', sub:'저항 문학의 이해',
                text:'죽는 날까지 하늘을 우러러\n한 점 부끄럼이 없기를,\n잎새에 이는 바람에도\n나는 괴로워했다.',
                author:'윤동주 (1917–1945)',
                vocab:[ {t:'우러러',d:'우러러보다, 올려다보다'}, {t:'부끄럼',d:'부끄러움'}, {t:'잎새',d:'나뭇잎'} ],
                question:'"시인이 \'별\'을 통해 전하고 싶은 메시지는 무엇인가?"' },
            'grammar-kr': { mode:'gram', tag:'국어 문법', title:'품사의 분류', sub:'체언·용언·수식언·관계언',
                rules:[ {r:'체언: 명사, 대명사, 수사',e:'"<u>학생</u>이 <u>책</u>을 읽는다."'}, {r:'용언: 동사, 형용사',e:'"꽃이 <u>아름답다</u>."'} ],
                compare:{a:'되',b:'돼',diff:'"되어"의 줄임 → 돼'},
                exercises:[ '"그는 열심히 공부( )."  →  한다 / 하다', '"꽃이 매우 ( )."  →  예쁘다 / 예쁜', '"밑줄 친 단어의 품사를 쓰시오."' ] },
            'writing-kr': { mode:'write', tag:'국어 작문', title:'논설문 쓰기', sub:'주장과 근거의 구성',
                structure:[ {part:'서론',desc:'문제 제기 → 주장 제시'}, {part:'본론',desc:'근거 나열 → 반론 반박'}, {part:'결론',desc:'요약 → 의견 재강조'} ],
                sample:'학교 급식에 학생 선택권을 확대해야 한다. 첫째, 영양 균형을 스스로 관리하는 능력을 기를 수 있다. 둘째…',
                prompt:'"스마트폰 사용 시간 제한에 대한 찬반 의견을 써보세요."' }
        }
    };
    var LEVEL_LABELS = { elementary:'초등', middle:'중등', high:'고등', adult:'성인' };
    var DIFF_LABELS = { beginner:'기초', intermediate:'중급', advanced:'고급' };

    function getPreviewContent() {
        var subj = obState.subject || 'english';
        var type = obState.type;
        var subjData = PREVIEW_DATA[subj] || PREVIEW_DATA.english;
        if (!type || !subjData[type]) type = Object.keys(subjData)[0];
        return subjData[type];
    }

    // --- Preview section heading helper ---
    // --- Section header (uses same CSS classes as editor) ---
    function pvSec(L, num, label) {
        return '<div class="psh">' + (num ? '<span class="psh__n">' + num + '</span>' : '') + '<span class="psh__t">' + label + '</span></div>';
    }

    // --- Preview header (uses same CSS classes as editor) ---
    function previewHeader(L, d, teacher, brand, badge) {
        var h = '<div class="p-header"><div class="p-header__left">';
        if (brand) h += '<div class="p-brand">' + brand + '</div>';
        h += '<div class="p-series">' + d.tag + '</div>';
        h += '<div class="p-title">' + d.title + '</div>';
        h += '<div class="p-subtitle">' + d.sub + '</div>';
        h += '</div><div class="p-header__right">';
        h += '<div class="p-badge">Session 1</div>';
        h += '<div class="p-meta">' + teacher + ' 선생님</div>';
        h += '<div class="p-date">' + badge + '</div>';
        h += '</div></div>';
        return h;
    }

    // --- Vocab grid helper (uses same CSS classes as editor) ---
    function pvVocab(L, items, label) {
        var h = '<div class="ps">' + pvSec(L, '', label);
        h += '<div class="vg">';
        items.forEach(function(v) {
            h += '<div class="vi"><div class="vi__t">' + v.t + '</div><div class="vi__d">' + v.d + '</div></div>';
        });
        h += '</div></div>';
        return h;
    }

    // ---- MODE: Conversation ----
    function previewConv(L, d) {
        var h = '';
        // Phrases
        h += '<div class="ps">' + pvSec(L, '01', '핵심 문장');
        h += '<ul class="pl">';
        d.phrases.forEach(function(p) { h += '<li>' + p + '</li>'; });
        h += '</ul></div>';
        // Vocab
        h += pvVocab(L, d.vocab, '핵심 표현');
        // Roleplay
        h += '<div class="ps">' + pvSec(L, '03', '롤플레이');
        h += '<div class="scs"><div class="sc">';
        h += '<div class="sc__n">SCENARIO 01</div>';
        h += '<div class="sc__t">' + d.scene + '</div>';
        h += '<div class="sc__p">' + d.dialog + '</div>';
        h += '</div></div></div>';
        return h;
    }

    // ---- MODE: Reading ----
    function previewRead(L, d) {
        var h = '';
        // Passage
        h += '<div class="ps">' + pvSec(L, '01', '독해 지문');
        h += '<div class="psg">' + d.passage + '</div></div>';
        // Vocab
        h += pvVocab(L, d.vocab, '어휘 정리');
        // Questions
        h += '<div class="ps">' + pvSec(L, '03', '독해 문제');
        d.questions.forEach(function(q, i) {
            h += '<div class="prb"><div class="prb__h"><div class="prb__n">' + (i+1) + '</div><div class="prb__q">' + q + '</div></div>';
            h += '<div class="prb__a"></div></div>';
        });
        h += '</div>';
        return h;
    }

    // ---- MODE: Grammar ----
    function previewGram(L, d) {
        var h = '';
        // Rules
        h += '<div class="ps">' + pvSec(L, '01', '문법 규칙');
        h += '<ul class="pl">';
        d.rules.forEach(function(r) {
            h += '<li><strong>' + r.r + '</strong><br><span style="color:var(--t3)">' + r.e + '</span></li>';
        });
        h += '</ul></div>';
        // Compare
        if (d.compare) {
            h += '<div class="ps">' + pvSec(L, '02', '비교');
            h += '<div style="display:flex;gap:8px;align-items:center">';
            h += '<div class="vi" style="flex:1;text-align:center"><div class="vi__t">' + d.compare.a + '</div></div>';
            h += '<span style="font-size:9px;font-weight:700;color:var(--t4)">vs</span>';
            h += '<div class="vi" style="flex:1;text-align:center"><div class="vi__t">' + d.compare.b + '</div></div>';
            h += '</div><div style="font-size:8px;color:var(--t3);margin-top:4px;text-align:center">' + d.compare.diff + '</div></div>';
        }
        // Exercises
        h += '<div class="ps">' + pvSec(L, '03', '연습 문제');
        d.exercises.forEach(function(e, i) {
            h += '<div class="prb"><div class="prb__h"><div class="prb__n">' + (i+1) + '</div><div class="prb__q">' + e + '</div></div>';
            h += '<div class="prb__a"></div></div>';
        });
        h += '</div>';
        return h;
    }

    // ---- MODE: Math ----
    function previewMath(L, d) {
        var h = '';
        // Concepts
        h += '<div class="ps">' + pvSec(L, '01', d.tag.indexOf('심화')>=0?'심화 개념':'핵심 개념');
        h += '<ul class="pl">';
        d.concepts.forEach(function(c) { h += '<li>' + c + '</li>'; });
        h += '</ul></div>';
        // Formula
        h += '<div class="ps">' + pvSec(L, '02', '공식');
        h += '<div class="cb"><div class="cb__t" style="text-align:center;font-size:13px">' + d.formula + '</div></div></div>';
        // Steps
        h += '<div class="ps">' + pvSec(L, '03', '풀이 예제');
        h += '<ul class="pl">';
        d.steps.forEach(function(s, i) {
            h += '<li style="font-family:var(--mono)"><span style="font-weight:700;color:var(--ac);margin-right:6px">(' + (i+1) + ')</span>' + s + '</li>';
        });
        h += '</ul></div>';
        // Problem
        h += '<div class="ps">' + pvSec(L, '04', '연습 문제');
        h += '<div class="prb"><div class="prb__h"><div class="prb__n">1</div><div class="prb__q">' + d.problem + '</div></div>';
        h += '<div class="prb__a"></div></div></div>';
        return h;
    }

    // ---- MODE: Literature ----
    function previewLit(L, d) {
        var h = '';
        var textHtml = d.text.replace(/\n/g, '<br>');
        // Text
        h += '<div class="ps">' + pvSec(L, '01', '작품 본문');
        h += '<div class="psg" style="font-style:italic">' + textHtml + '</div>';
        h += '<div style="font-size:8px;color:var(--t4);margin-top:4px;text-align:right">' + d.author + '</div></div>';
        // Vocab
        h += pvVocab(L, d.vocab, '어휘·어구');
        // Question
        h += '<div class="ps">' + pvSec(L, '03', '감상 문제');
        h += '<div class="prb"><div class="prb__h"><div class="prb__n">1</div><div class="prb__q">' + d.question + '</div></div>';
        h += '<div class="prb__a"></div></div></div>';
        return h;
    }

    // ---- MODE: Writing ----
    function previewWrite(L, d) {
        var h = '';
        // Structure
        h += '<div class="ps">' + pvSec(L, '01', '글 구조');
        h += '<ul class="pl">';
        d.structure.forEach(function(s) {
            h += '<li><strong style="color:var(--ac);margin-right:6px">' + s.part + '</strong>' + s.desc + '</li>';
        });
        h += '</ul></div>';
        // Sample
        h += '<div class="ps">' + pvSec(L, '02', '모범 글');
        h += '<div class="psg">' + d.sample + '</div></div>';
        // Prompt
        h += '<div class="ps">' + pvSec(L, '03', '작문 과제');
        h += '<div class="prb"><div class="prb__h"><div class="prb__n">1</div><div class="prb__q">' + d.prompt + '</div></div>';
        h += '<div class="prb__a"></div></div></div>';
        return h;
    }

    var _prevLayout = '';

    function updatePreview() {
        var page = document.getElementById('obPreviewPage');
        if (!page) return;

        var newLayout = obState.layout || 'classic';
        var layoutChanged = (_prevLayout !== '' && _prevLayout !== newLayout);
        _prevLayout = newLayout;

        function render() {
            page.setAttribute('data-theme', obState.theme);

            page.classList.remove('layout--classic', 'layout--modern', 'layout--compact');
            page.classList.add('layout--' + newLayout);

            var fontFamily = 'var(--font)';
            if (obState.font === 'serif') fontFamily = 'var(--serif)';
            else if (obState.font === 'mono') fontFamily = 'var(--mono)';
            page.style.fontFamily = fontFamily;

            var L = obState.layout;
            var teacherName = obState.teacher || '선생님';
            var brandName = obState.brand;
            var d = getPreviewContent();
            var badge = (LEVEL_LABELS[obState.level]||'중등') + ' · ' + (DIFF_LABELS[obState.difficulty]||'중급');
            var h = '';

            h += previewHeader(L, d, teacherName, brandName, badge);

            var mode = d.mode || 'conv';
            if (mode === 'conv') h += previewConv(L, d);
            else if (mode === 'read') h += previewRead(L, d);
            else if (mode === 'gram') h += previewGram(L, d);
            else if (mode === 'math') h += previewMath(L, d);
            else if (mode === 'lit') h += previewLit(L, d);
            else if (mode === 'write') h += previewWrite(L, d);
            else h += previewConv(L, d);

            if (brandName) {
                h += '<div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--bd2);display:flex;justify-content:space-between;font-size:7px;color:var(--t4)">';
                h += '<span>' + brandName + '</span>';
                h += '<span>' + teacherName + ' 선생님</span>';
                h += '</div>';
            }

            page.innerHTML = h;
        }

        if (layoutChanged) {
            // L4: Micro Scale — out
            page.style.transition = 'transform 150ms ease, opacity 150ms ease';
            page.style.transform = 'scale(0.98)';
            page.style.opacity = '0.1';

            setTimeout(function() {
                render();
                // L4: in
                page.style.transition = 'transform 200ms cubic-bezier(.16,1,.3,1), opacity 200ms ease-out';
                requestAnimationFrame(function() {
                    page.style.transform = '';
                    page.style.opacity = '';
                    setTimeout(function() { page.style.transition = ''; }, 220);
                });
            }, 160);
        } else {
            // C5: no motion, just render (background transitions via CSS)
            render();
        }
    }

    function launchEditor() {
        collectStepData();

        // Show Welcome Modal instead of going directly to editor
        var obOverlay = document.getElementById('onboarding');
        obOverlay.style.opacity = '0';
        obOverlay.style.transition = 'opacity .3s ease';
        setTimeout(function () {
            obOverlay.classList.add('ob--hidden');
            showWelcomeModal();
        }, 300);
        return;
    }

    function _launchEditorReal(studentName, gender) {
        var loadingEl = document.getElementById('editorLoading');

        // Store student info
        window.__classnote = window.__classnote || {};
        window.__classnote.studentName = studentName || '';
        window.__classnote.studentGender = gender || 'male';

        // Show loading screen
        loadingEl.classList.add('editor-loading--visible');

        setTimeout(function () {
            document.body.classList.remove('ob-active');

            // Apply student name
            var studentInput = document.getElementById('studentName');
            if (studentInput && studentName) {
                studentInput.value = studentName;
                studentInput.dispatchEvent(new Event('input'));
            }

            // Apply to editor
            var teacherInput = document.getElementById('teacherName');
            if (teacherInput) {
                teacherInput.value = obState.teacher;
                teacherInput.dispatchEvent(new Event('input'));
            }

            // Apply theme
            var themeDot = document.querySelector('.tdot[data-theme="' + obState.theme + '"]');
            if (themeDot) themeDot.click();

            // Store brand name for page footer/header usage
            window.__classnote = window.__classnote || {};
            window.__classnote.brand = obState.brand;
            window.__classnote.logoData = obState.logoData;
            window.__classnote.sections = obState.sections;
            window.__classnote.sectionNames = obState.sectionNames || {};
            window.__classnote.sectionOrder = obState.sectionOrder || null;
            window.__classnote.layout = obState.layout;
            window.__classnote.font = obState.font;
            window.__classnote.subject = obState.subject;
            window.__classnote.type = obState.type;
            window.__classnote.level = obState.level;
            window.__classnote.difficulty = obState.difficulty;

            // Save to localStorage for persistence
            try {
                localStorage.setItem('classnote_onboarding', JSON.stringify(obState));
            } catch (e) {}

            // Map subject+type to courseId
            var courseMap = {
                'english|conversation': 'biz-english',
                'english|daily': 'daily-english',
                'english|reading': 'eng-reading',
                'english|grammar': 'eng-grammar',
                'math|basic': 'math-main',
                'math|advanced-math': 'math-main',
                'math|problem-solving': 'math-main',
                'korean|literature': 'korean-main',
                'korean|grammar-kr': 'korean-main',
                'korean|writing-kr': 'korean-main'
            };
            var mapKey = obState.subject + '|' + obState.type;
            if (courseMap[mapKey]) {
                state.courseId = courseMap[mapKey];
                state.sessionIdx = 0;
            }

            // Recalc zoom now that preview is visible
            if (typeof calcPageZoom === 'function') calcPageZoom();

            // Re-render sidebar + page with new settings
            if (typeof renderNav === 'function') renderNav();
            if (typeof window.__renderPage === 'function') {
                window.__renderPage();
            }

            // Sync sidebar segment states with onboarding selections
            var syncSeg = function (segId, val) {
                var seg = document.getElementById(segId);
                if (!seg) return;
                seg.querySelectorAll('.sb__seg-btn').forEach(function (b) {
                    b.classList.toggle('sb__seg-btn--active', b.getAttribute('data-val') === val);
                });
            };
            syncSeg('sbLayoutSeg', obState.layout || 'classic');
            syncSeg('sbFontSeg', obState.font || 'sans');

            // Sync theme dot
            var themeDots = document.getElementById('themeDots');
            if (themeDots) {
                themeDots.querySelectorAll('.tdot').forEach(function (d) {
                    d.classList.toggle('tdot--active', d.getAttribute('data-theme') === obState.theme);
                });
            }

            // Step 2: Fade out loading screen after editor is ready
            setTimeout(function () {
                loadingEl.classList.add('editor-loading--fade-out');
                setTimeout(function () {
                    loadingEl.classList.remove('editor-loading--visible', 'editor-loading--fade-out');
                    // Check for autosave data now that editor is visible
                    if (typeof checkAutosave === 'function') checkAutosave();
                }, 300);
            }, 500);

        }, 300);
    }

    // =========================================
    // COURSE STRUCTURE
    // =========================================

    var COURSE_GROUPS = [
        {
            id: 'english',
            name: '영어',
            dot: '#1a6fb5',
            courses: [
                {
                    id: 'biz-english',
                    name: '비즈니스 영어',
                    series: '비즈니스 영어',
                    renderer: 'english',
                    sessions: [
                        {
                            num: 1, title: 'First Day at a Company',
                            subtitle: '첫 출근 — 첫 인사, 자기소개, 모를 때 대처하기',
                            sections: [
                                { num: '01', name: '첫 인사', phrases: [
                                    '"Hey, I just joined the team. I\'m [name]. Great to meet you!"',
                                    '"Nice to finally meet you in person."'
                                ]},
                                { num: '02', name: '자기소개', phrases: [
                                    '"I work in [field] — I\'ve been doing it for about X years. Super excited to be here."',
                                    '"I\'ve been working in [field] for the past few years. Really looking forward to diving into our new project."',
                                    '"What about you, how long have you been with the team?"'
                                ]},
                                { num: '03', name: '모를 때 자연스럽게 넘기는 표현', phrases: [
                                    '"I\'m not sure at the moment, but I\'ll get back to you on that."',
                                    '"That\'s a good question. Let me think it through and follow up."',
                                    '"I don\'t have that information off the top of my head, but I\'ll find out."'
                                ]}
                            ],
                            vocab: [
                                { term: 'Meet in person', def: '이름만 알던 사람을 실제로 만나다' },
                                { term: 'Get the hang of things', def: '적응하다, 감을 잡다' },
                                { term: 'Dive into', def: '본격적으로 시작하다' }
                            ],
                            scenarios: [
                                { num: 'Scenario 01', title: '첫 출근날 아침', prompt: '"Hey! You must be the new hire, welcome! I\'m Chris. How are you settling in so far?"' },
                                { num: 'Scenario 02', title: '팀 미팅 중 질문', prompt: '"What is last year\'s revenue of your company?"' }
                            ],
                            homework: [
                                { title: '첫 이메일 작성', desc: '외국인 동료에게 보내는 첫 인사 + 자기소개 이메일 작성' },
                                { title: '영어 자기소개 문장 3개 만들어오기', desc: '오늘 배운 표현 활용해서 직접 작성' },
                                { title: '모를 때 대처 표현 3가지', desc: '"I\'m not sure at the moment..." 처럼 본인만의 표현으로' }
                            ]
                        },
                        {
                            num: 2, title: "How's Your First Week Been?",
                            subtitle: '첫 주를 보낸 후 — 근황 나누기, 업무 파악, 도움 요청',
                            sections: [
                                { num: '01', name: '첫 주 근황 나누기', phrases: [
                                    '"Honestly, it\'s been a bit overwhelming, but in a good way."',
                                    '"Everyone\'s been super welcoming, and I\'m starting to get the hang of it."'
                                ]},
                                { num: '02', name: '업무 파악할 때', phrases: [
                                    '"Could you walk me through how this works?"',
                                    '"I want to make sure I fully understand."',
                                    '"Could you break it down for me?"'
                                ]},
                                { num: '03', name: '도움 요청하기', phrases: [
                                    '"Would you mind showing me how to do this?"',
                                    '"I hate to bother you, but could you spare a few minutes?"',
                                    '"Just wanted to double-check before I move forward. Does this look right to you?"'
                                ]}
                            ],
                            vocab: [
                                { term: 'Overwhelming', def: '감당하기 힘든, too much to deal with' },
                                { term: 'Walk someone through', def: '단계별로 설명해주다' },
                                { term: 'Double-check', def: '재확인하다' }
                            ],
                            scenarios: [
                                { num: 'Scenario 01', title: '첫주 후 근황 나누기', prompt: '"Hey! So how was your first week? Any questions?"' },
                                { num: 'Scenario 02', title: '업무 도움 요청', prompt: '"Hey, I heard you could use some help. What can I do for you?"' }
                            ],
                            homework: [
                                { title: '첫 주 소감 3문장 써오기', desc: '오늘 배운 표현을 활용해서 자연스럽게 현재 적응 상태를 표현하기' },
                                { title: '도움 요청 이메일 작성', desc: '시니어 동료에게 업무 관련 짧은 이메일 작성' },
                                { title: '핵심 표현 반복 말하기 연습', desc: '발음과 억양을 신경써서 내 걸로 만들기' }
                            ]
                        },
                        {
                            num: 3, title: 'Giving and Receiving Feedback',
                            subtitle: '피드백 주고받기 — 건설적 피드백, 의견 교환, 받아들이기',
                            sections: [
                                { num: '01', name: '피드백 줄 때', phrases: [
                                    '"Overall it looks great, but I have a couple of suggestions."',
                                    '"Have you considered doing it this way instead?"'
                                ]},
                                { num: '02', name: '피드백 받을 때', phrases: [
                                    '"That\'s a really good point. I\'ll update that."',
                                    '"I see what you mean. Let me rethink this part."',
                                    '"Thanks for catching that — I totally missed it."'
                                ]},
                                { num: '03', name: '의견이 다를 때', phrases: [
                                    '"I see where you\'re coming from, but I was thinking..."',
                                    '"That\'s one way to look at it. My concern is..."',
                                    '"Can we find a middle ground on this?"'
                                ]}
                            ],
                            vocab: [
                                { term: 'A couple of suggestions', def: '몇 가지 제안' },
                                { term: 'See where you\'re coming from', def: '네 말의 의도를 이해해' },
                                { term: 'Find a middle ground', def: '타협점을 찾다' }
                            ],
                            scenarios: [
                                { num: 'Scenario 01', title: '업무 피드백', prompt: '"Hey, I took a look at the report you sent over. A few things I wasn\'t sure about — can we walk through them?"' },
                                { num: 'Scenario 02', title: '디자인 방향 토론', prompt: '"I think we should go with option A. What do you think?"' }
                            ],
                            homework: [
                                { title: '업무 피드백 코멘트 3개 영어로 작성', desc: '건설적이고 공손한 톤으로 피드백 작성 연습' },
                                { title: '피드백 수용 표현 5가지 정리', desc: '본인 스타일에 맞는 표현으로 변형해보기' },
                                { title: '반대 의견 전달 롤플레이 준비', desc: '부드럽게 다른 의견을 제시하는 상황 3가지 준비' }
                            ]
                        }
                    ]
                },
                {
                    id: 'daily-english',
                    name: '일상 영어 회화',
                    series: '일상 영어 회화',
                    renderer: 'english',
                    sessions: [
                        {
                            num: 1, title: 'Ordering Food Like a Local',
                            subtitle: '음식 주문 — 카페, 레스토랑, 패스트푸드에서 자연스럽게',
                            sections: [
                                { num: '01', name: '카페에서 주문하기', phrases: [
                                    '"Can I get a medium iced latte, please?"',
                                    '"I\'ll have a flat white, same as last time."',
                                    '"Could I get that with oat milk instead?"'
                                ]},
                                { num: '02', name: '레스토랑에서', phrases: [
                                    '"Could we get a table for two?"',
                                    '"What do you recommend? I\'m not sure what to get."',
                                    '"Can I get the check, please?"'
                                ]},
                                { num: '03', name: '문제 상황 대처', phrases: [
                                    '"Sorry, this isn\'t what I ordered. I asked for the pasta."',
                                    '"Excuse me, could we get some more water?"',
                                    '"Is it possible to split the bill?"'
                                ]}
                            ],
                            vocab: [
                                { term: 'On the side', def: '(소스 등을) 따로 달라' },
                                { term: 'Split the bill', def: '각자 계산하다' },
                                { term: 'To go / For here', def: '포장 / 매장' },
                                { term: 'I\'m good', def: '괜찮아요 (거절 시)' }
                            ],
                            scenarios: [
                                { num: 'Scenario 01', title: '카페 주문', prompt: '"Hi! What can I get started for you today?"' },
                                { num: 'Scenario 02', title: '레스토랑에서 문제 발생', prompt: '"Here\'s your order! Oh wait, that doesn\'t look right. Let me check."' }
                            ],
                            homework: [
                                { title: '나만의 카페 주문 스크립트', desc: '자주 가는 카페에서 쓸 수 있는 주문 문장 3개 만들기' },
                                { title: '메뉴 설명 영어로 해보기', desc: '좋아하는 음식을 영어로 설명하는 연습' }
                            ]
                        },
                        {
                            num: 2, title: 'Small Talk That Actually Works',
                            subtitle: '스몰토크 — 처음 만난 사람과 자연스럽게 대화하기',
                            sections: [
                                { num: '01', name: '대화 시작하기', phrases: [
                                    '"So, what brings you here?"',
                                    '"Have you been here before? Any recommendations?"',
                                    '"I love your bag! Where did you get it?"'
                                ]},
                                { num: '02', name: '대화 이어가기', phrases: [
                                    '"Oh really? That sounds amazing. Tell me more!"',
                                    '"No way! I actually had a similar experience."',
                                    '"That\'s so cool. How did you get into that?"'
                                ]},
                                { num: '03', name: '대화 마무리', phrases: [
                                    '"It was really nice chatting with you!"',
                                    '"I should get going, but let\'s keep in touch!"',
                                    '"Hey, can I add you on Instagram?"'
                                ]}
                            ],
                            vocab: [
                                { term: 'What brings you here', def: '여기 어쩐 일이에요?' },
                                { term: 'Get into', def: '~에 빠지다, 시작하게 되다' },
                                { term: 'Keep in touch', def: '연락하고 지내다' },
                                { term: 'No way!', def: '말도 안 돼! (놀람)' }
                            ],
                            scenarios: [
                                { num: 'Scenario 01', title: '파티에서 처음 만난 사람', prompt: '"Hey! I don\'t think we\'ve met — I\'m Alex. Nice to meet you!"' },
                                { num: 'Scenario 02', title: '카페에서 옆자리 사람', prompt: '"Excuse me, is this seat taken? Oh nice, what are you reading?"' }
                            ],
                            homework: [
                                { title: '스몰토크 주제 5가지 준비', desc: '날씨, 음식, 취미 등 가볍게 꺼낼 수 있는 주제 정리' },
                                { title: '리액션 표현 연습', desc: '자연스러운 리액션 표현 5가지 정리하기' }
                            ]
                        },
                        {
                            num: 3, title: 'Getting Around Town',
                            subtitle: '길 찾기와 교통 — 택시, 지하철, 길 물어보기',
                            sections: [
                                { num: '01', name: '길 물어보기', phrases: [
                                    '"Excuse me, how do I get to the subway station?"',
                                    '"Is it walking distance, or should I take a cab?"',
                                    '"Am I going the right way to get there?"'
                                ]},
                                { num: '02', name: '택시/우버 이용', phrases: [
                                    '"Could you take me to [place], please?"',
                                    '"How long will it take to get there?"',
                                    '"You can drop me off right here. Thanks!"'
                                ]},
                                { num: '03', name: '대중교통', phrases: [
                                    '"Which line do I need to take to get to downtown?"',
                                    '"Is this the right platform for [destination]?"',
                                    '"Excuse me, does this bus go to [place]?"'
                                ]}
                            ],
                            vocab: [
                                { term: 'Walking distance', def: '걸어갈 수 있는 거리' },
                                { term: 'Drop me off', def: '내려주다' },
                                { term: 'Transfer', def: '환승하다' },
                                { term: 'Get off at', def: '~에서 내리다' }
                            ],
                            scenarios: [
                                { num: 'Scenario 01', title: '길 잃었을 때', prompt: '"You look a bit lost. Can I help you find your way?"' },
                                { num: 'Scenario 02', title: '택시 탑승', prompt: '"Where to? Do you have the address, or do you know the name of the place?"' }
                            ],
                            homework: [
                                { title: '우리 동네 영어로 길 안내하기', desc: '집에서 가까운 장소까지 영어로 길 안내 연습' },
                                { title: '교통수단 관련 표현 정리', desc: 'bus, subway, taxi 관련 실용 표현 각 3개씩' }
                            ]
                        }
                    ]
                },
                {
                    id: 'eng-reading',
                    name: '영어 독해',
                    series: '영어 독해 클래스',
                    renderer: 'eng-reading',
                    sessions: [
                        {
                            num: 1, title: 'The Power of Habits',
                            subtitle: '습관의 힘 — Reading Comprehension · Intermediate',
                            passage: {
                                title: 'The Power of Habits',
                                text: 'Every morning, millions of people around the world follow the same routine without thinking. They wake up, brush their teeth, make coffee, and check their phones. These <mark>automatic behaviors</mark>, known as habits, account for about 40% of our daily actions.\n\nAccording to researcher Charles Duhigg, every habit follows a simple loop: a <mark>cue</mark>, a <mark>routine</mark>, and a <mark>reward</mark>. Understanding this loop is the key to changing our behavior.\n\nThe most fascinating aspect of habits is their <mark>compound effect</mark>. Small changes, repeated consistently, can lead to remarkable results over time.'
                            },
                            vocab: [
                                { term: 'automatic', def: '자동적인' },
                                { term: 'account for', def: '~을 차지하다' },
                                { term: 'compound', def: '복합적인' },
                                { term: 'remarkable', def: '놀라운' },
                                { term: 'consistently', def: '일관되게' },
                                { term: 'fascinating', def: '매혹적인' }
                            ],
                            questions: [
                                { q: 'What percentage of our daily actions are habits?', choices: ['About 20%', 'About 40%', 'About 60%', 'About 80%'] },
                                { q: 'What are the three parts of a habit loop?', answer: true },
                                { q: 'What does "compound effect" mean in this context? (한국어 가능)', answer: true },
                                { q: 'Summarize the main idea in 1-2 sentences.', answer: true }
                            ]
                        },
                        {
                            num: 2, title: 'The Future of Remote Work',
                            subtitle: '원격 근무의 미래 — Reading Comprehension · Intermediate',
                            passage: {
                                title: 'The Future of Remote Work',
                                text: 'The global pandemic <mark>fundamentally transformed</mark> the way we work. What started as a temporary necessity has become a permanent feature. A recent survey found that 74% of companies plan to maintain some form of remote work policy.\n\nHowever, remote work is not without challenges. Many employees report feelings of <mark>isolation</mark> and difficulty separating work from personal life. The lack of face-to-face interaction can also <mark>hinder</mark> creativity.\n\nThe solution may lie in <mark>hybrid models</mark>. Companies like Google are experimenting with "anchor days" — specific days when all team members come to the office together.'
                            },
                            vocab: [
                                { term: 'fundamentally', def: '근본적으로' },
                                { term: 'isolation', def: '고립, 외로움' },
                                { term: 'hinder', def: '방해하다' },
                                { term: 'hybrid', def: '혼합의' },
                                { term: 'spontaneous', def: '즉흥적인' },
                                { term: 'permanent', def: '영구적인' }
                            ],
                            questions: [
                                { q: 'What percentage of companies plan to keep remote work?', choices: ['54%', '64%', '74%', '84%'] },
                                { q: 'What are two challenges of remote work mentioned?', answer: true },
                                { q: 'What are "anchor days"? Explain in your own words.', answer: true },
                                { q: 'Do you think hybrid models work? Why or why not? (영어 또는 한국어)', answer: true }
                            ]
                        }
                    ]
                },
                {
                    id: 'eng-grammar',
                    name: '영어 문법',
                    series: '영어 문법 마스터',
                    renderer: 'eng-grammar',
                    sessions: [
                        {
                            num: 1, title: 'Relative Pronouns (관계대명사)',
                            subtitle: 'who, which, that, whose 완벽 정리',
                            concept: { title: '관계대명사란?', body: '두 문장을 하나로 연결하면서, 앞의 명사(선행사)를 수식하는 절을 이끄는 대명사' },
                            table: {
                                headers: ['선행사', '주격', '목적격', '소유격'],
                                rows: [['사람', 'who', 'who(m)', 'whose'], ['사물/동물', 'which', 'which', 'whose / of which'], ['사람+사물', 'that', 'that', '—']]
                            },
                            examples: [
                                { en: 'The man <b>who</b> lives next door is a doctor.', note: '선행사: The man (사람) / 주격' },
                                { en: 'The book <b>which</b> I bought yesterday was interesting.', note: '선행사: The book (사물) / 목적격' },
                                { en: 'The girl <b>whose</b> father is a pilot won the prize.', note: '선행사: The girl (사람) / 소유격' }
                            ],
                            problems: [
                                { q: '빈칸에 알맞은 관계대명사를 쓰시오.\nThe teacher _______ teaches us English is very kind.', sub: '답: _____________' },
                                { q: '다음 두 문장을 관계대명사를 사용하여 한 문장으로 만드시오.\n• I have a friend. He speaks three languages.', answer: true },
                                { q: '밑줄 친 관계대명사의 선행사와 격을 쓰시오.\nThe cake <u>which</u> she made was delicious.', sub: '선행사: _________ / 격: _________' }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'math',
            name: '수학',
            dot: '#e85d2c',
            courses: [
                {
                    id: 'math-main',
                    name: '수학 기본',
                    series: '수학 클래스',
                    renderer: 'math',
                    sessions: [
                        {
                            num: 1, title: '일차함수의 그래프',
                            subtitle: '중학교 2학년 · 1학기',
                            concept: { title: '일차함수', body: 'y = ax + b (a ≠ 0) 꼴로 나타낼 수 있는 함수\n• 기울기 a: x가 1 증가할 때 y의 증가량\n• y절편 b: 그래프가 y축과 만나는 점의 y좌표' },
                            problems: [
                                { q: 'y = 2x + 3 의 그래프에서 기울기와 y절편을 각각 구하시오.', sub: '기울기: _______ , y절편: _______' },
                                { q: '다음 중 일차함수인 것을 모두 고르시오.', choices: ['y = 3x − 1', 'y = x²', 'y = −5x', 'y = 2/x'] },
                                { q: '두 점 (1, 5)와 (3, 9)를 지나는 일차함수의 식을 구하시오.', answer: true },
                                { q: 'y = 3x − 2 에서 x의 값이 2에서 5로 변할 때, y의 값의 변화량을 구하시오.', answer: true }
                            ]
                        },
                        {
                            num: 2, title: '연립방정식',
                            subtitle: '중학교 2학년 · 1학기',
                            concept: { title: '연립방정식', body: '미지수가 2개인 일차방정식 2개를 한 쌍으로 묶은 것\n• 대입법: 한 식을 다른 식에 대입\n• 가감법: 두 식을 더하거나 빼서 미지수 소거' },
                            problems: [
                                { q: '{ x + y = 5, x − y = 1 }의 해를 구하시오.', choices: ['x=2, y=3', 'x=3, y=2', 'x=4, y=1', 'x=1, y=4'] },
                                { q: '사과 3개와 배 2개의 가격이 7,000원이고, 사과 1개와 배 4개의 가격이 9,000원일 때, 사과와 배의 가격을 각각 구하시오.', answer: true },
                                { q: '{ 3x − y = 7, x + 2y = 4 }의 해가 x = a, y = b일 때, a + b의 값을 구하시오.', answer: true },
                                { q: '{ 2x + y = 10, x − y = 2 }를 가감법으로 풀어 x, y의 값을 구하시오.', answer: true }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'korean',
            name: '국어',
            dot: '#8b3a8b',
            courses: [
                {
                    id: 'korean-main',
                    name: '국어 기본',
                    series: '국어 클래스',
                    renderer: 'korean',
                    sessions: [
                        {
                            num: 1, title: '현대시 감상: 풀꽃',
                            subtitle: '나태주 — 문학 감상 · 고등학교',
                            poem: { title: '풀꽃', author: '나태주', text: '자세히 보아야\n예쁘다\n\n오래 보아야\n사랑스럽다\n\n너도 그렇다' },
                            analysis: [['작가', '나태주 (1945~)'], ['갈래', '자유시, 서정시'], ['성격', ''], ['주제', ''], ['화자', ''], ['표현상 특징', '']],
                            questions: [
                                { q: '"자세히 보아야 예쁘다"에서 화자가 전달하고자 하는 의미를 서술하시오.', answer: true },
                                { q: '이 시에서 "풀꽃"이 상징하는 것은 무엇인지 자신의 생각을 쓰시오.', answer: true },
                                { q: '"너도 그렇다"에서 "너"는 누구를 가리키는지, 이 표현의 효과를 설명하시오.', answer: true }
                            ],
                            writingPrompt: '이 시를 읽고 자신의 감상을 자유롭게 써보세요.'
                        }
                    ]
                }
            ]
        }
    ];

    // Flatten for quick lookup
    var ALL_COURSES = [];
    COURSE_GROUPS.forEach(function (g) {
        g.courses.forEach(function (c) { ALL_COURSES.push(c); });
    });

    // =========================================
    // RENDERERS (v4 shortened class names)
    // =========================================

    var E = ' contenteditable="true"';

    var renderers = {};

    // Section visibility helper
    // Merge course-level sections with per-session overrides
    function getEffectiveSections() {
        var cn = window.__classnote;
        if (!cn || !cn.sections) return {};
        var merged = {};
        for (var k in cn.sections) merged[k] = cn.sections[k];
        var sess = typeof getSession === 'function' ? getSession() : null;
        if (sess && sess._sections) {
            for (var sk in sess._sections) merged[sk] = sess._sections[sk];
        }
        return merged;
    }

    function secOn(key) {
        var cn = window.__classnote;
        if (!cn || !cn.sections) return true;
        return getEffectiveSections()[key] === true;
    }

    // Reorder .ps elements in the page based on sectionOrder
    function reorderSections(pageEl) {
        var cn = window.__classnote;
        if (!cn || !cn.sectionOrder || !cn.sectionOrder.length) return;

        // Build map: secKey → parent .ps element
        var psMap = {};
        pageEl.querySelectorAll('.psh[data-sec-key]').forEach(function (psh) {
            var key = psh.getAttribute('data-sec-key');
            var ps = psh.closest('.ps');
            if (ps && key) {
                if (!psMap[key]) psMap[key] = [];
                psMap[key].push(ps);
            }
        });

        // Find the insertion anchor: the element AFTER the last header element (before first .ps)
        var allPS = pageEl.querySelectorAll('.ps');
        if (!allPS.length) return;
        var firstPS = allPS[0];
        var parent = firstPS.parentNode;

        // Collect all .ps elements and remove them from DOM
        var allPSArr = Array.prototype.slice.call(allPS);
        allPSArr.forEach(function (ps) { parent.removeChild(ps); });

        // Re-insert in sectionOrder, then append any remaining
        var inserted = {};
        var anchor = pageEl.querySelector('.pf');
        cn.sectionOrder.forEach(function (key) {
            var elems = psMap[key];
            if (elems) {
                elems.forEach(function (ps) {
                    if (anchor) parent.insertBefore(ps, anchor);
                    else parent.appendChild(ps);
                });
                inserted[key] = true;
            }
        });
        // Append any sections not in sectionOrder (newly added)
        allPSArr.forEach(function (ps) {
            var psh = ps.querySelector('.psh[data-sec-key]');
            var key = psh ? psh.getAttribute('data-sec-key') : null;
            if (!key || !inserted[key]) {
                if (anchor) parent.insertBefore(ps, anchor);
                else parent.appendChild(ps);
            }
        });
    }

    // =========================================
    // ITEM CRUD — CONFIG & HELPERS
    // =========================================

    var ITEM_MAX = {
        phrases: 12, vocab: 12, scenarios: 6, homework: 6,
        questions: 8, problems: 8, analysis: 8, 'table-rows': 10,
        wordlist: 10, slang: 6, dialogue: 10, mistakes: 6,
        fillblank: 6, 'writing-prb': 6, correct: 6, choice: 4,
        transform: 6, truefalse: 6, 'structure-q': 4, translate: 6,
        'example-steps': 6, guided: 6, 'word-prb': 4, speed: 8,
        'mistake-math': 6, 'review-rows': 6, mock: 6,
        'examples-kr': 6, 'classify-rows': 8, 'compare-rows': 6,
        'outline-rows': 6, 'revise-rows': 6,
        dictation: 10, memo: 12, summarize: 8, opinion: 8,
        draft: 15, 'writing-lines': 12
    };

    var ITEM_FACTORIES = {
        phrases: function () { return '새 표현을 입력하세요.'; },
        vocab: function () { return { term: '단어', def: '뜻' }; },
        scenarios: function () { return { num: '', title: '상황', prompt: '예문을 입력하세요.' }; },
        homework: function () { return { title: '과제 제목', desc: '과제 내용' }; },
        questions: function () { return { q: '문제를 입력하세요.', answer: true }; },
        problems: function () { return { q: '문제를 입력하세요.' }; },
        analysis: function () { return ['항목', '']; },
        wordlist: function () { return { word: '', pos: '', meaning: '' }; },
        slang: function () { return { expr: '슬랭 표현', usage: '뜻 / 사용 상황' }; },
        dialogue: function (i) { return { role: i % 2 === 0 ? 'A' : 'B', line: '대사를 입력하세요.' }; },
        mistakes: function () { return { wrong: '틀린 표현', right: '올바른 표현' }; },
        fillblank: function () { return { q: '문장을 입력하세요. _______ 부분을 빈칸으로 남겨주세요.' }; },
        'writing-prb': function () { return { q: '한국어 문장을 입력하세요.' }; },
        correct: function () { return { wrong: '틀린 문장', right: '올바른 문장' }; },
        choice: function () { return { q: '문제를 입력하세요.', options: ['선택지', '선택지', '선택지', '선택지'] }; },
        transform: function () { return { q: '다음 문장을 변환하세요.' }; },
        truefalse: function () { return { q: '진술문을 입력하세요.' }; },
        'structure-q': function () { return { q: '복잡한 문장을 입력하세요.' }; },
        translate: function () { return { q: '문장을 입력하세요.' }; },
        'example-steps': function () { return { step: '풀이 단계' }; },
        guided: function () { return { q: '단계별 안내를 입력하세요.' }; },
        'word-prb': function () { return { q: '서술형 문제를 입력하세요.' }; },
        speed: function () { return { q: '빠른 풀이 문제' }; },
        'mistake-math': function () { return { wrong: '틀린 풀이', right: '올바른 풀이' }; },
        'review-rows': function () { return { num: '', wrong: '', fix: '' }; },
        mock: function () { return { q: '시험 형식 문제' }; },
        'examples-kr': function () { return { sentence: '예문을 입력하세요.' }; },
        'classify-rows': function () { return { word: '', type: '', note: '' }; },
        'compare-rows': function () { return { aspect: '', a: '', b: '' }; },
        'outline-rows': function () { return { part: '', content: '' }; },
        'revise-rows': function () { return { original: '', revised: '' }; },
        'eng-compare': function () { return { title: '표현', desc: '뉘앙스 설명' }; }
    };

    var LINE_DEFAULTS = {
        dictation: 6, memo: 8, summarize: 5, opinion: 5,
        draft: 10, 'writing-lines': 8
    };
    var LINE_MIN = 2;

    // type → session key mapping for hardcoded→dynamic items
    var CRUD_KEY_MAP = {
        'writing-prb': '_writing', 'example-steps': '_exampleSteps',
        'word-prb': '_wordProb', 'mistake-math': '_mistakeMath',
        'review-rows': '_review', 'examples-kr': '_examplesKr',
        'classify-rows': '_classify', 'compare-rows': '_compareRows',
        'outline-rows': '_outline', 'revise-rows': '_revise',
        'structure-q': '_structure', 'writing-lines': '_writingLines',
        'eng-compare': '_compare'
    };

    function ensureArray(session, key, defaultCount, factory) {
        if (!session[key] || !Array.isArray(session[key])) {
            session[key] = [];
            for (var i = 0; i < defaultCount; i++) session[key].push(factory(i));
        }
        return session[key];
    }

    function ensureLineCount(session, key) {
        if (typeof session[key] !== 'number') {
            session[key] = LINE_DEFAULTS[key] || 6;
        }
        return session[key];
    }

    // + button HTML
    function crudAdd(type, currentLen, secIdx) {
        var max = ITEM_MAX[type] || 6;
        var cls = currentLen >= max ? ' crud-maxed' : '';
        var sec = secIdx !== undefined ? ' data-crud-sec="' + secIdx + '"' : '';
        return '<button class="crud-add' + cls + '" data-crud-action="add" data-crud-type="' + type + '"' + sec + '>+</button>';
    }

    // +/- line buttons for line-count items (dictation, memo, etc.)
    function crudLines(type, currentCount) {
        var max = ITEM_MAX[type] || 10;
        var addCls = currentCount >= max ? ' class="crud-maxed"' : '';
        var rmCls = currentCount <= LINE_MIN ? ' class="crud-maxed"' : '';
        return '<div class="crud-lines">' +
            '<button' + rmCls + ' data-crud-action="remove-line" data-crud-type="' + type + '">−</button>' +
            '<button' + addCls + ' data-crud-action="add-line" data-crud-type="' + type + '">+</button>' +
            '</div>';
    }

    // --- English Conversation ---
    renderers.english = function (s, c, ctx) {
        var h = pageHeader(c.series, s.title, s.subtitle, s.num, ctx);

        if (secOn('phrases')) {
            var secSolo = s.sections.length <= 1 ? ' crud-solo' : '';
            s.sections.forEach(function (sec, si) {
                var solo = sec.phrases.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps' + secSolo + '" data-crud-sec-wrap="' + si + '">';
                if (si === 0) h += '<div class="psh"><span class="psh__t">핵심 문장</span></div>';
                var secXBtn = (s.sections.length > 1) ? '<button class="crud-sec-x" data-crud-action="remove-sec" data-crud-sec="' + si + '" title="이 번호 삭제">&times;</button>' : '';
                h += secH(sec.num, sec.name, 'phrases', si).replace('</div>', secXBtn + '</div>');
                h += '<ul class="pl">';
                sec.phrases.forEach(function (p, pi) {
                    var parts = String(p).split('\n');
                    var en = parts[0] || '';
                    var ko = parts.slice(1).join(' ') || '';
                    h += '<li class="pl__duo"' + solo + ' data-crud-type="phrases" data-crud-sec="' + si + '" data-crud-idx="' + pi + '"><span class="pl__en"' + E + '>' + en + '</span><span class="pl__ko"' + E + '>' + ko + '</span>';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></li>';
                });
                var isLast = si === s.sections.length - 1;
                h += '</ul><div class="crud-row">' + crudAdd('phrases', sec.phrases.length, si);
                if (isLast) h += '<button class="crud-add--sec-sib" data-crud-action="add-sec">+ 번호 추가</button>';
                h += '</div></div>';
            });
        }

        if (secOn('vocab')) {
            var solo = s.vocab.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '핵심 표현', 'vocab');
            h += '<div class="vg">';
            s.vocab.forEach(function (v, i) {
                h += '<div class="vi' + solo + '" data-crud-type="vocab" data-crud-idx="' + i + '"><div class="vi__t"' + E + '>' + v.term + '</div><div class="vi__d"' + E + '>' + v.def + '</div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
            });
            h += '</div>' + crudAdd('vocab', s.vocab.length) + '</div>';
        }

        if (secOn('scenarios')) {
            var solo = s.scenarios.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '롤플레이 시나리오', 'scenarios');
            h += '<div class="scs">';
            s.scenarios.forEach(function (sc, i) {
                h += '<div class="sc' + solo + '" data-crud-type="scenarios" data-crud-idx="' + i + '"><div class="sc__n">' + sc.num + '</div><div class="sc__t"' + E + '>' + sc.title + '</div><div class="sc__p"' + E + '>' + sc.prompt + '</div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
            });
            h += '</div>' + crudAdd('scenarios', s.scenarios.length) + '</div>';
        }

        if (secOn('homework')) {
            var solo = s.homework.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '숙제', 'homework');
            h += '<ul class="hwl">';
            s.homework.forEach(function (hw, i) {
                h += '<li' + solo + ' data-crud-type="homework" data-crud-idx="' + i + '"><div class="hw__n">' + (i + 1) + '</div><div><div class="hw__t"' + E + '>' + hw.title + '</div><div class="hw__d"' + E + '>' + hw.desc + '</div></div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></li>';
            });
            h += '</ul>' + crudAdd('homework', s.homework.length) + '</div>';
        }

        // --- Additional sections (empty templates) ---

        if (secOn('wordlist')) {
            var wl = ensureArray(s, '_wordlist', 5, ITEM_FACTORIES.wordlist);
            var solo = wl.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '단어장', 'wordlist');
            h += '<table class="ptb"><tr><th style="width:25%">단어</th><th style="width:30%">뜻</th><th>예문</th></tr>';
            wl.forEach(function (w, i) {
                h += '<tr' + solo + ' data-crud-type="wordlist" data-crud-idx="' + i + '"><td' + E + '>' + (w.word || '') + '</td><td' + E + '>' + (w.pos || '') + '</td><td' + E + '>' + (w.meaning || '') + '</td>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></tr>';
            });
            h += '</table>' + crudAdd('wordlist', wl.length) + '</div>';
        }

        if (secOn('slang')) {
            var sl = ensureArray(s, '_slang', 3, ITEM_FACTORIES.slang);
            var solo = sl.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '구어체·슬랭', 'slang');
            h += '<div class="cb" style="padding:0;overflow:hidden">';
            sl.forEach(function (item, i) {
                h += '<div style="padding:10px 14px;border-bottom:1px solid var(--bd2);display:flex;gap:12px;align-items:baseline;position:relative"' + solo + ' data-crud-type="slang" data-crud-idx="' + i + '">';
                h += '<div style="font-size:12px;font-weight:700;color:var(--ac);flex-shrink:0"' + E + '>' + item.expr + '</div>';
                h += '<div style="font-size:11px;color:var(--t3)"' + E + '>' + item.usage + '</div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
            });
            h += '</div>' + crudAdd('slang', sl.length) + '</div>';
        }

        if (secOn('compare')) {
            var cmp = ensureArray(s, '_compare', 2, function () { return { title: '표현', desc: '뉘앙스 설명' }; });
            var cmpSolo = cmp.length <= 1 ? ' crud-solo' : '';
            var cmpLabels = ['A','B','C','D','E','F','G','H'];
            h += '<div class="ps">' + secH('', '유사 표현 비교', 'compare');
            h += '<div class="scs">';
            cmp.forEach(function (item, i) {
                h += '<div class="sc' + cmpSolo + '" data-crud-type="eng-compare" data-crud-idx="' + i + '"><div class="sc__n">' + (cmpLabels[i] || String(i + 1)) + '</div><div class="sc__t"' + E + '>' + item.title + '</div><div class="sc__p"' + E + '>' + item.desc + '</div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
            });
            h += '</div>' + crudAdd('eng-compare', cmp.length) + '</div>';
        }

        if (secOn('mistakes')) {
            var mk = ensureArray(s, '_mistakes', 3, ITEM_FACTORIES.mistakes);
            var solo = mk.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '틀리기 쉬운 표현', 'mistakes');
            h += '<div class="cb" style="padding:0;overflow:hidden">';
            mk.forEach(function (item, i) {
                h += '<div style="padding:10px 14px;border-bottom:1px solid var(--bd2);display:flex;gap:12px;align-items:center;position:relative"' + solo + ' data-crud-type="mistakes" data-crud-idx="' + i + '">';
                h += '<div style="color:#d4572a;font-weight:700;font-size:11px;flex-shrink:0">✗</div>';
                h += '<div style="flex:1;font-size:12px"' + E + '>' + item.wrong + '</div>';
                h += '<div style="color:var(--ac);font-size:14px;flex-shrink:0">→</div>';
                h += '<div style="color:#1d8a5e;font-weight:700;font-size:11px;flex-shrink:0">✓</div>';
                h += '<div style="flex:1;font-size:12px"' + E + '>' + item.right + '</div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
            });
            h += '</div>' + crudAdd('mistakes', mk.length) + '</div>';
        }

        if (secOn('fillblank')) {
            var fb = ensureArray(s, '_fillblank', 3, ITEM_FACTORIES.fillblank);
            var solo = fb.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '빈칸 채우기', 'fillblank');
            fb.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="fillblank" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__sub">답: _____________</div></div>';
            });
            h += crudAdd('fillblank', fb.length) + '</div>';
        }

        if (secOn('writing')) {
            var wr = ensureArray(s, '_writing', 3, ITEM_FACTORIES['writing-prb']);
            var solo = wr.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '영작 연습', 'writing');
            wr.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="writing-prb" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__a"' + E + '>영어로 작성</div></div>';
            });
            h += crudAdd('writing-prb', wr.length) + '</div>';
        }

        if (secOn('dialogue')) {
            var dl = ensureArray(s, '_dialogue', 4, ITEM_FACTORIES.dialogue);
            var solo = dl.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '대화문', 'dialogue');
            h += '<div class="cb" style="padding:0;overflow:hidden">';
            dl.forEach(function (item, i) {
                var isA = item.role === 'A';
                h += '<div style="padding:10px 14px;border-bottom:1px solid var(--bd2);display:flex;gap:10px;align-items:flex-start;position:relative"' + solo + ' data-crud-type="dialogue" data-crud-idx="' + i + '">';
                h += '<div style="font-size:10px;font-weight:700;color:' + (isA ? 'var(--ac)' : 'var(--t3)') + ';width:16px;flex-shrink:0;padding-top:1px">' + item.role + '</div>';
                h += '<div style="font-size:12px;flex:1"' + E + '>' + item.line + '</div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
            });
            h += '</div>' + crudAdd('dialogue', dl.length) + '</div>';
        }

        if (secOn('dictation')) {
            var dc = ensureLineCount(s, '_dictation');
            h += '<div class="ps">' + secH('', '딕테이션', 'dictation');
            h += '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">선생님이 읽어주는 문장을 듣고 받아 적어보세요.</div>';
            var wlines = '';
            for (var dli = 0; dli < dc; dli++) wlines += '<div class="wl wl--t"></div>';
            h += '<div>' + wlines + '</div>' + crudLines('dictation', dc) + '</div>';
        }

        if (secOn('summary')) {
            h += '<div class="ps">' + secH('', '오늘의 요약', 'summary');
            h += '<div class="cb"><div class="cb__t"' + E + '>오늘 배운 핵심</div>';
            h += '<div class="cb__b"' + E + '>• 핵심 포인트 1\n• 핵심 포인트 2\n• 핵심 포인트 3</div></div></div>';
        }

        if (secOn('memo')) {
            var mc = ensureLineCount(s, '_memo');
            h += '<div class="ps">' + secH('', '메모란', 'memo');
            var mlines = '';
            for (var mli = 0; mli < mc; mli++) mlines += '<div class="wl wl--t"></div>';
            h += '<div>' + mlines + '</div>' + crudLines('memo', mc) + '</div>';
        }

        if (secOn('comment')) {
            h += '<div class="ps">' + secH('', '선생님 코멘트', 'comment');
            h += '<div class="cb" style="border-left-color:#1d8a5e"><div class="cb__t" style="color:#1d8a5e"' + E + '>피드백</div>';
            h += '<div class="cb__b"' + E + '>학생에 대한 피드백을 작성해주세요.</div></div></div>';
        }

        return h + pageFooter(ctx);
    };

    // --- English Reading ---
    renderers['eng-reading'] = function (s, c, ctx) {
        var h = pageHeader(c.series, s.title, s.subtitle, s.num, ctx);

        if (secOn('passage') && s.passage) {
            h += '<div class="ps">' + secH('', '독해 지문', 'passage');
            var paras = s.passage.text.split('\n\n');
            h += '<div class="psg">';
            h += '<div style="font-weight:600;font-size:12px;margin-bottom:8px;color:var(--ac)">' + s.passage.title + '</div>';
            h += '<div' + E + '>' + paras.map(function (p) { return '<p style="margin-bottom:8px">' + p + '</p>'; }).join('') + '</div>';
            h += '</div></div>';
        }

        if (secOn('vocab')) {
            var solo = s.vocab.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '어휘 정리', 'vocab');
            h += '<div class="vg">';
            s.vocab.forEach(function (v, i) {
                h += '<div class="vi' + solo + '" data-crud-type="vocab" data-crud-idx="' + i + '"><div class="vi__t"' + E + '>' + v.term + '</div><div class="vi__d"' + E + '>' + v.def + '</div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
            });
            h += '</div>' + crudAdd('vocab', s.vocab.length) + '</div>';
        }

        if (secOn('structure')) {
            var sq = ensureArray(s, '_structure', 2, ITEM_FACTORIES['structure-q']);
            var solo = sq.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '문장 구조 분석', 'structure');
            sq.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="structure-q" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__a"' + E + '>구조 분석</div></div>';
            });
            h += crudAdd('structure-q', sq.length) + '</div>';
        }

        if (secOn('translate')) {
            var tr = ensureArray(s, '_translate', 3, ITEM_FACTORIES.translate);
            var solo = tr.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '해석 연습', 'translate');
            tr.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="translate" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__a"' + E + '>해석</div></div>';
            });
            h += crudAdd('translate', tr.length) + '</div>';
        }

        if (secOn('questions') && s.questions) {
            var solo = s.questions.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '독해 문제', 'questions');
            s.questions.forEach(function (q, i) {
                h += '<div data-crud-type="questions" data-crud-idx="' + i + '"' + solo + ' style="position:relative">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += renderQ(i + 1, q) + '</div>';
            });
            h += crudAdd('questions', s.questions.length) + '</div>';
        }

        if (secOn('truefalse')) {
            var tf = ensureArray(s, '_truefalse', 3, ITEM_FACTORIES.truefalse);
            var solo = tf.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', 'True / False', 'truefalse');
            tf.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="truefalse" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__sub">T / F : _______</div></div>';
            });
            h += crudAdd('truefalse', tf.length) + '</div>';
        }

        if (secOn('fillblank')) {
            var fb = ensureArray(s, '_fillblank', 3, function () { return { q: '지문 속 핵심 어휘를 빈칸으로. _______' }; });
            var solo = fb.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '빈칸 채우기', 'fillblank');
            fb.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="fillblank" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__sub">답: _____________</div></div>';
            });
            h += crudAdd('fillblank', fb.length) + '</div>';
        }

        if (secOn('summarize')) {
            var sc = ensureLineCount(s, '_summarize');
            h += '<div class="ps">' + secH('', '요약하기', 'summarize');
            h += '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">본문의 핵심 내용을 자신의 말로 요약해보세요.</div>';
            var sl = '';
            for (var sli = 0; sli < sc; sli++) sl += '<div class="wl wl--t"></div>';
            h += '<div>' + sl + '</div>' + crudLines('summarize', sc) + '</div>';
        }

        if (secOn('opinion')) {
            var oc = ensureLineCount(s, '_opinion');
            h += '<div class="ps">' + secH('', '의견 쓰기', 'opinion');
            h += '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">주제에 대한 자신의 생각을 써보세요.</div>';
            var ol = '';
            for (var oli = 0; oli < oc; oli++) ol += '<div class="wl wl--t"></div>';
            h += '<div>' + ol + '</div>' + crudLines('opinion', oc) + '</div>';
        }

        if (secOn('homework')) {
            var hw = ensureArray(s, '_homework', 3, ITEM_FACTORIES.homework);
            var solo = hw.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '숙제', 'homework');
            h += '<ul class="hwl">';
            hw.forEach(function (item, i) {
                h += '<li' + solo + ' data-crud-type="homework" data-crud-idx="' + i + '"><div class="hw__n">' + (i + 1) + '</div><div><div class="hw__t"' + E + '>' + item.title + '</div><div class="hw__d"' + E + '>' + item.desc + '</div></div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></li>';
            });
            h += '</ul>' + crudAdd('homework', hw.length) + '</div>';
        }

        if (secOn('summary')) {
            h += '<div class="ps">' + secH('', '오늘의 요약', 'summary');
            h += '<div class="cb"><div class="cb__t"' + E + '>오늘 배운 핵심</div>';
            h += '<div class="cb__b"' + E + '>• 핵심 포인트 1\n• 핵심 포인트 2</div></div></div>';
        }

        if (secOn('memo')) {
            var mc = ensureLineCount(s, '_memo');
            h += '<div class="ps">' + secH('', '메모란', 'memo');
            var ml = '';
            for (var mli = 0; mli < mc; mli++) ml += '<div class="wl wl--t"></div>';
            h += '<div>' + ml + '</div>' + crudLines('memo', mc) + '</div>';
        }

        return h + pageFooter(ctx);
    };

    // --- English Grammar ---
    renderers['eng-grammar'] = function (s, c, ctx) {
        var h = pageHeader(c.series, s.title, s.subtitle, s.num, ctx);

        if (secOn('rule')) {
            h += '<div class="ps">' + secH('', '핵심 개념', 'rule');
            h += '<div class="cb"><div class="cb__t">' + s.concept.title + '</div><div class="cb__b"' + E + '>' + s.concept.body + '</div></div></div>';
        }

        if (secOn('examples') && s.table) {
            var solo = s.table.rows.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '정리표', 'examples');
            h += '<table class="ptb"><tr>' + s.table.headers.map(function (hd) { return '<th>' + hd + '</th>'; }).join('') + '</tr>';
            s.table.rows.forEach(function (r, i) {
                h += '<tr' + solo + ' data-crud-type="table-rows" data-crud-idx="' + i + '">' + r.map(function (c) { return '<td' + E + '>' + c + '</td>'; }).join('');
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></tr>';
            });
            h += '</table>' + crudAdd('table-rows', s.table.rows.length) + '</div>';
        }

        if (secOn('examples') && s.examples) {
            h += '<div class="ps">' + secH('', '예문', 'examples');
            h += '<div class="cb" style="padding:0;overflow:hidden">';
            s.examples.forEach(function (ex, i) {
                h += '<div style="padding:10px 14px;border-bottom:1px solid var(--bd2)"><div style="font-size:12px;margin-bottom:2px"' + E + '>' + (i + 1) + '. ' + ex.en + '</div><div style="font-size:10px;color:var(--t3)">&nbsp;&nbsp;→ ' + ex.note + '</div></div>';
            });
            h += '</div></div>';
        }

        if (secOn('compare')) {
            h += '<div class="ps">' + secH('', '비교 정리', 'compare');
            h += '<div class="scs">';
            h += '<div class="sc"><div class="sc__n">A</div><div class="sc__t"' + E + '>표현 A</div><div class="sc__p"' + E + '>설명</div></div>';
            h += '<div class="sc"><div class="sc__n">B</div><div class="sc__t"' + E + '>표현 B</div><div class="sc__p"' + E + '>설명</div></div>';
            h += '</div></div>';
        }

        if (secOn('exceptions')) {
            h += '<div class="ps">' + secH('', '예외·주의사항', 'exceptions');
            h += '<div class="cb" style="border-left-color:#f5a623"><div class="cb__t" style="color:#f5a623"' + E + '>주의</div>';
            h += '<div class="cb__b"' + E + '>예외 케이스를 정리하세요.</div></div></div>';
        }

        if (secOn('fillblank')) {
            h += '<div class="ps">' + secH('', '빈칸 채우기', 'fillblank');
            if (s.problems) {
                var solo = s.problems.length <= 1 ? ' crud-solo' : '';
                s.problems.forEach(function (q, i) {
                    h += '<div data-crud-type="problems" data-crud-idx="' + i + '"' + solo + ' style="position:relative">';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                    h += renderQ(i + 1, q) + '</div>';
                });
                h += crudAdd('problems', s.problems.length);
            } else {
                var fb = ensureArray(s, '_fillblank', 3, function () { return { q: '올바른 형태를 채우세요. _______' }; });
                var solo = fb.length <= 1 ? ' crud-solo' : '';
                fb.forEach(function (item, i) {
                    h += '<div class="prb' + solo + '" data-crud-type="fillblank" data-crud-idx="' + i + '">';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                    h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                    h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                    h += '<div class="prb__sub">답: _____________</div></div>';
                });
                h += crudAdd('fillblank', fb.length);
            }
            h += '</div>';
        }

        if (secOn('correct')) {
            var cr = ensureArray(s, '_correct', 3, ITEM_FACTORIES.correct);
            var solo = cr.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '오류 수정', 'correct');
            h += '<div class="cb" style="padding:0;overflow:hidden">';
            cr.forEach(function (item, i) {
                h += '<div style="padding:10px 14px;border-bottom:1px solid var(--bd2);display:flex;gap:12px;align-items:center;position:relative"' + solo + ' data-crud-type="correct" data-crud-idx="' + i + '">';
                h += '<div style="color:#d4572a;font-weight:700;font-size:11px;flex-shrink:0">✗</div>';
                h += '<div style="flex:1;font-size:12px"' + E + '>' + item.wrong + '</div>';
                h += '<div style="color:var(--ac);font-size:14px;flex-shrink:0">→</div>';
                h += '<div style="color:#1d8a5e;font-weight:700;font-size:11px;flex-shrink:0">✓</div>';
                h += '<div style="flex:1;font-size:12px"' + E + '>' + item.right + '</div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
            });
            h += '</div>' + crudAdd('correct', cr.length) + '</div>';
        }

        if (secOn('writing')) {
            var wr = ensureArray(s, '_writing', 3, function () { return { q: '배운 문법으로 문장을 만드세요.' }; });
            var solo = wr.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '문장 만들기', 'writing');
            wr.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="writing-prb" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__a"' + E + '>작성</div></div>';
            });
            h += crudAdd('writing-prb', wr.length) + '</div>';
        }

        if (secOn('choice')) {
            var ch = ensureArray(s, '_choice', 2, ITEM_FACTORIES.choice);
            var solo = ch.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '객관식 문제', 'choice');
            ch.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="choice" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__ch">';
                var marks = ['①', '②', '③', '④'];
                item.options.forEach(function (o, oi) { h += '<div class="prb__c"><span class="prb__cm">' + marks[oi] + '</span><span' + E + '>' + o + '</span></div>'; });
                h += '</div></div>';
            });
            h += crudAdd('choice', ch.length) + '</div>';
        }

        if (secOn('transform')) {
            var tf = ensureArray(s, '_transform', 3, ITEM_FACTORIES.transform);
            var solo = tf.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '문장 변환', 'transform');
            tf.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="transform" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__a"' + E + '>변환</div></div>';
            });
            h += crudAdd('transform', tf.length) + '</div>';
        }

        if (secOn('homework')) {
            var hw = ensureArray(s, '_homework', 3, ITEM_FACTORIES.homework);
            var solo = hw.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '숙제', 'homework');
            h += '<ul class="hwl">';
            hw.forEach(function (item, i) {
                h += '<li' + solo + ' data-crud-type="homework" data-crud-idx="' + i + '"><div class="hw__n">' + (i + 1) + '</div><div><div class="hw__t"' + E + '>' + item.title + '</div><div class="hw__d"' + E + '>' + item.desc + '</div></div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></li>';
            });
            h += '</ul>' + crudAdd('homework', hw.length) + '</div>';
        }

        if (secOn('summary')) {
            h += '<div class="ps">' + secH('', '오늘의 요약', 'summary');
            h += '<div class="cb"><div class="cb__t"' + E + '>핵심 문법 한줄 정리</div>';
            h += '<div class="cb__b"' + E + '>• 핵심 포인트</div></div></div>';
        }

        if (secOn('comment')) {
            h += '<div class="ps">' + secH('', '선생님 코멘트', 'comment');
            h += '<div class="cb" style="border-left-color:#1d8a5e"><div class="cb__t" style="color:#1d8a5e"' + E + '>피드백</div>';
            h += '<div class="cb__b"' + E + '>학생에 대한 피드백을 작성해주세요.</div></div></div>';
        }

        return h + pageFooter(ctx);
    };

    // --- Math ---
    renderers.math = function (s, c, ctx) {
        var h = pageHeader(c.series, s.title, s.subtitle, s.num, ctx);

        // -- 학습 섹션 --
        if (secOn('concept') && s.concept) {
            h += '<div class="ps">' + secH('', '핵심 개념', 'concept');
            var body = s.concept.body.split('\n').map(function (l) { return '<div>' + l + '</div>'; }).join('');
            h += '<div class="cb"><div class="cb__t">' + s.concept.title + '</div><div class="cb__b"' + E + '>' + body + '</div></div></div>';
        }

        if (secOn('strategy')) {
            h += '<div class="ps">' + secH('', '풀이 전략', 'strategy');
            h += '<div class="cb"><div class="cb__t"' + E + '>문제 유형별 접근법</div>';
            h += '<div class="cb__b"' + E + '>• 전략 1: ...\n• 전략 2: ...\n• 전략 3: ...</div></div></div>';
        }

        if (secOn('formula')) {
            h += '<div class="ps">' + secH('', '공식 정리', 'formula');
            h += '<div class="cb" style="text-align:center;padding:16px;border:2px solid var(--ac)">';
            h += '<div class="cb__b" style="font-size:14px;font-weight:700"' + E + '>공식을 입력하세요</div></div></div>';
        }

        if (secOn('proof')) {
            h += '<div class="ps">' + secH('', '증명', 'proof');
            h += '<div class="cb"><div class="cb__t"' + E + '>정리명</div>';
            h += '<div class="cb__b"' + E + '>증명 과정을 작성하세요.</div></div></div>';
        }

        if (secOn('visual')) {
            h += '<div class="ps">' + secH('', '그림·도식', 'visual');
            h += '<div style="height:140px;border:1.5px dashed var(--bd);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--t4);font-size:11px"' + E + '>그래프 / 도형 영역</div></div>';
        }

        if (secOn('tip')) {
            h += '<div class="ps">' + secH('', '풀이 팁', 'tip');
            h += '<div class="cb" style="border-left-color:#f5a623"><div class="cb__t" style="color:#f5a623"' + E + '>TIP</div>';
            h += '<div class="cb__b"' + E + '>풀이 팁을 작성하세요.</div></div></div>';
        }

        // -- 연습 섹션 --
        if (secOn('example')) {
            var ex = ensureArray(s, '_exampleSteps', 3, ITEM_FACTORIES['example-steps']);
            var solo = ex.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '풀이 예제', 'example');
            h += '<div class="cb" style="padding:0;overflow:hidden">';
            ex.forEach(function (item, i) {
                h += '<div style="padding:10px 14px;border-bottom:1px solid var(--bd2);display:flex;gap:10px;position:relative"' + solo + ' data-crud-type="example-steps" data-crud-idx="' + i + '">';
                h += '<div style="font-size:11px;font-weight:700;color:var(--ac);min-width:20px">(' + (i + 1) + ')</div>';
                h += '<div style="flex:1;font-size:12px"' + E + '>' + item.step + '</div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
            });
            h += '</div>' + crudAdd('example-steps', ex.length) + '</div>';
        }

        if (secOn('practice') && s.problems) {
            var solo = s.problems.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '연습 문제', 'practice');
            s.problems.forEach(function (q, i) {
                h += '<div data-crud-type="problems" data-crud-idx="' + i + '"' + solo + ' style="position:relative">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += renderQ(i + 1, q) + '</div>';
            });
            h += crudAdd('problems', s.problems.length) + '</div>';
        }

        if (secOn('guided')) {
            var gd = ensureArray(s, '_guided', 3, ITEM_FACTORIES.guided);
            var solo = gd.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '유도 풀이', 'guided');
            gd.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="guided" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">Step ' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__a"' + E + '>풀이</div></div>';
            });
            h += crudAdd('guided', gd.length) + '</div>';
        }

        if (secOn('word')) {
            var wp = ensureArray(s, '_wordProb', 2, ITEM_FACTORIES['word-prb']);
            var solo = wp.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '서술형 문제', 'word');
            wp.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="word-prb" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__a"' + E + '>풀이 / 답</div></div>';
            });
            h += crudAdd('word-prb', wp.length) + '</div>';
        }

        if (secOn('challenge')) {
            h += '<div class="ps">' + secH('', '도전 문제', 'challenge');
            h += '<div class="prb"><div class="prb__h"><div class="prb__n">★</div>';
            h += '<div class="prb__q"' + E + '>최고 난이도 문제를 입력하세요.</div></div>';
            h += '<div class="prb__a"' + E + '>풀이 / 답</div></div></div>';
        }

        if (secOn('mock')) {
            var mk = ensureArray(s, '_mock', 3, ITEM_FACTORIES.mock);
            var solo = mk.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '실전 모의', 'mock');
            mk.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="mock" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__a"' + E + '>풀이 / 답</div></div>';
            });
            h += crudAdd('mock', mk.length) + '</div>';
        }

        if (secOn('speed')) {
            var sp = ensureArray(s, '_speed', 4, ITEM_FACTORIES.speed);
            var solo = sp.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '시간 측정 연습', 'speed');
            h += '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">제한 시간: ___분</div>';
            sp.forEach(function (item, i) {
                h += '<div class="prb' + solo + '" data-crud-type="speed" data-crud-idx="' + i + '">';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                h += '<div class="prb__sub">답: _____________</div></div>';
            });
            h += crudAdd('speed', sp.length) + '</div>';
        }

        if (secOn('mistake')) {
            var mm = ensureArray(s, '_mistakeMath', 3, ITEM_FACTORIES['mistake-math']);
            var solo = mm.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '오답 노트', 'mistake');
            h += '<div class="cb" style="padding:0;overflow:hidden">';
            mm.forEach(function (item, i) {
                h += '<div style="padding:10px 14px;border-bottom:1px solid var(--bd2);position:relative"' + solo + ' data-crud-type="mistake-math" data-crud-idx="' + i + '">';
                h += '<div style="font-size:11px;font-weight:600;color:#d4572a;margin-bottom:4px"' + E + '>' + item.wrong + '</div>';
                h += '<div style="font-size:11px;color:#1d8a5e"' + E + '>' + item.right + '</div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
            });
            h += '</div>' + crudAdd('mistake-math', mm.length) + '</div>';
        }

        if (secOn('review')) {
            var rv = ensureArray(s, '_review', 3, ITEM_FACTORIES['review-rows']);
            var solo = rv.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '오답 복기', 'review');
            h += '<table class="ptb"><tr><th style="width:8%">번호</th><th style="width:42%">틀린 부분</th><th style="width:50%">수정·복기</th></tr>';
            rv.forEach(function (item, i) {
                h += '<tr' + solo + ' data-crud-type="review-rows" data-crud-idx="' + i + '"><td>' + (i + 1) + '</td><td' + E + '>' + (item.wrong || '') + '</td><td' + E + '>' + (item.fix || '') + '</td>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></tr>';
            });
            h += '</table>' + crudAdd('review-rows', rv.length) + '</div>';
        }

        // -- 마무리 섹션 --
        if (secOn('homework')) {
            var hw = ensureArray(s, '_homework', 3, ITEM_FACTORIES.homework);
            var solo = hw.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '숙제', 'homework');
            h += '<ul class="hwl">';
            hw.forEach(function (item, i) {
                h += '<li' + solo + ' data-crud-type="homework" data-crud-idx="' + i + '"><div class="hw__n">' + (i + 1) + '</div><div><div class="hw__t"' + E + '>' + item.title + '</div><div class="hw__d"' + E + '>' + item.desc + '</div></div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></li>';
            });
            h += '</ul>' + crudAdd('homework', hw.length) + '</div>';
        }

        if (secOn('summary')) {
            h += '<div class="ps">' + secH('', '오늘의 요약', 'summary');
            h += '<div class="cb"><div class="cb__t"' + E + '>오늘 배운 핵심</div>';
            h += '<div class="cb__b"' + E + '>• 핵심 포인트 1\n• 핵심 포인트 2\n• 핵심 포인트 3</div></div></div>';
        }

        if (secOn('memo')) {
            var mc = ensureLineCount(s, '_memo');
            h += '<div class="ps">' + secH('', '풀이 메모', 'memo');
            var ml = '';
            for (var mli = 0; mli < mc; mli++) ml += '<div class="wl wl--t"></div>';
            h += '<div>' + ml + '</div>' + crudLines('memo', mc) + '</div>';
        }

        if (secOn('comment')) {
            h += '<div class="ps">' + secH('', '선생님 코멘트', 'comment');
            h += '<div class="cb" style="border-left-color:#1d8a5e"><div class="cb__t" style="color:#1d8a5e"' + E + '>피드백</div>';
            h += '<div class="cb__b"' + E + '>학생에 대한 피드백을 작성해주세요.</div></div></div>';
        }

        return h + pageFooter(ctx);
    };

    // --- Korean ---
    renderers.korean = function (s, c, ctx) {
        var h = pageHeader(c.series, s.title, s.subtitle, s.num, ctx);
        var cn = window.__classnote || {};
        var krType = cn.type || 'literature';

        // ======= 문학 =======
        if (krType === 'literature') {
            if (secOn('text') && s.poem) {
                h += '<div class="ps">' + secH('', '작품 본문', 'text');
                var lines = s.poem.text.split('\n').map(function (l) { return l === '' ? '<br>' : l; }).join('<br>');
                h += '<div class="psg" style="text-align:center;font-family:var(--kr);font-size:14px;line-height:2.2">';
                h += '<div style="font-weight:700;font-size:15px;margin-bottom:12px;color:var(--ac)">' + s.poem.title + '</div>';
                h += '<div style="font-size:11px;color:var(--t3);margin-bottom:16px">' + s.poem.author + '</div>';
                h += '<div' + E + '>' + lines + '</div>';
                h += '</div></div>';
            }

            if (secOn('background')) {
                h += '<div class="ps">' + secH('', '작품 배경', 'background');
                h += '<div class="cb"><div class="cb__t"' + E + '>작가·시대·장르</div>';
                h += '<div class="cb__b"' + E + '>작품의 배경 정보를 입력하세요.</div></div></div>';
            }

            if (secOn('analysis') && s.analysis) {
                var solo = s.analysis.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '작품 분석', 'analysis');
                h += '<table class="ptb"><tr><th style="width:25%">항목</th><th>내용</th></tr>';
                s.analysis.forEach(function (r, i) {
                    h += '<tr' + solo + ' data-crud-type="analysis" data-crud-idx="' + i + '"><td style="font-weight:600"' + E + '>' + r[0] + '</td><td' + E + '>' + (r[1] || '<span style="color:var(--t4);font-size:10px">클릭하여 작성</span>') + '</td>';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></tr>';
                });
                h += '</table>' + crudAdd('analysis', s.analysis.length) + '</div>';
            }

            if (secOn('vocab')) {
                var vocabArr = s.vocab || ensureArray(s, 'vocab', 4, ITEM_FACTORIES.vocab);
                var solo = vocabArr.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '어휘·어구', 'vocab');
                h += '<div class="vg">';
                vocabArr.forEach(function (v, i) {
                    h += '<div class="vi' + solo + '" data-crud-type="vocab" data-crud-idx="' + i + '"><div class="vi__t"' + E + '>' + v.term + '</div><div class="vi__d"' + E + '>' + v.def + '</div>';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
                });
                h += '</div>' + crudAdd('vocab', vocabArr.length) + '</div>';
            }

            if (secOn('questions') && s.questions) {
                var solo = s.questions.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '감상 문제', 'questions');
                s.questions.forEach(function (q, i) {
                    h += '<div data-crud-type="questions" data-crud-idx="' + i + '"' + solo + ' style="position:relative">';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                    h += renderQ(i + 1, q) + '</div>';
                });
                h += crudAdd('questions', s.questions.length) + '</div>';
            }

            if (secOn('compare')) {
                var cmp = ensureArray(s, '_compareRows', 3, function () { return { aspect: '', a: '', b: '' }; });
                var solo = cmp.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '작품 비교', 'compare');
                h += '<table class="ptb"><tr><th style="width:20%">항목</th><th style="width:40%">작품 A</th><th style="width:40%">작품 B</th></tr>';
                var defaultAspects = ['주제', '화자/시점', '표현 기법'];
                cmp.forEach(function (item, i) {
                    h += '<tr' + solo + ' data-crud-type="compare-rows" data-crud-idx="' + i + '"><td style="font-weight:600"' + E + '>' + (item.aspect || defaultAspects[i] || '') + '</td><td' + E + '>' + (item.a || '') + '</td><td' + E + '>' + (item.b || '') + '</td>';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></tr>';
                });
                h += '</table>' + crudAdd('compare-rows', cmp.length) + '</div>';
            }

            if (secOn('writing')) {
                var wc = ensureLineCount(s, '_writingLines');
                h += '<div class="ps">' + secH('', '감상문 쓰기', 'writing');
                h += '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">' + (s.writingPrompt || '작품을 읽고 자신의 감상을 자유롭게 써보세요.') + '</div>';
                var wl = '';
                for (var wli = 0; wli < wc; wli++) wl += '<div class="wl wl--t"></div>';
                h += '<div>' + wl + '</div>' + crudLines('writing-lines', wc) + '</div>';
            }
        }

        // ======= 문법 (grammar-kr) =======
        if (krType === 'grammar-kr') {
            if (secOn('rule')) {
                h += '<div class="ps">' + secH('', '문법 규칙', 'rule');
                h += '<div class="cb"><div class="cb__t"' + E + '>핵심 문법 규칙</div>';
                h += '<div class="cb__b"' + E + '>문법 규칙을 정리하세요.</div></div></div>';
            }

            if (secOn('examples')) {
                var ekr = ensureArray(s, '_examplesKr', 3, ITEM_FACTORIES['examples-kr']);
                var solo = ekr.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '예시', 'examples');
                h += '<div class="cb" style="padding:0;overflow:hidden">';
                ekr.forEach(function (item, i) {
                    h += '<div style="padding:10px 14px;border-bottom:1px solid var(--bd2);position:relative"' + solo + ' data-crud-type="examples-kr" data-crud-idx="' + i + '">';
                    h += '<div style="font-size:12px;margin-bottom:2px"' + E + '>' + (i + 1) + '. ' + item.sentence + '</div>';
                    h += '<div style="font-size:10px;color:var(--t3)">&nbsp;&nbsp;→ 설명</div>';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
                });
                h += '</div>' + crudAdd('examples-kr', ekr.length) + '</div>';
            }

            if (secOn('compare')) {
                h += '<div class="ps">' + secH('', '혼동 구분', 'compare');
                h += '<div class="scs">';
                h += '<div class="sc"><div class="sc__n">A</div><div class="sc__t"' + E + '>표현 A</div><div class="sc__p"' + E + '>사용법 설명</div></div>';
                h += '<div class="sc"><div class="sc__n">B</div><div class="sc__t"' + E + '>표현 B</div><div class="sc__p"' + E + '>사용법 설명</div></div>';
                h += '</div></div>';
            }

            if (secOn('exceptions')) {
                h += '<div class="ps">' + secH('', '예외·주의', 'exceptions');
                h += '<div class="cb" style="border-left-color:#f5a623"><div class="cb__t" style="color:#f5a623"' + E + '>주의사항</div>';
                h += '<div class="cb__b"' + E + '>불규칙·예외 케이스를 정리하세요.</div></div></div>';
            }

            if (secOn('fillblank')) {
                var fb = ensureArray(s, '_fillblank', 3, function () { return { q: '문장에서 알맞은 표현을 채우세요. _______' }; });
                var solo = fb.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '빈칸 채우기', 'fillblank');
                fb.forEach(function (item, i) {
                    h += '<div class="prb' + solo + '" data-crud-type="fillblank" data-crud-idx="' + i + '">';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                    h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                    h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                    h += '<div class="prb__sub">답: _____________</div></div>';
                });
                h += crudAdd('fillblank', fb.length) + '</div>';
            }

            if (secOn('correct')) {
                var cr = ensureArray(s, '_correct', 3, ITEM_FACTORIES.correct);
                var solo = cr.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '맞춤법 교정', 'correct');
                h += '<div class="cb" style="padding:0;overflow:hidden">';
                cr.forEach(function (item, i) {
                    h += '<div style="padding:10px 14px;border-bottom:1px solid var(--bd2);display:flex;gap:12px;align-items:center;position:relative"' + solo + ' data-crud-type="correct" data-crud-idx="' + i + '">';
                    h += '<div style="color:#d4572a;font-weight:700;font-size:11px;flex-shrink:0">✗</div>';
                    h += '<div style="flex:1;font-size:12px"' + E + '>' + item.wrong + '</div>';
                    h += '<div style="color:var(--ac);font-size:14px;flex-shrink:0">→</div>';
                    h += '<div style="color:#1d8a5e;font-weight:700;font-size:11px;flex-shrink:0">✓</div>';
                    h += '<div style="flex:1;font-size:12px"' + E + '>' + item.right + '</div>';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
                });
                h += '</div>' + crudAdd('correct', cr.length) + '</div>';
            }

            if (secOn('classify')) {
                var cl = ensureArray(s, '_classify', 4, ITEM_FACTORIES['classify-rows']);
                var solo = cl.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '분류하기', 'classify');
                h += '<table class="ptb"><tr><th>단어/표현</th><th>품사/문장성분</th><th>설명</th></tr>';
                cl.forEach(function (item, i) {
                    h += '<tr' + solo + ' data-crud-type="classify-rows" data-crud-idx="' + i + '"><td' + E + '>' + (item.word || '') + '</td><td' + E + '>' + (item.type || '') + '</td><td' + E + '>' + (item.note || '') + '</td>';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></tr>';
                });
                h += '</table>' + crudAdd('classify-rows', cl.length) + '</div>';
            }

            if (secOn('choice')) {
                var ch = ensureArray(s, '_choice', 2, ITEM_FACTORIES.choice);
                var solo = ch.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '객관식 문제', 'choice');
                ch.forEach(function (item, i) {
                    h += '<div class="prb' + solo + '" data-crud-type="choice" data-crud-idx="' + i + '">';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button>';
                    h += '<div class="prb__h"><div class="prb__n">' + (i + 1) + '</div>';
                    h += '<div class="prb__q"' + E + '>' + item.q + '</div></div>';
                    h += '<div class="prb__ch">';
                    var marks = ['①', '②', '③', '④'];
                    item.options.forEach(function (o, oi) { h += '<div class="prb__c"><span class="prb__cm">' + marks[oi] + '</span><span' + E + '>' + o + '</span></div>'; });
                    h += '</div></div>';
                });
                h += crudAdd('choice', ch.length) + '</div>';
            }
        }

        // ======= 작문 (writing-kr) =======
        if (krType === 'writing-kr') {
            if (secOn('theory')) {
                h += '<div class="ps">' + secH('', '작문 이론', 'theory');
                h += '<div class="cb"><div class="cb__t"' + E + '>글쓰기 원칙</div>';
                h += '<div class="cb__b"' + E + '>작문 이론을 정리하세요.</div></div></div>';
            }

            if (secOn('structure')) {
                h += '<div class="ps">' + secH('', '글 구조', 'structure');
                h += '<div class="cb" style="padding:0;overflow:hidden">';
                var parts = ['서론', '본론', '결론'];
                parts.forEach(function (p, i) {
                    h += '<div style="padding:10px 14px;border-bottom:1px solid var(--bd2);display:flex;gap:12px">';
                    h += '<div style="font-size:11px;font-weight:700;color:var(--ac);min-width:32px">' + p + '</div>';
                    h += '<div style="flex:1;font-size:12px"' + E + '>내용을 입력하세요.</div></div>';
                });
                h += '</div></div>';
            }

            if (secOn('sample')) {
                h += '<div class="ps">' + secH('', '모범 글', 'sample');
                h += '<div class="psg"><div' + E + '>모범 글을 입력하세요. 잘 쓴 글의 예시를 보여주세요.</div></div></div>';
            }

            if (secOn('vocab')) {
                var vocabArr = s.vocab || ensureArray(s, 'vocab', 4, ITEM_FACTORIES.vocab);
                var solo = vocabArr.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '표현·어휘', 'vocab');
                h += '<div class="vg">';
                vocabArr.forEach(function (v, i) {
                    h += '<div class="vi' + solo + '" data-crud-type="vocab" data-crud-idx="' + i + '"><div class="vi__t"' + E + '>' + v.term + '</div><div class="vi__d"' + E + '>' + v.def + '</div>';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></div>';
                });
                h += '</div>' + crudAdd('vocab', vocabArr.length) + '</div>';
            }

            if (secOn('outline')) {
                var ol = ensureArray(s, '_outline', 4, function (i) {
                    var names = ['서론', '본론 1', '본론 2', '결론'];
                    return { part: names[i] || '', content: '' };
                });
                var solo = ol.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '개요 작성', 'outline');
                h += '<table class="ptb"><tr><th style="width:20%">단락</th><th>핵심 내용</th></tr>';
                ol.forEach(function (item, i) {
                    h += '<tr' + solo + ' data-crud-type="outline-rows" data-crud-idx="' + i + '"><td style="font-weight:600"' + E + '>' + (item.part || '') + '</td><td' + E + '>' + (item.content || '') + '</td>';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></tr>';
                });
                h += '</table>' + crudAdd('outline-rows', ol.length) + '</div>';
            }

            if (secOn('draft')) {
                var dc = ensureLineCount(s, '_draft');
                h += '<div class="ps">' + secH('', '초고 쓰기', 'draft');
                h += '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">아래에 글을 작성해보세요.</div>';
                var dl = '';
                for (var dli = 0; dli < dc; dli++) dl += '<div class="wl wl--t"></div>';
                h += '<div>' + dl + '</div>' + crudLines('draft', dc) + '</div>';
            }

            if (secOn('revise')) {
                var rv = ensureArray(s, '_revise', 3, ITEM_FACTORIES['revise-rows']);
                var solo = rv.length <= 1 ? ' crud-solo' : '';
                h += '<div class="ps">' + secH('', '퇴고 연습', 'revise');
                h += '<table class="ptb"><tr><th style="width:45%">원문</th><th style="width:10%"></th><th style="width:45%">수정</th></tr>';
                rv.forEach(function (item, i) {
                    h += '<tr' + solo + ' data-crud-type="revise-rows" data-crud-idx="' + i + '"><td' + E + '>' + (item.original || '') + '</td><td style="text-align:center;color:var(--ac)">→</td><td' + E + '>' + (item.revised || '') + '</td>';
                    h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></tr>';
                });
                h += '</table>' + crudAdd('revise-rows', rv.length) + '</div>';
            }

            if (secOn('peer')) {
                h += '<div class="ps">' + secH('', '동료 평가', 'peer');
                h += '<table class="ptb"><tr><th style="width:30%">평가 항목</th><th>피드백</th></tr>';
                var evalItems = ['내용 전달', '문장 구조', '맞춤법·문법'];
                evalItems.forEach(function (it) {
                    h += '<tr><td style="font-weight:600">' + it + '</td><td' + E + '></td></tr>';
                });
                h += '</table></div>';
            }

            if (secOn('prompt')) {
                h += '<div class="ps">' + secH('', '글감 제시', 'prompt');
                h += '<div class="cb" style="border-left-color:#f5a623"><div class="cb__t" style="color:#f5a623"' + E + '>작문 주제</div>';
                h += '<div class="cb__b"' + E + '>주제 또는 상황을 제시하세요.</div></div></div>';
            }
        }

        // ======= 마무리 (공통) =======
        if (secOn('homework')) {
            var hw = ensureArray(s, '_homework', 3, ITEM_FACTORIES.homework);
            var solo = hw.length <= 1 ? ' crud-solo' : '';
            h += '<div class="ps">' + secH('', '숙제', 'homework');
            h += '<ul class="hwl">';
            hw.forEach(function (item, i) {
                h += '<li' + solo + ' data-crud-type="homework" data-crud-idx="' + i + '"><div class="hw__n">' + (i + 1) + '</div><div><div class="hw__t"' + E + '>' + item.title + '</div><div class="hw__d"' + E + '>' + item.desc + '</div></div>';
                h += '<button class="crud-x" data-crud-action="remove" aria-label="삭제">&times;</button></li>';
            });
            h += '</ul>' + crudAdd('homework', hw.length) + '</div>';
        }

        if (secOn('summary')) {
            h += '<div class="ps">' + secH('', '오늘의 요약', 'summary');
            h += '<div class="cb"><div class="cb__t"' + E + '>오늘 배운 핵심</div>';
            h += '<div class="cb__b"' + E + '>• 핵심 포인트 1\n• 핵심 포인트 2\n• 핵심 포인트 3</div></div></div>';
        }

        if (secOn('memo')) {
            var mc = ensureLineCount(s, '_memo');
            h += '<div class="ps">' + secH('', '메모란', 'memo');
            var ml = '';
            for (var mli = 0; mli < mc; mli++) ml += '<div class="wl wl--t"></div>';
            h += '<div>' + ml + '</div>' + crudLines('memo', mc) + '</div>';
        }

        if (secOn('comment')) {
            h += '<div class="ps">' + secH('', '선생님 코멘트', 'comment');
            h += '<div class="cb" style="border-left-color:#1d8a5e"><div class="cb__t" style="color:#1d8a5e"' + E + '>피드백</div>';
            h += '<div class="cb__b"' + E + '>학생에 대한 피드백을 작성해주세요.</div></div></div>';
        }

        return h + pageFooter(ctx);
    };

    // =========================================
    // HELPERS
    // =========================================

    function pageHeader(series, title, subtitle, num, ctx) {
        var h = '<div class="p-header"><div class="p-header__left">';
        if (ctx.brand) h += '<div class="p-brand">' + esc(ctx.brand) + '</div>';
        h += '<div class="p-series">' + esc(series) + '</div>';
        h += '<div class="p-title"' + E + '>' + esc(title) + '</div>';
        h += '<div class="p-subtitle"' + E + '>' + esc(subtitle) + '</div>';
        h += '</div><div class="p-header__right">';
        if (ctx.logoData) {
            h += '<img class="p-logo" src="' + ctx.logoData + '" alt="로고">';
        }
        h += '<div class="p-header__nav">';
        h += '<button class="p-nav" id="prevBtn" onclick="window.__go(-1)" aria-label="이전 세션">←</button>';
        h += '<div class="p-badge">Session ' + num + '</div>';
        h += '<button class="p-nav" id="nextBtn" onclick="window.__go(1)" aria-label="다음 세션">→</button>';
        h += '</div>';
        h += '<div class="p-meta">';
        if (ctx.date) h += '<div>' + ctx.date + '</div>';
        if (ctx.teacherName) h += '<div>선생님: <strong>' + esc(ctx.teacherName) + '</strong></div>';
        if (ctx.studentName) {
            h += '<div>학생: <strong>' + esc(ctx.studentName) + '</strong></div>';
        }
        h += '</div>';
        h += '</div></div>';
        return h;
    }

    function pageFooter(ctx) {
        var left = ctx.brand ? esc(ctx.brand) : '';
        var r = ctx.teacherName ? esc(ctx.teacherName) + ' 선생님' : '';
        return '<div class="pf"><span>' + left + '</span><span>' + r + '</span></div>';
    }

    function secH(num, name, key, secIdx) {
        var cn = window.__classnote;
        // Individual phrase sections use their own name directly, not sectionNames
        var display = (secIdx === undefined && key && cn && cn.sectionNames && cn.sectionNames[key]) ? cn.sectionNames[key] : name;
        var keyAttr = key ? ' data-sec-key="' + key + '"' : '';
        var secIdxAttr = (secIdx !== undefined) ? ' data-sec-idx="' + secIdx + '"' : '';
        return '<div class="psh"' + keyAttr + secIdxAttr + '>' + (num ? '<span class="psh__n">' + num + '</span>' : '') + '<span class="psh__t"' + E + '>' + display + '</span></div>';
    }

    function renderQ(num, item) {
        var h = '<div class="prb"><div class="prb__h"><div class="prb__n">' + num + '</div>';
        h += '<div class="prb__q"' + E + '>' + (item.q || '').replace(/\n/g, '<br>') + '</div></div>';
        if (item.choices) {
            var m = ['①', '②', '③', '④'];
            h += '<div class="prb__ch">';
            item.choices.forEach(function (c, i) { h += '<div class="prb__c"><span class="prb__cm">' + m[i] + '</span><span' + E + '>' + c + '</span></div>'; });
            h += '</div>';
        }
        if (item.sub) h += '<div class="prb__sub">' + item.sub + '</div>';
        if (item.answer) h += '<div class="prb__a"' + E + '>풀이 / 답</div>';
        h += '</div>';
        return h;
    }

    function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    // =========================================
    // ITEM CRUD — RUNTIME LOGIC
    // =========================================

    function _ctEl(el) {
        if (!el) return '';
        var clone = el.cloneNode(true);
        clone.querySelectorAll('br').forEach(function (br) { br.replaceWith('\n'); });
        clone.querySelectorAll('div,p').forEach(function (d) { d.before('\n'); });
        return clone.textContent.trim();
    }
    function _ct(parent, sel) {
        return _ctEl(parent.querySelector(sel));
    }

    function resolveArray(session, type, secIdx) {
        switch (type) {
            case 'phrases': return session.sections && session.sections[secIdx] ? session.sections[secIdx].phrases : null;
            case 'vocab': return session.vocab;
            case 'scenarios': return session.scenarios;
            case 'homework': return session.homework || session._homework;
            case 'questions': return session.questions;
            case 'problems': return session.problems;
            case 'analysis': return session.analysis;
            case 'table-rows': return session.table ? session.table.rows : null;
            default:
                var k = CRUD_KEY_MAP[type] || ('_' + type);
                return session[k] || null;
        }
    }

    function resolveLineKey(type) {
        return CRUD_KEY_MAP[type] || ('_' + type);
    }

    var SYNC_HANDLERS = {
        phrases: function (el) {
            var en = el.querySelector('.pl__en');
            var ko = el.querySelector('.pl__ko');
            if (en && ko) return _ctEl(en) + '\n' + _ctEl(ko);
            var span = el.querySelector('[contenteditable]');
            return span ? _ctEl(span) : el.textContent.trim();
        },
        vocab: function (el) { return { term: _ct(el, '.vi__t'), def: _ct(el, '.vi__d') }; },
        scenarios: function (el, ex) { return { num: ex.num || '', title: _ct(el, '.sc__t'), prompt: _ct(el, '.sc__p') }; },
        homework: function (el) { return { title: _ct(el, '.hw__t'), desc: _ct(el, '.hw__d') }; },
        'eng-compare': function (el) { return { title: _ct(el, '.sc__t'), desc: _ct(el, '.sc__p') }; },
        fillblank: function (el) { return { q: _ct(el, '.prb__q') }; },
        'writing-prb': function (el) { return { q: _ct(el, '.prb__q') }; },
        translate: function (el) { return { q: _ct(el, '.prb__q') }; },
        'structure-q': function (el) { return { q: _ct(el, '.prb__q') }; },
        truefalse: function (el) { return { q: _ct(el, '.prb__q') }; },
        transform: function (el) { return { q: _ct(el, '.prb__q') }; },
        guided: function (el) { return { q: _ct(el, '.prb__q') }; },
        'word-prb': function (el) { return { q: _ct(el, '.prb__q') }; },
        speed: function (el) { return { q: _ct(el, '.prb__q') }; },
        mock: function (el) { return { q: _ct(el, '.prb__q') }; },
        dialogue: function (el, ex) {
            var eds = el.querySelectorAll('[contenteditable]');
            return { role: ex.role || 'A', line: eds[0] ? eds[0].textContent.trim() : '' };
        },
        mistakes: function (el) {
            var eds = el.querySelectorAll('[contenteditable]');
            return { wrong: eds[0] ? eds[0].textContent.trim() : '', right: eds[1] ? eds[1].textContent.trim() : '' };
        },
        correct: function (el) {
            var eds = el.querySelectorAll('[contenteditable]');
            return { wrong: eds[0] ? eds[0].textContent.trim() : '', right: eds[1] ? eds[1].textContent.trim() : '' };
        },
        slang: function (el) {
            var eds = el.querySelectorAll('[contenteditable]');
            return { expr: eds[0] ? eds[0].textContent.trim() : '', usage: eds[1] ? eds[1].textContent.trim() : '' };
        },
        wordlist: function (el) {
            var tds = el.querySelectorAll('td');
            return { word: tds[0] ? tds[0].textContent.trim() : '', pos: tds[1] ? tds[1].textContent.trim() : '', meaning: tds[2] ? tds[2].textContent.trim() : '' };
        },
        'example-steps': function (el) {
            var eds = el.querySelectorAll('[contenteditable]');
            return { step: eds[0] ? eds[0].textContent.trim() : '' };
        },
        'mistake-math': function (el) {
            var eds = el.querySelectorAll('[contenteditable]');
            return { wrong: eds[0] ? eds[0].textContent.trim() : '', right: eds[1] ? eds[1].textContent.trim() : '' };
        },
        'review-rows': function (el) {
            var tds = el.querySelectorAll('td');
            return { num: '', wrong: tds[1] ? tds[1].textContent.trim() : '', fix: tds[2] ? tds[2].textContent.trim() : '' };
        },
        'examples-kr': function (el) {
            var eds = el.querySelectorAll('[contenteditable]');
            return { sentence: eds[0] ? eds[0].textContent.trim() : '' };
        },
        'classify-rows': function (el) {
            var tds = el.querySelectorAll('td');
            return { word: tds[0] ? tds[0].textContent.trim() : '', type: tds[1] ? tds[1].textContent.trim() : '', note: tds[2] ? tds[2].textContent.trim() : '' };
        },
        'compare-rows': function (el) {
            var tds = el.querySelectorAll('td');
            return { aspect: tds[0] ? tds[0].textContent.trim() : '', a: tds[1] ? tds[1].textContent.trim() : '', b: tds[2] ? tds[2].textContent.trim() : '' };
        },
        'outline-rows': function (el) {
            var tds = el.querySelectorAll('td');
            return { part: tds[0] ? tds[0].textContent.trim() : '', content: tds[1] ? tds[1].textContent.trim() : '' };
        },
        'revise-rows': function (el) {
            var tds = el.querySelectorAll('td');
            return { original: tds[0] ? tds[0].textContent.trim() : '', revised: tds[2] ? tds[2].textContent.trim() : '' };
        },
        questions: function (el, ex) {
            var q = _ct(el, '.prb__q');
            var choices = ex.choices ? [] : undefined;
            if (choices) {
                el.querySelectorAll('.prb__c span[contenteditable]').forEach(function (s) { choices.push(s.textContent.trim()); });
            }
            return { q: q, choices: choices, sub: ex.sub, answer: ex.answer };
        },
        problems: function (el, ex) {
            var q = _ct(el, '.prb__q');
            var choices = ex.choices ? [] : undefined;
            if (choices) {
                el.querySelectorAll('.prb__c span[contenteditable]').forEach(function (s) { choices.push(s.textContent.trim()); });
            }
            return { q: q, choices: choices, sub: ex.sub, answer: ex.answer };
        },
        analysis: function (el) {
            var tds = el.querySelectorAll('td');
            return [tds[0] ? tds[0].textContent.trim() : '', tds[1] ? tds[1].textContent.trim() : ''];
        },
        'table-rows': function (el) {
            var tds = el.querySelectorAll('td');
            var row = [];
            tds.forEach(function (td) { row.push(td.textContent.trim()); });
            return row;
        },
        choice: function (el) {
            var q = _ct(el, '.prb__q');
            var options = [];
            el.querySelectorAll('.prb__c span[contenteditable]').forEach(function (s) { options.push(s.textContent.trim()); });
            return { q: q, options: options };
        }
    };

    function syncEditablesToSession() {
        var session = getSession();
        if (!session) return;
        var items = document.querySelectorAll('[data-crud-type][data-crud-idx]');
        items.forEach(function (el) {
            var type = el.getAttribute('data-crud-type');
            var idx = parseInt(el.getAttribute('data-crud-idx'), 10);
            var secIdx = parseInt(el.getAttribute('data-crud-sec') || '0', 10);
            var arr = resolveArray(session, type, secIdx);
            if (!arr || idx >= arr.length) return;
            var syncer = SYNC_HANDLERS[type];
            if (syncer) {
                arr[idx] = syncer(el, arr[idx]);
            }
        });

        // Sync page header editables (title, subtitle, series)
        var titleEl = document.querySelector('.p-title[contenteditable]');
        if (titleEl) session.title = titleEl.textContent.trim();
        var subtitleEl = document.querySelector('.p-subtitle[contenteditable]');
        if (subtitleEl) session.subtitle = subtitleEl.textContent.trim();
        var seriesEl = document.querySelector('.p-series[contenteditable]');
        if (seriesEl) {
            var course = getCourse();
            if (course) course.series = seriesEl.textContent.trim();
        }

        // Sync section header editables (sectionNames + individual phrase section names)
        var cn = window.__classnote;
        if (cn) {
            if (!cn.sectionNames) cn.sectionNames = {};
            document.querySelectorAll('.psh[data-sec-key]').forEach(function (psh) {
                var tEl = psh.querySelector('.psh__t[contenteditable]');
                if (!tEl) return;
                var key = psh.getAttribute('data-sec-key');
                var secIdxStr = psh.getAttribute('data-sec-idx');
                var val = tEl.textContent.trim();

                // Individual phrase section names → session.sections[i].name
                if (key === 'phrases' && secIdxStr !== null) {
                    var si = parseInt(secIdxStr, 10);
                    if (session.sections && session.sections[si]) {
                        session.sections[si].name = val;
                    }
                } else if (key) {
                    cn.sectionNames[key] = val;
                }
            });
        }
    }

    function _scrollContainer() { return document.querySelector('.preview') || document.documentElement; }

    function addItem(type, secIdx) {
        syncEditablesToSession();
        var session = getSession();
        if (!session) return;

        var sc = _scrollContainer(), scrollY = sc.scrollTop;

        // Line-count items
        if (LINE_DEFAULTS[type] !== undefined) {
            var lk = resolveLineKey(type);
            ensureLineCount(session, lk);
            if (session[lk] < (ITEM_MAX[type] || 10)) {
                session[lk]++;
                renderPage();
                sc.scrollTop = scrollY;
            }
            return;
        }

        var arr = resolveArray(session, type, secIdx);
        var factory = ITEM_FACTORIES[type];
        var max = ITEM_MAX[type] || 6;
        if (!arr || !factory || arr.length >= max) return;
        // table-rows: match column count of existing rows
        if (type === 'table-rows' && arr.length > 0) {
            var cols = arr[0].length || 3;
            var newRow = [];
            for (var ri = 0; ri < cols; ri++) newRow.push('');
            arr.push(newRow);
        } else {
            arr.push(factory(arr.length));
        }
        renderPage();
        // Restore scroll & focus the newly added item
        requestAnimationFrame(function () {
            sc.scrollTop = scrollY;
            var selector = '[data-crud-type="' + type + '"]';
            if (secIdx !== undefined) selector += '[data-crud-sec="' + secIdx + '"]';
            var allItems = document.querySelectorAll(selector);
            var last = allItems[allItems.length - 1];
            if (last) {
                var editable = last.querySelector('[contenteditable]');
                if (editable) editable.focus();
                last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }

    // B2: Undo support
    var _undoData = null;
    var _undoTimer = null;
    var _undoToast = null;
    var _undoBtn = null;

    function _showUndoToast() {
        if (!_undoToast) _undoToast = document.getElementById('undoToast');
        if (!_undoBtn) {
            _undoBtn = document.getElementById('undoBtn');
            if (_undoBtn) {
                _undoBtn.addEventListener('click', function () {
                    if (!_undoData) return;
                    clearTimeout(_undoTimer);
                    var session = getSession();
                    if (!session) { _undoData = null; return; }
                    if (_undoData.type === '_section') {
                        // Restore removed phrase section
                        if (session.sections) {
                            session.sections.splice(_undoData.secIdx, 0, _undoData.item);
                            session.sections.forEach(function (sec, i) { sec.num = String(i + 1); });
                        }
                    } else if (_undoData.lineKey) {
                        session[_undoData.lineKey] = _undoData.oldVal;
                    } else {
                        var arr = resolveArray(session, _undoData.type, _undoData.secIdx);
                        if (arr) arr.splice(_undoData.itemIdx, 0, _undoData.item);
                    }
                    _undoData = null;
                    if (_undoToast) _undoToast.style.display = 'none';
                    renderPage();
                });
            }
        }
        if (_undoToast) _undoToast.style.display = 'flex';
        clearTimeout(_undoTimer);
        _undoTimer = setTimeout(function () {
            _undoData = null;
            if (_undoToast) _undoToast.style.display = 'none';
        }, 5000);
    }

    function removeItem(type, itemIdx, secIdx) {
        syncEditablesToSession();
        var session = getSession();
        if (!session) return;

        var sc = _scrollContainer(), scrollY = sc.scrollTop;

        // Line-count items
        if (LINE_DEFAULTS[type] !== undefined) {
            var lk = resolveLineKey(type);
            ensureLineCount(session, lk);
            if (session[lk] > LINE_MIN) {
                _undoData = { lineKey: lk, oldVal: session[lk], type: type };
                session[lk]--;
                renderPage();
                sc.scrollTop = scrollY;
                _showUndoToast();
            }
            return;
        }

        var arr = resolveArray(session, type, secIdx);
        if (!arr || arr.length <= 1) return;
        var removed = arr.splice(itemIdx, 1)[0];
        _undoData = { type: type, itemIdx: itemIdx, secIdx: secIdx, item: removed };
        renderPage();
        requestAnimationFrame(function () { sc.scrollTop = scrollY; });
        _showUndoToast();
    }

    // =========================================
    // STATE
    // =========================================

    var state = {
        courseId: ALL_COURSES[0].id,
        sessionIdx: 0,
        theme: 'ink',
        teacherName: '',
        studentName: '',
        date: ''
    };

    var els = {
        courseNav: document.getElementById('courseNav'),
        page: document.getElementById('page'),
        themeDots: document.getElementById('themeDots'),
        teacherName: document.getElementById('teacherName'),
        studentName: document.getElementById('studentName'),
        sessionDate: document.getElementById('sessionDate'),
        btnPrint: document.getElementById('btnPrint'),
        btnPdf: document.getElementById('btnPdf'),
        breadcrumb: document.getElementById('breadcrumb')
    };

    // Set today's date
    var today = new Date();
    els.sessionDate.value = today.toISOString().split('T')[0];
    state.date = formatDate(els.sessionDate.value);

    function formatDate(val) {
        if (!val) return '';
        var d = new Date(val + 'T00:00:00');
        return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
    }

    function getCourse() { return ALL_COURSES.find(function (c) { return c.id === state.courseId; }); }
    function getSession() {
        var c = getCourse();
        if (!c || !c.sessions || !c.sessions.length) return null;
        if (state.sessionIdx < 0 || state.sessionIdx >= c.sessions.length) {
            state.sessionIdx = Math.max(0, Math.min(state.sessionIdx, c.sessions.length - 1));
        }
        return c.sessions[state.sessionIdx] || null;
    }
    function getCtx() {
        var cn = window.__classnote || {};
        var sess = getSession();
        var dateVal = (sess && sess._date) ? sess._date : state.date;
        return {
            teacherName: state.teacherName,
            studentName: state.studentName,
            date: dateVal,
            brand: cn.brand || '',
            logoData: cn.logoData || null
        };
    }

    // =========================================
    // RENDER NAV (v4 class names)
    // =========================================

    function renderNav() {
        var course = getCourse();
        if (!course) return;

        // Zone 1: Brand header
        var brandEl = document.getElementById('sbBrand');
        if (brandEl) {
            var cn = window.__classnote || {};
            var bh = '<div class="sb__brand-row">';
            if (cn.logoData) {
                bh += '<img class="sb__brand-logo" src="' + cn.logoData + '" alt="">';
            }
            bh += '<div class="sb__brand-info">';
            bh += '<div class="sb__brand-name">' + esc(course.name) + '</div>';
            bh += '</div></div>';
            // Tags
            var subjectLabels = { english: '영어', math: '수학', korean: '국어' };
            var levelLabels = { elementary: '초등', middle: '중등', high: '고등', adult: '성인' };
            var diffLabels = { beginner: '초급', intermediate: '중급', advanced: '고급' };
            if (cn.subject || cn.level || cn.difficulty) {
                bh += '<div class="sb__brand-tags">';
                if (cn.subject) bh += '<span class="sb__tag">' + (subjectLabels[cn.subject] || cn.subject) + '</span>';
                if (cn.level) bh += '<span class="sb__tag">' + (levelLabels[cn.level] || cn.level) + '</span>';
                if (cn.difficulty) bh += '<span class="sb__tag">' + (diffLabels[cn.difficulty] || cn.difficulty) + '</span>';
                bh += '</div>';
            }
            brandEl.innerHTML = bh;
        }

        // Session count
        var countEl = document.getElementById('sessionCount');
        if (countEl) countEl.textContent = course.sessions.length;

        // Zone 2: Session list
        var h = '';
        course.sessions.forEach(function (s, i) {
            var sActive = i === state.sessionIdx;
            h += '<div class="nsi' + (sActive ? ' nsi--active' : '') + '" data-idx="' + i + '" draggable="true">';
            h += '<span class="nsi__grip" title="드래그하여 순서 변경">⠿</span>';
            h += '<span class="nsi__n">' + s.num + '</span>';
            h += '<input class="nsi__input" value="' + esc(s.title) + '" data-rename-idx="' + i + '" readonly>';
            h += '<span class="nsi__actions">';
            h += '<button class="nsi__btn" data-dup-idx="' + i + '" title="세션 복제"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>';
            if (course.sessions.length > 1) {
                h += '<button class="nsi__btn nsi__btn--danger" data-del-idx="' + i + '" title="세션 삭제"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
            }
            h += '</span>';
            h += '</div>';
        });

        els.courseNav.innerHTML = h;

        // Bind session clicks
        els.courseNav.querySelectorAll('.nsi').forEach(function (item) {
            item.addEventListener('click', function (e) {
                if (e.target.closest('.nsi__actions') || e.target.closest('.nsi__input:not([readonly])')) return;
                e.stopPropagation();
                var newIdx = parseInt(this.getAttribute('data-idx'));
                if (newIdx === state.sessionIdx) return;
                if (hasEdited && !confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return;
                syncEditablesToSession();
                hasEdited = false;
                // Save current date before switching
                var currSess = getSession();
                if (currSess) currSess._date = state.date;
                state.sessionIdx = newIdx;
                // Load date from new session
                var newSess = getSession();
                if (newSess && newSess._date) {
                    state.date = newSess._date;
                } else if (newSess) {
                    var today = new Date();
                    state.date = formatDate(today.toISOString().split('T')[0]);
                    newSess._date = state.date;
                }
                if (els.sessionDate && state.date) {
                    var m = state.date.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
                    if (m) {
                        var mm = m[2].length < 2 ? '0' + m[2] : m[2];
                        var dd = m[3].length < 2 ? '0' + m[3] : m[3];
                        els.sessionDate.value = m[1] + '-' + mm + '-' + dd;
                    }
                }
                // Reset page state (same as __go)
                var wrap = document.getElementById('pageWrap');
                if (wrap) wrap.querySelectorAll('.page--extra').forEach(function (p) { p.remove(); });
                var nav = document.getElementById('pageNav');
                if (nav) nav.classList.remove('page-nav--show');
                pageState = { pages: [], current: 0, total: 1 };
                renderNav();
                renderPage();
            });
        });

        // Bind click to rename (only on active session)
        els.courseNav.querySelectorAll('.nsi__input').forEach(function (input) {
            input.addEventListener('click', function (e) {
                var nsi = this.closest('.nsi');
                if (!nsi || !nsi.classList.contains('nsi--active')) return;
                e.stopPropagation();
                if (this.hasAttribute('readonly')) {
                    this.removeAttribute('readonly');
                    this.focus();
                    this.select();
                }
            });
            input.addEventListener('blur', function () {
                this.setAttribute('readonly', '');
                var idx = parseInt(this.getAttribute('data-rename-idx'));
                var val = this.value.trim();
                if (val && course.sessions[idx]) {
                    course.sessions[idx].title = val;
                    renderPage();
                    saveCourseToFirestore();
                }
            });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
                if (e.key === 'Escape') {
                    var idx = parseInt(this.getAttribute('data-rename-idx'));
                    this.value = course.sessions[idx].title;
                    this.setAttribute('readonly', '');
                    this.blur();
                }
            });
        });

        // Bind duplicate session buttons
        els.courseNav.querySelectorAll('[data-dup-idx]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var idx = parseInt(this.getAttribute('data-dup-idx'));
                duplicateSession(state.courseId, idx);
            });
        });

        // Bind delete session buttons
        els.courseNav.querySelectorAll('[data-del-idx]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var idx = parseInt(this.getAttribute('data-del-idx'));
                if (!confirm('세션 ' + course.sessions[idx].num + '을(를) 삭제하시겠습니까?')) return;
                syncEditablesToSession();
                course.sessions.splice(idx, 1);
                // Renumber remaining sessions
                course.sessions.forEach(function (s, i) { s.num = i + 1; });
                // Adjust active index
                if (state.sessionIdx >= course.sessions.length) {
                    state.sessionIdx = course.sessions.length - 1;
                } else if (state.sessionIdx > idx) {
                    state.sessionIdx--;
                }
                hasEdited = false;
                renderNav();
                renderPage();
                saveCourseToFirestore();
            });
        });

        // Drag reorder
        var dragIdx = null;
        els.courseNav.querySelectorAll('.nsi').forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                dragIdx = parseInt(this.getAttribute('data-idx'));
                this.classList.add('nsi--dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragend', function () {
                this.classList.remove('nsi--dragging');
                els.courseNav.querySelectorAll('.nsi').forEach(function (n) { n.classList.remove('nsi--drag-over'); });
                dragIdx = null;
            });
            item.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                els.courseNav.querySelectorAll('.nsi').forEach(function (n) { n.classList.remove('nsi--drag-over'); });
                this.classList.add('nsi--drag-over');
            });
            item.addEventListener('dragleave', function () {
                this.classList.remove('nsi--drag-over');
            });
            item.addEventListener('drop', function (e) {
                e.preventDefault();
                var dropIdx = parseInt(this.getAttribute('data-idx'));
                if (dragIdx === null || dragIdx === dropIdx) return;
                syncEditablesToSession();
                var moved = course.sessions.splice(dragIdx, 1)[0];
                course.sessions.splice(dropIdx, 0, moved);
                course.sessions.forEach(function (s, i) { s.num = i + 1; });
                // Adjust active index
                if (state.sessionIdx === dragIdx) {
                    state.sessionIdx = dropIdx;
                } else if (dragIdx < state.sessionIdx && dropIdx >= state.sessionIdx) {
                    state.sessionIdx--;
                } else if (dragIdx > state.sessionIdx && dropIdx <= state.sessionIdx) {
                    state.sessionIdx++;
                }
                hasEdited = false;
                renderNav();
                renderPage();
                saveCourseToFirestore();
            });
        });

        // "새 세션" button
        var addBtn = document.getElementById('addSessionBtn');
        if (addBtn) {
            addBtn.onclick = function () {
                syncEditablesToSession();
                var lastSession = course.sessions[course.sessions.length - 1];
                var newSession = JSON.parse(JSON.stringify(lastSession));
                newSession.num = course.sessions.length + 1;
                newSession.title = 'Session ' + newSession.num;
                // Clear content but keep structure
                clearSessionContent(newSession);
                course.sessions.push(newSession);
                state.sessionIdx = course.sessions.length - 1;
                hasEdited = false;
                renderNav();
                renderPage();
                saveCourseToFirestore();
            };
        }
    }

    // =========================================
    // SECTION PANEL — sidebar section manager
    // =========================================
    function persistSections() {
        try {
            var raw = localStorage.getItem('classnote_onboarding');
            if (raw) {
                var ob = JSON.parse(raw);
                var cn = window.__classnote;
                if (cn) {
                    ob.sections = cn.sections;
                    ob.sectionNames = cn.sectionNames || {};
                    ob.sectionOrder = cn.sectionOrder || null;
                    localStorage.setItem('classnote_onboarding', JSON.stringify(ob));
                }
            }
        } catch (e) {}
    }

    // Get ordered list of enabled section keys
    function getEffectiveOrder(allSections, cn) {
        var effSec = getEffectiveSections();
        var enabledKeys = allSections.filter(function (s) { return effSec[s.key] === true; }).map(function (s) { return s.key; });
        if (!cn.sectionOrder || !cn.sectionOrder.length) return enabledKeys;
        var ordered = [];
        var inOrder = {};
        cn.sectionOrder.forEach(function (k) {
            if (effSec[k] === true) { ordered.push(k); inOrder[k] = true; }
        });
        enabledKeys.forEach(function (k) { if (!inOrder[k]) ordered.push(k); });
        return ordered;
    }

    function renderSectionPanel() {
        var panel = document.getElementById('sectionPanel');
        if (!panel) return;

        var cn = window.__classnote;
        if (!cn || !cn.sections || !cn.subject || !cn.type) {
            panel.innerHTML = '<div style="font-size:11px;color:var(--t4);padding:4px 8px">온보딩 완료 후 표시됩니다</div>';
            return;
        }

        var subj = cn.subject;
        var type = cn.type;
        var subjSections = TYPE_SECTIONS[subj];
        if (!subjSections) return;
        var allSections = subjSections[type];
        if (!allSections) return;

        if (!cn.sectionNames) cn.sectionNames = {};

        // Build section lookup
        var secByKey = {};
        allSections.forEach(function (s) { secByKey[s.key] = s; });

        // Ordered enabled sections
        var orderedKeys = getEffectiveOrder(allSections, cn);

        var h = '';
        // Draggable list of enabled sections
        h += '<div class="sp__list" id="spList">';
        orderedKeys.forEach(function (key, idx) {
            var s = secByKey[key];
            if (!s) return;
            var displayName = cn.sectionNames[key] || s.name;
            h += '<div class="sp__item sp__item--draggable" data-sec-key="' + key + '" data-sp-idx="' + idx + '" draggable="true">';
            h += '<span class="sp__grip" title="드래그하여 순서 변경">';
            h += '<svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor"><circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/><circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/><circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/></svg>';
            h += '</span>';
            h += '<span class="sp__dot sp__dot--' + s.cat + '" title="' + ({ learn:'학습', practice:'연습', wrap:'마무리' }[s.cat] || '') + '"></span>';
            h += '<input class="sp__name" value="' + esc(displayName) + '" data-sec-rename="' + key + '" title="' + esc(s.desc) + '">';
            h += '<span class="sp__actions">';
            h += '<button class="sp__btn" data-sec-toggle="' + key + '" title="숨기기">';
            h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
            h += '</button>';
            h += '</span>';
            h += '</div>';
        });
        h += '</div>';

        // Hidden sections
        var effSec = getEffectiveSections();
        var offSections = allSections.filter(function (s) { return effSec[s.key] !== true; });
        if (offSections.length > 0) {
            h += '<div class="sp__hidden-group">';
            h += '<div class="sp__hidden-label">숨겨진 섹션</div>';
            offSections.forEach(function (s) {
                h += '<div class="sp__item sp__item--off" data-sec-key="' + s.key + '">';
                h += '<span class="sp__dot sp__dot--' + s.cat + '"></span>';
                h += '<span class="sp__name-static">' + esc(s.name) + '</span>';
                h += '<button class="sp__btn sp__btn--restore" data-sec-toggle="' + s.key + '" title="다시 표시">';
                h += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
                h += '</button>';
                h += '</div>';
            });
            h += '</div>';
        }

        panel.innerHTML = h;

        // --- Drag and drop ---
        var spList = document.getElementById('spList');
        var dragItem = null;
        var dragIdx = -1;
        var placeholder = document.createElement('div');
        placeholder.className = 'sp__placeholder';

        if (spList) {
            spList.addEventListener('dragstart', function (e) {
                var item = e.target.closest('.sp__item--draggable');
                if (!item) return;
                dragItem = item;
                dragIdx = parseInt(item.getAttribute('data-sp-idx'), 10);
                item.classList.add('sp__item--dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
            });

            spList.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                var target = e.target.closest('.sp__item--draggable');
                if (!target || target === dragItem) {
                    // If hovering past the last item, put placeholder at end
                    if (spList.contains(placeholder)) return;
                    return;
                }
                var rect = target.getBoundingClientRect();
                var midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    spList.insertBefore(placeholder, target);
                } else {
                    spList.insertBefore(placeholder, target.nextSibling);
                }
            });

            spList.addEventListener('dragend', function () {
                if (dragItem) dragItem.classList.remove('sp__item--dragging');
                if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
                dragItem = null;
                dragIdx = -1;
            });

            spList.addEventListener('drop', function (e) {
                e.preventDefault();
                if (!dragItem) return;
                // Insert dragItem at placeholder position
                if (placeholder.parentNode === spList) {
                    spList.insertBefore(dragItem, placeholder);
                    placeholder.parentNode.removeChild(placeholder);
                }
                dragItem.classList.remove('sp__item--dragging');
                // Read new order from DOM
                var newOrder = [];
                spList.querySelectorAll('.sp__item--draggable').forEach(function (el) {
                    newOrder.push(el.getAttribute('data-sec-key'));
                });
                cn.sectionOrder = newOrder;
                persistSections();
                renderPage();
                // Re-render panel to update indices
                renderSectionPanel();
            });
        }

        // --- Touch drag support ---
        (function () {
            var touchItem = null;
            var touchClone = null;
            var touchStartY = 0;
            var touchOffsetY = 0;

            if (!spList) return;

            spList.addEventListener('touchstart', function (e) {
                var grip = e.target.closest('.sp__grip');
                if (!grip) return;
                var item = grip.closest('.sp__item--draggable');
                if (!item) return;
                touchItem = item;
                var touch = e.touches[0];
                var rect = item.getBoundingClientRect();
                touchStartY = touch.clientY;
                touchOffsetY = touch.clientY - rect.top;
                // Create floating clone
                touchClone = item.cloneNode(true);
                touchClone.className = 'sp__item sp__item--ghost';
                touchClone.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;z-index:999;pointer-events:none;';
                document.body.appendChild(touchClone);
                item.classList.add('sp__item--dragging');
                e.preventDefault();
            }, { passive: false });

            spList.addEventListener('touchmove', function (e) {
                if (!touchItem || !touchClone) return;
                var touch = e.touches[0];
                touchClone.style.top = (touch.clientY - touchOffsetY) + 'px';
                // Find item under touch
                touchClone.style.display = 'none';
                var under = document.elementFromPoint(touch.clientX, touch.clientY);
                touchClone.style.display = '';
                if (under) {
                    var target = under.closest('.sp__item--draggable');
                    if (target && target !== touchItem) {
                        var rect = target.getBoundingClientRect();
                        var mid = rect.top + rect.height / 2;
                        if (touch.clientY < mid) {
                            spList.insertBefore(placeholder, target);
                        } else {
                            spList.insertBefore(placeholder, target.nextSibling);
                        }
                    }
                }
                e.preventDefault();
            }, { passive: false });

            spList.addEventListener('touchend', function () {
                if (!touchItem) return;
                if (placeholder.parentNode === spList) {
                    spList.insertBefore(touchItem, placeholder);
                    placeholder.parentNode.removeChild(placeholder);
                }
                touchItem.classList.remove('sp__item--dragging');
                if (touchClone && touchClone.parentNode) touchClone.parentNode.removeChild(touchClone);
                // Save new order
                var newOrder = [];
                spList.querySelectorAll('.sp__item--draggable').forEach(function (el) {
                    newOrder.push(el.getAttribute('data-sec-key'));
                });
                cn.sectionOrder = newOrder;
                persistSections();
                renderPage();
                renderSectionPanel();
                touchItem = null;
                touchClone = null;
            });
        })();

        // --- Bind toggle (hide) ---
        panel.querySelectorAll('[data-sec-toggle]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var key = this.getAttribute('data-sec-toggle');
                var effSec = getEffectiveSections();
                var wasOn = effSec[key] === true;
                // Save toggle to per-session _sections only (not course-level)
                var sess = getSession();
                if (sess) {
                    if (!sess._sections) sess._sections = {};
                    sess._sections[key] = !wasOn;
                }
                // If toggling on, add to end of order
                if (!wasOn && cn.sectionOrder) {
                    if (cn.sectionOrder.indexOf(key) === -1) cn.sectionOrder.push(key);
                }
                // If toggling off, remove from order
                if (wasOn && cn.sectionOrder) {
                    cn.sectionOrder = cn.sectionOrder.filter(function (k) { return k !== key; });
                }
                persistSections();
                saveCourseToFirestore();
                // Remember page position after re-render
                // Toggling ON → go to last page (new section appended at end)
                // Toggling OFF → stay on current page
                if (!wasOn) {
                    pendingScrollToSection = 'last';
                } else {
                    pendingScrollToSection = pageState.current;
                }
                renderSectionPanel();
                renderPage();
            });
        });

        // --- Bind rename ---
        panel.querySelectorAll('[data-sec-rename]').forEach(function (input) {
            input.addEventListener('blur', function () {
                var key = this.getAttribute('data-sec-rename');
                var val = this.value.trim();
                var original = allSections.find(function (s) { return s.key === key; });
                if (val && original) {
                    if (val === original.name) {
                        delete cn.sectionNames[key];
                    } else {
                        cn.sectionNames[key] = val;
                    }
                    persistSections();
                    renderPage();
                }
            });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
                if (e.key === 'Escape') {
                    var key = this.getAttribute('data-sec-rename');
                    var original = allSections.find(function (s) { return s.key === key; });
                    this.value = cn.sectionNames[key] || (original ? original.name : '');
                    this.blur();
                }
            });
        });
    }

    // Clear editable content from a session (keep section structure)
    function clearSessionContent(session) {
        if (!session || !session.sections) return;
        session.sections.forEach(function (sec) {
            if (sec.phrases) sec.phrases = sec.phrases.map(function () { return ''; });
        });
        // Clear common array fields
        ['vocab', 'homework', 'quiz', 'notes', 'sentences', 'examples', 'problems'].forEach(function (key) {
            if (Array.isArray(session[key])) {
                session[key] = session[key].map(function (item) {
                    if (typeof item === 'string') return '';
                    if (typeof item === 'object' && item !== null) {
                        var copy = {};
                        Object.keys(item).forEach(function (k) { copy[k] = ''; });
                        return copy;
                    }
                    return item;
                });
            }
        });
    }

    // A1: Duplicate a session
    function duplicateSession(courseId, sessionIdx) {
        var course = ALL_COURSES.find(function (c) { return c.id === courseId; });
        if (!course || !course.sessions[sessionIdx]) return;
        syncEditablesToSession();
        var original = course.sessions[sessionIdx];
        var copy = JSON.parse(JSON.stringify(original));
        copy.num = course.sessions.length + 1;
        copy.title = original.title + ' (복사)';
        course.sessions.push(copy);
        state.courseId = courseId;
        state.sessionIdx = course.sessions.length - 1;
        renderNav();
        renderPage();
        saveCourseToFirestore();
    }

    // =========================================
    // MULTI-PAGE SYSTEM
    // =========================================

    var A4_HEIGHT = 1123;
    var A4_PADDING = 96; // 48px top + 48px bottom
    var A4_CONTENT = A4_HEIGHT - A4_PADDING;

    // Shared: count how many pages a rendered page element needs.
    // Returns { pages: [[sec,...], ...], pageFitLevel: [0, ...], fitApplied: 'fit--N'|null }
    // pageEl must have overflow:visible and maxHeight:none before calling.
    function countPages(pageEl) {
        var children = Array.prototype.slice.call(pageEl.children);
        var header = null, footer = null, sections = [];
        children.forEach(function (child) {
            if (child.classList.contains('p-header')) header = child;
            else if (child.classList.contains('pf')) footer = child;
            else sections.push(child);
        });

        // Try global auto-fit first
        pageEl.classList.remove('fit--1', 'fit--2', 'fit--3');
        var trueHeight = pageEl.scrollHeight;
        var globalFit = null;

        if (trueHeight > A4_HEIGHT) {
            var overflowPct = (trueHeight - A4_HEIGHT) / A4_HEIGHT;
            // Only try global fit if overflow is modest (≤15%)
            if (overflowPct <= 0.15) {
                var fitLevels = ['fit--1', 'fit--2', 'fit--3'];
                for (var fi = 0; fi < fitLevels.length; fi++) {
                    pageEl.classList.add(fitLevels[fi]);
                    trueHeight = pageEl.scrollHeight;
                    if (trueHeight <= A4_HEIGHT) {
                        // Check: does fit leave too much whitespace (>8%)?
                        var wastedPct = (A4_HEIGHT - trueHeight) / A4_HEIGHT;
                        if (wastedPct > 0.20) {
                            // Fit shrinks too aggressively — reject it, go multi-page
                            pageEl.classList.remove(fitLevels[fi]);
                            trueHeight = pageEl.scrollHeight;
                            globalFit = null;
                        } else {
                            globalFit = fitLevels[fi];
                        }
                        break;
                    }
                    if (fi < fitLevels.length - 1) pageEl.classList.remove(fitLevels[fi]);
                }
                if (trueHeight > A4_HEIGHT) {
                    pageEl.classList.remove('fit--1', 'fit--2', 'fit--3');
                    trueHeight = pageEl.scrollHeight;
                }
            }
        }

        // Single page?
        if (trueHeight <= A4_HEIGHT) {
            return { count: 1, pages: [sections], pageFitLevel: [0], globalFit: globalFit, header: header, footer: footer, sections: sections };
        }

        // Multi-page distribution
        pageEl.classList.remove('fit--1', 'fit--2', 'fit--3'); // measure at base size
        var headerH = header ? header.offsetHeight + 24 : 0;
        var footerH = footer ? footer.offsetHeight + 16 : 0;
        var page1Available = A4_CONTENT - headerH - footerH;
        var pageNAvailable = A4_CONTENT - footerH;

        var fitMargins = [18, 10, 6, 4]; // margin per fit level (0,1,2,3)

        function measurePageAtFit(allSecs, fitLevel) {
            var cls = fitLevel > 0 ? 'fit--' + fitLevel : null;
            if (cls) pageEl.classList.add(cls);
            var totalH = 0;
            var m = fitMargins[fitLevel] || 18;
            allSecs.forEach(function(s) { totalH += s.offsetHeight + m; });
            if (cls) pageEl.classList.remove(cls);
            return totalH;
        }

        var dist = [[]];
        var currentH = 0;
        var isFirstPage = true;
        var pageFitLevel = [0];

        sections.forEach(function (sec) {
            var secH = sec.offsetHeight + 18;
            var limit = isFirstPage ? page1Available : pageNAvailable;

            if (currentH + secH > limit && dist[dist.length - 1].length > 0) {
                var squeezed = false;
                var overflow = (currentH + secH) - limit;
                var overflowRatio = overflow / (currentH + secH);

                if (overflowRatio <= 0.08) {
                    var candidateSecs = dist[dist.length - 1].concat([sec]);
                    for (var fl = 1; fl <= 3; fl++) {
                        var fittedH = measurePageAtFit(candidateSecs, fl);
                        if (fittedH <= limit) {
                            // Reject if fit leaves >8% whitespace
                            var wasted = (limit - fittedH) / limit;
                            if (wasted > 0.08) break;
                            pageFitLevel[dist.length - 1] = fl;
                            dist[dist.length - 1].push(sec);
                            currentH = fittedH;
                            squeezed = true;
                            break;
                        }
                    }
                }

                if (!squeezed) {
                    dist.push([]);
                    pageFitLevel.push(0);
                    currentH = 0;
                    isFirstPage = false;
                    dist[dist.length - 1].push(sec);
                    currentH += secH;
                }
            } else {
                dist[dist.length - 1].push(sec);
                currentH += secH;
            }
        });

        return { count: dist.length, pages: dist, pageFitLevel: pageFitLevel, globalFit: null, header: header, footer: footer, sections: sections };
    }

    var pageState = { pages: [], current: 0, total: 1 };
    var renderGen = 0; // incremented each renderPage to cancel stale paginateContent calls
    var pendingScrollToSection = null; // 'last' to go to last page, or page index to restore


    // Splits rendered content across multiple A4 pages if needed
    function paginateContent() {
        var wrap = document.getElementById('pageWrap');
        var nav = document.getElementById('pageNav');
        if (!wrap || !nav) return;

        // Don't run while onboarding is visible
        var obOverlay = document.getElementById('onboarding');
        if (obOverlay && !obOverlay.classList.contains('ob--hidden')) return;

        var firstPage = els.page;

        // Temporarily allow overflow to measure
        firstPage.style.maxHeight = 'none';
        firstPage.style.overflow = 'visible';

        // Use shared counting logic
        var result = countPages(firstPage);

        firstPage.style.maxHeight = '';
        firstPage.style.overflow = '';

        // Clean up any extra pages from previous render
        wrap.querySelectorAll('.page--extra').forEach(function (p) { p.remove(); });

        if (result.count <= 1) {
            // Single page
            firstPage.classList.remove('fit--1', 'fit--2', 'fit--3');
            if (result.globalFit) firstPage.classList.add(result.globalFit);
            if (result.pageFitLevel[0] > 0) firstPage.classList.add('fit--' + result.pageFitLevel[0]);
            firstPage.classList.add('page--single');
            nav.classList.remove('page-nav--show');
            pageState = { pages: [firstPage], current: 0, total: 1 };

            // Distribute spare space as extra margin among sections
            var psSections = firstPage.querySelectorAll('.ps');
            // Reset any previously added extra margins
            psSections.forEach(function (ps) { ps.style.marginBottom = ''; });
            // Measure true content height (temporarily remove min-height)
            firstPage.style.maxHeight = 'none';
            firstPage.style.overflow = 'visible';
            firstPage.style.minHeight = '0';
            var contentH = firstPage.scrollHeight;
            firstPage.style.maxHeight = '';
            firstPage.style.overflow = '';
            firstPage.style.minHeight = '';
            var spare = A4_HEIGHT - contentH;
            if (spare > 20 && psSections.length > 1) {
                // Distribute spare evenly, cap at 40px each to avoid over-spacing
                var extraPerSection = Math.min(Math.floor(spare / psSections.length), 40);
                if (extraPerSection > 2) {
                    psSections.forEach(function (ps) {
                        var current = parseInt(window.getComputedStyle(ps).marginBottom, 10) || 0;
                        ps.style.marginBottom = (current + extraPerSection) + 'px';
                    });
                }
            }
            // Single page — just clear pending (no page navigation needed)
            pendingScrollToSection = null;
            updateSidebarPageBreaks(result);
            return;
        }

        firstPage.classList.remove('page--single');

        var pages = result.pages;
        var pageFitLevel = result.pageFitLevel;
        var header = result.header;
        var footer = result.footer;

        // Build pages: keep first page, create extras
        var allPages = [firstPage];
        var theme = firstPage.getAttribute('data-theme');

        // First page: keep header + first batch + footer
        firstPage.innerHTML = '';
        firstPage.classList.remove('fit--1', 'fit--2', 'fit--3');
        if (pageFitLevel[0] > 0) firstPage.classList.add('fit--' + pageFitLevel[0]);
        if (header) firstPage.appendChild(header.cloneNode(true));
        pages[0].forEach(function (sec) { firstPage.appendChild(sec); });
        if (footer) firstPage.appendChild(footer.cloneNode(true));

        // Extra pages
        for (var i = 1; i < pages.length; i++) {
            var extra = document.createElement('div');
            var cn = window.__classnote;
            var lc = 'layout--' + ((cn && cn.layout) || 'classic');
            var fitCls = pageFitLevel[i] > 0 ? ' fit--' + pageFitLevel[i] : '';
            extra.className = 'page page--extra ' + lc + fitCls;
            extra.setAttribute('data-theme', theme);
            extra.style.fontFamily = firstPage.style.fontFamily || '';

            pages[i].forEach(function (sec) { extra.appendChild(sec); });

            if (footer && i === pages.length - 1) {
                extra.appendChild(footer.cloneNode(true));
            }

            wrap.appendChild(extra);
            allPages.push(extra);
        }

        // Add page number to bottom center of each page
        var totalP = allPages.length;
        allPages.forEach(function (pg, idx) {
            var pageNum = document.createElement('div');
            pageNum.className = 'p-page-num';
            pageNum.textContent = (idx + 1) + ' / ' + totalP;
            pg.appendChild(pageNum);
        });

        // Set up page state & navigation
        pageState = { pages: allPages, current: 0, total: allPages.length };

        // If a section toggle triggered this, restore page position
        if (pendingScrollToSection != null) {
            if (pendingScrollToSection === 'last') {
                pageState.current = allPages.length - 1;
            } else {
                // Restore to same page index, clamped to valid range
                var wanted = typeof pendingScrollToSection === 'number' ? pendingScrollToSection : 0;
                pageState.current = Math.min(wanted, allPages.length - 1);
            }
            pendingScrollToSection = null;
        }

        // Show all pages vertically (scrollable)
        nav.classList.add('page-nav--show');
        updatePageNav();
        updateSidebarPageBreaks(result);
    }

    // Update sidebar section panel with page-break dividers
    function updateSidebarPageBreaks(result) {
        var panel = document.getElementById('spList');
        if (!panel) return;
        // Remove existing page-break markers
        panel.querySelectorAll('.sp__page-break').forEach(function (el) { el.remove(); });
        if (!result || result.count <= 1) return;
        // Build a map: sectionKey → pageIndex
        var keyToPage = {};
        result.pages.forEach(function (pageSections, pageIdx) {
            pageSections.forEach(function (secEl) {
                var psh = secEl.querySelector('.psh[data-sec-key]');
                if (psh) keyToPage[psh.getAttribute('data-sec-key')] = pageIdx;
            });
        });
        // Walk sidebar items and insert dividers between page transitions
        var items = panel.querySelectorAll('.sp__item');
        var prevPage = -1;
        items.forEach(function (item) {
            var key = item.getAttribute('data-sec-key');
            var pg = keyToPage[key];
            if (pg === undefined) return;
            if (prevPage >= 0 && pg !== prevPage) {
                var divider = document.createElement('div');
                divider.className = 'sp__page-break';
                divider.textContent = (pg + 1) + '페이지';
                panel.insertBefore(divider, item);
            }
            prevPage = pg;
        });
    }

    function updatePageNav() {
        var info = document.getElementById('pageInfo');
        var prevBtn = document.getElementById('pagePrev');
        var nextBtn = document.getElementById('pageNext');
        if (!info) return;

        info.textContent = (pageState.current + 1) + ' / ' + pageState.total;
        if (prevBtn) prevBtn.disabled = pageState.current === 0;
        if (nextBtn) nextBtn.disabled = pageState.current >= pageState.total - 1;

        // Scroll to current page
        if (pageState.pages[pageState.current]) {
            pageState.pages[pageState.current].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // Bind page nav buttons
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('#pagePrev,#pageNext');
        if (!btn) return;
        if (btn.id === 'pagePrev' && pageState.current > 0) {
            pageState.current--;
            updatePageNav();
        } else if (btn.id === 'pageNext' && pageState.current < pageState.total - 1) {
            pageState.current++;
            updatePageNav();
        }
    });

    // =========================================
    // RENDER PAGE
    // =========================================

    function renderPage() {
        var course = getCourse();
        var session = getSession();
        if (!course || !session) return;
        // Expose for onboarding callback
        window.__renderPage = renderPage;

        var renderer = renderers[course.renderer];
        if (!renderer) return;

        // Clean up extra pages
        var wrap = document.getElementById('pageWrap');
        if (wrap) wrap.querySelectorAll('.page--extra').forEach(function (p) { p.remove(); });

        els.page.innerHTML = renderer(session, course, getCtx());
        reorderSections(els.page);
        els.page.setAttribute('data-theme', state.theme);
        els.page.classList.remove('page--single', 'fit--1', 'fit--2', 'fit--3');

        // Apply layout class
        els.page.classList.remove('layout--classic', 'layout--modern', 'layout--compact');
        var cn = window.__classnote;
        var layoutCls = 'layout--' + ((cn && cn.layout) || 'classic');
        els.page.classList.add(layoutCls);

        // Apply font
        var fontVal = (cn && cn.font) || 'sans';
        var fontFamily = '';
        if (fontVal === 'serif') fontFamily = 'var(--serif)';
        else if (fontVal === 'mono') fontFamily = 'var(--mono)';
        els.page.style.fontFamily = fontFamily;

        // Breadcrumb
        els.breadcrumb.innerHTML = course.name + ' › <span>Session ' + session.num + '</span>';

        // Nav buttons
        var prev = document.getElementById('prevBtn');
        var next = document.getElementById('nextBtn');
        if (prev) prev.disabled = state.sessionIdx === 0;
        if (next) next.disabled = state.sessionIdx >= course.sessions.length - 1;

        // Paginate if needed (after DOM is painted + fonts loaded)
        // Must: 1) rAF so browser discovers which fonts the new content needs,
        //        2) fonts.ready so those fonts are loaded,
        //        3) another rAF to ensure layout is stable.
        var thisGen = ++renderGen;
        requestAnimationFrame(function () {
            if (thisGen !== renderGen) return; // stale — newer render superseded us
            void els.page.offsetHeight; // force reflow → triggers font loading
            var afterFonts = function () {
                requestAnimationFrame(function () {
                    if (thisGen !== renderGen) return; // stale
                    paginateContent();
                });
            };
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(afterFonts);
            } else {
                afterFonts();
            }
        });

        // Animate
        els.page.style.opacity = '0';
        els.page.style.transform = 'translateY(6px)';
        requestAnimationFrame(function () {
            els.page.style.transition = 'opacity 0.2s, transform 0.2s';
            els.page.style.opacity = '1';
            els.page.style.transform = 'translateY(0)';
        });

        // Update sidebar section panel
        renderSectionPanel();
    }

    // Expose helpers for external data access (e.g. Playwright tests)
    window.__getSession = getSession;
    window.__getCourse = getCourse;
    window.__renderPage = renderPage;
    window.__renderNav = renderNav;
    window.__save = function () { saveCourseToFirestore(true); };

    window.__go = function (dir) {
        var c = getCourse();
        if (!c) return;
        var n = state.sessionIdx + dir;
        if (n < 0 || n >= c.sessions.length) return;
        // Save current date to current session before switching
        var currSess = getSession();
        if (currSess) currSess._date = state.date;
        syncEditablesToSession();
        state.sessionIdx = n;
        // Load date from new session
        var newSess = getSession();
        if (newSess && newSess._date) {
            state.date = newSess._date;
        } else if (newSess) {
            // First time visiting this session - use today's date
            var today = new Date();
            state.date = formatDate(today.toISOString().split('T')[0]);
            newSess._date = state.date;
        }
        // Update date picker
        if (els.sessionDate && state.date) {
            var m = state.date.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
            if (m) {
                var mm = m[2].length < 2 ? '0' + m[2] : m[2];
                var dd = m[3].length < 2 ? '0' + m[3] : m[3];
                els.sessionDate.value = m[1] + '-' + mm + '-' + dd;
            }
        }
        // Reset page state
        var wrap = document.getElementById('pageWrap');
        if (wrap) wrap.querySelectorAll('.page--extra').forEach(function (p) { p.remove(); });
        var nav = document.getElementById('pageNav');
        if (nav) nav.classList.remove('page-nav--show');
        pageState = { pages: [], current: 0, total: 1 };
        renderNav();
        renderPage();
    };

    // =========================================
    // BINDINGS
    // =========================================

    // Theme dots (v4: .tdot / .tdot--active)
    els.themeDots.querySelectorAll('.tdot').forEach(function (dot) {
        dot.addEventListener('click', function () {
            els.themeDots.querySelectorAll('.tdot').forEach(function (d) { d.classList.remove('tdot--active'); });
            this.classList.add('tdot--active');
            state.theme = this.getAttribute('data-theme');
            els.page.setAttribute('data-theme', state.theme);
            // Also update extra pages
            document.querySelectorAll('.page--extra').forEach(function (p) {
                p.setAttribute('data-theme', state.theme);
            });
            // Update topbar logo icon color
            var logoIcon = document.querySelector('.topbar__logo-icon');
            if (logoIcon) logoIcon.style.background = getComputedStyle(els.page).getPropertyValue('--ac');
        });
    });

    // Collapsible groups
    document.querySelectorAll('.sb__group-toggle').forEach(function (toggle) {
        toggle.addEventListener('click', function () {
            var group = this.closest('.sb__collapsible');
            if (group) group.classList.toggle('sb__collapsible--closed');
        });
    });

    // Names & Date
    var debounce;
    function onInputChange() {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
            state.teacherName = els.teacherName.value;
            state.studentName = els.studentName.value;
            var formatted = formatDate(els.sessionDate.value);
            state.date = formatted;
            // Save date per-session
            var sess = getSession();
            if (sess) sess._date = formatted;
            renderPage();
        }, 300);
    }
    els.teacherName.addEventListener('input', onInputChange);
    els.studentName.addEventListener('input', onInputChange);
    els.sessionDate.addEventListener('change', onInputChange);

    // --- Autosave (every 5s after last edit) ---
    var autosaveTimer;
    var autosaveEl = document.getElementById('autosaveStatus');
    function triggerAutosave() {
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(function () {
            syncEditablesToSession();
            var course = getCourse();
            var session = getSession();
            if (!course || !session) return;
            try {
                var key = 'classnote_autosave_' + state.courseId + '_' + state.sessionIdx;
                localStorage.setItem(key, JSON.stringify({
                    session: session,
                    teacherName: state.teacherName,
                    studentName: state.studentName,
                    date: state.date,
                    theme: state.theme,
                    ts: Date.now()
                }));
                // Show saved indicator (only if no Firestore save happening)
                if (autosaveEl && !currentCourseDocId) {
                    autosaveEl.textContent = '저장됨';
                    autosaveEl.classList.add('topbar__autosave--show');
                    setTimeout(function () {
                        autosaveEl.classList.remove('topbar__autosave--show');
                    }, 2000);
                }
            } catch (e) {}
            // Firestore cloud save (debounced separately)
            saveCourseToFirestore();
        }, 5000);
    }
    document.addEventListener('input', function (e) {
        if (e.target.closest('.page') || e.target.closest('.cbar') || e.target.closest('.sidebar')) triggerAutosave();
    });

    // --- beforeunload: 편집 중 탭 닫기 경고 ---
    var hasEdited = false;
    document.addEventListener('input', function (e) {
        if (e.target.closest('.page') || e.target.closest('.cbar') || e.target.closest('.sidebar')) hasEdited = true;
    });
    window.addEventListener('beforeunload', function (e) {
        if (hasEdited) { e.preventDefault(); e.returnValue = ''; }
    });

    // --- A2: Ctrl+S / Cmd+S instant save ---
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            clearTimeout(autosaveTimer);
            syncEditablesToSession();
            var course = getCourse();
            var session = getSession();
            if (!course || !session) return;
            try {
                var key = 'classnote_autosave_' + state.courseId + '_' + state.sessionIdx;
                localStorage.setItem(key, JSON.stringify({
                    session: session,
                    teacherName: state.teacherName,
                    studentName: state.studentName,
                    date: state.date,
                    theme: state.theme,
                    ts: Date.now()
                }));
            } catch (ex) {}
            if (autosaveEl) {
                autosaveEl.textContent = '저장됨';
                autosaveEl.classList.add('topbar__autosave--show');
                setTimeout(function () {
                    autosaveEl.classList.remove('topbar__autosave--show');
                }, 2000);
            }
        }
    });

    // --- Global error handler ---
    window.addEventListener('error', function (e) {
        console.error('[클래스노트]', e.message, e.filename, e.lineno);
    });

    // CRUD event delegation
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-crud-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-crud-action');

        // Handle section-level actions first (no data-crud-type needed)
        if (action === 'add-sec') {
            // Add a new phrase section
            syncEditablesToSession();
            var sess = getSession();
            if (sess && sess.sections) {
                var newNum = sess.sections.length + 1;
                sess.sections.push({ num: String(newNum), name: '번호 ' + newNum, phrases: [''] });
                renderPage();
            }
            return;
        }
        if (action === 'remove-sec') {
            // Remove an entire phrase section
            syncEditablesToSession();
            var sess2 = getSession();
            var si2 = parseInt(btn.getAttribute('data-crud-sec'), 10);
            if (sess2 && sess2.sections && sess2.sections.length > 1 && sess2.sections[si2]) {
                var removedSec = sess2.sections.splice(si2, 1)[0];
                // Re-number remaining sections
                sess2.sections.forEach(function (sec, i) { sec.num = String(i + 1); });
                _undoData = { type: '_section', secIdx: si2, item: removedSec };
                renderPage();
                _showUndoToast();
            }
            return;
        }

        // For other CRUD actions, type is required
        var type = btn.getAttribute('data-crud-type')
                 || (btn.closest('[data-crud-type]') ? btn.closest('[data-crud-type]').getAttribute('data-crud-type') : null);
        if (!type) return;
        var secAttr = btn.getAttribute('data-crud-sec');
        if (secAttr === null) {
            var parentItem = btn.closest('[data-crud-sec]');
            if (parentItem) secAttr = parentItem.getAttribute('data-crud-sec');
        }
        var secIdx = secAttr !== null ? parseInt(secAttr, 10) : undefined;

        if (action === 'add' || action === 'add-line') {
            addItem(type, secIdx);
        } else if (action === 'remove' || action === 'remove-line') {
            var itemEl = btn.closest('[data-crud-idx]');
            if (action === 'remove' && itemEl) {
                var idx = parseInt(itemEl.getAttribute('data-crud-idx'), 10);
                itemEl.classList.add('crud-removing');
                setTimeout(function () { removeItem(type, idx, secIdx); }, 130);
            } else {
                removeItem(type, 0, secIdx);
            }
        }
    });

    // Print
    els.btnPrint.addEventListener('click', function () { window.print(); });

    // PDF (same as print for now)
    els.btnPdf.addEventListener('click', function () { window.print(); });

    // =========================================
    // PHRASE LONG-PRESS DRAG REORDER
    // =========================================
    (function () {
        var HOLD_MS = 350;
        var holdTimer = null;
        var dragLi = null;
        var dragClone = null;
        var dragList = null;      // the <ul class="pl">
        var dragSecIdx = -1;
        var placeholder = null;
        var offsetY = 0;
        var startY = 0;
        var active = false;

        function getY(e) {
            return e.touches ? e.touches[0].clientY : e.clientY;
        }

        function beginDrag(li, y) {
            active = true;
            dragLi = li;
            dragList = li.closest('ul.pl');
            dragSecIdx = parseInt((li.closest('[data-crud-sec-wrap]') || li.closest('[data-crud-sec]') || { getAttribute: function () { return '0'; } }).getAttribute('data-crud-sec-wrap') || li.getAttribute('data-crud-sec') || '0', 10);
            var rect = li.getBoundingClientRect();
            offsetY = y - rect.top;

            // Create placeholder
            placeholder = document.createElement('li');
            placeholder.className = 'pl__ph';
            placeholder.style.height = rect.height + 'px';
            li.parentNode.insertBefore(placeholder, li);

            // Create floating clone
            dragClone = li.cloneNode(true);
            dragClone.className = 'pl__drag';
            dragClone.style.width = rect.width + 'px';
            dragClone.style.top = rect.top + 'px';
            dragClone.style.left = rect.left + 'px';
            document.body.appendChild(dragClone);

            li.style.display = 'none';
            document.body.style.userSelect = 'none';
        }

        function moveDrag(y) {
            if (!active || !dragClone) return;
            dragClone.style.top = (y - offsetY) + 'px';

            // Find insertion point
            var items = dragList.querySelectorAll('li:not(.pl__ph):not(.pl__drag)');
            var inserted = false;
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (it === dragLi || it.style.display === 'none') continue;
                var r = it.getBoundingClientRect();
                if (y < r.top + r.height / 2) {
                    dragList.insertBefore(placeholder, it);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) dragList.appendChild(placeholder);
        }

        function endDrag() {
            if (!active) return;
            clearTimeout(holdTimer);

            // Place the real li at placeholder position
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(dragLi, placeholder);
                placeholder.parentNode.removeChild(placeholder);
            }
            dragLi.style.display = '';
            if (dragClone && dragClone.parentNode) dragClone.parentNode.removeChild(dragClone);
            document.body.style.userSelect = '';

            // Read new order from DOM indices and update data
            syncEditablesToSession();
            var sess = getSession();
            if (sess && sess.sections && sess.sections[dragSecIdx]) {
                var sec = sess.sections[dragSecIdx];
                var lis = dragList.querySelectorAll('li[data-crud-idx]');
                var newPhrases = [];
                lis.forEach(function (el) {
                    var idx = parseInt(el.getAttribute('data-crud-idx'), 10);
                    if (sec.phrases[idx] !== undefined) newPhrases.push(sec.phrases[idx]);
                });
                if (newPhrases.length === sec.phrases.length) {
                    sec.phrases = newPhrases;
                }
            }
            renderPage();

            active = false;
            dragLi = null;
            dragClone = null;
            dragList = null;
            placeholder = null;
        }

        function cancelDrag() {
            clearTimeout(holdTimer);
            if (!active) return;
            if (dragLi) dragLi.style.display = '';
            if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            if (dragClone && dragClone.parentNode) dragClone.parentNode.removeChild(dragClone);
            document.body.style.userSelect = '';
            active = false;
            dragLi = null;
            dragClone = null;
            dragList = null;
            placeholder = null;
        }

        // Mouse events
        document.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            var li = e.target.closest('.pl li[data-crud-type="phrases"]');
            if (!li || e.target.closest('.crud-x') || e.target.closest('button')) return;
            startY = getY(e);
            var capturedLi = li;
            holdTimer = setTimeout(function () { beginDrag(capturedLi, startY); }, HOLD_MS);
        });
        document.addEventListener('mousemove', function (e) {
            if (holdTimer && !active && Math.abs(getY(e) - startY) > 8) { clearTimeout(holdTimer); holdTimer = null; }
            if (active) { e.preventDefault(); moveDrag(getY(e)); }
        });
        document.addEventListener('mouseup', function () {
            clearTimeout(holdTimer); holdTimer = null;
            if (active) endDrag();
        });

        // Touch events
        document.addEventListener('touchstart', function (e) {
            var li = e.target.closest('.pl li[data-crud-type="phrases"]');
            if (!li || e.target.closest('.crud-x') || e.target.closest('button')) return;
            startY = getY(e);
            var capturedLi = li;
            holdTimer = setTimeout(function () {
                beginDrag(capturedLi, startY);
                // Haptic feedback if available
                if (navigator.vibrate) navigator.vibrate(30);
            }, HOLD_MS);
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
            if (holdTimer && !active && Math.abs(getY(e) - startY) > 8) { clearTimeout(holdTimer); holdTimer = null; }
            if (active) { e.preventDefault(); moveDrag(getY(e)); }
        }, { passive: false });
        document.addEventListener('touchend', function () {
            clearTimeout(holdTimer); holdTimer = null;
            if (active) endDrag();
        });
        document.addEventListener('touchcancel', function () {
            clearTimeout(holdTimer); holdTimer = null;
            cancelDrag();
        });
    })();

    // =========================================
    // PUBLISH / DEPLOY (Phase 2: Firebase Firestore)
    // =========================================

    // --- Firebase init ---
    var db = null;
    if (typeof firebase !== 'undefined' && typeof CLASSNOTE_FIREBASE !== 'undefined') {
        if (!firebase.apps.length) firebase.initializeApp(CLASSNOTE_FIREBASE);
        db = firebase.firestore();
    }

    // --- Slug generator ---
    function generateSlug(len) {
        var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        var n = len || 6;
        var arr = new Uint8Array(n);
        crypto.getRandomValues(arr);
        var slug = '';
        for (var i = 0; i < n; i++) slug += chars[arr[i] % 36];
        return slug;
    }

    // =========================================
    // COURSE PERSISTENCE (Firestore)
    // =========================================

    var currentCourseDocId = null;
    var _courseSaveTimer = null;
    var _courseSaving = false;

    function saveCourseToFirestore(immediate) {
        if (!db) return;
        // Only auto-save if courseDocId already exists (created during first deploy)
        if (!currentCourseDocId) return;
        clearTimeout(_courseSaveTimer);

        var doSave = function () {
            if (_courseSaving) return;
            syncEditablesToSession();
            var course = getCourse();
            if (!course) return;

            var cn = window.__classnote || {};
            var isNew = false;

            _courseSaving = true;

            var docData = {
                courseId: state.courseId,
                classnote: {
                    brand: cn.brand || '',
                    sections: cn.sections || {},
                    sectionNames: cn.sectionNames || {},
                    sectionOrder: cn.sectionOrder || null,
                    layout: cn.layout || 'classic',
                    font: cn.font || 'sans',
                    subject: cn.subject || '',
                    type: cn.type || '',
                    level: cn.level || '',
                    difficulty: cn.difficulty || ''
                },
                state: {
                    theme: state.theme,
                    teacherName: state.teacherName,
                    studentName: state.studentName,
                    date: state.date
                },
                sessions: JSON.parse(JSON.stringify(course.sessions)),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (currentPublishedSlug) {
                docData.publishedSlug = currentPublishedSlug;
            }
            if (isNew) {
                docData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            db.collection('courses').doc(currentCourseDocId).set(docData, { merge: true })
                .then(function () {
                    _courseSaving = false;
                    // Update URL on first save
                    if (isNew) {
                        var url = new URL(location.href);
                        url.searchParams.set('c', currentCourseDocId);
                        history.replaceState(null, '', url.toString());
                        // Save to recent list in localStorage
                        _saveRecentCourse(currentCourseDocId, course.name);
                    }
                    // Show saved indicator
                    if (autosaveEl) {
                        autosaveEl.textContent = '클라우드 저장됨';
                        autosaveEl.classList.add('topbar__autosave--show');
                        setTimeout(function () {
                            autosaveEl.classList.remove('topbar__autosave--show');
                        }, 2000);
                    }
                })
                .catch(function (err) {
                    _courseSaving = false;
                    console.error('Course save failed:', err);
                });
        };

        if (immediate) {
            doSave();
        } else {
            _courseSaveTimer = setTimeout(doSave, 3000);
        }
    }

    function loadCourseFromFirestore(courseDocId, callback) {
        if (!db) { callback(false); return; }

        db.collection('courses').doc(courseDocId).get()
            .then(function (doc) {
                if (!doc.exists) { callback(false); return; }

                var data = doc.data();
                currentCourseDocId = courseDocId;

                // Restore __classnote
                var cn = data.classnote || {};
                window.__classnote = window.__classnote || {};
                window.__classnote.brand = cn.brand || '';
                window.__classnote.sections = cn.sections || {};
                window.__classnote.sectionNames = cn.sectionNames || {};
                window.__classnote.sectionOrder = cn.sectionOrder || null;
                window.__classnote.layout = cn.layout || 'classic';
                window.__classnote.font = cn.font || 'sans';
                window.__classnote.subject = cn.subject || '';
                window.__classnote.type = cn.type || '';
                window.__classnote.level = cn.level || '';
                window.__classnote.difficulty = cn.difficulty || '';
                // Restore logoData from localStorage if available
                try {
                    var logoKey = 'classnote_logo_' + courseDocId;
                    var savedLogo = localStorage.getItem(logoKey);
                    if (savedLogo) window.__classnote.logoData = savedLogo;
                } catch (e) {}

                // Restore state
                var savedState = data.state || {};
                state.courseId = data.courseId || ALL_COURSES[0].id;
                state.theme = savedState.theme || 'ink';
                state.teacherName = savedState.teacherName || '';
                state.studentName = savedState.studentName || '';
                state.date = savedState.date || '';

                // Restore sessions into the matching course
                var course = getCourse();
                if (course && data.sessions && data.sessions.length) {
                    course.sessions = data.sessions;
                }
                // Show the latest session by default
                state.sessionIdx = course && course.sessions ? Math.max(0, course.sessions.length - 1) : 0;

                // Restore published slug
                if (data.publishedSlug) {
                    currentPublishedSlug = data.publishedSlug;
                }

                // Use per-session date if available, else fall back to global
                var sess = getSession();
                if (sess && sess._date) {
                    state.date = sess._date;
                }

                // Sync UI inputs
                if (els.teacherName) els.teacherName.value = state.teacherName;
                if (els.studentName) els.studentName.value = state.studentName;
                if (els.sessionDate && state.date) {
                    // Reverse format "2026년 3월 19일" → "2026-03-19"
                    var m = state.date.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
                    if (m) {
                        var mm = m[2].length === 1 ? '0' + m[2] : m[2];
                        var dd = m[3].length === 1 ? '0' + m[3] : m[3];
                        els.sessionDate.value = m[1] + '-' + mm + '-' + dd;
                    }
                }
                // Apply theme
                var themeDot = document.querySelector('.tdot[data-theme="' + state.theme + '"]');
                if (themeDot) themeDot.click();

                // Apply layout
                var layoutBtns = document.querySelectorAll('[data-layout]');
                layoutBtns.forEach(function (b) {
                    b.classList.toggle('sb__seg-btn--active', b.getAttribute('data-layout') === cn.layout);
                });

                // Save to recent list
                _saveRecentCourse(courseDocId, course ? course.name : '');

                callback(true);
            })
            .catch(function (err) {
                console.error('Course load failed:', err);
                callback(false);
            });
    }

    function _saveRecentCourse(docId, name) {
        try {
            var recent = JSON.parse(localStorage.getItem('classnote_recent_courses') || '[]');
            recent = recent.filter(function (r) { return r.id !== docId; });
            recent.unshift({ id: docId, name: name, ts: Date.now() });
            if (recent.length > 10) recent = recent.slice(0, 10);
            localStorage.setItem('classnote_recent_courses', JSON.stringify(recent));
        } catch (e) {}
    }

    // --- Capture note data (no side effects) ---
    function captureNoteData() {
        var wrap = document.getElementById('pageWrap');
        if (!wrap) return null;

        var pages = wrap.querySelectorAll('.page');
        var pagesHtml = '';
        pages.forEach(function (pg) {
            var clone = pg.cloneNode(true);
            clone.querySelectorAll('[contenteditable]').forEach(function (el) {
                el.removeAttribute('contenteditable');
            });
            clone.querySelectorAll('.p-nav, .p-header__nav').forEach(function (el) {
                el.remove();
            });
            // Remove CRUD buttons from published output
            clone.querySelectorAll('.crud-x, .crud-add, .crud-lines, .crud-row, .crud-add--sec-sib').forEach(function (el) {
                el.remove();
            });
            // Clear "영어로 작성" placeholder for student print
            clone.querySelectorAll('.prb__a').forEach(function (el) {
                if (el.textContent.trim() === '영어로 작성') el.textContent = '';
            });
            // Strip CRUD data attributes
            clone.querySelectorAll('[data-crud-type]').forEach(function (el) {
                el.removeAttribute('data-crud-type');
                el.removeAttribute('data-crud-idx');
                el.removeAttribute('data-crud-sec');
            });
            // Remove crud-solo class
            clone.querySelectorAll('.crud-solo').forEach(function (el) {
                el.classList.remove('crud-solo');
            });
            pagesHtml += clone.outerHTML;
        });

        var cn = window.__classnote || {};
        var session = getSession();
        return {
            html: pagesHtml,
            settings: {
                theme: state.theme,
                layout: cn.layout || 'classic',
                font: cn.font || 'sans',
                brand: cn.brand || '',
                teacherName: state.teacherName || '',
                studentName: state.studentName || '',
                date: state.date || '',
                title: session ? session.title : '',
                subtitle: session ? session.subtitle : ''
            },
            timestamp: Date.now()
        };
    }

    // --- Deploy modal helpers ---
    function showDeployModal(stateName, data) {
        var overlay = document.getElementById('deployOverlay');
        var loading = document.getElementById('deployLoading');
        var success = document.getElementById('deploySuccess');
        var error = document.getElementById('deployError');

        // Reset animations by re-rendering celebration zone
        var celeb = success.querySelector('.deploy-celebration');
        if (celeb) {
            var clone = celeb.cloneNode(true);
            celeb.parentNode.replaceChild(clone, celeb);
        }

        overlay.style.display = 'flex';
        overlay.classList.remove('dmo--visible');
        loading.style.display = 'none';
        success.style.display = 'none';
        error.style.display = 'none';

        // Trigger enter animation
        requestAnimationFrame(function () {
            overlay.classList.add('dmo--visible');
        });

        if (stateName === 'loading') {
            loading.style.display = '';
        } else if (stateName === 'success') {
            success.style.display = '';

            var isFirstDeploy = data.isFirst;
            var titleEl = document.getElementById('deployTitleText');
            var descEl = document.getElementById('deployDescText');
            var flowEl = document.getElementById('deployFlow');
            var tipEl = document.getElementById('deployTip');

            if (isFirstDeploy) {
                if (titleEl) titleEl.textContent = '공유 완료!';
                if (descEl) descEl.textContent = '학생들이 수업 자료를 볼 수 있어요';
                if (flowEl) flowEl.style.display = '';
                if (tipEl) tipEl.style.display = '';
            } else {
                if (titleEl) titleEl.textContent = '업데이트 완료!';
                if (descEl) descEl.textContent = '수정 사항이 학생 페이지에 즉시 반영되었어요';
                if (flowEl) flowEl.style.display = 'none';
                if (tipEl) tipEl.style.display = 'none';
            }

            document.getElementById('deployLink').value = data.url;

            // Editor link
            var editorLinkEl = document.getElementById('deployEditorLink');
            if (editorLinkEl && data.editorUrl) {
                editorLinkEl.value = data.editorUrl;
            }
        } else if (stateName === 'error') {
            error.style.display = '';
            document.getElementById('deployErrorMsg').textContent =
                data.message || '네트워크 오류가 발생했습니다.';
        }
    }

    function hideDeployModal() {
        var overlay = document.getElementById('deployOverlay');
        overlay.classList.remove('dmo--visible');
        setTimeout(function () { overlay.style.display = 'none'; }, 300);
    }

    // --- Main publish function ---
    var currentPublishedSlug = null;

    // Clean a page clone for publishing (remove editor artifacts)
    function cleanPageClone(clone) {
        clone.querySelectorAll('[contenteditable]').forEach(function (el) {
            el.removeAttribute('contenteditable');
            // Preserve newlines: convert \n in text to <br> for student view
            if (el.innerHTML.indexOf('\n') !== -1) {
                el.innerHTML = el.innerHTML.replace(/\n/g, '<br>');
            }
        });
        clone.querySelectorAll('.p-nav, .p-header__nav').forEach(function (el) {
            el.remove();
        });
        clone.querySelectorAll('.crud-x, .crud-add, .crud-lines, .crud-sec-x, .crud-sec-add').forEach(function (el) {
            el.remove();
        });
        clone.querySelectorAll('[data-crud-type]').forEach(function (el) {
            el.removeAttribute('data-crud-type');
            el.removeAttribute('data-crud-idx');
            el.removeAttribute('data-crud-sec');
        });
        clone.querySelectorAll('.crud-solo').forEach(function (el) {
            el.classList.remove('crud-solo');
        });
        // Remove page numbers (view.js doesn't need them)
        clone.querySelectorAll('.p-page-num').forEach(function (el) {
            el.remove();
        });
        return clone;
    }

    // Capture a single session's HTML using offscreen rendering
    // Now supports multi-page: runs countPages() to split into multiple .page divs
    function captureSessionHtml(session, course) {
        var renderer = renderers[course.renderer];
        if (!renderer) return '';

        // Temporarily set sessionIdx so secOn/getEffectiveSections use this session's _sections
        var savedIdx = state.sessionIdx;
        var sessIdx = course.sessions.indexOf(session);
        if (sessIdx >= 0) state.sessionIdx = sessIdx;

        var cn = window.__classnote || {};
        var layoutCls = 'layout--' + ((cn.layout) || 'classic');
        var theme = state.theme;
        var fontVal = cn.font || 'sans';

        // Create offscreen container
        var offscreen = document.createElement('div');
        offscreen.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;visibility:hidden;';
        document.body.appendChild(offscreen);

        // Create page element matching the real one
        var page = document.createElement('div');
        page.className = 'page ' + layoutCls;
        page.setAttribute('data-theme', theme);
        if (fontVal === 'serif') page.style.fontFamily = 'var(--serif)';
        else if (fontVal === 'mono') page.style.fontFamily = 'var(--mono)';

        page.innerHTML = renderer(session, course, getCtx());
        reorderSections(page);
        offscreen.appendChild(page);

        // Allow overflow for measurement
        page.style.maxHeight = 'none';
        page.style.overflow = 'visible';
        void page.offsetHeight;

        // Use countPages to detect multi-page
        var result = countPages(page);

        if (result.count <= 1) {
            // Single page — apply fit class + margin distribution (match editor)
            page.classList.remove('fit--1', 'fit--2', 'fit--3');
            if (result.globalFit) page.classList.add(result.globalFit);
            page.classList.add('page--single');

            // Distribute spare space as extra margin among sections
            var psSecs = page.querySelectorAll('.ps');
            psSecs.forEach(function (ps) { ps.style.marginBottom = ''; });
            page.style.minHeight = '0';
            var contentH = page.scrollHeight;
            page.style.minHeight = '';
            var spare = A4_HEIGHT - contentH;
            if (spare > 20 && psSecs.length > 1) {
                var extraPerSec = Math.min(Math.floor(spare / psSecs.length), 40);
                if (extraPerSec > 2) {
                    psSecs.forEach(function (ps) {
                        var cur = parseInt(window.getComputedStyle(ps).marginBottom, 10) || 0;
                        ps.style.marginBottom = (cur + extraPerSec) + 'px';
                    });
                }
            }

            var clone = cleanPageClone(page.cloneNode(true));
            var html = clone.outerHTML;
            document.body.removeChild(offscreen);
            state.sessionIdx = savedIdx;
            return html;
        }

        // Multi-page: build separate .page divs
        var pagesHtml = '';
        var header = result.header;
        var footer = result.footer;

        for (var i = 0; i < result.pages.length; i++) {
            var pgDiv = document.createElement('div');
            pgDiv.className = 'page ' + layoutCls;
            if (result.pageFitLevel[i] > 0) pgDiv.className += ' fit--' + result.pageFitLevel[i];
            pgDiv.setAttribute('data-theme', theme);
            if (fontVal === 'serif') pgDiv.style.fontFamily = 'var(--serif)';
            else if (fontVal === 'mono') pgDiv.style.fontFamily = 'var(--mono)';

            // First page gets the header
            if (i === 0 && header) pgDiv.appendChild(header.cloneNode(true));

            // Add sections for this page
            result.pages[i].forEach(function (sec) {
                pgDiv.appendChild(sec.cloneNode(true));
            });

            // Last page gets the footer
            if (footer && i === result.pages.length - 1) {
                pgDiv.appendChild(footer.cloneNode(true));
            }

            var cleanPg = cleanPageClone(pgDiv);
            pagesHtml += cleanPg.outerHTML;
        }

        document.body.removeChild(offscreen);
        state.sessionIdx = savedIdx;
        return pagesHtml;
    }

    function publishNote() {
        syncEditablesToSession();
        var course = getCourse();
        if (!course) return;

        var cn = window.__classnote || {};
        var sessionsData = [];

        // Capture all sessions
        course.sessions.forEach(function (session) {
            var html = captureSessionHtml(session, course);
            sessionsData.push({
                html: html,
                title: session.title || '',
                subtitle: session.subtitle || ''
            });
        });

        var settings = {
            theme: state.theme,
            layout: cn.layout || 'classic',
            font: cn.font || 'sans',
            brand: cn.brand || '',
            teacherName: state.teacherName || '',
            studentName: state.studentName || '',
            date: state.date || ''
        };

        // Also keep backward-compatible single html (current session)
        var currentSession = getSession();
        var legacyNoteData = {
            html: sessionsData[state.sessionIdx] ? sessionsData[state.sessionIdx].html : '',
            settings: {
                theme: settings.theme,
                layout: settings.layout,
                font: settings.font,
                brand: settings.brand,
                teacherName: settings.teacherName,
                studentName: settings.studentName,
                date: settings.date,
                title: currentSession ? currentSession.title : '',
                subtitle: currentSession ? currentSession.subtitle : ''
            },
            timestamp: Date.now()
        };

        // Always save to localStorage as fallback
        try {
            localStorage.setItem('classnote_preview', JSON.stringify(legacyNoteData));
        } catch (e) { /* ignore */ }

        // No Firebase → fall back to local preview
        if (!db) {
            window.open('view.html', '_blank');
            return;
        }

        showDeployModal('loading');

        // Create courseDocId on first deploy
        var isFirstCourse = !currentCourseDocId;
        if (isFirstCourse) currentCourseDocId = generateSlug(8);

        var slug = currentPublishedSlug || generateSlug();

        var deployDocData = {
            sessions: sessionsData,
            html: legacyNoteData.html,
            settings: settings,
            courseDocId: currentCourseDocId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!currentPublishedSlug) {
            deployDocData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        // Build course doc data
        var cn = window.__classnote || {};
        var courseDocData = {
            courseId: state.courseId,
            classnote: {
                brand: cn.brand || '',
                sections: cn.sections || {},
                sectionNames: cn.sectionNames || {},
                layout: cn.layout || 'classic',
                font: cn.font || 'sans',
                subject: cn.subject || '',
                type: cn.type || '',
                level: cn.level || '',
                difficulty: cn.difficulty || ''
            },
            state: {
                theme: state.theme,
                teacherName: state.teacherName,
                studentName: state.studentName,
                date: state.date
            },
            sessions: JSON.parse(JSON.stringify(course.sessions)),
            publishedSlug: slug,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (isFirstCourse) {
            courseDocData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        // Timeout: 30s 후 자동 에러 표시
        var deployTimeout = setTimeout(function () {
            showDeployModal('error', { message: '시간이 초과되었습니다. 네트워크를 확인 후 다시 시도해주세요.' });
        }, 30000);

        // Save both: published note + course data
        var batch = db.batch();
        batch.set(db.collection('published_notes').doc(slug), deployDocData, { merge: true });
        batch.set(db.collection('courses').doc(currentCourseDocId), courseDocData, { merge: true });

        batch.commit().then(function () {
            clearTimeout(deployTimeout);
            currentPublishedSlug = slug;

            // Update URL with ?c= on first deploy
            if (isFirstCourse) {
                var url = new URL(location.href);
                url.searchParams.set('c', currentCourseDocId);
                history.replaceState(null, '', url.toString());
                _saveRecentCourse(currentCourseDocId, course.name);
                // Save logo to localStorage keyed by courseDocId
                if (cn.logoData) {
                    try { localStorage.setItem('classnote_logo_' + currentCourseDocId, cn.logoData); } catch (e) {}
                }
            }

            var shareUrl = 'https://class-note-material.netlify.app/view.html?id=' + slug;
            var editorUrl = 'https://class-note-material.netlify.app/templates.html?c=' + currentCourseDocId;
            showDeployModal('success', { url: shareUrl, editorUrl: editorUrl, isFirst: isFirstCourse });
        }).catch(function (err) {
            clearTimeout(deployTimeout);
            // Roll back courseDocId if first deploy failed
            if (isFirstCourse) currentCourseDocId = null;
            console.error('Deploy failed:', err);
            showDeployModal('error', {
                message: err.message || '배포 중 오류가 발생했습니다. 다시 시도해주세요.'
            });
        });
    }

    // --- Deploy button ---
    var btnPreview = document.getElementById('btnPreview');
    if (btnPreview) {
        btnPreview.addEventListener('click', publishNote);
    }

    // --- Deploy modal events ---
    var deployCopyBtn = document.getElementById('deployCopy');
    if (deployCopyBtn) {
        deployCopyBtn.addEventListener('click', function () {
            var input = document.getElementById('deployLink');
            input.select();
            navigator.clipboard.writeText(input.value).then(function () {
                var copied = document.getElementById('deployCopied');
                copied.style.display = '';
                setTimeout(function () { copied.style.display = 'none'; }, 2500);
            });
        });
    }

    document.getElementById('deployOpen').addEventListener('click', function () {
        window.open(document.getElementById('deployLink').value, '_blank');
    });

    // Editor link copy button
    var deployEditorCopy = document.getElementById('deployEditorCopy');
    if (deployEditorCopy) {
        deployEditorCopy.addEventListener('click', function () {
            var input = document.getElementById('deployEditorLink');
            input.select();
            navigator.clipboard.writeText(input.value).then(function () {
                var copied = document.getElementById('deployEditorCopied');
                copied.style.display = '';
                setTimeout(function () { copied.style.display = 'none'; }, 2500);
            });
        });
    }

    // Editor link "접속" button
    var deployEditorGo = document.getElementById('deployEditorGo');
    if (deployEditorGo) {
        deployEditorGo.addEventListener('click', function () {
            var input = document.getElementById('deployEditorLink');
            if (input && input.value) window.open(input.value, '_blank');
        });
    }

    document.getElementById('deployClose').addEventListener('click', hideDeployModal);
    document.getElementById('deployErrorClose').addEventListener('click', hideDeployModal);
    document.getElementById('deployRetry').addEventListener('click', publishNote);

    document.getElementById('deployOverlay').addEventListener('click', function (e) {
        if (e.target === this) hideDeployModal();
    });

    // B4: ESC key closes deploy modal + focus trap
    var _deployPrevFocus = null;
    var _origShowDeploy = showDeployModal;
    showDeployModal = function (stateName, data) {
        _deployPrevFocus = document.activeElement;
        _origShowDeploy(stateName, data);
        // Focus first button in modal
        setTimeout(function () {
            var modal = document.querySelector('.deploy-modal');
            if (modal) {
                var btn = modal.querySelector('button:not([style*="display:none"])');
                if (btn) btn.focus();
            }
        }, 50);
    };
    var _origHideDeploy = hideDeployModal;
    hideDeployModal = function () {
        _origHideDeploy();
        if (_deployPrevFocus) { _deployPrevFocus.focus(); _deployPrevFocus = null; }
    };
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            var overlay = document.getElementById('deployOverlay');
            if (overlay && overlay.style.display !== 'none') {
                hideDeployModal();
            }
        }
    });

    // =========================================
    // AUTO-ZOOM: fit page to preview area
    // =========================================

    var PAGE_W = 794, PAGE_H = 1123;
    var ZOOM_MIN = 0.4, ZOOM_MAX = 0.85;

    function calcPageZoom() {
        var preview = document.querySelector('.preview');
        if (!preview) return;

        var pad = 48; // top+bottom padding of preview area
        var availH = preview.clientHeight - pad;
        var availW = preview.clientWidth - 40; // left+right padding

        var zoomH = availH / PAGE_H;
        var zoomW = availW / PAGE_W;
        var zoom = Math.min(zoomH, zoomW);

        // Clamp
        zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));

        // Round to 2 decimal places for cleaner rendering
        zoom = Math.round(zoom * 100) / 100;

        preview.style.setProperty('--page-zoom', zoom);
    }

    // Run on resize
    var _resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(calcPageZoom, 60);
    });

    // Initial calc
    calcPageZoom();

    // =========================================
    // INIT
    // =========================================

    // Check for ?c= parameter (returning teacher with saved course)
    var _urlParams = new URLSearchParams(location.search);
    var _courseParam = _urlParams.get('c');

    if (_courseParam && /^[a-z0-9]{4,20}$/.test(_courseParam)) {
        // Skip onboarding, load from Firestore
        var obOverlay = document.getElementById('onboarding');
        var loadingEl = document.getElementById('editorLoading');
        if (obOverlay) obOverlay.classList.add('ob--hidden');
        document.body.classList.remove('ob-active');
        if (loadingEl) loadingEl.classList.add('editor-loading--visible');

        loadCourseFromFirestore(_courseParam, function (success) {
            if (success) {
                renderNav();
                renderPage();
                if (typeof calcPageZoom === 'function') calcPageZoom();
                // Fade out loading
                setTimeout(function () {
                    if (loadingEl) {
                        loadingEl.classList.add('editor-loading--fade-out');
                        setTimeout(function () {
                            loadingEl.classList.remove('editor-loading--visible', 'editor-loading--fade-out');
                        }, 300);
                    }
                }, 500);
            } else {
                // Load failed — fall back to onboarding
                if (obOverlay) { obOverlay.classList.remove('ob--hidden'); obOverlay.style.display = ''; }
                document.body.classList.add('ob-active');
                if (loadingEl) loadingEl.classList.remove('editor-loading--visible');
                renderNav();
                renderPage();
            }
        });
    } else {
        // Normal flow: onboarding → editor
        renderNav();
        renderPage();
    }

    // --- Autosave restore check ---
    // Deferred: only show after onboarding is complete (editor visible)
    function checkAutosave() {
        // Don't show if onboarding is still visible
        var obEl = document.getElementById('onboarding');
        if (obEl && obEl.style.display !== 'none' && obEl.offsetParent !== null) return;

        var key = 'classnote_autosave_' + state.courseId + '_' + state.sessionIdx;
        var raw;
        try { raw = localStorage.getItem(key); } catch (e) { return; }
        if (!raw) return;

        var saved;
        try { saved = JSON.parse(raw); } catch (e) { return; }

        // Only show if saved within last 24h
        if (!saved.ts || Date.now() - saved.ts > 86400000) {
            localStorage.removeItem(key);
            return;
        }

        var toast = document.getElementById('restoreToast');
        var btnYes = document.getElementById('restoreYes');
        var btnNo = document.getElementById('restoreNo');
        if (!toast || !btnYes || !btnNo) return;

        toast.style.display = 'flex';

        btnYes.addEventListener('click', function () {
            toast.style.display = 'none';

            // Restore session data
            var course = getCourse();
            if (course && saved.session) {
                course.sessions[state.sessionIdx] = saved.session;
            }

            // Restore state fields
            if (saved.teacherName !== undefined) {
                state.teacherName = saved.teacherName;
                if (els.teacherName) els.teacherName.value = saved.teacherName;
            }
            if (saved.studentName !== undefined) {
                state.studentName = saved.studentName;
                if (els.studentName) els.studentName.value = saved.studentName;
            }
            if (saved.theme) {
                var dot = document.querySelector('.tdot[data-theme="' + saved.theme + '"]');
                if (dot) dot.click();
            }

            renderPage();
        });

        btnNo.addEventListener('click', function () {
            toast.style.display = 'none';
            localStorage.removeItem(key);
        });

        // Auto-dismiss after 10s
        setTimeout(function () {
            toast.style.display = 'none';
        }, 10000);
    }
    // Run check now (in case editor is already visible)
    checkAutosave();

    // =========================================
    // WELCOME MODAL (2-step flow)
    // =========================================
    var wmGender = 'male';

    function showWelcomeModal() {
        var modal = document.getElementById('welcomeModal');
        if (!modal) return;
        modal.style.display = '';
        // Reset to step 1
        document.getElementById('wmStepInput').classList.add('wm__step--active');
        document.getElementById('wmStepReveal').classList.remove('wm__step--active');
    }

    // Gender card toggle
    var wmGenderWrap = document.getElementById('wmGender');
    if (wmGenderWrap) {
        wmGenderWrap.addEventListener('click', function (e) {
            var card = e.target.closest('.wm__gender-card');
            if (!card) return;
            wmGender = card.getAttribute('data-gender');
            wmGenderWrap.querySelectorAll('.wm__gender-card').forEach(function (c) {
                var isActive = c.getAttribute('data-gender') === wmGender;
                c.classList.toggle('wm__gender-card--active', isActive);
                // Update check dots
                var dot = c.querySelector('.wm__check-dot');
                if (dot) dot.classList.toggle('wm__check-dot--active', isActive);
                // Update label
                var lbl = c.querySelector('.wm__gender-label');
                if (lbl) lbl.classList.toggle('wm__gender-label--active', isActive);
            });
        });
    }

    // Next button → go to profile reveal
    var wmNextBtn = document.getElementById('wmNext');
    if (wmNextBtn) {
        wmNextBtn.addEventListener('click', function () {
            var nameVal = (document.getElementById('wmName').value || '').trim();
            if (!nameVal) {
                var inp = document.getElementById('wmName');
                inp.style.borderColor = '#ef4444';
                inp.focus();
                setTimeout(function () { inp.style.borderColor = ''; }, 1500);
                return;
            }

            // Populate profile reveal with data
            var isFemale = wmGender === 'female';
            var profileCard = document.getElementById('wmProfileCard');
            var avatarImg = document.getElementById('wmAvatarImg');
            var profileName = document.getElementById('wmProfileName');
            var badge = document.getElementById('wmBadge');
            var badgeText = document.getElementById('wmBadgeText');
            var greeting = document.getElementById('wmGreeting');
            var revealSub = document.getElementById('wmRevealSub');

            profileName.textContent = nameVal;
            badgeText.textContent = isFemale ? '여학생' : '남학생';
            greeting.textContent = '"오늘부터 ' + nameVal + ' 학생의 여정이 시작돼요"';
            avatarImg.src = isFemale
                ? 'images/generated-1774419137742.png'
                : 'images/generated-1774417632961.png';

            if (isFemale) {
                profileCard.classList.add('wm__profile-card--female');
                badge.style.background = '#FDF2F8';
                badge.style.color = '#EC4899';
                revealSub.textContent = '멋진 학생 카드가 생성되었어요';
            } else {
                profileCard.classList.remove('wm__profile-card--female');
                badge.style.background = '#EFF6FF';
                badge.style.color = '#3B82F6';
                revealSub.textContent = '학생 카드가 등록되었어요';
            }

            // Transition to step 2
            document.getElementById('wmStepInput').classList.remove('wm__step--active');
            document.getElementById('wmStepReveal').classList.add('wm__step--active');

            // Scroll card to top
            document.getElementById('wmCard').scrollTop = 0;
        });
    }

    // Start button → launch editor
    var wmStartBtn = document.getElementById('wmStart');
    if (wmStartBtn) {
        wmStartBtn.addEventListener('click', function () {
            var nameVal = (document.getElementById('wmName').value || '').trim();
            var modal = document.getElementById('welcomeModal');
            modal.style.opacity = '0';
            modal.style.transition = 'opacity .3s ease';
            setTimeout(function () {
                modal.style.display = 'none';
                modal.style.opacity = '';
                modal.style.transition = '';
                _launchEditorReal(nameVal, wmGender);
            }, 300);
        });
    }

    // Enter key on name input → trigger next
    var wmNameInput = document.getElementById('wmName');
    if (wmNameInput) {
        wmNameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('wmNext').click();
            }
        });
    }

    // =========================================
    // ADD STUDENT MODAL
    // =========================================
    var asmOverlay = document.getElementById('addStudentOverlay');

    // Type card toggle
    var asmTypeGrid = document.getElementById('asmTypeGrid');
    if (asmTypeGrid) {
        asmTypeGrid.addEventListener('click', function (e) {
            var card = e.target.closest('.asm__type-card');
            if (!card) return;
            asmTypeGrid.querySelectorAll('.asm__type-card').forEach(function (c) {
                c.classList.toggle('asm__type-card--active', c === card);
            });
        });
    }

    // Pill toggles (level & difficulty)
    document.querySelectorAll('.asm__pills').forEach(function (row) {
        row.addEventListener('click', function (e) {
            var pill = e.target.closest('.asm__pill');
            if (!pill) return;
            row.querySelectorAll('.asm__pill').forEach(function (p) {
                p.classList.toggle('asm__pill--active', p === pill);
            });
        });
    });

    // Cancel
    var asmCancel = document.getElementById('asmCancel');
    if (asmCancel) {
        asmCancel.addEventListener('click', function () {
            if (asmOverlay) asmOverlay.style.display = 'none';
        });
    }

    // Confirm (placeholder — just close for now)
    var asmConfirm = document.getElementById('asmConfirm');
    if (asmConfirm) {
        asmConfirm.addEventListener('click', function () {
            var name = (document.getElementById('asmName').value || '').trim();
            if (!name) {
                var inp = document.getElementById('asmName');
                inp.style.borderColor = '#ef4444';
                inp.focus();
                setTimeout(function () { inp.style.borderColor = ''; }, 1500);
                return;
            }
            // Apply student name to editor
            var studentInput = document.getElementById('studentName');
            if (studentInput) {
                studentInput.value = name;
                studentInput.dispatchEvent(new Event('input'));
            }
            asmOverlay.style.display = 'none';
            document.getElementById('asmName').value = '';
        });
    }

    // Close on overlay click
    if (asmOverlay) {
        asmOverlay.addEventListener('click', function (e) {
            if (e.target === asmOverlay) asmOverlay.style.display = 'none';
        });
    }

    // Expose for sidebar button
    window.showAddStudentModal = function () {
        if (asmOverlay) asmOverlay.style.display = '';
    };

})();
