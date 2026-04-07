-- Migration: Driver cart persistence (server-side cart)
-- Adds a per-driver cart table storing item + quantity.
-- Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS driver_cart_items (
  driver_id        INT NOT NULL,
  catalog_item_id  INT NOT NULL,
  qty              INT NOT NULL DEFAULT 1,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (driver_id, catalog_item_id),
  INDEX idx_dci_driver (driver_id),
  INDEX idx_dci_item   (catalog_item_id),
  CONSTRAINT fk_dci_driver FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dci_item   FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

