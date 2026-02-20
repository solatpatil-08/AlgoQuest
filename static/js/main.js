/* ============================================
   MAIN.JS - AlgoQuest Global Scripts v2.1
   Toast, alerts, smooth scroll, active nav
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {
    var THEME_STORAGE_KEY = 'aq-theme';
    var root = document.documentElement;
    var systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function getStoredTheme() {
        try {
            return window.localStorage.getItem(THEME_STORAGE_KEY);
        } catch (err) {
            return null;
        }
    }

    function getSystemTheme() {
        return systemThemeQuery && systemThemeQuery.matches ? 'dark' : 'light';
    }

    function syncThemeToggleUI(theme) {
        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            var icon = button.querySelector('[data-theme-icon]');
            var label = button.querySelector('[data-theme-label]');
            var nextTheme = theme === 'dark' ? 'light' : 'dark';

            button.setAttribute('aria-label', 'Switch to ' + nextTheme + ' mode');
            button.setAttribute('title', 'Switch to ' + nextTheme + ' mode');

            if (icon) {
                icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
            }
            if (label) {
                label.textContent = theme === 'dark' ? 'Light' : 'Dark';
            }
        });
    }

    function applyTheme(theme, persistChoice) {
        var normalizedTheme = theme === 'dark' ? 'dark' : 'light';
        root.setAttribute('data-theme', normalizedTheme);
        root.setAttribute('data-bs-theme', normalizedTheme);
        root.style.colorScheme = normalizedTheme;
        syncThemeToggleUI(normalizedTheme);

        if (persistChoice) {
            try {
                window.localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
            } catch (err) {
                // Ignore storage access errors silently.
            }
        }

        if (typeof window.CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('aq:themechange', {
                detail: { theme: normalizedTheme }
            }));
        }
    }

    var storedTheme = getStoredTheme();
    var initialTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : getSystemTheme();
    applyTheme(initialTheme, false);

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
        button.addEventListener('click', function () {
            var currentTheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
        });
    });

    if (!storedTheme && systemThemeQuery) {
        var systemThemeListener = function (event) {
            applyTheme(event.matches ? 'dark' : 'light', false);
        };
        if (typeof systemThemeQuery.addEventListener === 'function') {
            systemThemeQuery.addEventListener('change', systemThemeListener);
        } else if (typeof systemThemeQuery.addListener === 'function') {
            systemThemeQuery.addListener(systemThemeListener);
        }
    }

    /* ---- Show all Bootstrap toasts ---- */
    document.querySelectorAll('.toast').forEach(function (el) {
        new bootstrap.Toast(el).show();
    });

    /* ---- Auto-dismiss alerts marked explicitly ---- */
    document.querySelectorAll('.alert.alert-auto-dismiss').forEach(function (alert) {
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
            var href = this.getAttribute('href');
            
            // Ignore href="#" (used for dropdowns, modals, etc.)
            if (!href || href === '#') {
                return;
            }
            
            // Guard against invalid selectors
            try {
                var target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } catch (err) {
                // Invalid selector, silently ignore.
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
                navbar.style.boxShadow = 'var(--aq-navbar-scroll-shadow)';
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
        form.addEventListener('submit', function (event) {
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
    backToTop.style.cssText = 'position:fixed;bottom:2rem;right:2rem;z-index:1040;opacity:0;pointer-events:none;transition:opacity 0.3s ease,transform 0.3s ease;transform:translateY(10px);width:42px;height:42px;border-radius:50%;box-shadow:var(--aq-shadow-blue);';
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

