-- Migration: Add point management tables and language preference
-- Run this on the RDS instance to add the new schema for Sprint 5 features.
-- All statements use IF NOT EXISTS / safe patterns so they can be run multiple times.

-- Points ledger (may already exist in live DB)
CREATE TABLE IF NOT EXISTS driver_points_ledger (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  driver_id  INT NOT NULL,
  sponsor_id INT NULL,
  delta      INT NOT NULL,
  reason     VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dpl_driver  (driver_id),
  INDEX idx_dpl_sponsor (sponsor_id),
  CONSTRAINT fk_dpl_driver  FOREIGN KEY (driver_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dpl_sponsor FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Password reset tokens (may already exist in live DB)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at    TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prt_user (user_id),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Scheduled/recurring point awards
CREATE TABLE IF NOT EXISTS scheduled_point_awards (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  sponsor_id    INT NOT NULL,
  driver_id     INT NULL,
  points        INT NOT NULL,
  reason        VARCHAR(255) NOT NULL,
  frequency     ENUM('once','daily','weekly','monthly') NOT NULL DEFAULT 'once',
  scheduled_date DATE NOT NULL,
  is_recurring  TINYINT(1) NOT NULL DEFAULT 0,
  is_paused     TINYINT(1) NOT NULL DEFAULT 0,
  last_run_at   TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_spa_sponsor (sponsor_id),
  INDEX idx_spa_driver  (driver_id),
  INDEX idx_spa_date    (scheduled_date),
  CONSTRAINT fk_spa_sponsor FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_spa_driver  FOREIGN KEY (driver_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Point expiration rules per sponsor
CREATE TABLE IF NOT EXISTS point_expiration_rules (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  sponsor_id    INT NOT NULL UNIQUE,
  expiry_days   INT NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_per_sponsor FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add preferred_language column to users.
-- Idempotency is handled by migrate.js ignoring duplicate-column errors.
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) NULL DEFAULT 'en';
