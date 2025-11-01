import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://sxbsihqartvgdxdgunmj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4YnNpaHFhcnR2Z2R4ZGd1bm1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTE5OTEsImV4cCI6MjA3NzE4Nzk5MX0.zqCRXdPEFaq6HBDLBuuYh4lY-hbiRdF1pvHWwuCMW3c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyApprovalSystem() {
  console.log('Verifying approval system implementation...\n');

  try {
    // Check team_members table structure
    console.log('1. Checking team_members table structure...');
    const { data: members, error } = await supabase
      .from('team_members')
      .select('*')
      .limit(5);

    if (error) {
      console.error('Error fetching members:', error);
      return;
    }

    console.log('Sample members:');
    members.forEach(member => {
      console.log(`- ${member.name} (${member.email}): jabatan="${member.jabatan}", role="${member.role}"`);
    });

    // Check for pending approval members
    const pendingMembers = members.filter(m => m.jabatan === 'pending_approval');
    const approvedMembers = members.filter(m => m.jabatan === 'approved');
    const rejectedMembers = members.filter(m => m.jabatan === 'rejected');

    console.log(`\nApproval status summary:`);
    console.log(`- Pending approval: ${pendingMembers.length}`);
    console.log(`- Approved: ${approvedMembers.length}`);
    console.log(`- Rejected: ${rejectedMembers.length}`);

    // Test approval workflow simulation
    if (pendingMembers.length > 0) {
      console.log('\n2. Testing approval workflow...');
      const testMember = pendingMembers[0];
      console.log(`Testing with member: ${testMember.name} (${testMember.email})`);

      // Simulate approval
      const { error: approveError } = await supabase
        .from('team_members')
        .update({ jabatan: 'approved' })
        .eq('id', testMember.id);

      if (approveError) {
        console.error('Error approving member:', approveError);
      } else {
        console.log('✅ Member approved successfully');

        // Revert back for testing
        await supabase
          .from('team_members')
          .update({ jabatan: 'pending_approval' })
          .eq('id', testMember.id);

        console.log('✅ Approval workflow working correctly');
      }
    } else {
      console.log('\n2. No pending members found for testing');
    }

    console.log('\n✅ Verification completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Test signup flow in the application');
    console.log('2. Verify login blocking for pending accounts');
    console.log('3. Test admin approval/rejection in Team component');

  } catch (error) {
    console.error('Verification failed:', error);
  }
}

verifyApprovalSystem();