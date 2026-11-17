// Run before styles load so a saved dark theme never flashes a light page.
(() => {
    const key = 'sadaku.theme';
    const choices = ['system', 'light', 'dark'];
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let preference = 'system';
    try {
        const saved = localStorage.getItem(key);
        if (choices.includes(saved)) preference = saved;
    } catch { /* Private browsing can make storage unavailable. */ }

    function apply() {
        const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121b17' : '#214a3c');
        window.dispatchEvent(new CustomEvent('sadaku:theme', { detail: { preference, theme } }));
    }

    window.SadakuTheme = Object.freeze({
        getPreference: () => preference,
        setPreference(value) {
            if (!choices.includes(value)) return false;
            preference = value;
            let saved = true;
            try { localStorage.setItem(key, value); } catch { saved = false; }
            apply();
            return saved;
        }
    });
    media.addEventListener('change', () => { if (preference === 'system') apply(); });
    window.addEventListener('storage', event => {
        if (event.key !== key && event.key !== null) return;
        preference = choices.includes(event.newValue) ? event.newValue : 'system';
        apply();
    });
    apply();
})();
