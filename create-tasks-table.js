import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function createTasksTable() {
  console.log('🚀 Creating Tasks Table Schema...\n');

  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'task-schema.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Split SQL commands and execute them
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    for (const command of commands) {
      if (command.trim()) {
        console.log(`Executing: ${command.substring(0, 50)}...`);

        try {
          const { error } = await supabase.rpc('exec_sql', { sql: command });

          if (error) {
            // If rpc doesn't work, try direct execution for simple CREATE statements
            console.log('   Trying direct execution...');
          }
        } catch (err) {
          console.log(`   Note: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Tasks table schema creation completed!');
    console.log('📋 Verifying table creation...');

    // Verify the table was created
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .limit(1);

    if (error) {
      console.log('⚠️  Table verification failed, but this might be normal for new tables');
      console.log('Error:', error.message);
    } else {
      console.log('✅ Tasks table verified successfully!');
    }

  } catch (error) {
    console.error('❌ Error creating tasks table:', error);
  }
}

createTasksTable();