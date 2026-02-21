
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
-- if index doesnt exist, create it

CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  ad_id INT NULL,
  sponsor_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_driver_id (driver_id),
  INDEX idx_ad_id (ad_id),
  INDEX idx_sponsor_id (sponsor_id),
  INDEX idx_status (status),
  CONSTRAINT fk_applications_driver
    FOREIGN KEY (driver_id) REFERENCES users(id)
    ON DELETE CASCADE, 
  CONSTRAINT fk_applications_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES users(id)
    ON DELETE CASCADE
  ,
  CONSTRAINT fk_applications_ad
    FOREIGN KEY (ad_id) REFERENCES ads(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ads table (for sponsor sponsorship listings)
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