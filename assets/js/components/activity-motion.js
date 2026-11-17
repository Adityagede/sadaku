export function bindActivityMotion(root) {
    const running = new WeakMap();
    root.addEventListener('click', event => {
        const summary = event.target.closest('.activity-row');
        if (!summary || event.defaultPrevented || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const item = summary.closest('.activity-item');
        const content = item?.querySelector('.activity-detail');
        if (!content || typeof item.animate !== 'function') return;
        event.preventDefault();
        const previous = running.get(item);
        const expanded = previous ? !previous.expanded : !item.open;
        const from = item.getBoundingClientRect().height;
        previous?.animation.cancel();
        item.open = true;
        const to = expanded ? item.getBoundingClientRect().height : summary.getBoundingClientRect().height + item.offsetHeight - item.clientHeight;
        const animation = item.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
        running.set(item, { animation, expanded });
        animation.onfinish = () => {
            if (running.get(item)?.animation !== animation) return;
            item.open = expanded;
            running.delete(item);
            animation.cancel();
        };
    });
}
