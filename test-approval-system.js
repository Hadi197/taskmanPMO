import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://sxbsihqartvgdxdgunmj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4YnNpaHFhcnR2Z2R4ZGd1bm1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTE5OTEsImV4cCI6MjA3NzE4Nzk5MX0.zqCRXdPEFaq6HBDLBuuYh4lY-hbiRdF1pvHWwuCMW3c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testApprovalSystem() {
  console.log('Testing approval system...');

  try {
    // Test 1: Check if new signup creates pending member
    console.log('\n1. Testing signup creates pending member...');

    const testEmail = `test${Date.now()}@test.com`;
    const testPassword = 'testpassword123';

    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: 'Test User',
          nipp: 'TEST123'
        }
      }
    });

    if (signupError) {
      console.error('Signup error:', signupError);
      return;
    }

    console.log('Signup successful for:', testEmail);

    // Wait a moment for the team member to be created
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if team member was created with pending status
    const { data: memberData, error: memberError } = await supabase
      .from('team_members')
      .select('*')
      .eq('email', testEmail)
      .single();

    if (memberError) {
      console.error('Error checking team member:', memberError);
    } else {
      console.log('Team member created:', memberData);
      console.log('Approval status (jabatan):', memberData.jabatan);

      if (memberData.jabatan === 'pending_approval') {
        console.log('✅ PASS: New member created with pending approval status');
      } else {
        console.log('❌ FAIL: Member not created with pending status');
      }
    }

    // Test 2: Try to sign in with pending account (should fail)
    console.log('\n2. Testing login with pending account...');

    const { data: signinData, error: signinError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signinError && signinError.message.includes('pending approval')) {
      console.log('✅ PASS: Login blocked for pending account');
    } else if (signinData.user) {
      console.log('❌ FAIL: Login allowed for pending account');
      // Sign out if we accidentally got in
      await supabase.auth.signOut();
    } else {
      console.log('❌ FAIL: Unexpected login result:', signinError);
    }

    // Test 3: Approve the member (simulate admin action)
    console.log('\n3. Testing member approval...');

    const { error: approveError } = await supabase
      .from('team_members')
      .update({ jabatan: 'approved' })
      .eq('email', testEmail);

    if (approveError) {
      console.error('Approval error:', approveError);
    } else {
      console.log('✅ PASS: Member approved successfully');

      // Test 4: Try to sign in with approved account (should succeed)
      console.log('\n4. Testing login with approved account...');

      const { data: approvedSigninData, error: approvedSigninError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });

      if (approvedSigninError) {
        console.log('❌ FAIL: Login failed for approved account:', approvedSigninError);
      } else {
        console.log('✅ PASS: Login successful for approved account');
        // Sign out
        await supabase.auth.signOut();
      }
    }

    // Clean up: Delete test user
    console.log('\n5. Cleaning up test data...');

    // Delete from team_members
    await supabase
      .from('team_members')
      .delete()
      .eq('email', testEmail);

    // Note: Can't easily delete from auth.users via client, but that's ok for testing

    console.log('✅ Test completed');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testApprovalSystem();