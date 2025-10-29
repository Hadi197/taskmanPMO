import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTables() {
  console.log('🔍 Checking Supabase Database Tables...\n');

  const tables = ['boards', 'tasks', 'sub_tasks', 'sub_sub_task', 'team_members', 'task_documents'];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: Error - ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count} records`);
      }
    } catch (err) {
      console.log(`❌ ${table}: Exception - ${err.message}`);
    }
  }

  console.log('\n📊 Sample Data from Each Table:\n');

  // Get sample data from each table
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(2);

      if (!error && data && data.length > 0) {
        console.log(`${table.toUpperCase()}:`);
        data.forEach((row, i) => {
          console.log(`  ${i + 1}. ${JSON.stringify(row, null, 2).replace(/\n/g, '\n     ')}`);
        });
        console.log('');
      }
    } catch (err) {
      // Skip if error
    }
  }
}

checkTables().catch(console.error);
