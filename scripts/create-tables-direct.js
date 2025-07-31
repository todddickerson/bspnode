const https = require('https')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function executeSQL(sql) {
  const url = new URL(`${supabaseUrl}/rest/v1/rpc/exec_sql`)
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Prefer': 'return=representation'
    }
  }

  const data = JSON.stringify({ query: sql })

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = ''
      res.on('data', (chunk) => body += chunk)
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(body)
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`))
        }
      })
    })
    
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function createTables() {
  console.log('🚀 Creating Supabase tables directly...\n')

  // Try using the Supabase REST API to execute raw SQL
  const tableCreationSQL = `
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Create messages table
    CREATE TABLE IF NOT EXISTS messages (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      stream_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );

    -- Create stream_stats table
    CREATE TABLE IF NOT EXISTS stream_stats (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      stream_id TEXT NOT NULL UNIQUE,
      viewer_count INTEGER DEFAULT 0,
      heart_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );

    -- Create stream_presence table
    CREATE TABLE IF NOT EXISTS stream_presence (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      stream_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      is_host BOOLEAN DEFAULT false,
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      UNIQUE(stream_id, user_id)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_messages_stream_id ON messages(stream_id);
    CREATE INDEX IF NOT EXISTS idx_stream_presence_stream_id ON stream_presence(stream_id);
  `

  try {
    console.log('Attempting to execute SQL via Supabase API...')
    const result = await executeSQL(tableCreationSQL)
    console.log('✅ Tables created successfully!')
    console.log('Result:', result)
  } catch (error) {
    console.error('❌ Failed to create tables via API:', error.message)
    
    // If direct API doesn't work, try alternative approach
    console.log('\n📝 Alternative: Please run this SQL in your Supabase Dashboard:')
    console.log('Direct link: https://supabase.com/dashboard/project/pdgqkfmghtvfubffzctq/sql/new')
    console.log('\n```sql')
    console.log(tableCreationSQL)
    console.log('```')
  }
}

// Also try using fetch if available
async function createTablesWithFetch() {
  const fetch = require('node-fetch')
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        query: 'CREATE TABLE test_table (id INT);'
      })
    })

    const result = await response.text()
    console.log('Fetch result:', result)
  } catch (error) {
    console.log('Fetch error:', error.message)
  }
}

// Run the table creation
createTables()