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

    // --- Hero step slider (Scale+Fade intro → Slide Left loop) ---
    (function () {
        var screen = document.querySelector('.hero__mockup-screen');
        if (!screen) return;
        var imgs = screen.querySelectorAll('img');
        var dots = document.querySelectorAll('.hero__step-dot');
        var current = 2; // starts on Step 3
        var introPlayed = false;

        function slideLeft(next) {
            var prev = current;
            current = next;
            dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });

            imgs[prev].classList.remove('active');
            imgs[prev].classList.add('exit-left');

            imgs[current].style.transition = 'none';
            imgs[current].classList.remove('exit-left');
            imgs[current].style.transform = 'translateX(100%)';
            imgs[current].style.opacity = '0';

            requestAnimationFrame(function () {
                imgs[current].style.transition = '';
                imgs[current].classList.add('active');
                imgs[current].style.transform = '';
                imgs[current].style.opacity = '';
            });

            setTimeout(function () { imgs[prev].classList.remove('exit-left'); }, 700);
        }

        function introScaleFade() {
            // Step 3 → Step 1 with pure Scale+Fade (no slide)
            var prev = current;
            current = 0;
            introPlayed = true;

            dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });

            // Exit: Step 3 shrinks out
            imgs[prev].classList.remove('active');
            imgs[prev].style.transition = 'transform 0.8s cubic-bezier(0.4,0,0.2,1), opacity 0.8s ease';
            imgs[prev].style.transform = 'scale(0.92)';
            imgs[prev].style.opacity = '0';

            // Enter: Step 1 starts at scale(1.08), no translateX
            imgs[current].style.transition = 'none';
            imgs[current].style.transform = 'scale(1.08)';
            imgs[current].style.opacity = '0';
            imgs[current].offsetHeight; // force reflow — lock starting state
            imgs[current].style.transition = 'transform 0.8s cubic-bezier(0.4,0,0.2,1), opacity 0.8s ease';
            imgs[current].style.transform = 'scale(1)';
            imgs[current].style.opacity = '1';
            imgs[current].classList.add('active');

            // Clean up inline styles after transition ends
            setTimeout(function () {
                imgs[prev].style.transition = '';
                imgs[prev].style.transform = '';
                imgs[prev].style.opacity = '';
                imgs[current].style.transition = '';
                imgs[current].style.transform = '';
                imgs[current].style.opacity = '';
            }, 900);
        }

        function tick() {
            if (!introPlayed) {
                introScaleFade();
                setTimeout(tick, 1800);
            } else {
                var next = (current + 1) % imgs.length;
                slideLeft(next);
                setTimeout(tick, 1800);
            }
        }

        dots.forEach(function (dot, i) {
            dot.addEventListener('click', function () {
                if (i === current) return;
                introPlayed = true;
                slideLeft(i);
            });
        });

        // Start: wait 2s showing Step 3, then intro transition
        setTimeout(tick, 2000);
    })();

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
