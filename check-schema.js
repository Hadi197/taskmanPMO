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

async function checkTableSchema() {
  console.log('🔍 Checking team_members table schema...\n')

  try {
    // First, let's see what columns exist by trying to describe the table
    console.log('📋 Attempting to get table structure...')

    // Try different possible column names
    const possibleColumns = ['id', 'user_id', 'name', 'email', 'nipp', 'jabatan', 'role', 'color']

    for (const column of possibleColumns) {
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select(column)
          .limit(1)

        if (!error) {
          console.log(`✅ Column '${column}' exists`)
        } else {
          console.log(`❌ Column '${column}' does not exist or has issues:`, error.message)
        }
      } catch (err) {
        console.log(`❌ Error checking column '${column}':`, err.message)
      }
    }

    console.log('\n🧪 Testing insert with different approaches...')

    // Test 1: Insert without id field (let database auto-generate)
    const testData1 = {
      name: 'Test User 1',
      email: 'test1@example.com',
      nipp: '123',
      jabatan: 'Tester',
      role: 'Level1',
      color: '#FF0000'
    }

    console.log('Test 1: Insert without id field...')
    const { data: result1, error: insertError1 } = await supabase
      .from('team_members')
      .insert([testData1])
      .select()

    if (insertError1) {
      console.error('❌ Insert without id failed:', insertError1.message)
    } else {
      console.log('✅ Insert without id succeeded!')
      console.log('Result:', result1)

      // Clean up
      if (result1 && result1[0] && result1[0].id) {
        await supabase.from('team_members').delete().eq('id', result1[0].id)
        console.log('🧹 Test record cleaned up')
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

// Run the check
checkTableSchema()