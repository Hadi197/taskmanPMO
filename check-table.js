import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTableStructure() {
  try {
    console.log('🔍 Checking table structure...');

    // Try to get a sample row
    const { data, error } = await supabase
      .from('task')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing table:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Table exists with sample row:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('📭 Table exists but is empty');

      // Try to insert a test row to see what columns are required
      console.log('🔧 Testing insert to see available columns...');
      const testInsert = await supabase
        .from('task')
        .insert([{ name: 'test_task' }])
        .select();

      if (testInsert.error) {
        console.log('❌ Insert failed, showing required columns:', testInsert.error.message);
      } else {
        console.log('✅ Insert successful, cleaning up...');
        // Clean up test data
        await supabase.from('task').delete().eq('name', 'test_task');
        console.log('🧹 Test data cleaned up');
      }
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

checkTableStructure();