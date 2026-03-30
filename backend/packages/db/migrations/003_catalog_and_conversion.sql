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
-- Idempotency is handled by migrate.js ignoring duplicate-column errors.
ALTER TABLE catalog_items ADD COLUMN category VARCHAR(100) NULL;
ALTER TABLE catalog_items ADD COLUMN is_available TINYINT(1) NOT NULL DEFAULT 1;
