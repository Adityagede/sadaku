<?php
declare(strict_types=1);

function environment(string $key, string $default = ''): string
{
    static $values = null;
    if ($values === null) {
        $values = [];
        $file = dirname(__DIR__) . '/.env';
        if (is_file($file)) {
            $lines = file($file, FILE_IGNORE_NEW_LINES);
            if ($lines === false) {
                throw new RuntimeException('File .env tidak dapat dibaca.');
            }
            foreach ($lines as $index => $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }
                if (!preg_match('/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/D', $line, $matches)) {
                    throw new RuntimeException('Format .env tidak valid pada baris ' . ($index + 1) . '.');
                }
                $value = trim($matches[2]);
                if ($value !== '' && ($value[0] === '"' || $value[0] === "'")) {
                    if (strlen($value) < 2 || substr($value, -1) !== $value[0]) {
                        throw new RuntimeException('Tanda kutip .env belum ditutup pada baris ' . ($index + 1) . '.');
                    }
                    $value = substr($value, 1, -1);
                }
                $values[$matches[1]] = $value;
            }
        }
    }

    $systemValue = getenv($key);
    return $systemValue !== false ? $systemValue : ($values[$key] ?? $default);
}
