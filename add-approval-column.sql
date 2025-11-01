-- Add status column to team_members table for approval system
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Update existing members to approved status
UPDATE team_members SET status = 'approved' WHERE status IS NULL;

-- Add check constraint for status values
ALTER TABLE team_members ADD CONSTRAINT status_check CHECK (status IN ('pending', 'approved', 'rejected'));