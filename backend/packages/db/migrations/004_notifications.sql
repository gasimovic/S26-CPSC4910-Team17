-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  type          VARCHAR(50) NOT NULL,
  title         VARCHAR(255) NOT NULL,
  body          TEXT NULL,
  is_read       TINYINT(1) NOT NULL DEFAULT 0,
  is_mandatory  TINYINT(1) NOT NULL DEFAULT 0,
  ref_type      VARCHAR(50) NULL,
  ref_id        INT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user      (user_id, is_read, created_at),
  INDEX idx_notif_type      (user_id, type),
  CONSTRAINT fk_notif_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notification preferences (per-user toggles per type)
CREATE TABLE IF NOT EXISTS notification_preferences (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  notif_type    VARCHAR(50) NOT NULL,
  is_enabled    TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_np_user_type (user_id, notif_type),
  CONSTRAINT fk_np_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notification mute / quiet hours settings
CREATE TABLE IF NOT EXISTS notification_mute (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE,
  muted_until   TIMESTAMP NULL,
  quiet_start   TIME NULL,
  quiet_end     TIME NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_nm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
