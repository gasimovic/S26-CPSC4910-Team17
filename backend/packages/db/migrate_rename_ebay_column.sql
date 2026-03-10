-- Migration: rename ebay_item_id → external_item_id in catalog_items
-- Run this once against the live AWS RDS database.
-- Safe to re-run: the IF NOT EXISTS check prevents duplicate column creation.

ALTER TABLE catalog_items
  CHANGE COLUMN ebay_item_id external_item_id VARCHAR(100) NULL;
