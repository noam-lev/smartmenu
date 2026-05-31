-- Phase 1: lean relational modifiers (groups, options, item assignment).
-- Per-item price overrides deferred to a later phase.

-- modifier_groups: restaurant-scoped library
CREATE TABLE IF NOT EXISTS modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  selection_mode TEXT NOT NULL DEFAULT 'single'
    CHECK (selection_mode IN ('single', 'multi')),
  min_select INT NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select INT NOT NULL DEFAULT 1 CHECK (max_select >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (max_select >= min_select)
);

CREATE INDEX IF NOT EXISTS idx_modifier_groups_restaurant
  ON modifier_groups (restaurant_id);

-- modifier_options: choices within a group
CREATE TABLE IF NOT EXISTS modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_delta NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modifier_options_group
  ON modifier_options (modifier_group_id);

-- menu_item_modifier_groups: which groups apply to which items
CREATE TABLE IF NOT EXISTS menu_item_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items (id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups (id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  min_select_override INT NULL CHECK (min_select_override IS NULL OR min_select_override >= 0),
  max_select_override INT NULL CHECK (max_select_override IS NULL OR max_select_override >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, modifier_group_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_item_modifier_groups_item
  ON menu_item_modifier_groups (menu_item_id);

CREATE INDEX IF NOT EXISTS idx_menu_item_modifier_groups_group
  ON menu_item_modifier_groups (modifier_group_id);

-- Bump menus.updated_at when modifier data changes (cart invalidation contract).
CREATE OR REPLACE FUNCTION bump_active_menus_updated_at(p_restaurant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE menus
  SET updated_at = now()
  WHERE restaurant_id = p_restaurant_id
    AND is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION trg_modifier_groups_bump_menu()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    rid := OLD.restaurant_id;
  ELSE
    rid := NEW.restaurant_id;
  END IF;
  PERFORM bump_active_menus_updated_at(rid);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION trg_modifier_options_bump_menu()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rid UUID;
BEGIN
  SELECT restaurant_id INTO rid
  FROM modifier_groups
  WHERE id = COALESCE(NEW.modifier_group_id, OLD.modifier_group_id);

  IF rid IS NOT NULL THEN
    PERFORM bump_active_menus_updated_at(rid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION trg_menu_item_modifier_groups_bump_menu()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rid UUID;
BEGIN
  SELECT restaurant_id INTO rid
  FROM menu_items
  WHERE id = COALESCE(NEW.menu_item_id, OLD.menu_item_id);

  IF rid IS NOT NULL THEN
    PERFORM bump_active_menus_updated_at(rid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS modifier_groups_bump_menu ON modifier_groups;
CREATE TRIGGER modifier_groups_bump_menu
  AFTER INSERT OR UPDATE OR DELETE ON modifier_groups
  FOR EACH ROW EXECUTE FUNCTION trg_modifier_groups_bump_menu();

DROP TRIGGER IF EXISTS modifier_options_bump_menu ON modifier_options;
CREATE TRIGGER modifier_options_bump_menu
  AFTER INSERT OR UPDATE OR DELETE ON modifier_options
  FOR EACH ROW EXECUTE FUNCTION trg_modifier_options_bump_menu();

DROP TRIGGER IF EXISTS menu_item_modifier_groups_bump_menu ON menu_item_modifier_groups;
CREATE TRIGGER menu_item_modifier_groups_bump_menu
  AFTER INSERT OR UPDATE OR DELETE ON menu_item_modifier_groups
  FOR EACH ROW EXECUTE FUNCTION trg_menu_item_modifier_groups_bump_menu();

-- RLS (service role bypasses; policies for future direct client access).
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_modifier_groups ENABLE ROW LEVEL SECURITY;

-- Reload PostgREST schema cache so nested API embeds see new FK relationships.
NOTIFY pgrst, 'reload schema';
