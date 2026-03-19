/* ============================================
   클래스노트 — Student View (v4)
   Single bar, maximum A4 viewport fill,
   modern minimal UI
   ============================================ */

(function () {
    'use strict';

    var container = document.getElementById('noteContainer');
    var emptyEl = document.getElementById('viewEmpty');
    var metaEl = document.getElementById('viewMeta');
    var printBtn = document.getElementById('viewPrint');
    var loadingEl = document.getElementById('viewLoading');

    // Page navigator
    var viewPager = document.getElementById('viewPager');
    var viewPrev = document.getElementById('viewPrev');
    var viewNext = document.getElementById('viewNext');
    var viewBadge = document.getElementById('viewBadge');
    var viewDots = document.getElementById('viewDots');

    // Tool buttons
    var darkBtn = document.getElementById('viewDark');
    var shareBtn = document.getElementById('viewShare');
    var fullscreenBtn = document.getElementById('viewFullscreen');
    var pdfBtn = document.getElementById('viewPdf');
    var toastEl = document.getElementById('viewToast');

    // Session nav (v4 — inside unified bar)
    var viewNav = document.getElementById('viewNav');
    var sessionPrevBtn = document.getElementById('sessionPrev');
    var sessionNextBtn = document.getElementById('sessionNext');
    var sessionTitleEl = document.getElementById('sessionTitle');
    var sessionSelector = document.getElementById('sessionSelector');
    var sessionPopover = document.getElementById('sessionPopover');
    var sessionOverlay = document.getElementById('sessionOverlay');
    var sessionDropdownList = document.getElementById('sessionDropdownList');
    var sessionsAnchor = document.getElementById('viewSessions');

    var viewState = { pages: [], current: 0, total: 0 };

    // --- Toast ---
    var toastTimer = null;
    function showToast(msg) {
        if (!toastEl) return;
        clearTimeout(toastTimer);
        toastEl.textContent = msg;
        toastEl.style.display = '';
        toastTimer = setTimeout(function () {
            toastEl.style.display = 'none';
        }, 2500);
    }

    // --- Loading ---
    function showLoading() {
        if (loadingEl) loadingEl.style.display = '';
        container.style.display = 'none';
        emptyEl.style.display = 'none';
    }
    function hideLoading() {
        if (loadingEl) loadingEl.style.display = 'none';
    }

    // =========================================
    // DARK MODE — default to LIGHT
    // =========================================

    function initDarkMode() {
        var saved = localStorage.getItem('classnote_dark');
        applyDark(saved === 'true');
    }

    function applyDark(isDark) {
        document.documentElement.setAttribute('data-dark', isDark ? 'true' : 'false');
        if (darkBtn) darkBtn.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('classnote_dark', isDark);
    }

    if (darkBtn) {
        darkBtn.addEventListener('click', function () {
            var current = document.documentElement.getAttribute('data-dark') === 'true';
            applyDark(!current);
            requestAnimationFrame(scalePages);
        });
    }

    initDarkMode();

    // =========================================
    // SHARE
    // =========================================

    if (shareBtn) {
        shareBtn.addEventListener('click', function () {
            if (navigator.share) {
                navigator.share({ title: document.title, url: location.href }).catch(function () {});
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(location.href).then(function () {
                    showToast('링크가 복사되었습니다');
                });
            }
        });
    }

    // =========================================
    // FULLSCREEN
    // =========================================

    var fsEnterSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
    var fsExitSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function () {
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                var el = document.documentElement;
                var rfs = el.requestFullscreen || el.webkitRequestFullscreen;
                if (rfs) rfs.call(el).catch(function () {});
            } else {
                var efs = document.exitFullscreen || document.webkitExitFullscreen;
                if (efs) efs.call(document);
            }
        });
        document.addEventListener('fullscreenchange', function () {
            fullscreenBtn.innerHTML = document.fullscreenElement ? fsExitSvg : fsEnterSvg;
            setTimeout(scalePages, 100);
        });
    }

    // =========================================
    // PDF
    // =========================================

    if (pdfBtn) {
        pdfBtn.addEventListener('click', function () {
            showToast('PDF로 저장하려면 인쇄 대화상자에서 "PDF로 저장"을 선택하세요');
            setTimeout(function () {
                viewState.pages.forEach(function (pg) { pg.style.display = ''; });
                window.print();
                if (viewState.total > 1) showCurrentPage();
            }, 800);
        });
    }

    // =========================================
    // OFFLINE CACHE
    // =========================================

    var CACHE_MAX = 5;

    function cacheNote(slug, data) {
        try {
            var index = JSON.parse(localStorage.getItem('classnote_cache_index') || '[]');
            index = index.filter(function (s) { return s !== slug; });
            index.push(slug);
            while (index.length > CACHE_MAX) {
                var old = index.shift();
                localStorage.removeItem('classnote_cache_' + old);
            }
            localStorage.setItem('classnote_cache_index', JSON.stringify(index));
            localStorage.setItem('classnote_cache_' + slug, JSON.stringify(data));
        } catch (e) { /* storage full */ }
    }

    function getCachedNote(slug) {
        try {
            var raw = localStorage.getItem('classnote_cache_' + slug);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function showOfflineBanner() {
        var existing = document.querySelector('.view-offline');
        if (existing) return;
        var banner = document.createElement('div');
        banner.className = 'view-offline';
        banner.textContent = '오프라인 모드 — 마지막으로 저장된 버전입니다';
        document.body.insertBefore(banner, document.body.firstChild);
    }

    // =========================================
    // LOAD NOTE
    // =========================================

    function loadNote(callback) {
        var slug = new URLSearchParams(location.search).get('id');
        if (slug) slug = slug.toLowerCase();

        if (slug && !/^[a-z0-9]{4,20}$/.test(slug)) {
            callback(null, 'invalid');
            return;
        }

        if (slug && typeof firebase !== 'undefined' && typeof CLASSNOTE_FIREBASE !== 'undefined') {
            showLoading();
            if (!firebase.apps.length) firebase.initializeApp(CLASSNOTE_FIREBASE);
            firebase.firestore().collection('published_notes').doc(slug).get()
                .then(function (doc) {
                    if (doc.exists) {
                        var data = doc.data();
                        cacheNote(slug, data);
                        callback(data);
                    } else {
                        callback(null, 'notfound');
                    }
                })
                .catch(function (err) {
                    console.error('Firestore load failed:', err.code || '', err.message || err);
                    var cached = getCachedNote(slug);
                    if (cached) {
                        showOfflineBanner();
                        callback(cached);
                    } else {
                        callback(null, 'network');
                    }
                });
            return;
        }

        if (!slug) {
            var raw = localStorage.getItem('classnote_preview');
            if (!raw) { callback(null, 'noslug'); return; }
            try {
                callback(JSON.parse(raw));
            } catch (e) {
                callback(null, 'corrupt');
            }
            return;
        }

        callback(null, 'nofirebase');
    }

    function stripInteractive(html) {
        html = html.replace(/ contenteditable="true"/g, '');
        html = html.replace(/<button[^>]*id="(?:prevBtn|nextBtn)"[^>]*>.*?<\/button>/gs, '');
        html = html.replace(/<div[^>]*class="p-header__nav"[^>]*>[\s\S]*?<\/div>/g, '');
        html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
        html = html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
        html = html.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');
        html = html.replace(/<embed\b[^>]*>/gi, '');
        html = html.replace(/<link\b[^>]*>/gi, '');
        html = html.replace(/<meta\b[^>]*>/gi, '');
        html = html.replace(/<base\b[^>]*>/gi, '');
        html = html.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '');
        html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
        html = html.replace(/(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""');
        return html;
    }

    function showEmpty(reason) {
        hideLoading();
        container.style.display = 'none';
        emptyEl.style.display = '';

        var iconEl = emptyEl.querySelector('.vmain__empty-icon');
        var titleEl = emptyEl.querySelector('.vmain__empty-title');
        var descEl = emptyEl.querySelector('.vmain__empty-desc');

        if (reason === 'network') {
            if (iconEl) iconEl.textContent = '📡';
            if (titleEl) titleEl.textContent = '연결할 수 없습니다';
            if (descEl) descEl.textContent = '네트워크를 확인 후 새로고침해주세요.';
        } else if (reason === 'notfound' || reason === 'invalid') {
            if (iconEl) iconEl.textContent = '📄';
            if (titleEl) titleEl.textContent = '노트를 찾을 수 없습니다';
            if (descEl) descEl.textContent = '링크가 올바른지 확인해주세요.';
        } else {
            if (iconEl) iconEl.textContent = '📄';
            if (titleEl) titleEl.textContent = '노트를 찾을 수 없습니다';
            if (descEl) descEl.textContent = '선생님에게 링크를 다시 요청해주세요.';
        }
    }

    // =========================================
    // MULTI-SESSION STATE
    // =========================================

    var viewSessions = [];
    var currentSessionIdx = 0;
    var noteTheme = 'ink';
    var noteLayout = 'classic';
    var noteFont = 'sans';

    // =========================================
    // RENDER NOTE
    // =========================================

    function renderNote(data, errorReason) {
        hideLoading();

        if (data && data.sessions && data.sessions.length) {
            viewSessions = data.sessions;
        } else if (data && data.html) {
            viewSessions = [{
                html: data.html,
                title: (data.settings || {}).title || '',
                subtitle: (data.settings || {}).subtitle || ''
            }];
        } else {
            showEmpty(errorReason || 'notfound');
            return;
        }

        emptyEl.style.display = 'none';
        container.style.display = '';

        var settings = data.settings || {};
        var validThemes = ['ink', 'teal', 'forest', 'plum', 'ember', 'steel'];
        var validLayouts = ['classic', 'modern', 'compact'];

        noteTheme = validThemes.indexOf(settings.theme) !== -1 ? settings.theme : 'ink';
        noteLayout = validLayouts.indexOf(settings.layout) !== -1 ? settings.layout : 'classic';
        noteFont = settings.font || 'sans';

        // Meta
        var metaParts = [];
        if (settings.studentName) metaParts.push(settings.studentName);
        if (settings.date) metaParts.push(settings.date);
        if (metaEl && metaParts.length) {
            metaEl.textContent = metaParts.join(' · ');
        }

        // Show session nav in unified bar (only if multiple sessions)
        if (viewSessions.length > 1) {
            if (viewNav) viewNav.style.display = '';
            if (sessionsAnchor) sessionsAnchor.style.display = '';
            if (metaEl) metaEl.style.display = 'none'; // hide meta when nav visible
            buildSessionPopover();

            if (sessionPrevBtn && !sessionPrevBtn._bound) {
                sessionPrevBtn._bound = true;
                sessionPrevBtn.addEventListener('click', function () {
                    if (currentSessionIdx > 0) switchSession(currentSessionIdx - 1);
                });
            }
            if (sessionNextBtn && !sessionNextBtn._bound) {
                sessionNextBtn._bound = true;
                sessionNextBtn.addEventListener('click', function () {
                    if (currentSessionIdx < viewSessions.length - 1) switchSession(currentSessionIdx + 1);
                });
            }
            if (sessionSelector && !sessionSelector._bound) {
                sessionSelector._bound = true;
                sessionSelector.addEventListener('click', function () {
                    togglePopover();
                });
            }
            if (sessionOverlay && !sessionOverlay._bound) {
                sessionOverlay._bound = true;
                sessionOverlay.addEventListener('click', function () {
                    closePopover();
                });
            }
        }

        var sParam = new URLSearchParams(location.search).get('s');
        if (sParam) {
            var sIdx = parseInt(sParam) - 1;
            if (sIdx >= 0 && sIdx < viewSessions.length) {
                currentSessionIdx = sIdx;
            }
        }

        renderSession(currentSessionIdx);
        if (viewSessions.length > 1) updateSessionStepper(currentSessionIdx);
    }

    function renderSession(idx) {
        var session = viewSessions[idx];
        if (!session) return;

        if (session.title) {
            document.title = session.title + ' — 클래스노트';
        }

        container.innerHTML = stripInteractive(session.html);

        container.querySelectorAll('.page').forEach(function (pg) {
            pg.setAttribute('data-theme', noteTheme);
            pg.classList.add('layout--' + noteLayout);
        });

        if (noteFont !== 'sans') {
            var fontFamily = noteFont === 'serif' ? 'var(--serif)' : 'var(--mono)';
            container.querySelectorAll('.page').forEach(function (pg) {
                pg.style.fontFamily = fontFamily;
            });
        }

        setupPageNav();
        requestAnimationFrame(scalePages);
    }

    // =========================================
    // SESSION STEPPER + POPOVER
    // =========================================

    function updateSessionStepper(idx) {
        var session = viewSessions[idx];
        var label = (idx + 1) + '회차';
        var title = session.title || ('Session ' + (idx + 1));
        if (sessionTitleEl) sessionTitleEl.textContent = label + '  ·  ' + title;
        if (sessionPrevBtn) sessionPrevBtn.disabled = idx === 0;
        if (sessionNextBtn) sessionNextBtn.disabled = idx === viewSessions.length - 1;

        if (sessionDropdownList) {
            var items = sessionDropdownList.querySelectorAll('.vpop__item');
            items.forEach(function (item, i) {
                item.classList.toggle('vpop__item--active', i === idx);
            });
        }
    }

    function buildSessionPopover() {
        if (!sessionDropdownList) return;
        var html = '';
        viewSessions.forEach(function (s, i) {
            var isActive = i === currentSessionIdx;
            html += '<button class="vpop__item' + (isActive ? ' vpop__item--active' : '') + '" data-session="' + i + '">';
            html += '<span class="vpop__num">' + (i + 1) + '</span>';
            html += '<div class="vpop__text">';
            html += '<span class="vpop__title">' + (s.title || ('Session ' + (i + 1))) + '</span>';
            if (s.subtitle) {
                html += '<span class="vpop__sub">' + s.subtitle + '</span>';
            }
            html += '</div>';
            html += '</button>';
        });
        sessionDropdownList.innerHTML = html;

        sessionDropdownList.querySelectorAll('.vpop__item').forEach(function (item) {
            item.addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-session'));
                if (idx !== currentSessionIdx) switchSession(idx);
                closePopover();
            });
        });
    }

    var popoverOpen = false;

    function togglePopover() {
        if (popoverOpen) closePopover();
        else openPopover();
    }

    function openPopover() {
        popoverOpen = true;
        if (sessionPopover) sessionPopover.style.display = '';
        if (sessionOverlay) sessionOverlay.style.display = '';
        if (sessionSelector) sessionSelector.classList.add('vbar__session--open');
    }

    function closePopover() {
        popoverOpen = false;
        if (sessionPopover) sessionPopover.style.display = 'none';
        if (sessionOverlay) sessionOverlay.style.display = 'none';
        if (sessionSelector) sessionSelector.classList.remove('vbar__session--open');
    }

    function switchSession(idx) {
        currentSessionIdx = idx;
        renderSession(idx);
        updateSessionStepper(idx);
        var url = new URL(location.href);
        url.searchParams.set('s', idx + 1);
        history.replaceState(null, '', url.toString());
    }

    // =========================================
    // PAGE NAVIGATION
    // =========================================

    function setupPageNav() {
        var pages = Array.prototype.slice.call(container.querySelectorAll('.page'));
        viewState.pages = pages;
        viewState.total = pages.length;
        viewState.current = 0;

        if (pages.length <= 1) {
            if (viewPager) viewPager.style.display = 'none';
            return;
        }

        if (viewPager) viewPager.style.display = '';
        buildDots();
        updatePageNav();
        showCurrentPage();
    }

    function buildDots() {
        if (!viewDots) return;
        var html = '';
        for (var i = 0; i < viewState.total; i++) {
            html += '<div class="vpager__dot' + (i === 0 ? ' vpager__dot--active' : '') + '" data-page="' + i + '"></div>';
        }
        viewDots.innerHTML = html;
        viewDots.querySelectorAll('.vpager__dot').forEach(function (dot) {
            dot.addEventListener('click', function () {
                var pg = parseInt(this.getAttribute('data-page'));
                if (pg !== viewState.current) {
                    viewState.current = pg;
                    showCurrentPage();
                }
            });
        });
    }

    function updatePageNav() {
        if (!viewBadge) return;
        viewBadge.textContent = (viewState.current + 1) + ' / ' + viewState.total;
        if (viewPrev) viewPrev.disabled = viewState.current === 0;
        if (viewNext) viewNext.disabled = viewState.current === viewState.total - 1;
        if (viewDots) {
            viewDots.querySelectorAll('.vpager__dot').forEach(function (dot, i) {
                dot.classList.toggle('vpager__dot--active', i === viewState.current);
            });
        }
    }

    function showCurrentPage() {
        viewState.pages.forEach(function (pg, i) {
            pg.style.display = i === viewState.current ? '' : 'none';
        });
        updatePageNav();
        requestAnimationFrame(scalePages);
    }

    function goPage(delta) {
        var next = viewState.current + delta;
        if (next < 0 || next >= viewState.total) return;
        viewState.current = next;
        showCurrentPage();
    }

    // Mobile swipe
    var touchStartX = 0;
    var touchStartY = 0;
    document.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
        if (viewState.total <= 1) return;
        var dx = touchStartX - e.changedTouches[0].clientX;
        var dy = touchStartY - e.changedTouches[0].clientY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx > 0) goPage(1);
            else goPage(-1);
        }
    }, { passive: true });

    // =========================================
    // SCALE PAGES — fill viewport
    // =========================================

    function isMobileReading() {
        return window.innerWidth <= 600;
    }

    function scalePages() {
        var pages = container.querySelectorAll('.page');
        if (!pages.length) return;

        if (isMobileReading()) {
            pages.forEach(function (pg) {
                pg.style.transform = '';
                pg.style.marginBottom = '';
            });
            return;
        }

        // Only the single unified bar
        var header = document.getElementById('viewHeader');
        var headerH = header ? header.offsetHeight : 0;

        var availW = window.innerWidth - 16;
        var availH = window.innerHeight - headerH - 4;

        var pageW = 794;
        var pageH = 1123;

        var scaleW = availW / pageW;
        var scaleH = availH / pageH;
        var scale = Math.min(scaleW, scaleH, 1);

        pages.forEach(function (pg) {
            if (pg.style.display === 'none') return;
            if (scale < 0.99) {
                pg.style.transform = 'scale(' + scale + ')';
                pg.style.marginBottom = '-' + Math.round(pageH * (1 - scale)) + 'px';
            } else {
                pg.style.transform = '';
                pg.style.marginBottom = '';
            }
        });
    }

    // =========================================
    // INIT
    // =========================================

    loadNote(function (noteData, errorReason) {
        renderNote(noteData, errorReason);
        requestAnimationFrame(scalePages);
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(scalePages, 100);
    });

    document.addEventListener('keydown', function (e) {
        if (viewState.total <= 1) return;
        if (e.key === 'ArrowLeft') goPage(-1);
        if (e.key === 'ArrowRight') goPage(1);
    });

    if (printBtn) {
        printBtn.addEventListener('click', function () {
            viewState.pages.forEach(function (pg) { pg.style.display = ''; });
            window.print();
            if (viewState.total > 1) showCurrentPage();
        });
    }

    if (viewPrev) viewPrev.addEventListener('click', function () { goPage(-1); });
    if (viewNext) viewNext.addEventListener('click', function () { goPage(1); });

})();
