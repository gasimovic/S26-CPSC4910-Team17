-- Migration: add ad_id to applications
ALTER TABLE applications
  ADD COLUMN ad_id INT NULL,
  ADD INDEX idx_ad_id (ad_id);

ALTER TABLE applications
  ADD CONSTRAINT fk_applications_ad
    FOREIGN KEY (ad_id) REFERENCES ads(id)
    ON DELETE SET NULL;