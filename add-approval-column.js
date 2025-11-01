import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function addApprovalColumn() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)[1];
    const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1];

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Adding approval status column to team_members table...');

    // Execute SQL to add status column
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
        UPDATE team_members SET status = 'approved' WHERE status IS NULL OR status = '';
      `
    });

    if (error) {
      console.error('Error adding column:', error);
      console.log('Trying alternative approach...');

      // Try direct approach
      const { data, error: updateError } = await supabase
        .from('team_members')
        .update({ status: 'approved' })
        .is('status', null);

      if (updateError) {
        console.error('Error updating existing members:', updateError);
      } else {
        console.log('✅ Updated existing members to approved status');
      }
    } else {
      console.log('✅ Successfully added status column');
    }

    // Verify the changes
    const { data: sample, error: checkError } = await supabase
      .from('team_members')
      .select('*')
      .limit(1);

    if (!checkError && sample && sample.length > 0) {
      console.log('Updated table structure:');
      console.log('Fields:', Object.keys(sample[0]));
      console.log('Sample record:', sample[0]);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

addApprovalColumn();