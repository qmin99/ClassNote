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

    // --- Load note data (callback-based for async Firestore) ---
    function loadNote(callback) {
        var slug = new URLSearchParams(location.search).get('id');

        // If slug exists and Firebase is available → fetch from Firestore
        if (slug && typeof firebase !== 'undefined' && typeof CLASSNOTE_FIREBASE !== 'undefined') {
            firebase.initializeApp(CLASSNOTE_FIREBASE);
            firebase.firestore().collection('published_notes').doc(slug).get()
                .then(function (doc) {
                    callback(doc.exists ? doc.data() : null);
                })
                .catch(function () {
                    callback(null);
                });
            return;
        }

        // Fallback: localStorage (local preview from editor)
        var raw = localStorage.getItem('classnote_preview');
        if (!raw) { callback(null); return; }

        try {
            callback(JSON.parse(raw));
        } catch (e) {
            callback(null);
        }
    }

    // --- Strip interactive elements from HTML ---
    function stripInteractive(html) {
        html = html.replace(/ contenteditable="true"/g, '');
        html = html.replace(/<button[^>]*id="(?:prevBtn|nextBtn)"[^>]*>.*?<\/button>/gs, '');
        html = html.replace(/<div[^>]*class="p-header__nav"[^>]*>[\s\S]*?<\/div>/g, '');
        return html;
    }

    // --- Render note into container ---
    function renderNote(data) {
        if (!data || !data.html) {
            container.style.display = 'none';
            emptyEl.style.display = '';
            return;
        }

        emptyEl.style.display = 'none';
        container.style.display = '';

        var settings = data.settings || {};

        // Set page title
        if (settings.title) {
            document.title = settings.title + ' — 클래스노트';
        }

        // Show meta info in header
        var metaParts = [];
        if (settings.teacherName) metaParts.push(settings.teacherName + ' 선생님');
        if (settings.brand) metaParts.push(settings.brand);
        if (metaEl && metaParts.length) {
            metaEl.textContent = metaParts.join(' · ');
        }

        // Clean the HTML
        var cleanHtml = stripInteractive(data.html);

        // Inject into container
        container.innerHTML = cleanHtml;

        // Apply theme to all pages
        var theme = settings.theme || 'ink';
        container.querySelectorAll('.page').forEach(function (pg) {
            pg.setAttribute('data-theme', theme);
        });

        // Apply layout class to all pages
        var layout = settings.layout || 'classic';
        container.querySelectorAll('.page').forEach(function (pg) {
            pg.classList.add('layout--' + layout);
        });

        // Apply font to all pages
        var font = settings.font || 'sans';
        if (font !== 'sans') {
            var fontFamily = font === 'serif' ? 'var(--serif)' : 'var(--mono)';
            container.querySelectorAll('.page').forEach(function (pg) {
                pg.style.fontFamily = fontFamily;
            });
        }
    }

    // --- Init ---
    loadNote(function (noteData) {
        renderNote(noteData);
    });

    // Print button
    if (printBtn) {
        printBtn.addEventListener('click', function () {
            window.print();
        });
    }
})();
