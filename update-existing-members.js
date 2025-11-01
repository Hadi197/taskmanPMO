import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function updateExistingMembers() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)[1];
    const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1];

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Updating existing members to approved status...');

    // Update all existing members to approved status
    const { data, error } = await supabase
      .from('team_members')
      .update({ status: 'approved' })
      .is('status', null)
      .select();

    if (error) {
      console.error('Error updating members:', error);
      return;
    }

    console.log(`✅ Updated ${data?.length || 0} existing members to approved status`);

    // Also update any empty status fields
    const { data: data2, error: error2 } = await supabase
      .from('team_members')
      .update({ status: 'approved' })
      .eq('status', '')
      .select();

    if (!error2 && data2) {
      console.log(`✅ Updated ${data2.length} additional members with empty status`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

updateExistingMembers();