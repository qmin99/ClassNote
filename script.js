/* ============================================
   클래스노트 (ClassNote) — Landing Page Scripts
   ============================================ */

(function () {
    'use strict';

    // --- Nav scroll behavior ---
    const nav = document.getElementById('nav');

    function handleNavScroll() {
        nav.classList.toggle('nav--scrolled', window.scrollY > 40);
    }

    window.addEventListener('scroll', handleNavScroll, { passive: true });

    // --- Mobile menu ---
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            this.classList.toggle('active');
            navLinks.classList.toggle('active');
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });

        navLinks.querySelectorAll('.nav__link').forEach(function (link) {
            link.addEventListener('click', function () {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // --- Smooth scroll ---
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var targetId = this.getAttribute('href');
            if (targetId === '#') return;
            var target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                var offset = nav.offsetHeight + 20;
                var top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: top, behavior: 'smooth' });
            }
        });
    });

    // --- Scroll reveal (anim-scroll, anim-blur, anim-scale, stagger-group) ---
    // Delay observer start so hero entrance finishes first
    var revealElements = document.querySelectorAll('.anim-scroll, .anim-blur, .anim-scale, .stagger-group');

    var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
    });

    setTimeout(function () {
        revealElements.forEach(function (el) {
            revealObserver.observe(el);
        });
    }, 1200);

    // --- Counter count-up animation ---
    function animateCounter(el) {
        var target = parseInt(el.dataset.target, 10);
        var suffix = el.dataset.suffix || '';
        var duration = 1600;
        var start = performance.now();

        function tick(now) {
            var elapsed = now - start;
            var progress = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.round(eased * target);
            el.textContent = current + suffix;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    var counterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.counter').forEach(function (el) {
        counterObserver.observe(el);
    });

    // --- Template theme toggle ---
    var themeBtns = document.querySelectorAll('.theme-btn');
    var templatesSection = document.querySelector('.templates');

    if (templatesSection) {
        themeBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                themeBtns.forEach(function (b) { b.classList.remove('theme-btn--active'); });
                this.classList.add('theme-btn--active');
            });
        });
    }

    // --- Email signup ---
    var signupForm = document.getElementById('signupForm');
    var emailInput = document.getElementById('emailInput');
    var signupSuccess = document.getElementById('signupSuccess');

    if (signupForm) {
        signupForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = emailInput.value.trim();
            if (!email) return;

            var signups = JSON.parse(localStorage.getItem('classnote_signups') || '[]');
            signups.push({ email: email, date: new Date().toISOString() });
            localStorage.setItem('classnote_signups', JSON.stringify(signups));

            signupForm.hidden = true;
            signupSuccess.hidden = false;
            signupSuccess.style.opacity = '0';
            signupSuccess.style.transform = 'translateY(12px)';
            requestAnimationFrame(function () {
                signupSuccess.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
                signupSuccess.style.opacity = '1';
                signupSuccess.style.transform = 'translateY(0)';
            });
        });
    }

})();
