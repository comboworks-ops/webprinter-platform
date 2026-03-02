-- =====================================================
-- Print Product Designer Database Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. DESIGNER TEMPLATES
-- Die-cut shapes, guides, and document templates
-- =====================================================
CREATE TABLE IF NOT EXISTS designer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL, -- 'business_card', 'sticker_circle', 'sticker_rounded', 'rectangle', etc.
  category TEXT DEFAULT 'general', -- 'business_cards', 'stickers', 'posters', etc.
  
  -- Dimensions (in mm)
  width_mm NUMERIC NOT NULL,
  height_mm NUMERIC NOT NULL,
  bleed_mm NUMERIC DEFAULT 3,
  safe_area_mm NUMERIC DEFAULT 3,
  
  -- DPI settings
  dpi_default INTEGER DEFAULT 300,
  dpi_min_required INTEGER DEFAULT 150,
  
  -- Color profile
  color_profile TEXT DEFAULT 'FOGRA39', -- FOGRA39, FOGRA51, FOGRA52, etc.
  
  -- SVG paths for overlays/guides
  trim_path TEXT, -- actual cut line SVG path
  safe_area_path TEXT, -- safe area for text (SVG path)
  cut_contour_path TEXT, -- for stickers/die-cuts (spot color path)
  
  -- Visual
  preview_image_url TEXT,
  icon_name TEXT, -- lucide icon name
  
  -- Flags
  is_public BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  supports_cut_contour BOOLEAN DEFAULT false, -- for stickers
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. SAVED DESIGNS
-- User's saved design projects
-- =====================================================
CREATE TABLE IF NOT EXISTS designer_saved_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Links
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  template_id UUID REFERENCES designer_templates(id) ON DELETE SET NULL,
  
  -- Design info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Document specifications
  width_mm NUMERIC NOT NULL,
  height_mm NUMERIC NOT NULL,
  bleed_mm NUMERIC DEFAULT 3,
  dpi INTEGER DEFAULT 300,
  color_profile TEXT DEFAULT 'FOGRA39',
  
  -- Editor state (Fabric.js JSON)
  editor_json JSONB NOT NULL DEFAULT '{}',
  
  -- Preview
  preview_thumbnail_url TEXT,
  
  -- Export status
  export_pdf_url TEXT,
  last_exported_at TIMESTAMPTZ,
  
  -- Preflight
  preflight_warnings JSONB DEFAULT '[]',
  preflight_errors_count INTEGER DEFAULT 0,
  preflight_warnings_count INTEGER DEFAULT 0,
  warnings_accepted BOOLEAN DEFAULT false,
  warnings_accepted_at TIMESTAMPTZ,
  warnings_accepted_by UUID REFERENCES auth.users(id),
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'ready', 'ordered'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. DESIGNER EXPORTS
-- PDF export history
-- =====================================================
CREATE TABLE IF NOT EXISTS designer_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID REFERENCES designer_saved_designs(id) ON DELETE CASCADE NOT NULL,
  
  -- Export details
  pdf_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  pages INTEGER DEFAULT 1,
  
  -- Technical specs
  color_profile TEXT,
  dpi INTEGER,
  has_cut_contour BOOLEAN DEFAULT false,
  pdf_standard TEXT DEFAULT 'PDF/X-4', -- PDF/X-1a, PDF/X-3, PDF/X-4
  
  -- Link to order (optional)
  order_id UUID,
  order_item_id UUID,
  
  -- Timestamps
  exported_at TIMESTAMPTZ DEFAULT NOW(),
  exported_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE designer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE designer_saved_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE designer_exports ENABLE ROW LEVEL SECURITY;

-- Templates: Public read, admin write
CREATE POLICY "Templates are publicly readable" 
  ON designer_templates FOR SELECT 
  USING (is_public = true AND is_active = true);

CREATE POLICY "Admins can manage templates"
  ON designer_templates FOR ALL
  USING (true); -- Adjust based on your admin logic

-- Saved Designs: Users can only see their own
CREATE POLICY "Users can view own designs"
  ON designer_saved_designs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own designs"
  ON designer_saved_designs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own designs"
  ON designer_saved_designs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own designs"
  ON designer_saved_designs FOR DELETE
  USING (auth.uid() = user_id);

-- Exports: Users can only see their own (through design ownership)
CREATE POLICY "Users can view own exports"
  ON designer_exports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM designer_saved_designs d 
      WHERE d.id = designer_exports.design_id 
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create exports for own designs"
  ON designer_exports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designer_saved_designs d 
      WHERE d.id = designer_exports.design_id 
      AND d.user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_designer_templates_type ON designer_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_designer_templates_category ON designer_templates(category);
CREATE INDEX IF NOT EXISTS idx_saved_designs_user ON designer_saved_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_designs_product ON designer_saved_designs(product_id);
CREATE INDEX IF NOT EXISTS idx_exports_design ON designer_exports(design_id);

-- =====================================================
-- 6. SEED DATA - Initial Templates
-- =====================================================
INSERT INTO designer_templates (name, template_type, category, width_mm, height_mm, bleed_mm, dpi_default, icon_name, description) VALUES
  -- Business Cards
  ('Visitkort - Standard', 'business_card', 'business_cards', 85, 55, 3, 300, 'CreditCard', 'Standard visitkort format'),
  ('Visitkort - EU Standard', 'business_card_eu', 'business_cards', 85, 55, 3, 300, 'CreditCard', 'EU standard visitkort'),
  
  -- Stickers
  ('Rund Sticker', 'sticker_circle', 'stickers', 50, 50, 2, 300, 'Circle', 'Rund klistermærke med konturskæring'),
  ('Rundet Rektangel Sticker', 'sticker_rounded', 'stickers', 80, 50, 2, 300, 'Square', 'Rektangulær sticker med afrundede hjørner'),
  ('Rektangel Sticker', 'sticker_rectangle', 'stickers', 100, 70, 2, 300, 'RectangleHorizontal', 'Standard rektangulær sticker'),
  
  -- Standard formats
  ('A4 Dokument', 'a4', 'documents', 210, 297, 3, 300, 'FileText', 'A4 standard format'),
  ('A5 Dokument', 'a5', 'documents', 148, 210, 3, 300, 'FileText', 'A5 standard format'),
  ('A6 Dokument', 'a6', 'documents', 105, 148, 3, 300, 'FileText', 'A6 standard format')
ON CONFLICT DO NOTHING;

-- Update sticker templates to support cut contour
UPDATE designer_templates SET supports_cut_contour = true WHERE template_type LIKE 'sticker_%';

-- =====================================================
-- DONE! Verify with:
-- SELECT * FROM designer_templates;
-- =====================================================
