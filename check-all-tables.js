import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAllTables() {
  console.log('🔍 Checking all tables from setup.sql...\n');

  const tables = ['boards', 'tasks', 'team_members', 'task_comments'];
  const results = {};

  for (const table of tables) {
    try {
      console.log(`📋 Checking table: ${table}`);
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ Table '${table}' error: ${error.message}`);
        results[table] = { exists: false, error: error.message };
      } else {
        console.log(`✅ Table '${table}' exists`);
        results[table] = { exists: true, count: data?.length || 0 };
      }
    } catch (err) {
      console.log(`❌ Unexpected error checking '${table}': ${err.message}`);
      results[table] = { exists: false, error: err.message };
    }
    console.log('');
  }

  // Summary
  console.log('📊 SUMMARY:');
  console.log('===========');

  const existingTables = Object.entries(results).filter(([_, result]) => result.exists);
  const missingTables = Object.entries(results).filter(([_, result]) => !result.exists);

  if (existingTables.length > 0) {
    console.log('✅ Existing tables:');
    existingTables.forEach(([table, result]) => {
      console.log(`   - ${table} (${result.count} records)`);
    });
  }

  if (missingTables.length > 0) {
    console.log('\n❌ Missing tables:');
    missingTables.forEach(([table, result]) => {
      console.log(`   - ${table}: ${result.error}`);
    });
  }

  console.log(`\n🎯 Result: ${existingTables.length}/${tables.length} tables exist`);

  if (missingTables.length === 0) {
    console.log('🎉 All tables are ready! You can now run the application.');
    return true;
  } else {
    console.log('⚠️  Some tables are missing. Please run setup.sql in Supabase SQL Editor.');
    return false;
  }
}

checkAllTables();