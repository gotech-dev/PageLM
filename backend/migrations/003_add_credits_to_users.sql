-- Add credits column to users
ALTER TABLE users
    ADD COLUMN credits INT UNSIGNED NOT NULL DEFAULT 0
        COMMENT 'Remaining credits balance for metered AI usage';

