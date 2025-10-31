const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addParentIdColumn() {
  try {
    console.log('🔧 Adding parent_id column to tasks table...');

    // Read the SQL file
    const sql = fs.readFileSync('./add-parent-id-column.sql', 'utf8');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sql
    });

    if (error) {
      console.error('❌ Error adding parent_id column:', error);
      return;
    }

    console.log('✅ Successfully added parent_id column to tasks table');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addParentIdColumn();