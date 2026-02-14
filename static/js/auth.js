/* ============================================
   AUTH.JS — AlgoQuest Authentication UI v2.0
   Password toggle, form loading, validation
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {

    /* ---- Password Toggle ---- */
    document.querySelectorAll('[data-password-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var targetId = btn.getAttribute('data-target');
            var input = document.getElementById(targetId);
            if (!input) return;

            var icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                if (icon) {
                    icon.classList.remove('bi-eye');
                    icon.classList.add('bi-eye-slash');
                }
                btn.setAttribute('aria-label', 'Hide password');
            } else {
                input.type = 'password';
                if (icon) {
                    icon.classList.remove('bi-eye-slash');
                    icon.classList.add('bi-eye');
                }
                btn.setAttribute('aria-label', 'Show password');
            }
            input.focus();
        });
    });

    /* ---- Form Submit Loading State ---- */
    document.querySelectorAll('.js-auth-form').forEach(function (form) {
        form.addEventListener('submit', function () {
            var submitBtn = form.querySelector('.auth-submit-btn');
            if (!submitBtn) return;

            var loadingText = submitBtn.getAttribute('data-loading-text') || 'Please wait...';
            submitBtn.disabled = true;
            submitBtn.classList.add('btn-loading');
            submitBtn.innerHTML =
                '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>' +
                loadingText;
        });
    });

    /* ---- Focus glow effect on inputs ---- */
    document.querySelectorAll('.auth-card .form-control').forEach(function (input) {
        input.addEventListener('focus', function () {
            this.closest('.mb-3, .mb-4')?.classList.add('input-focused');
        });
        input.addEventListener('blur', function () {
            this.closest('.mb-3, .mb-4')?.classList.remove('input-focused');
        });
    });

    /* ---- Real-time validation styling ---- */
    document.querySelectorAll('.auth-card input[required]').forEach(function (input) {
        input.addEventListener('input', function () {
            if (this.classList.contains('is-invalid') && this.value.trim() !== '') {
                this.classList.remove('is-invalid');
                var feedback = this.parentElement.querySelector('.invalid-feedback');
                if (feedback) {
                    feedback.style.display = 'none';
                }
            }
        });
    });

    /* ---- Password strength indicator (signup) ---- */
    var passwordInput = document.getElementById('id_password1');
    if (passwordInput) {
        var strengthBar = document.createElement('div');
        strengthBar.className = 'password-strength-bar mt-2';
        strengthBar.innerHTML = '<div class="strength-fill"></div>';
        strengthBar.style.cssText = 'height:4px;background:var(--aq-border);border-radius:9999px;overflow:hidden;';

        var fill = strengthBar.querySelector('.strength-fill');
        fill.style.cssText = 'height:100%;width:0;border-radius:9999px;transition:width 0.3s ease, background 0.3s ease;';

        var helpText = passwordInput.closest('.mb-3, .mb-4');
        if (helpText) {
            helpText.appendChild(strengthBar);
        }

        passwordInput.addEventListener('input', function () {
            var val = this.value;
            var score = 0;
            if (val.length >= 8) score++;
            if (val.length >= 12) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            var pct = Math.min((score / 5) * 100, 100);
            var color = '#EF4444';
            if (score >= 4) color = '#10B981';
            else if (score >= 3) color = '#F59E0B';
            else if (score >= 2) color = '#FB923C';

            fill.style.width = pct + '%';
            fill.style.background = color;
        });
    }
});
