-- Migration 003: System Monitoring tables
-- Adds: system_config, system_config_changelog, login_attempts
-- Adds columns: reviewed_at/reviewed_by on driver_points_ledger,
--               next_run_at/run_count/last_error on scheduled_point_awards

-- System configuration key-value store
CREATE TABLE IF NOT EXISTS system_config (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  config_key   VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description  VARCHAR(500) DEFAULT '',
  updated_by   INT NULL,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sc_updater FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System config changelog (#3052)
CREATE TABLE IF NOT EXISTS system_config_changelog (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  config_key    VARCHAR(100) NOT NULL,
  old_value     TEXT NULL,
  new_value     TEXT NULL,
  changed_by    INT NULL,
  change_reason VARCHAR(500) NULL,
  changed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_scc_changer FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Login attempts log (#3048, #3049)
CREATE TABLE IF NOT EXISTS login_attempts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  email          VARCHAR(255) NOT NULL,
  success        TINYINT(1) NOT NULL DEFAULT 0,
  ip_address     VARCHAR(45) NULL,
  user_agent     VARCHAR(500) NULL,
  failure_reason VARCHAR(100) NULL,
  attempted_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_la_email (email),
  INDEX idx_la_time  (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add reviewed_at / reviewed_by to driver_points_ledger for audit log review
ALTER TABLE driver_points_ledger ADD COLUMN reviewed_at TIMESTAMP NULL;
ALTER TABLE driver_points_ledger ADD COLUMN reviewed_by INT NULL;

-- Add next_run_at / run_count / last_error to scheduled_point_awards
ALTER TABLE scheduled_point_awards ADD COLUMN next_run_at TIMESTAMP NULL;
ALTER TABLE scheduled_point_awards ADD COLUMN run_count INT NOT NULL DEFAULT 0;
ALTER TABLE scheduled_point_awards ADD COLUMN last_error TEXT NULL;
