-- Daily Checklists Feature Tables
-- Migration: 010_add_checklist_tables.sql

-- Checklist templates (reusable, created once)
CREATE TABLE IF NOT EXISTS checklist_templates (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER REFERENCES restaurants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  recurrence VARCHAR(20) DEFAULT 'daily',
  recurrence_days INTEGER[] DEFAULT '{1,2,3,4,5,6,0}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sections within a template
CREATE TABLE IF NOT EXISTS checklist_sections (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES checklist_templates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  emoji VARCHAR(10),
  sort_order INTEGER DEFAULT 0,
  assigned_to INTEGER REFERENCES staff(id)
);

-- Individual checklist items within a section
CREATE TABLE IF NOT EXISTS checklist_items (
  id SERIAL PRIMARY KEY,
  section_id INTEGER REFERENCES checklist_sections(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_critical BOOLEAN DEFAULT false
);

-- Daily instances generated from templates
CREATE TABLE IF NOT EXISTS checklist_instances (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES checklist_templates(id),
  restaurant_id INTEGER REFERENCES restaurants(id),
  date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(template_id, date)
);

-- Individual item completion tracking
CREATE TABLE IF NOT EXISTS checklist_completions (
  id SERIAL PRIMARY KEY,
  instance_id INTEGER REFERENCES checklist_instances(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES checklist_items(id),
  completed_by INTEGER REFERENCES staff(id),
  completed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(instance_id, item_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_checklist_templates_restaurant ON checklist_templates(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_checklist_sections_template ON checklist_sections(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_section ON checklist_items(section_id);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_date ON checklist_instances(date);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_template_date ON checklist_instances(template_id, date);
CREATE INDEX IF NOT EXISTS idx_checklist_completions_instance ON checklist_completions(instance_id);
