import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkColumns() {
  try {
    console.log('🔍 Checking table columns...');

    // Try insert with empty object to see what columns are required
    const { error } = await supabase
      .from('task')
      .insert([{}]);

    console.log('❌ Insert error (shows what columns exist):', error.message);

    // Try different column names that might exist
    const possibleColumns = ['id', 'title', 'content', 'status', 'created_at', 'updated_at'];

    for (const col of possibleColumns) {
      try {
        const { data, error } = await supabase
          .from('task')
          .select(col)
          .limit(1);

        if (!error) {
          console.log(`✅ Column '${col}' exists`);
        }
      } catch (err) {
        // Column doesn't exist
      }
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

checkColumns();