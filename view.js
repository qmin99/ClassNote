/* ============================================
   클래스노트 — Student View
   Reads note data and renders read-only pages.
   Phase 2: fetches from Firebase Firestore by slug
   Fallback: reads from localStorage (local preview)
   ============================================ */

(function () {
    'use strict';

    var container = document.getElementById('noteContainer');
    var emptyEl = document.getElementById('viewEmpty');
    var metaEl = document.getElementById('viewMeta');
    var printBtn = document.getElementById('viewPrint');
    var loadingEl = document.getElementById('viewLoading');

    // Page navigator elements
    var viewNav = document.getElementById('viewNav');
    var viewPrev = document.getElementById('viewPrev');
    var viewNext = document.getElementById('viewNext');
    var viewBadge = document.getElementById('viewBadge');

    // Tool buttons
    var darkBtn = document.getElementById('viewDark');
    var shareBtn = document.getElementById('viewShare');
    var fullscreenBtn = document.getElementById('viewFullscreen');
    var pdfBtn = document.getElementById('viewPdf');

    // Session stepper elements
    var sessionPrevBtn = document.getElementById('sessionPrev');
    var sessionNextBtn = document.getElementById('sessionNext');
    var sessionTitleEl = document.getElementById('sessionTitle');
    var sessionSelector = document.getElementById('sessionSelector');
    var sessionPopover = document.getElementById('sessionPopover');
    var sessionOverlay = document.getElementById('sessionOverlay');
    var sessionDropdownList = document.getElementById('sessionDropdownList');

    var viewState = { pages: [], current: 0, total: 0 };

    // --- Show/hide loading ---
    function showLoading() {
        if (loadingEl) loadingEl.style.display = '';
        container.style.display = 'none';
        emptyEl.style.display = 'none';
    }
    function hideLoading() {
        if (loadingEl) loadingEl.style.display = 'none';
    }

    // =========================================
    // A8: DARK MODE
    // =========================================

    function initDarkMode() {
        var saved = localStorage.getItem('classnote_dark');
        var isDark = saved !== null ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyDark(isDark);
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
        });
    }

    initDarkMode();

    // =========================================
    // SHARE BUTTON
    // =========================================

    if (shareBtn) {
        shareBtn.addEventListener('click', function () {
            var url = location.href;
            if (navigator.share) {
                navigator.share({ title: document.title, url: url }).catch(function () {});
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(function () {
                    showToast('링크가 복사되었습니다');
                });
            }
        });
    }

    function showToast(msg) {
        var t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;opacity:0;transition:opacity .3s';
        document.body.appendChild(t);
        requestAnimationFrame(function () { t.style.opacity = '1'; });
        setTimeout(function () {
            t.style.opacity = '0';
            setTimeout(function () { t.remove(); }, 300);
        }, 2000);
    }

    // =========================================
    // FULLSCREEN BUTTON
    // =========================================

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function () {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(function () {});
            } else {
                document.exitFullscreen();
            }
        });
        document.addEventListener('fullscreenchange', function () {
            var isFs = !!document.fullscreenElement;
            fullscreenBtn.innerHTML = isFs
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
        });
    }

    // =========================================
    // PDF BUTTON
    // =========================================

    if (pdfBtn) {
        pdfBtn.addEventListener('click', function () {
            viewState.pages.forEach(function (pg) { pg.style.display = ''; });
            showToast('PDF로 저장하려면 인쇄 대화상자에서 "PDF로 저장"을 선택하세요');
            setTimeout(function () {
                window.print();
                if (viewState.total > 1) showCurrentPage();
            }, 300);
        });
    }

    // =========================================
    // A7: OFFLINE CACHE
    // =========================================

    var CACHE_MAX = 5;

    function cacheNote(slug, data) {
        try {
            var index = JSON.parse(localStorage.getItem('classnote_cache_index') || '[]');
            // Remove existing entry for this slug
            index = index.filter(function (s) { return s !== slug; });
            index.push(slug);
            // LRU eviction
            while (index.length > CACHE_MAX) {
                var old = index.shift();
                localStorage.removeItem('classnote_cache_' + old);
            }
            localStorage.setItem('classnote_cache_index', JSON.stringify(index));
            localStorage.setItem('classnote_cache_' + slug, JSON.stringify(data));
        } catch (e) { /* storage full — ignore */ }
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

        // Validate slug format (alphanumeric, 4-20 chars)
        if (slug && !/^[a-z0-9]{4,20}$/.test(slug)) {
            callback(null, 'invalid');
            return;
        }

        // If slug exists and Firebase is available → fetch from Firestore
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
                    // A7: Try offline cache on network error
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

        // No slug → check localStorage (local preview from editor)
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

    // --- Strip interactive/dangerous elements from HTML ---
    function stripInteractive(html) {
        html = html.replace(/ contenteditable="true"/g, '');
        html = html.replace(/<button[^>]*id="(?:prevBtn|nextBtn)"[^>]*>.*?<\/button>/gs, '');
        html = html.replace(/<div[^>]*class="p-header__nav"[^>]*>[\s\S]*?<\/div>/g, '');
        // XSS: remove dangerous tags
        html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
        html = html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
        html = html.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');
        html = html.replace(/<embed\b[^>]*>/gi, '');
        html = html.replace(/<link\b[^>]*>/gi, '');
        html = html.replace(/<meta\b[^>]*>/gi, '');
        html = html.replace(/<base\b[^>]*>/gi, '');
        html = html.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '');
        // XSS: remove all on* event handler attributes
        html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
        // XSS: remove javascript: protocol in href/src/action
        html = html.replace(/(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""');
        return html;
    }

    // --- Show empty state with context ---
    function showEmpty(reason) {
        hideLoading();
        container.style.display = 'none';
        emptyEl.style.display = '';

        var iconEl = emptyEl.querySelector('.view-empty__icon');
        var titleEl = emptyEl.querySelector('.view-empty__title');
        var descEl = emptyEl.querySelector('.view-empty__desc');

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

    // --- Multi-session state ---
    var viewSessions = [];   // { html, title, subtitle }[]
    var currentSessionIdx = 0;
    var noteSettings = {};
    var noteTheme = 'ink';
    var noteLayout = 'classic';
    var noteFont = 'sans';

    var sessionsBar = document.getElementById('viewSessions');
    var footerNameEl = document.getElementById('viewFooterName');

    // --- Render note into container ---
    function renderNote(data, errorReason) {
        hideLoading();

        // Normalize: support both new sessions[] and legacy html field
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
        noteSettings = settings;

        // Validate theme/layout
        var validThemes = ['ink', 'teal', 'forest', 'plum', 'ember', 'steel'];
        var validLayouts = ['classic', 'modern', 'compact'];

        noteTheme = validThemes.indexOf(settings.theme) !== -1 ? settings.theme : 'ink';
        noteLayout = validLayouts.indexOf(settings.layout) !== -1 ? settings.layout : 'classic';
        noteFont = settings.font || 'sans';

        // Show student name in footer
        if (footerNameEl) {
            if (settings.studentName) {
                footerNameEl.textContent = settings.studentName;
            } else {
                footerNameEl.style.display = 'none';
                var sep = document.querySelector('.view-footer__sep');
                if (sep) sep.style.display = 'none';
            }
        }

        // Build session stepper (only if multiple sessions)
        if (viewSessions.length > 1 && sessionsBar) {
            buildSessionPopover();
            updateSessionStepper();
            sessionsBar.style.display = '';

            // Arrow buttons
            if (sessionPrevBtn) {
                sessionPrevBtn.addEventListener('click', function () {
                    if (currentSessionIdx > 0) switchSession(currentSessionIdx - 1);
                });
            }
            if (sessionNextBtn) {
                sessionNextBtn.addEventListener('click', function () {
                    if (currentSessionIdx < viewSessions.length - 1) switchSession(currentSessionIdx + 1);
                });
            }
            // Trigger click → toggle popover
            if (sessionSelector) {
                sessionSelector.addEventListener('click', function () { togglePopover(); });
            }
            // Overlay click → close popover
            if (sessionOverlay) {
                sessionOverlay.addEventListener('click', function () { closePopover(); });
            }
        }

        // Check ?s= parameter for initial session
        var sParam = new URLSearchParams(location.search).get('s');
        if (sParam) {
            var sIdx = parseInt(sParam) - 1; // 1-based for user
            if (sIdx >= 0 && sIdx < viewSessions.length) {
                currentSessionIdx = sIdx;
            }
        }

        // Render initial session
        renderSession(currentSessionIdx);
    }

    function renderSession(idx) {
        var session = viewSessions[idx];
        if (!session) return;

        // Set page title
        if (session.title) {
            document.title = session.title + ' — 클래스노트';
        }

        // Clean and inject HTML
        var cleanHtml = stripInteractive(session.html);
        container.innerHTML = cleanHtml;

        // Apply theme to all pages
        container.querySelectorAll('.page').forEach(function (pg) {
            pg.setAttribute('data-theme', noteTheme);
        });

        // Apply layout class
        container.querySelectorAll('.page').forEach(function (pg) {
            pg.classList.add('layout--' + noteLayout);
        });

        // Apply font
        if (noteFont !== 'sans') {
            var fontFamily = noteFont === 'serif' ? 'var(--serif)' : 'var(--mono)';
            container.querySelectorAll('.page').forEach(function (pg) {
                pg.style.fontFamily = fontFamily;
            });
        }

        // Setup page navigation
        setupPageNav();
        requestAnimationFrame(scalePages);
    }

    function switchSession(idx) {
        currentSessionIdx = idx;
        renderSession(idx);
        updateSessionStepper();
        closePopover();

        // Update URL ?s= parameter
        var url = new URL(location.href);
        url.searchParams.set('s', idx + 1);
        history.replaceState(null, '', url.toString());

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // =========================================
    // SESSION STEPPER + POPOVER
    // =========================================

    function updateSessionStepper() {
        if (!sessionTitleEl) return;
        var s = viewSessions[currentSessionIdx];
        var title = s.title || ('Session ' + (currentSessionIdx + 1));
        sessionTitleEl.textContent = (currentSessionIdx + 1) + '회차  \u00b7  ' + title;
        if (sessionPrevBtn) sessionPrevBtn.disabled = currentSessionIdx === 0;
        if (sessionNextBtn) sessionNextBtn.disabled = currentSessionIdx === viewSessions.length - 1;
    }

    function buildSessionPopover() {
        if (!sessionDropdownList) return;
        var html = '';
        viewSessions.forEach(function (s, i) {
            var title = s.title || ('Session ' + (i + 1));
            var sub = s.subtitle || '';
            var active = i === currentSessionIdx ? ' view-sessions__item--active' : '';
            html += '<button class="view-sessions__item' + active + '" data-idx="' + i + '">'
                + '<span class="view-sessions__item-num">' + (i + 1) + '</span>'
                + '<span class="view-sessions__item-text">'
                + '<span class="view-sessions__item-title">' + title + '</span>'
                + (sub ? '<span class="view-sessions__item-sub">' + sub + '</span>' : '')
                + '</span></button>';
        });
        sessionDropdownList.innerHTML = html;

        sessionDropdownList.querySelectorAll('.view-sessions__item').forEach(function (item) {
            item.addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-idx'));
                if (idx !== currentSessionIdx) switchSession(idx);
            });
        });
    }

    function openPopover() {
        if (!sessionPopover || !sessionOverlay) return;
        // Rebuild to update active state
        buildSessionPopover();
        sessionPopover.style.display = '';
        sessionOverlay.style.display = '';
        if (sessionSelector) sessionSelector.classList.add('view-sessions__trigger--open');
    }

    function closePopover() {
        if (sessionPopover) sessionPopover.style.display = 'none';
        if (sessionOverlay) sessionOverlay.style.display = 'none';
        if (sessionSelector) sessionSelector.classList.remove('view-sessions__trigger--open');
    }

    function togglePopover() {
        var isOpen = sessionPopover && sessionPopover.style.display !== 'none';
        if (isOpen) closePopover();
        else openPopover();
    }

    // --- Page navigation ---
    function setupPageNav() {
        var pages = Array.prototype.slice.call(container.querySelectorAll('.page'));
        viewState.pages = pages;
        viewState.total = pages.length;
        viewState.current = 0;

        if (pages.length <= 1) {
            if (viewNav) viewNav.style.display = 'none';
            return;
        }

        if (viewNav) viewNav.style.display = '';
        updatePageNav();
        showCurrentPage();
    }

    function updatePageNav() {
        if (!viewBadge) return;
        viewBadge.textContent = (viewState.current + 1) + ' / ' + viewState.total;
        if (viewPrev) viewPrev.disabled = viewState.current === 0;
        if (viewNext) viewNext.disabled = viewState.current === viewState.total - 1;
    }

    function showCurrentPage() {
        viewState.pages.forEach(function (pg, i) {
            pg.style.display = i === viewState.current ? '' : 'none';
        });
        updatePageNav();
        requestAnimationFrame(scalePages);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function goPage(delta) {
        var next = viewState.current + delta;
        if (next < 0 || next >= viewState.total) return;
        viewState.current = next;
        showCurrentPage();
    }

    // --- Mobile swipe support ---
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
        // Only horizontal swipe (dx > dy to avoid scroll conflicts)
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx > 0) goPage(1);   // swipe left → next
            else goPage(-1);          // swipe right → prev
        }
    }, { passive: true });

    // --- B1: Scale pages (skip on mobile — use reading mode) ---
    function isMobileReading() {
        return window.innerWidth <= 600;
    }

    function scalePages() {
        var pages = container.querySelectorAll('.page');
        if (!pages.length) return;
        // B1: mobile reading mode — no scaling
        if (isMobileReading()) {
            pages.forEach(function (pg) {
                pg.style.transform = '';
                pg.style.marginBottom = '';
            });
            return;
        }
        var viewBody = document.querySelector('.view-body');
        if (!viewBody) return;
        var viewWidth = viewBody.clientWidth - 40;
        pages.forEach(function (pg) {
            if (pg.style.display === 'none') return;
            var pageWidth = pg.offsetWidth || 794;
            if (viewWidth < pageWidth) {
                var scale = viewWidth / pageWidth;
                pg.style.transform = 'scale(' + scale + ')';
                pg.style.marginBottom = '-' + Math.round(pg.offsetHeight * (1 - scale)) + 'px';
            } else {
                pg.style.transform = '';
                pg.style.marginBottom = '';
            }
        });
    }

    // --- Init ---
    loadNote(function (noteData, errorReason) {
        renderNote(noteData, errorReason);
        requestAnimationFrame(scalePages);
    });

    // --- Resize debounce ---
    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(scalePages, 150);
    });

    // --- Keyboard arrow navigation ---
    document.addEventListener('keydown', function (e) {
        if (viewState.total <= 1) return;
        if (e.key === 'ArrowLeft') goPage(-1);
        if (e.key === 'ArrowRight') goPage(1);
    });

    // Print button
    if (printBtn) {
        printBtn.addEventListener('click', function () {
            // Show all pages for print
            viewState.pages.forEach(function (pg) { pg.style.display = ''; });
            window.print();
            // Restore current page view
            if (viewState.total > 1) showCurrentPage();
        });
    }

    // Page nav buttons
    if (viewPrev) viewPrev.addEventListener('click', function () { goPage(-1); });
    if (viewNext) viewNext.addEventListener('click', function () { goPage(1); });

    // =========================================
    // A9: SCROLL HIDE HEADER
    // =========================================

    var lastScrollY = 0;
    var scrollDelta = 0;
    var headerHidden = false;
    var SCROLL_THRESHOLD = 60;

    window.addEventListener('scroll', function () {
        var currentY = window.scrollY;
        var diff = currentY - lastScrollY;

        if (diff > 0) {
            // Scrolling down
            scrollDelta += diff;
            if (scrollDelta > SCROLL_THRESHOLD && !headerHidden && currentY > 100) {
                headerHidden = true;
                var header = document.querySelector('.view-header');
                if (header) header.classList.add('view-header--hidden');
                if (viewNav) viewNav.classList.add('view-nav--hidden');
            }
        } else {
            // Scrolling up
            scrollDelta = 0;
            if (headerHidden) {
                headerHidden = false;
                var header = document.querySelector('.view-header');
                if (header) header.classList.remove('view-header--hidden');
                if (viewNav) viewNav.classList.remove('view-nav--hidden');
            }
        }

        lastScrollY = currentY;
    }, { passive: true });

})();
