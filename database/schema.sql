CREATE TABLE IF NOT EXISTS albums (
    id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    name VARCHAR(70) NOT NULL,
    target BIGINT UNSIGNED NOT NULL,
    deadline DATE NULL,
    motivation VARCHAR(180) NOT NULL DEFAULT '',
    color ENUM('sage', 'peach', 'lilac', 'sand') NOT NULL DEFAULT 'sage',
    image MEDIUMBLOB NULL,
    image_type VARCHAR(32) NULL,
    image_version CHAR(16) NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT albums_positive_target CHECK (target > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saving_plans (
    album_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    frequency ENUM('daily', 'weekly', 'monthly') NOT NULL,
    amount BIGINT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    schedule_day TINYINT UNSIGNED NOT NULL DEFAULT 1,
    reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_time TIME NOT NULL DEFAULT '19:00:00',
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT plans_album FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    CONSTRAINT plans_positive_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    endpoint_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    subscription TEXT NOT NULL,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reminder_deliveries (
    album_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    subscription_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    due_date DATE NOT NULL,
    sent_at DATETIME NOT NULL,
    PRIMARY KEY (album_id, subscription_id, due_date),
    CONSTRAINT deliveries_album FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    CONSTRAINT deliveries_subscription FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entries (
    id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    album_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    type ENUM('deposit', 'withdrawal') NOT NULL,
    amount BIGINT UNSIGNED NOT NULL,
    date DATE NOT NULL,
    note VARCHAR(120) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL,
    INDEX entries_album_date (album_id, date, created_at),
    CONSTRAINT entries_album FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    CONSTRAINT entries_positive_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
