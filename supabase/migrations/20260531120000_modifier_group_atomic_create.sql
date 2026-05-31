-- Atomic create: modifier group + options + attach to menu item (single transaction).
CREATE OR REPLACE FUNCTION public.create_modifier_group_atomic(
  p_restaurant_id UUID,
  p_menu_item_id UUID,
  p_name TEXT,
  p_translations JSONB,
  p_selection_mode TEXT,
  p_min_select INT,
  p_max_select INT,
  p_options JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_group_id UUID;
  v_sort INT;
  v_opt JSONB;
  v_idx INT := 0;
  v_mode TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM menu_items mi
    WHERE mi.id = p_menu_item_id
      AND mi.restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'invalid_menu_item' USING ERRCODE = 'P0001';
  END IF;

  v_mode := COALESCE(NULLIF(trim(p_selection_mode), ''), 'single');
  IF v_mode NOT IN ('single', 'multi') THEN
    v_mode := 'single';
  END IF;

  IF p_max_select < p_min_select THEN
    RAISE EXCEPTION 'invalid_select_bounds' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_array_length(COALESCE(p_options, '[]'::jsonb)) < 1 THEN
    RAISE EXCEPTION 'options_required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO modifier_groups (
    restaurant_id,
    name,
    translations,
    selection_mode,
    min_select,
    max_select,
    sort_order
  )
  VALUES (
    p_restaurant_id,
    trim(p_name),
    COALESCE(p_translations, '{}'::jsonb),
    v_mode,
    GREATEST(0, COALESCE(p_min_select, 0)),
    GREATEST(0, COALESCE(p_max_select, 1)),
    0
  )
  RETURNING id INTO v_group_id;

  FOR v_opt IN SELECT value FROM jsonb_array_elements(COALESCE(p_options, '[]'::jsonb))
  LOOP
    INSERT INTO modifier_options (
      modifier_group_id,
      name,
      translations,
      price_delta,
      is_default,
      is_available,
      sort_order
    )
    VALUES (
      v_group_id,
      trim(COALESCE(v_opt->>'name', '')),
      COALESCE(v_opt->'translations', '{}'::jsonb),
      COALESCE((v_opt->>'price_delta')::numeric, 0),
      COALESCE((v_opt->>'is_default')::boolean, false),
      COALESCE((v_opt->>'is_available')::boolean, true),
      v_idx
    );
    v_idx := v_idx + 1;
  END LOOP;

  SELECT COALESCE(MAX(sort_order), -1) + 1
  INTO v_sort
  FROM menu_item_modifier_groups
  WHERE menu_item_id = p_menu_item_id;

  INSERT INTO menu_item_modifier_groups (menu_item_id, modifier_group_id, sort_order)
  VALUES (p_menu_item_id, v_group_id, v_sort);

  RETURN v_group_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
