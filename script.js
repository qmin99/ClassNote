/* ============================================
   클래스노트 (Classnote) — Landing Page Scripts
   ============================================ */

(function () {
    'use strict';

    // --- Nav scroll behavior ---
    const nav = document.getElementById('nav');
    let lastScroll = 0;

    function handleNavScroll() {
        const scrollY = window.scrollY;
        nav.classList.toggle('nav--scrolled', scrollY > 40);
        lastScroll = scrollY;
    }

    window.addEventListener('scroll', handleNavScroll, { passive: true });

    // --- Mobile menu ---
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    hamburger.addEventListener('click', function () {
        this.classList.toggle('active');
        navLinks.classList.toggle('active');
        document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });

    // Close mobile menu on link click
    navLinks.querySelectorAll('.nav__link').forEach(function (link) {
        link.addEventListener('click', function () {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

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

    // --- Scroll animations ---
    var scrollElements = document.querySelectorAll('.anim-scroll');

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                // Stagger children if it's a grid
                var children = entry.target.children;
                if (entry.target.classList.contains('pain__grid') ||
                    entry.target.classList.contains('templates__grid') ||
                    entry.target.classList.contains('pricing__grid') ||
                    entry.target.classList.contains('how__steps')) {
                    Array.from(children).forEach(function (child, i) {
                        child.style.opacity = '0';
                        child.style.transform = 'translateY(24px)';
                        child.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ' + (i * 0.1) + 's, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ' + (i * 0.1) + 's';
                        requestAnimationFrame(function () {
                            child.style.opacity = '1';
                            child.style.transform = 'translateY(0)';
                        });
                    });
                }
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
    });

    scrollElements.forEach(function (el) {
        observer.observe(el);
    });

    // --- Template theme toggle ---
    var themeBtns = document.querySelectorAll('.theme-btn');
    var templatesSection = document.querySelector('.templates');

    themeBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            // Update active button
            themeBtns.forEach(function (b) { b.classList.remove('theme-btn--active'); });
            this.classList.add('theme-btn--active');

            // Apply theme
            var theme = this.getAttribute('data-theme');
            templatesSection.setAttribute('data-active-theme', theme);

            // Animate cards
            var cards = document.querySelectorAll('.template-card__page');
            cards.forEach(function (card, i) {
                card.style.transform = 'scale(0.96)';
                card.style.opacity = '0.7';
                setTimeout(function () {
                    card.style.transform = 'scale(1)';
                    card.style.opacity = '1';
                }, 150 + i * 50);
            });
        });
    });

    // Set initial theme
    templatesSection.setAttribute('data-active-theme', 'warm');

    // --- Pricing toggle ---
    var pricingToggle = document.getElementById('pricingToggle');
    var isYearly = false;

    pricingToggle.addEventListener('click', function () {
        isYearly = !isYearly;
        this.classList.toggle('active', isYearly);

        // Update labels
        document.querySelectorAll('.pricing__toggle-label').forEach(function (label) {
            label.classList.remove('pricing__toggle-label--active');
        });
        var period = isYearly ? 'yearly' : 'monthly';
        document.querySelector('[data-period="' + period + '"]').classList.add('pricing__toggle-label--active');

        // Update prices with animation
        document.querySelectorAll('.pricing__card-amount[data-monthly]').forEach(function (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
            setTimeout(function () {
                el.textContent = isYearly ? el.getAttribute('data-yearly') : el.getAttribute('data-monthly');
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 200);
        });
    });

    // --- Email signup ---
    var signupForm = document.getElementById('signupForm');
    var emailInput = document.getElementById('emailInput');
    var signupSuccess = document.getElementById('signupSuccess');

    signupForm.addEventListener('submit', function (e) {
        e.preventDefault();

        var email = emailInput.value.trim();
        if (!email) return;

        // Save to localStorage (MVP — no backend)
        var signups = JSON.parse(localStorage.getItem('classnote_signups') || '[]');
        signups.push({ email: email, date: new Date().toISOString() });
        localStorage.setItem('classnote_signups', JSON.stringify(signups));

        // Show success
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

    // --- Hero mockup float animation ---
    var mockupCards = document.querySelectorAll('.mockup-card');
    var startTime = Date.now();

    function animateMockups() {
        var t = (Date.now() - startTime) / 1000;
        mockupCards.forEach(function (card, i) {
            var offset = Math.sin(t * 0.8 + i * 1.2) * 6;
            var baseRotate = [-2, 3, -1][i] || 0;
            card.style.transform = 'rotate(' + baseRotate + 'deg) translateY(' + offset + 'px)';
        });
        requestAnimationFrame(animateMockups);
    }

    animateMockups();

})();
