-- ===========================================
-- TASK MANAGEMENT DATABASE SCHEMA
-- ===========================================

-- Create boards table
CREATE TABLE boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6', -- Hex color for board theme
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID -- Could link to user if you add authentication
);

-- Create tasks table
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'Working on it', 'Stuck', 'Done', 'Review')),
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  assigned_to TEXT, -- Name of person assigned
  due_date DATE,
  tags TEXT[], -- Array of tags
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create team_members table (optional, for predefined team)
CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  email TEXT,
  avatar_url TEXT,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_comments table (optional, for comments on tasks)
CREATE TABLE task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INDEXES for better performance
-- ===========================================

CREATE INDEX idx_tasks_board_id ON tasks(board_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_boards_created_at ON boards(created_at);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on your auth needs)
CREATE POLICY "Allow all operations on boards" ON boards FOR ALL USING (true);
CREATE POLICY "Allow all operations on tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all operations on team_members" ON team_members FOR ALL USING (true);
CREATE POLICY "Allow all operations on task_comments" ON task_comments FOR ALL USING (true);

-- ===========================================
-- TRIGGERS for updated_at
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON boards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- SAMPLE DATA (optional)
-- ===========================================

-- Insert sample team members
INSERT INTO team_members (name, color) VALUES
('Adi Priatmono', '#8B5CF6'),
('Dimas', '#3B82F6'),
('Zukril', '#10B981'),
('Istriono', '#F59E0B'),
('Alexis', '#EC4899'),
('mami Chika', '#EAB308');

-- Insert sample board
INSERT INTO boards (name, description, color) VALUES
('Project TMO PJM', 'Task management for TMO PJM project', '#3B82F6');

-- Insert sample tasks
INSERT INTO tasks (board_id, title, description, status, priority, assigned_to, due_date) VALUES
((SELECT id FROM boards WHERE name = 'Project TMO PJM'), 'Setup Development Environment', 'Install Node.js, setup project structure, configure Tailwind CSS', 'Done', 'High', 'Adi Priatmono', '2025-10-30'),
((SELECT id FROM boards WHERE name = 'Project TMO PJM'), 'Design Database Schema', 'Create database tables for boards, tasks, and team members', 'Done', 'High', 'Dimas', '2025-10-28'),
((SELECT id FROM boards WHERE name = 'Project TMO PJM'), 'Implement Supabase Integration', 'Connect frontend with Supabase backend for data persistence', 'Done', 'Medium', 'Adi Priatmono', '2025-10-28'),
((SELECT id FROM boards WHERE name = 'Project TMO PJM'), 'Create Task Management UI', 'Build responsive UI for task boards with drag & drop functionality', 'Working on it', 'High', 'Zukril', '2025-11-05'),
((SELECT id FROM boards WHERE name = 'Project TMO PJM'), 'Add User Authentication', 'Implement user login/signup with Supabase Auth', 'Not Started', 'Medium', 'Istriono', '2025-11-10'),
((SELECT id FROM boards WHERE name = 'Project TMO PJM'), 'Testing & Bug Fixes', 'Comprehensive testing and fixing any bugs found', 'Not Started', 'Medium', 'Alexis', '2025-11-15');