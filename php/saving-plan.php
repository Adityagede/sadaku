<?php
declare(strict_types=1);

function plan_schedule(array $plan, string $date): string
{
    $value = max($date, $plan['startDate']);
    $cursor = new DateTimeImmutable($value, new DateTimeZone('Asia/Jakarta'));
    if ($plan['frequency'] === 'daily') return $value;
    if ($plan['frequency'] === 'weekly') {
        $days = ((int) $plan['scheduleDay'] - (int) $cursor->format('w') + 7) % 7;
        return $cursor->modify("+$days days")->format('Y-m-d');
    }
    $monthly = static function (DateTimeImmutable $month) use ($plan): string {
        return $month->setDate((int) $month->format('Y'), (int) $month->format('m'), min((int) $plan['scheduleDay'], (int) $month->format('t')))->format('Y-m-d');
    };
    $scheduled = $monthly($cursor);
    return $scheduled >= $value ? $scheduled : $monthly($cursor->modify('first day of next month'));
}

function plan_next(array $plan, string $date): string
{
    return plan_schedule($plan, (new DateTimeImmutable($date))->modify('+1 day')->format('Y-m-d'));
}

function plan_period(array $plan, string $date): ?array
{
    if ($date < $plan['startDate']) return null;
    $cursor = new DateTimeImmutable($date);
    $start = $date;
    if ($plan['frequency'] === 'weekly') {
        $days = ((int) $cursor->format('w') - (int) $plan['scheduleDay'] + 7) % 7;
        $start = $cursor->modify("-$days days")->format('Y-m-d');
    } elseif ($plan['frequency'] === 'monthly') {
        $month = $cursor->modify('first day of this month');
        $start = plan_schedule([...$plan, 'startDate' => $month->format('Y-m-d')], $month->format('Y-m-d'));
        if ($start > $date) {
            $month = $month->modify('-1 month');
            $start = plan_schedule([...$plan, 'startDate' => $month->format('Y-m-d')], $month->format('Y-m-d'));
        }
    }
    return $start < $plan['startDate'] ? null : ['start' => $start, 'end' => plan_next($plan, $start)];
}

function plan_deposits(array $plan, array $entries, string $albumId, string $date): int
{
    $period = plan_period($plan, $date);
    if (!$period) return 0;
    $amount = 0;
    foreach ($entries as $entry) {
        if ($entry['albumId'] === $albumId && $entry['type'] === 'deposit' && $entry['date'] >= $period['start'] && $entry['date'] < $period['end'] && $entry['date'] <= $date) $amount += $entry['amount'];
    }
    return $amount;
}

function reminder_due(array $album, array $entries, DateTimeImmutable $now): bool
{
    $plan = $album['plan'];
    $now = $now->setTimezone(new DateTimeZone('Asia/Jakarta'));
    $date = $now->format('Y-m-d');
    return $plan && !$plan['paused'] && $plan['reminderEnabled'] && $album['balance'] < $album['target']
        && plan_schedule($plan, $date) === $date && $now->format('H:i') >= $plan['reminderTime']
        && plan_deposits($plan, $entries, $album['id'], $date) < $plan['amount'];
}
