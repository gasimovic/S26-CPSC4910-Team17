-- Migration: Sponsor Organization Management
-- Run this on the RDS instance after 001_point_management.sql

-- Sponsor organizations table
CREATE TABLE IF NOT EXISTS sponsor_organizations (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL UNIQUE,
  description  TEXT NULL,
  phone        VARCHAR(50) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city         VARCHAR(100) NULL,
  state        VARCHAR(100) NULL,
  postal_code  VARCHAR(20) NULL,
  country      VARCHAR(100) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sponsor action log (audit trail)
CREATE TABLE IF NOT EXISTS sponsor_action_log (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  org_id         INT NULL,
  sponsor_id     INT NOT NULL,
  action         VARCHAR(100) NOT NULL,
  target_user_id INT NULL,
  details        TEXT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sal_org     (org_id),
  INDEX idx_sal_sponsor (sponsor_id),
  INDEX idx_sal_target  (target_user_id),
  CONSTRAINT fk_sal_sponsor FOREIGN KEY (sponsor_id)     REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sal_target  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Safe column additions (MySQL 8.0 ADD COLUMN IF NOT EXISTS)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL;
ALTER TABLE sponsor_profiles ADD COLUMN IF NOT EXISTS org_id INT NULL;
ALTER TABLE sponsor_profiles ADD COLUMN IF NOT EXISTS sponsor_role ENUM('owner','admin','member') NOT NULL DEFAULT 'member';
ALTER TABLE sponsor_profiles ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Auto-create org records from existing company_name values
-- and link existing sponsors to their org
INSERT IGNORE INTO sponsor_organizations (name)
SELECT DISTINCT company_name FROM sponsor_profiles
WHERE company_name IS NOT NULL AND TRIM(company_name) != '';

UPDATE sponsor_profiles sp
JOIN sponsor_organizations so ON so.name = sp.company_name
SET sp.org_id = so.id
WHERE sp.org_id IS NULL AND sp.company_name IS NOT NULL;

-- Make the first sponsor in each org the owner
UPDATE sponsor_profiles sp
SET sp.sponsor_role = 'owner'
WHERE sp.org_id IS NOT NULL
  AND sp.user_id = (
    SELECT MIN(sp2.user_id)
    FROM (SELECT user_id, org_id FROM sponsor_profiles WHERE org_id IS NOT NULL) sp2
    WHERE sp2.org_id = sp.org_id
  );
