CREATE TABLE IF NOT EXISTS orders (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  driver_id             INT NOT NULL,
  status                ENUM('pending','confirmed','delivered','cancelled') NOT NULL DEFAULT 'pending',
  total_points          INT NOT NULL DEFAULT 0,
  confirmation_number   VARCHAR(20) NOT NULL,
  confirmed_at          TIMESTAMP NULL,
  cancelled_at          TIMESTAMP NULL,
  cancellation_reason   VARCHAR(255) NULL,
  cancelled_by_user_id  INT NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_confirmation (confirmation_number),
  INDEX idx_orders_driver          (driver_id),
  INDEX idx_orders_driver_status   (driver_id, status),
  INDEX idx_orders_driver_created  (driver_id, created_at),
  INDEX idx_orders_status          (status),
  CONSTRAINT fk_orders_driver FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  order_id                INT NOT NULL,
  catalog_item_id         INT NULL,
  sponsor_id              INT NOT NULL,
  item_title_snapshot     VARCHAR(255) NOT NULL,
  item_image_url_snapshot VARCHAR(500) NULL,
  points_cost_snapshot    INT NOT NULL,
  qty                     INT NOT NULL DEFAULT 1,
  INDEX idx_oi_order      (order_id),
  INDEX idx_oi_sponsor    (sponsor_id),
  CONSTRAINT fk_oi_order  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
