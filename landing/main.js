// ChofyAI Studio · Landing page — interactividad mínima.
// Sin frameworks, sin build step. Solo lo que añade valor real.
// Deploy trigger: 2026-05-22.

(() => {
    'use strict';

    // ─── Scroll-spy en la nav ────────────────────────────────
    const sections = ['tools', 'platforms', 'stack', 'install', 'docs', 'about']
        .map((id) => document.getElementById(id))
        .filter(Boolean);
    const navLinks = document.querySelectorAll('.nav-links a');

    const setActive = (id) => {
        navLinks.forEach((a) => {
            const href = a.getAttribute('href');
            a.classList.toggle('active', href === `#${id}`);
        });
    };

    if ('IntersectionObserver' in window && sections.length) {
        const io = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (visible) setActive(visible.target.id);
            },
            { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
        );
        sections.forEach((s) => io.observe(s));
    }

    // ─── Detección de plataforma del visitante ──────────────
    // Añadimos una pista contextual en el bloque Install si detectamos Windows.
    const installGrid = document.querySelector('.install-grid');
    if (installGrid) {
        const ua = navigator.userAgent.toLowerCase();
        const isWin = ua.includes('windows');
        const isLinux = ua.includes('linux') && !ua.includes('android');
        const isMac = ua.includes('mac');

        if (isWin || isLinux || isMac) {
            const hint = document.createElement('p');
            hint.className = 'install-hint';
            hint.style.cssText =
                'grid-column: 1 / -1; text-align: center; color: var(--fg-mute); ' +
                'font-size: 0.92rem; margin: 0 0 12px; padding: 12px 16px; ' +
                'background: var(--bg-3); border: 1px solid var(--border); border-radius: 10px;';
            const platform = isMac ? 'macOS' : isWin ? 'Windows' : 'Linux';
            const emoji = isMac ? '🍎' : isWin ? '🪟' : '🐧';
            hint.innerHTML = `${emoji} Detectamos que estás en <strong>${platform}</strong>. Sigue el bloque correspondiente.`;
            installGrid.insertBefore(hint, installGrid.firstChild);
        }
    }

    // ─── Año dinámico en el footer ──────────────────────────
    const year = new Date().getFullYear();
    document.querySelectorAll('.footer-bottom span').forEach((s) => {
        if (s.textContent.includes('©')) {
            s.textContent = s.textContent.replace(/\d{4}/, String(year));
        }
    });
})();
