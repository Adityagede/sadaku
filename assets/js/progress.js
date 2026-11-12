export function calculateProgress(balance, target) {
    if (!Number.isFinite(balance) || !Number.isFinite(target) || target <= 0) return 0;
    return Math.min(100, Math.max(0, balance * 100 / target));
}

export function formatProgress(value) {
    if (value === 0) return '0%';
    if (value >= 100) return '100%';
    if (value < 0.0001) return '<0,0001%';
    if (value > 99.99) return '>99,99%';
    return new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: value < 0.1 ? 4 : 2
    }).format(value) + '%';
}
