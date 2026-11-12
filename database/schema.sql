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
