-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Core users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,

  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,

  -- expected values: 'admin', 'driver', 'sponsor'
  role ENUM('admin', 'driver', 'sponsor') NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Driver profile
CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id INT NOT NULL PRIMARY KEY,

  first_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NULL,
  dob DATE NULL,

  phone VARCHAR(50) NULL,

  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  postal_code VARCHAR(20) NULL,
  country VARCHAR(100) NULL,

  sponsor_org VARCHAR(255) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_driver_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Sponsor profile
CREATE TABLE IF NOT EXISTS sponsor_profiles (
  user_id INT NOT NULL PRIMARY KEY,

  first_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NULL,
  dob DATE NULL,

  phone VARCHAR(50) NULL,

  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  postal_code VARCHAR(20) NULL,
  country VARCHAR(100) NULL,

  company_name VARCHAR(255) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_sponsor_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Admin profile
CREATE TABLE IF NOT EXISTS admin_profiles (
  user_id INT NOT NULL PRIMARY KEY,

  first_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NULL,
  dob DATE NULL,

  phone VARCHAR(50) NULL,

  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  postal_code VARCHAR(20) NULL,
  country VARCHAR(100) NULL,

  display_name VARCHAR(255) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_admin_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Ads table (for sponsor sponsorship listings)
-- NOTE: must be created BEFORE applications because applications has a FK to ads
CREATE TABLE IF NOT EXISTS ads (
  id          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  sponsor_id  INT UNSIGNED     NOT NULL,
  title       VARCHAR(255)     NOT NULL,
  description TEXT             NOT NULL,
  requirements TEXT,
  benefits    TEXT,
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ads_sponsor (sponsor_id),
  CONSTRAINT fk_ads_sponsor FOREIGN KEY (sponsor_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Applications table
-- NOTE: ad_id uses INT UNSIGNED to match ads.id type (required for FK compatibility)
CREATE TABLE IF NOT EXISTS applications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  driver_id   INT NOT NULL,
  ad_id       INT UNSIGNED NULL,
  sponsor_id  INT NOT NULL,
  status      ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT NULL,
  notes       TEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_driver_id  (driver_id),
  INDEX idx_ad_id      (ad_id),
  INDEX idx_sponsor_id (sponsor_id),
  INDEX idx_status     (status),

  CONSTRAINT fk_applications_driver
    FOREIGN KEY (driver_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_applications_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_applications_ad
    FOREIGN KEY (ad_id)      REFERENCES ads(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catalog items for Sponsor Shop
CREATE TABLE IF NOT EXISTS catalog_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sponsor_id INT NOT NULL,
  external_item_id VARCHAR(100) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(500) NULL,
  price DECIMAL(10, 2) NOT NULL,
  point_cost INT NOT NULL,
  category VARCHAR(100) NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_catalog_items_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sprint_info (
  id INT PRIMARY KEY DEFAULT 1,
  sprint_number INT NOT NULL DEFAULT 1,
  title VARCHAR(255),
  description TEXT,
  goals TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT INTO sprint_info (id, sprint_number, title, description, goals)
VALUES (1, 1, '', '', '');

-- Messages between sponsors and drivers
CREATE TABLE IF NOT EXISTS messages (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  sender_id    INT NOT NULL,
  recipient_id INT NULL,            -- NULL for broadcast messages
  sponsor_id   INT NOT NULL,        -- sponsorship program context
  body         TEXT NOT NULL,
  is_broadcast TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_sender    (sender_id),
  INDEX idx_messages_recipient (recipient_id),
  INDEX idx_messages_sponsor   (sponsor_id),
  CONSTRAINT fk_messages_sender    FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sponsor   FOREIGN KEY (sponsor_id)   REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tracks which messages each user has read
CREATE TABLE IF NOT EXISTS message_reads (
  message_id INT NOT NULL,
  user_id    INT NOT NULL,
  read_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT fk_mr_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Points ledger (delta-based)
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

-- Password reset tokens
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
  driver_id     INT NULL,              -- NULL = all drivers in program
  points        INT NOT NULL,
  reason        VARCHAR(255) NOT NULL,
  frequency     ENUM('once','daily','weekly','monthly') NOT NULL DEFAULT 'once',
  scheduled_date DATE NOT NULL,        -- next/only run date
  is_recurring  TINYINT(1) NOT NULL DEFAULT 0,
  is_paused     TINYINT(1) NOT NULL DEFAULT 0,
  last_run_at   TIMESTAMP NULL,
  next_run_at   TIMESTAMP NULL,
  run_count     INT NOT NULL DEFAULT 0,
  last_error    TEXT NULL,
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
  sponsor_id    INT NOT NULL UNIQUE,   -- one rule per sponsor
  expiry_days   INT NOT NULL,          -- points expire after N days
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_per_sponsor FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dollar-to-point conversion rate per sponsor
CREATE TABLE IF NOT EXISTS sponsor_conversion_rates (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  sponsor_id        INT NOT NULL UNIQUE,
  dollars_per_point DECIMAL(10,4) NOT NULL,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_scr_sponsor FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Language preference per user
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) NULL DEFAULT 'en';

-- Track last login timestamp
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL;

-- Sponsor organizations
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

-- Link sponsors to their organization + add role and active status
ALTER TABLE sponsor_profiles ADD COLUMN org_id INT NULL;
ALTER TABLE sponsor_profiles ADD COLUMN sponsor_role ENUM('owner','admin','member') NOT NULL DEFAULT 'member';
ALTER TABLE sponsor_profiles ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

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