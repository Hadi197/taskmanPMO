import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSpecificUser() {
  const targetEmail = 'purwana.hadi@gmail.com'
  console.log(`🔍 Checking data for user: ${targetEmail}\n`)

  try {
        // Check team_members table
    console.log('📋 Checking team_members table...')
    const { data: teamMembers, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('email', targetEmail)

    if (error) {
      console.error('❌ Error querying team_members:', error.message)
    } else if (teamMembers && teamMembers.length > 0) {
      console.log('✅ Found in team_members:')
      teamMembers.forEach((member, index) => {
        console.log(`   Database ID: ${member.id} (auto-increment)`)
        console.log(`   Name: ${member.name}`)
        console.log(`   Email: ${member.email}`)
        console.log(`   NIPP: ${member.nipp || 'Not provided'}`)
        console.log(`   Jabatan: ${member.jabatan || 'Not provided'}`)
        console.log(`   Role: ${member.role}`)
        console.log(`   Color: ${member.color}`)
        if (member.created_at) {
          console.log(`   Created: ${new Date(member.created_at).toLocaleString()}`)
        }
        console.log('')
      })
    } else {
      console.log('❌ Not found in team_members table')
    }

    // Check if we can get user info from auth
    console.log('� Checking auth system...')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        console.log('⚠️  Cannot check current auth user:', authError.message)
      } else if (user && user.email === targetEmail) {
        console.log('✅ Current authenticated user:')
        console.log(`   ID: ${user.id}`)
        console.log(`   Email: ${user.email}`)
        console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`)
        if (user.user_metadata) {
          console.log(`   Metadata: ${JSON.stringify(user.user_metadata, null, 2)}`)
        }
      } else if (user) {
        console.log(`ℹ️  Current user is different: ${user.email}`)
      } else {
        console.log('ℹ️  No user currently authenticated')
      }
    } catch (authCheckError) {
      console.log('⚠️  Auth check failed:', authCheckError.message)
    }

    // Try to search all team members to see if email exists anywhere
    console.log('🔍 Searching all team members for any mention of this email...')
    const { data: allMembers, error: allError } = await supabase
      .from('team_members')
      .select('*')

    if (!allError && allMembers) {
      console.log(`📊 Total team members in database: ${allMembers.length}`)

      if (allMembers.length > 0) {
        console.log('\n📋 All existing team members:')
        allMembers.forEach((member, index) => {
          console.log(`   ${index + 1}. ${member.name} (${member.email}) - ID: ${member.id}`)
        })
        console.log('')
      }

      const foundMembers = allMembers.filter(member =>
        member.email && member.email.toLowerCase().includes(targetEmail.toLowerCase())
      )

      if (foundMembers.length > 0) {
        console.log(`✅ Found ${foundMembers.length} team member(s) with similar email:`)
        foundMembers.forEach((member, index) => {
          console.log(`   ${index + 1}. ${member.name} (${member.email})`)
        })
      } else {
        console.log('❌ No team members found with this email pattern')
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

// Run the check
checkSpecificUser()