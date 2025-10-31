-- Add parent_id column to tasks table for hierarchical tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- Create index for parent_id
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);