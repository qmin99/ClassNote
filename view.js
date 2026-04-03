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

    // Session dropdown elements
    var sessionSelect = document.getElementById('viewSessionSelect');
    var sessionTrigger = document.getElementById('viewSessionTrigger');
    var sessionLabel = document.getElementById('viewSessionLabel');
    var sessionDropdown = document.getElementById('viewSessionDropdown');
    var viewDivider = document.getElementById('viewDivider');

    // Tool buttons
    var shareBtn = document.getElementById('viewShare');
    var fullscreenBtn = document.getElementById('viewFullscreen');
    var pdfBtn = document.getElementById('viewPdf');

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
        t.setAttribute('data-toast', '');
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

    // --- Fullscreen: immersive mode ---
    var fsExitBtn = null;

    function enterFullscreen() {
        document.documentElement.requestFullscreen().catch(function () {});
    }

    function exitFullscreen() {
        if (document.fullscreenElement) document.exitFullscreen();
    }

    function applyFullscreenUI(isFs) {
        var header = document.querySelector('.view-header');
        var body = document.querySelector('.view-body');
        if (isFs) {
            // Hide header
            if (header) header.style.display = 'none';
            // Dark bg, center content
            document.body.style.background = '#111';
            if (body) { body.style.padding = '0'; body.style.justifyContent = 'center'; body.style.minHeight = '100vh'; }
            // Create floating exit button
            if (!fsExitBtn) {
                fsExitBtn = document.createElement('button');
                fsExitBtn.className = 'fs-exit-btn';
                fsExitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
                fsExitBtn.title = '전체화면 종료';
                fsExitBtn.addEventListener('click', exitFullscreen);
                document.body.appendChild(fsExitBtn);
            }
            fsExitBtn.style.display = '';
            // Show floating page nav if multi-page
            var navEl = document.getElementById('viewNav');
            if (navEl && viewState.total > 1) {
                navEl.classList.add('fs-nav-float');
            }
            // Scale page to fit viewport
            scalePagesFullscreen();
        } else {
            // Restore header
            if (header) header.style.display = '';
            document.body.style.background = '';
            if (body) { body.style.padding = ''; body.style.justifyContent = ''; body.style.minHeight = ''; }
            if (fsExitBtn) fsExitBtn.style.display = 'none';
            var navEl = document.getElementById('viewNav');
            if (navEl) navEl.classList.remove('fs-nav-float');
            // Restore normal scaling
            var pages = container.querySelectorAll('.page');
            pages.forEach(function (pg) {
                pg.style.transform = '';
                pg.style.marginBottom = '';
                pg.style.transformOrigin = '';
            });
            requestAnimationFrame(scalePages);
        }
    }

    function scalePagesFullscreen() {
        var pages = container.querySelectorAll('.page');
        if (!pages.length) return;
        var vh = window.innerHeight;
        var vw = window.innerWidth;
        pages.forEach(function (pg) {
            if (pg.style.display === 'none') return;
            var pw = pg.offsetWidth || 794;
            var ph = pg.offsetHeight || 1123;
            var scaleH = vh / ph;
            var scaleW = vw / pw;
            var scale = Math.min(scaleH, scaleW);
            pg.style.transformOrigin = 'top center';
            pg.style.transform = 'scale(' + scale + ')';
            pg.style.marginBottom = '-' + Math.round(ph * (1 - scale)) + 'px';
        });
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function () {
            if (!document.fullscreenElement) {
                enterFullscreen();
            } else {
                exitFullscreen();
            }
        });
        document.addEventListener('fullscreenchange', function () {
            var isFs = !!document.fullscreenElement;
            applyFullscreenUI(isFs);
            fullscreenBtn.innerHTML = isFs
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
        });
    }

    // =========================================
    // PDF BUTTON (html2canvas + jsPDF for mobile)
    // =========================================

    function isMobileDevice() {
        return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth <= 820 && 'ontouchstart' in window);
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    var pdfLibsReady = null; // cache the promise

    function ensurePdfLibs() {
        if (typeof html2canvas !== 'undefined' && typeof jspdf !== 'undefined') {
            return Promise.resolve();
        }
        if (!pdfLibsReady) {
            pdfLibsReady = loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
                .then(function () {
                    return loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
                });
        }
        return pdfLibsReady;
    }

    // Recursively inline all computed styles on element tree
    // Reads from the LIVE DOM (main window) so CSS vars are fully resolved
    function inlineAllStyles(el) {
        var computed = window.getComputedStyle(el);
        var props = ['color','background-color','background-image',
            'border-color','border-top-color','border-bottom-color','border-left-color','border-right-color',
            'border-top-width','border-bottom-width','border-left-width','border-right-width',
            'border-top-style','border-bottom-style','border-left-style','border-right-style',
            'font-family','font-size','font-weight','font-style','line-height','letter-spacing',
            'text-decoration','text-decoration-color','text-align','text-transform',
            'padding-top','padding-right','padding-bottom','padding-left',
            'margin-top','margin-right','margin-bottom','margin-left',
            'display','flex-direction','align-items','justify-content','gap','flex-wrap','flex-grow','flex-shrink',
            'opacity','box-shadow','border-radius',
            'overflow','overflow-x','overflow-y','white-space','word-break',
            'grid-template-columns','grid-template-rows','column-gap','row-gap',
            'list-style-type','vertical-align','position','top','left','right','bottom',
            'width','height','min-width','min-height','max-width','max-height',
            'box-sizing','outline'];
        for (var i = 0; i < props.length; i++) {
            var val = computed.getPropertyValue(props[i]);
            if (val) el.style.setProperty(props[i], val);
        }
        for (var j = 0; j < el.children.length; j++) {
            inlineAllStyles(el.children[j]);
        }
    }

    function generatePdf() {
        showToast('PDF 준비 중...');
        pdfBtn.disabled = true;
        if (printBtn) printBtn.disabled = true;

        ensurePdfLibs().then(function () {
            var pages = Array.prototype.slice.call(container.querySelectorAll('.page'));
            if (!pages.length) { pdfBtn.disabled = false; if (printBtn) printBtn.disabled = false; return; }

            // Show ALL pages and force A4 desktop layout
            viewState.pages.forEach(function (pg) { pg.style.display = ''; });
            pages.forEach(function (pg) {
                pg.style.cssText = 'display:flex !important;flex-direction:column;width:794px !important;min-width:794px !important;max-width:794px !important;height:1123px !important;min-height:1123px !important;max-height:1123px !important;padding:48px 60px !important;margin:0;zoom:1 !important;transform:none !important;overflow:hidden;box-sizing:border-box;background:#fff;';
            });

            // Inline all resolved CSS on original DOM (CSS vars → real values)
            pages.forEach(function (pg) { inlineAllStyles(pg); });

            // Remove toasts from DOM before capture
            document.querySelectorAll('[data-toast]').forEach(function (t) { t.remove(); });

            showToast('PDF 생성 중...');
            // Immediately hide the toast we just created
            var genToast = document.querySelector('[data-toast]');
            if (genToast) genToast.style.display = 'none';

            var pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            var pdfW = 210;
            var pdfH = 297;
            var scale = 2;

            function capturePage(idx) {
                if (idx >= pages.length) {
                    // Clean restore: re-render session (removes all inline hacks)
                    renderSession(currentSessionIdx);

                    var title = document.title.replace(' — 클래스노트', '') || 'classnote';

                    // iOS Safari doesn't support <a download> or pdf.save
                    // Open PDF in new tab so user can share/save from there
                    var blob = pdf.output('blob');
                    var blobUrl = URL.createObjectURL(blob);
                    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                        // iOS: open in new tab (user can share/save from Safari)
                        window.location.href = blobUrl;
                    } else if (/Android/i.test(navigator.userAgent)) {
                        // Android: try anchor download, fallback to open
                        var a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = title + '.pdf';
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(function () { a.remove(); }, 1000);
                    } else {
                        pdf.save(title + '.pdf');
                        URL.revokeObjectURL(blobUrl);
                    }

                    pdfBtn.disabled = false;
                    if (printBtn) printBtn.disabled = false;
                    showToast('PDF가 생성되었습니다');
                    return;
                }

                if (idx > 0) pdf.addPage();

                html2canvas(pages[idx], {
                    scale: scale,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    width: 794,
                    height: 1123
                }).then(function (canvas) {
                    var imgData = canvas.toDataURL('image/jpeg', 0.92);
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
                    capturePage(idx + 1);
                }).catch(function () {
                    capturePage(idx + 1);
                });
            }

            // Let forced layout settle before capture
            setTimeout(function () { capturePage(0); }, 300);
        }).catch(function () {
            showToast('PDF 라이브러리를 불러올 수 없습니다. 네트워크를 확인해주세요.');
            pdfBtn.disabled = false;
            if (printBtn) printBtn.disabled = false;
            pdfLibsReady = null;
        });
    }

    if (pdfBtn) {
        pdfBtn.addEventListener('click', function () {
            if (isMobileDevice()) {
                generatePdf();
            } else {
                viewState.pages.forEach(function (pg) { pg.style.display = ''; });
                window.print();
                if (viewState.total > 1) showCurrentPage();
            }
        });
    }

    // =========================================
    // A7: OFFLINE CACHE
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

    // --- Strip interactive/dangerous elements from HTML ---
    function stripInteractive(html) {
        html = html.replace(/<div class="prb__a"[^>]*>영어로 작성<\/div>/g, '<div class="prb__a prb__a--student"></div>');
        html = html.replace(/ contenteditable="true"/g, '');
        html = html.replace(/<button[^>]*class="crud-[^"]*"[^>]*>.*?<\/button>/gs, '');
        html = html.replace(/<div[^>]*class="crud-row"[^>]*>[\s\S]*?<\/div>/g, '');
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
    var viewSessions = [];
    var currentSessionIdx = 0;
    var noteSettings = {};
    var noteTheme = 'ink';
    var noteLayout = 'classic';
    var noteFont = 'sans';

    // --- Render note into container ---
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
        noteSettings = settings;

        var validThemes = ['ink', 'teal', 'forest', 'plum', 'ember', 'steel'];
        var validLayouts = ['classic', 'modern', 'compact'];

        noteTheme = validThemes.indexOf(settings.theme) !== -1 ? settings.theme : 'ink';
        noteLayout = validLayouts.indexOf(settings.layout) !== -1 ? settings.layout : 'classic';
        noteFont = settings.font || 'sans';

        if (metaEl && settings.studentName) {
            metaEl.textContent = settings.studentName;
        }

        var sParam = new URLSearchParams(location.search).get('s');
        if (sParam) {
            var sIdx = parseInt(sParam) - 1;
            if (sIdx >= 0 && sIdx < viewSessions.length) {
                currentSessionIdx = sIdx;
            }
        } else {
            // Default to latest (last) session
            currentSessionIdx = viewSessions.length - 1;
        }

        renderSession(currentSessionIdx);
    }

    // =========================================
    // SESSION DROPDOWN
    // =========================================

    function buildSessionDropdown() {
        if (!sessionSelect || viewSessions.length <= 1) {
            if (sessionSelect) sessionSelect.style.display = 'none';
            if (viewDivider) viewDivider.style.display = 'none';
            return;
        }

        sessionSelect.style.display = '';

        if (sessionLabel) {
            sessionLabel.textContent = 'Session ' + (currentSessionIdx + 1);
        }

        var html = '';
        viewSessions.forEach(function (s, i) {
            var title = s.title || ('Session ' + (i + 1));
            var active = i === currentSessionIdx ? ' view-session-select__item--active' : '';
            html += '<button class="view-session-select__item' + active + '" data-session="' + i + '">'
                + '<span class="view-session-select__num">' + (i + 1) + '</span>'
                + '<span>' + title + '</span>'
                + '</button>';
        });
        if (sessionDropdown) sessionDropdown.innerHTML = html;

        // Bind dropdown item clicks
        if (sessionDropdown) {
            sessionDropdown.querySelectorAll('.view-session-select__item').forEach(function (item) {
                item.addEventListener('click', function () {
                    var newIdx = parseInt(this.getAttribute('data-session'));
                    if (newIdx !== currentSessionIdx) switchSession(newIdx);
                    closeSessionDropdown();
                });
            });
        }
    }

    function closeSessionDropdown() {
        if (sessionSelect) sessionSelect.classList.remove('view-session-select--open');
    }

    // Toggle dropdown
    if (sessionTrigger) {
        sessionTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            sessionSelect.classList.toggle('view-session-select--open');
        });
    }
    document.addEventListener('click', closeSessionDropdown);

    // =========================================
    // RENDER SESSION
    // =========================================

    function renderSession(idx) {
        var session = viewSessions[idx];
        if (!session) return;

        if (session.title) {
            document.title = session.title + ' — 클래스노트';
        }

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

        // Footer: keep brand + teacher name as-is

        // Apply font
        if (noteFont !== 'sans') {
            var fontFamily = noteFont === 'serif' ? 'var(--serif)' : 'var(--mono)';
            container.querySelectorAll('.page').forEach(function (pg) {
                pg.style.fontFamily = fontFamily;
            });
        }

        // Hide Korean translations and add toggle buttons
        setupKoToggle();

        // Build session dropdown + page nav
        buildSessionDropdown();
        setupPageNav();
        requestAnimationFrame(scalePages);
    }

    function setupKoToggle() {
        var koEls = container.querySelectorAll('.pl__ko');
        if (!koEls.length) return;

        // Hide all Korean by default
        koEls.forEach(function (ko) { ko.classList.add('pl__ko--hidden'); });

        // Find the 핵심 문장 header and add eye icon
        container.querySelectorAll('.psh').forEach(function (psh) {
            var title = psh.querySelector('.psh__t');
            if (!title || title.textContent.trim() !== '핵심 문장') return;

            var btn = document.createElement('button');
            btn.className = 'ko-toggle';
            btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
            btn.title = '해석 보기';
            btn.addEventListener('click', function () {
                var isHidden = koEls[0].classList.contains('pl__ko--hidden');
                koEls.forEach(function (ko) {
                    ko.classList.toggle('pl__ko--hidden', !isHidden);
                });
                btn.classList.toggle('ko-toggle--on', isHidden);
                btn.title = isHidden ? '해석 숨기기' : '해석 보기';
            });
            psh.appendChild(btn);
        });
    }

    function switchSession(idx) {
        currentSessionIdx = idx;
        renderSession(idx);

        var url = new URL(location.href);
        url.searchParams.set('s', idx + 1);
        history.replaceState(null, '', url.toString());

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- Page navigation ---
    function setupPageNav() {
        var pages = Array.prototype.slice.call(container.querySelectorAll('.page'));
        viewState.pages = pages;
        viewState.total = pages.length;
        viewState.current = 0;

        if (pages.length <= 1) {
            if (viewNav) viewNav.style.display = 'none';
            if (viewDivider) viewDivider.style.display = 'none';
            return;
        }

        if (viewNav) viewNav.style.display = '';
        // Show divider if both session selector and page nav are visible
        if (viewDivider && viewSessions.length > 1) viewDivider.style.display = '';

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
            if (i === viewState.current) {
                pg.style.display = '';
                pg.classList.remove('page--enter');
                void pg.offsetWidth; // force reflow
                pg.classList.add('page--enter');
            } else {
                pg.style.display = 'none';
                pg.classList.remove('page--enter');
            }
        });
        updatePageNav();
        requestAnimationFrame(document.fullscreenElement ? scalePagesFullscreen : scalePages);
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
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx > 0) goPage(1);
            else goPage(-1);
        }
    }, { passive: true });

    // --- Scale pages ---
    function isMobileReading() {
        return window.innerWidth <= 600;
    }

    function scalePages() {
        var pages = container.querySelectorAll('.page');
        if (!pages.length) return;
        if (isMobileReading()) {
            pages.forEach(function (pg) {
                pg.style.zoom = '';
                pg.style.transform = '';
                pg.style.marginBottom = '';
            });
            return;
        }
        // Match editor's zoom approach: fit A4 page within viewport
        var header = document.querySelector('.view-header');
        var headerH = header ? header.offsetHeight : 50;
        var availH = window.innerHeight - headerH - 64; // 64px padding
        var viewBody = document.querySelector('.view-body');
        var availW = viewBody ? viewBody.clientWidth - 40 : window.innerWidth - 40;
        var pageW = 794;
        var pageH = 1123;
        var scaleH = availH / pageH;
        var scaleW = availW / pageW;
        var zoom = Math.min(scaleH, scaleW, 1); // never exceed 100%
        zoom = Math.max(zoom, 0.4); // never go below 40%
        pages.forEach(function (pg) {
            if (pg.style.display === 'none') return;
            pg.style.zoom = zoom;
            pg.style.transform = '';
            pg.style.marginBottom = '';
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
        resizeTimer = setTimeout(document.fullscreenElement ? scalePagesFullscreen : scalePages, 150);
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
            if (isMobileDevice()) {
                generatePdf();
            } else {
                viewState.pages.forEach(function (pg) { pg.style.display = ''; });
                window.print();
                if (viewState.total > 1) showCurrentPage();
            }
        });
    }

    // Page nav buttons
    if (viewPrev) viewPrev.addEventListener('click', function () { goPage(-1); });
    if (viewNext) viewNext.addEventListener('click', function () { goPage(1); });

    // =========================================
    // SCROLL HIDE HEADER
    // =========================================

    var lastScrollY = 0;
    var scrollDelta = 0;
    var headerHidden = false;
    var SCROLL_THRESHOLD = 60;

    window.addEventListener('scroll', function () {
        var currentY = window.scrollY;
        var diff = currentY - lastScrollY;

        if (diff > 0) {
            scrollDelta += diff;
            if (scrollDelta > SCROLL_THRESHOLD && !headerHidden && currentY > 100) {
                headerHidden = true;
                var header = document.querySelector('.view-header');
                if (header) header.classList.add('view-header--hidden');
            }
        } else {
            scrollDelta = 0;
            if (headerHidden) {
                headerHidden = false;
                var header = document.querySelector('.view-header');
                if (header) header.classList.remove('view-header--hidden');
            }
        }

        lastScrollY = currentY;
    }, { passive: true });

})();
