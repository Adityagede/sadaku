#!/bin/sh
set -eu

: "${DB_HOST:?Isi DB_HOST database online}"
: "${DB_DATABASE:?Isi DB_DATABASE}"
: "${DB_USERNAME:?Isi DB_USERNAME khusus aplikasi}"
: "${DB_PASSWORD:?Isi DB_PASSWORD}"
: "${APP_KEY:?Isi APP_KEY acak minimal 32 karakter}"
: "${APP_USER:?Isi APP_USER untuk akses pemilik}"
: "${APP_PASSWORD_HASH:?Isi APP_PASSWORD_HASH bcrypt}"

if [ "${#APP_KEY}" -lt 32 ]; then
    echo 'APP_KEY harus minimal 32 karakter.' >&2
    exit 1
fi
case "$APP_USER" in
    *[!a-zA-Z0-9_-]*|'') echo 'APP_USER hanya boleh berisi huruf, angka, garis bawah, dan tanda minus.' >&2; exit 1 ;;
esac
case "$APP_PASSWORD_HASH" in
    '$2a$'*|'$2b$'*|'$2y$'*) ;;
    *) echo 'APP_PASSWORD_HASH harus berupa hash bcrypt.' >&2; exit 1 ;;
esac
if [ "${APP_ENV:-}" != 'production' ]; then
    echo 'Container ini harus memakai APP_ENV=production.' >&2
    exit 1
fi

exec "$@"
