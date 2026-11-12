FROM dunglas/frankenphp:1-php8.4-alpine

WORKDIR /app
RUN install-php-extensions pdo_mysql mbstring fileinfo \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY deployment/php.ini /usr/local/etc/php/conf.d/zz-sadaku.ini
COPY Caddyfile /etc/caddy/Caddyfile
COPY php ./php
COPY index.html ./public/index.html
COPY assets/css/style.css assets/css/interface.css ./public/assets/css/
COPY assets/js ./public/assets/js
COPY assets/images ./public/assets/images
COPY deployment/api.php ./public/php/api.php
COPY deployment/entrypoint.sh /usr/local/bin/sadaku-entrypoint
RUN chmod +x /usr/local/bin/sadaku-entrypoint

ENV APP_ENV=production PORT=80
EXPOSE 80
ENTRYPOINT ["/usr/local/bin/sadaku-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
