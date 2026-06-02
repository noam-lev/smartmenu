-- Per-category section header background (nullable = default zinc styling).
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS header_color TEXT NULL;

COMMENT ON COLUMN categories.header_color IS 'Optional #RRGGBB hex for diner/admin category section header background.';

NOTIFY pgrst, 'reload schema';
