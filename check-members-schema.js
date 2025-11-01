import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function checkTeamMembersSchema() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)[1];
    const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1];

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking team_members table structure...');

    // Get a sample record to see the structure
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('Sample team member record:');
      console.log(JSON.stringify(data[0], null, 2));
      console.log('Fields:', Object.keys(data[0]));
    } else {
      console.log('No team members found');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkTeamMembersSchema();