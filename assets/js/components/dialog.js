import { $ } from './dom.js';

export function createDialogs() {
    let toastTimer;
    let lastDialogOpener;
    function notify(message) {
        clearTimeout(toastTimer);
        $('#toast').textContent = message;
        $('#toast').hidden = false;
        toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
    }

    function openDialog(dialog) {
        lastDialogOpener = document.activeElement;
        const error = $('.form-error', dialog);
        if (error) error.textContent = '';
        dialog.showModal();
        document.body.classList.add('dialog-open');
    }

    function setBusy(dialog, busy) {
        dialog.dataset.busy = String(busy);
        dialog.querySelectorAll('button, input, textarea, select').forEach(control => {
            if (busy) {
                control.dataset.originalDisabled = String(control.disabled);
                control.disabled = true;
            } else {
                control.disabled = control.dataset.originalDisabled === 'true';
                delete control.dataset.originalDisabled;
            }
        });
        const submit = $('button[type="submit"]', dialog) || $('#confirm-delete', dialog);
        if (submit) {
            if (busy) {
                submit.dataset.originalText = submit.textContent;
                submit.textContent = 'Menyimpan…';
            } else {
                submit.textContent = submit.dataset.originalText;
            }
        }
    }


    return { notify, openDialog, setBusy, restoreFocus() { if (lastDialogOpener?.isConnected) lastDialogOpener.focus(); else $('#konten').focus({ preventScroll: true }); } };
}
