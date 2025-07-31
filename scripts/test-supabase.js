const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Not set')
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSupabase() {
  console.log('Testing Supabase connection...')
  
  try {
    // Test 1: Check if we can query the messages table
    console.log('\n1. Testing messages table query...')
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .limit(5)
    
    if (messagesError) {
      console.error('Messages query error:', messagesError)
    } else {
      console.log(`✓ Messages table accessible. Found ${messages?.length || 0} messages`)
    }
    
    // Test 2: Check if we can query the stream_stats table
    console.log('\n2. Testing stream_stats table query...')
    const { data: stats, error: statsError } = await supabase
      .from('stream_stats')
      .select('*')
      .limit(5)
    
    if (statsError) {
      console.error('Stream stats query error:', statsError)
    } else {
      console.log(`✓ Stream stats table accessible. Found ${stats?.length || 0} stats`)
    }
    
    // Test 3: Check if we can query the stream_presence table
    console.log('\n3. Testing stream_presence table query...')
    const { data: presence, error: presenceError } = await supabase
      .from('stream_presence')
      .select('*')
      .limit(5)
    
    if (presenceError) {
      console.error('Stream presence query error:', presenceError)
    } else {
      console.log(`✓ Stream presence table accessible. Found ${presence?.length || 0} presence records`)
    }
    
    // Test 4: Test real-time subscription
    console.log('\n4. Testing real-time subscription...')
    const channel = supabase
      .channel('test-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('Real-time event received:', payload)
        }
      )
      .subscribe((status) => {
        console.log(`✓ Real-time subscription status: ${status}`)
      })
    
    // Clean up
    setTimeout(() => {
      supabase.removeChannel(channel)
      console.log('\n✅ All Supabase tests completed!')
      process.exit(0)
    }, 3000)
    
  } catch (error) {
    console.error('Test error:', error)
    process.exit(1)
  }
}

testSupabase()