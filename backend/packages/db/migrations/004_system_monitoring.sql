-- Migration 004: System monitoring tables (#3144-#3149)
-- Run: mysql -h <host> -u <user> -p <db> < backend/packages/db/migrations/004_system_monitoring.sql

-- Safe column-add helper (idempotent)
DROP PROCEDURE IF EXISTS safe_add_col;
DELIMITER $$
CREATE PROCEDURE safe_add_col(
  IN tbl  VARCHAR(64),
  IN col  VARCHAR(64),
  IN def  VARCHAR(255)
)
BEGIN
  SET @q = CONCAT(
    'SELECT COUNT(*) INTO @exists FROM information_schema.columns ',
    'WHERE table_schema = DATABASE() AND table_name = ''', tbl,
    ''' AND column_name = ''', col, ''''
  );
  PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
  IF @exists = 0 THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END$$
DELIMITER ;

-- Add missing columns to scheduled_point_awards for job monitoring
CALL safe_add_col('scheduled_point_awards', 'next_run_at',  'TIMESTAMP NULL AFTER last_run_at');
CALL safe_add_col('scheduled_point_awards', 'run_count',    'INT NOT NULL DEFAULT 0 AFTER next_run_at');
CALL safe_add_col('scheduled_point_awards', 'last_error',   'TEXT NULL AFTER run_count');

-- Maintenance windows (#3148)
CREATE TABLE IF NOT EXISTS maintenance_windows (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  starts_at   DATETIME NOT NULL,
  ends_at     DATETIME NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_by  INT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mw_active (is_active, ends_at),
  CONSTRAINT fk_mw_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Feature flags (#3149)
CREATE TABLE IF NOT EXISTS feature_flags (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  feature_key VARCHAR(100) NOT NULL UNIQUE,
  label       VARCHAR(255) NOT NULL,
  description TEXT,
  is_enabled  TINYINT(1) NOT NULL DEFAULT 0,
  updated_by  INT NULL,
  updated_at  TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ff_updater FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default feature flags
INSERT IGNORE INTO feature_flags (feature_key, label, description, is_enabled) VALUES
  ('catalog_enabled',     'Product Catalog',         'Allow drivers to browse and redeem from the product catalog', 1),
  ('scheduled_awards',    'Scheduled Awards',        'Enable sponsors to schedule recurring point awards',         1),
  ('driver_registration', 'Driver Registration',     'Allow new driver accounts to be created',                    1),
  ('sponsor_registration','Sponsor Registration',    'Allow new sponsor accounts to be created',                   1),
  ('leaderboard',         'Leaderboard',             'Show the driver leaderboard page',                           1),
  ('achievements',        'Achievements',            'Show the achievements page for drivers',                     1),
  ('messaging',           'In-App Messaging',        'Enable the messaging system between drivers and sponsors',   1),
  ('point_expiration',    'Point Expiration Rules',   'Allow sponsors to set point expiration policies',            1);

-- Clean up
DROP PROCEDURE IF EXISTS safe_add_col;
