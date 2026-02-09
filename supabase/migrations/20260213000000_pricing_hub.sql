-- Pricing Hub Feature
-- A standalone module for managing CSV price imports with folders, combining, and publishing

-- Folders for organizing projects
CREATE TABLE pricing_hub_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES pricing_hub_folders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Projects (workspaces for combining imports)
CREATE TABLE pricing_hub_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES pricing_hub_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft', -- 'draft', 'ready', 'published'
  combined_data JSONB DEFAULT '[]', -- merged price rows
  detected_attributes JSONB DEFAULT '{}', -- {formats: [], materials: [], finishes: []}
  settings JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  published_to_product_id UUID -- tracks which product this was published to
);

-- Individual CSV imports within projects
CREATE TABLE pricing_hub_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID REFERENCES pricing_hub_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_filename TEXT,
  csv_data JSONB NOT NULL, -- parsed rows
  column_mapping JSONB, -- maps CSV columns to attributes
  row_count INTEGER DEFAULT 0,
  attributes_detected JSONB DEFAULT '{}', -- {formats: [], materials: [], finishes: []}
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_pricing_hub_folders_tenant ON pricing_hub_folders(tenant_id);
CREATE INDEX idx_pricing_hub_projects_tenant ON pricing_hub_projects(tenant_id);
CREATE INDEX idx_pricing_hub_projects_folder ON pricing_hub_projects(folder_id);
CREATE INDEX idx_pricing_hub_imports_project ON pricing_hub_imports(project_id);

-- Enable RLS
ALTER TABLE pricing_hub_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_hub_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_hub_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folders
CREATE POLICY "Tenants can view own folders" ON pricing_hub_folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_folders.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can insert own folders" ON pricing_hub_folders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_folders.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can update own folders" ON pricing_hub_folders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_folders.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own folders" ON pricing_hub_folders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_folders.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

-- RLS Policies for projects
CREATE POLICY "Tenants can view own projects" ON pricing_hub_projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_projects.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can insert own projects" ON pricing_hub_projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_projects.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can update own projects" ON pricing_hub_projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_projects.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own projects" ON pricing_hub_projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_projects.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

-- RLS Policies for imports
CREATE POLICY "Tenants can view own imports" ON pricing_hub_imports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_imports.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can insert own imports" ON pricing_hub_imports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_imports.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can update own imports" ON pricing_hub_imports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_imports.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own imports" ON pricing_hub_imports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = pricing_hub_imports.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

-- Master admin access (can view all)
CREATE POLICY "Master admin can view all folders" ON pricing_hub_folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = '00000000-0000-0000-0000-000000000000'
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Master admin can manage all folders" ON pricing_hub_folders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = '00000000-0000-0000-0000-000000000000'
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Master admin can view all projects" ON pricing_hub_projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = '00000000-0000-0000-0000-000000000000'
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Master admin can manage all projects" ON pricing_hub_projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = '00000000-0000-0000-0000-000000000000'
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Master admin can view all imports" ON pricing_hub_imports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = '00000000-0000-0000-0000-000000000000'
      AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Master admin can manage all imports" ON pricing_hub_imports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = '00000000-0000-0000-0000-000000000000'
      AND t.owner_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE pricing_hub_folders IS 'Folders for organizing pricing hub projects';
COMMENT ON TABLE pricing_hub_projects IS 'Pricing hub projects/workspaces for combining CSV imports';
COMMENT ON TABLE pricing_hub_imports IS 'Individual CSV imports within pricing hub projects';
