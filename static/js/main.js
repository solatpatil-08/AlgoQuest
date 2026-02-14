/* ============================================
   MAIN.JS — AlgoQuest Global Scripts v2.0
   Toast, alerts, smooth scroll, active nav
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {

    /* ---- Show all Bootstrap toasts ---- */
    document.querySelectorAll('.toast').forEach(function (el) {
        new bootstrap.Toast(el).show();
    });

    /* ---- Auto-dismiss alerts after 5s ---- */
    document.querySelectorAll('.alert:not(.alert-permanent)').forEach(function (alert) {
        setTimeout(function () {
            alert.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(function () { alert.remove(); }, 400);
        }, 5000);
    });

    /* ---- Smooth scroll for anchor links ---- */
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    /* ---- Navbar active link highlight ---- */
    var currentPath = window.location.pathname;
    document.querySelectorAll('.navbar-aq .nav-link').forEach(function (link) {
        var href = link.getAttribute('href');
        if (href && href !== '#' && currentPath.startsWith(href) && href !== '/') {
            link.classList.add('active');
        }
    });

    /* ---- Navbar shrink on scroll ---- */
    var navbar = document.querySelector('.navbar-aq');
    if (navbar) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 30) {
                navbar.style.padding = '0.4rem 0';
                navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
            } else {
                navbar.style.padding = '0.65rem 0';
                navbar.style.boxShadow = '';
            }
        }, { passive: true });
    }

    /* ---- Dropdown menu styling ---- */
    document.querySelectorAll('.dropdown-menu').forEach(function (menu) {
        menu.style.borderRadius = 'var(--aq-radius-md)';
        menu.style.padding = '0.5rem 0';
        menu.style.marginTop = '0.5rem';
    });

    /* ---- Intersection Observer for fade-in animations ---- */
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-up');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.observe-fade').forEach(function (el) {
            observer.observe(el);
        });
    }

    /* ---- Disable double submit on all forms ---- */
    document.querySelectorAll('form').forEach(function (form) {
        var submitted = false;
        form.addEventListener('submit', function () {
            if (submitted) {
                event.preventDefault();
                return;
            }
            submitted = true;
            /* Reset after 10s in case of error */
            setTimeout(function () { submitted = false; }, 10000);
        });
    });

    /* ---- Back to top button (auto-created) ---- */
    var backToTop = document.createElement('button');
    backToTop.innerHTML = '<i class="bi bi-chevron-up"></i>';
    backToTop.className = 'btn btn-primary btn-icon';
    backToTop.setAttribute('aria-label', 'Back to top');
    backToTop.style.cssText = 'position:fixed;bottom:2rem;right:2rem;z-index:1040;opacity:0;pointer-events:none;transition:opacity 0.3s ease,transform 0.3s ease;transform:translateY(10px);width:42px;height:42px;border-radius:50%;box-shadow:0 4px 14px rgba(37,99,235,0.3);';
    document.body.appendChild(backToTop);

    backToTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', function () {
        if (window.scrollY > 400) {
            backToTop.style.opacity = '1';
            backToTop.style.pointerEvents = 'auto';
            backToTop.style.transform = 'translateY(0)';
        } else {
            backToTop.style.opacity = '0';
            backToTop.style.pointerEvents = 'none';
            backToTop.style.transform = 'translateY(10px)';
        }
    }, { passive: true });
});

