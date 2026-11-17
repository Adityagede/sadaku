import { $ } from './dom.js';

export function createAppMenu() {
    const appMenu = $('#app-menu');
    let appMenuOpener = null;
    function closeAppMenu(restoreFocus = false) {
        if (!appMenuOpener) return;
        const opener = appMenuOpener;
        appMenuOpener = null;
        opener.setAttribute('aria-expanded', 'false');
        appMenu.setAttribute('inert', '');
        if (restoreFocus) opener.focus({ preventScroll: true });
    }

    function toggleAppMenu(button) {
        if (appMenuOpener === button) {
            closeAppMenu(true);
            return;
        }
        closeAppMenu();
        if (button.parentElement !== appMenu.parentElement) button.after(appMenu);
        appMenuOpener = button;
        button.setAttribute('aria-expanded', 'true');
        appMenu.removeAttribute('inert');
        $('[data-action="settings"]', appMenu).focus({ preventScroll: true });
    }

    document.addEventListener('click', event => {
        if (appMenuOpener && !appMenuOpener.contains(event.target) && !appMenu.contains(event.target)) closeAppMenu();
        if (appMenu.contains(event.target) && event.target.closest('a[href]')) closeAppMenu(true);
    });
    document.addEventListener('focusin', event => {
        if (appMenuOpener && !appMenuOpener.contains(event.target) && !appMenu.contains(event.target)) closeAppMenu();
    });
    document.addEventListener('keydown', event => {
        if (appMenuOpener && event.key === 'Escape') {
            event.preventDefault();
            closeAppMenu(true);
        }
    });


    return { closeAppMenu, toggleAppMenu };
}
