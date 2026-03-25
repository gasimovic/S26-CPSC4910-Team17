-- Migration: Catalog availability, category, and sponsor conversion rates
-- Sprint S26 features. Run AFTER 002_sponsor_org_management.sql.
-- All statements are safe to re-run (idempotent).

-- -- New table: sponsor_conversion_rates --------------------------------------
-- One row per sponsor, stores the dollar-to-point conversion reference value.
-- Mirrors the one-row-per-sponsor pattern used by point_expiration_rules.
CREATE TABLE IF NOT EXISTS sponsor_conversion_rates (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  sponsor_id        INT NOT NULL UNIQUE,
  dollars_per_point DECIMAL(10,4) NOT NULL,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_scr_sponsor FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- Extend catalog_items ------------------------------------------------------
-- Use stored procedure for IF NOT EXISTS column check (MySQL limitation).
DELIMITER //
CREATE PROCEDURE add_catalog_sprint26_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'catalog_items'
      AND COLUMN_NAME  = 'category'
  ) THEN
    ALTER TABLE catalog_items ADD COLUMN category VARCHAR(100) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'catalog_items'
      AND COLUMN_NAME  = 'is_available'
  ) THEN
    ALTER TABLE catalog_items ADD COLUMN is_available TINYINT(1) NOT NULL DEFAULT 1;
  END IF;
END //
DELIMITER ;

CALL add_catalog_sprint26_columns();
DROP PROCEDURE IF EXISTS add_catalog_sprint26_columns;
