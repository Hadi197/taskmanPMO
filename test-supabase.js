import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Environment variables not set!');
  console.log('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    console.log('URL:', supabaseUrl.replace(/https:\/\/.*?\./, 'https://***.'));

    // Test 1: Basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('boards')
      .select('count', { count: 'exact', head: true });

    if (connectionError) {
      console.error('❌ Connection failed:', connectionError.message);
      return false;
    }

    console.log('✅ Supabase connection successful');

    // Test 2: Check if tables exist
    const { data: boards, error: boardsError } = await supabase
      .from('boards')
      .select('*')
      .limit(1);

    if (boardsError) {
      console.error('❌ Boards table error:', boardsError.message);
      return false;
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .limit(1);

    if (tasksError) {
      console.error('❌ Tasks table error:', tasksError.message);
      return false;
    }

    console.log('✅ Database tables accessible');
    console.log('📊 Current data:');
    console.log('- Boards:', boards?.length || 0);
    console.log('- Tasks:', tasks?.length || 0);

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

testSupabaseConnection();