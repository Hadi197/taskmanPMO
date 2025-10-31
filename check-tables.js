import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTables() {
  console.log('🔍 Checking database tables...\n');
  
  try {
    // Check if users table exists
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5);
    
    if (!usersError) {
      console.log('✅ Users table exists:');
      console.log(usersData);
    } else {
      console.log('❌ Users table does not exist or error:', usersError.message);
    }
    
    // Check if team_members table exists
    const { data: teamData, error: teamError } = await supabase
      .from('team_members')
      .select('*')
      .limit(5);
    
    if (!teamError) {
      console.log('✅ Team members table exists:');
      console.log(teamData);
    } else {
      console.log('❌ Team members table does not exist or error:', teamError.message);
    }
    
    // Check current tasks table
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .limit(5);
    
    if (!tasksError) {
      console.log('✅ Tasks table exists:');
      console.log(tasksData);
    } else {
      console.log('❌ Tasks table error:', tasksError.message);
    }
    
  } catch (error) {
    console.error('Error checking tables:', error);
  }
}

checkTables();
