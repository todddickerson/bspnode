const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables!')
  process.exit(1)
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupTables() {
  console.log('🚀 Setting up Supabase tables via API...\n')

  try {
    // Use the Supabase Management API to execute SQL
    const projectRef = 'pdgqkfmghtvfubffzctq'
    const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
    
    // SQL statements to execute
    const sqlStatements = [
      // Enable UUID extension
      `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
      
      // Create messages table
      `CREATE TABLE IF NOT EXISTS messages (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        stream_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
      );`,
      
      // Create stream_stats table
      `CREATE TABLE IF NOT EXISTS stream_stats (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        stream_id TEXT NOT NULL UNIQUE,
        viewer_count INTEGER DEFAULT 0,
        heart_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
      );`,
      
      // Create stream_presence table
      `CREATE TABLE IF NOT EXISTS stream_presence (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        stream_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        is_host BOOLEAN DEFAULT false,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        UNIQUE(stream_id, user_id)
      );`,
      
      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_messages_stream_id ON messages(stream_id);`,
      `CREATE INDEX IF NOT EXISTS idx_stream_presence_stream_id ON stream_presence(stream_id);`,
      
      // Disable RLS for easier testing (can enable later)
      `ALTER TABLE messages DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE stream_stats DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE stream_presence DISABLE ROW LEVEL SECURITY;`
    ]

    // Alternative approach: Use Supabase client to create tables via raw SQL
    console.log('Attempting to create tables using service role access...\n')
    
    // Since Supabase doesn't expose direct SQL execution via JS client,
    // we'll create the tables by attempting operations that will auto-create them
    // or use a workaround
    
    // First, let's try to access each table to see current state
    console.log('1. Checking current table status...')
    
    const tables = ['messages', 'stream_stats', 'stream_presence']
    const tableStatus = {}
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1)
        if (error) {
          tableStatus[table] = 'missing'
          console.log(`   ❌ ${table}: Not found`)
        } else {
          tableStatus[table] = 'exists'
          console.log(`   ✅ ${table}: Already exists`)
        }
      } catch (err) {
        tableStatus[table] = 'error'
        console.log(`   ❌ ${table}: Error - ${err.message}`)
      }
    }

    // If tables don't exist, we need to create them
    // Using a workaround with Supabase REST API
    const missingTables = Object.entries(tableStatus)
      .filter(([_, status]) => status === 'missing')
      .map(([table, _]) => table)

    if (missingTables.length > 0) {
      console.log(`\n2. Creating ${missingTables.length} missing tables...`)
      console.log('\n⚠️  Tables need to be created via Supabase Dashboard SQL Editor')
      console.log('\nPlease follow these steps:')
      console.log('1. Go to https://supabase.com/dashboard/project/pdgqkfmghtvfubffzctq/sql/new')
      console.log('2. Copy and paste the following SQL:\n')
      
      // Output the SQL for manual execution
      const setupSQL = `
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

-- Disable RLS for testing
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE stream_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE stream_presence DISABLE ROW LEVEL SECURITY;`

      console.log('```sql')
      console.log(setupSQL)
      console.log('```')
      
      console.log('\n3. Click "Run" to execute the SQL')
      console.log('\n📝 Direct link to SQL editor:')
      console.log('https://supabase.com/dashboard/project/pdgqkfmghtvfubffzctq/sql/new')
      
      // Try an alternative approach using fetch with Supabase REST API
      console.log('\n\nAttempting alternative setup via REST API...')
      await attemptRESTSetup()
      
    } else {
      console.log('\n✅ All tables already exist!')
      console.log('\n🎉 Supabase is ready to use!')
    }

  } catch (error) {
    console.error('Setup error:', error)
  }
}

async function attemptRESTSetup() {
  // Unfortunately, Supabase doesn't allow table creation via REST API
  // Tables must be created via Dashboard or CLI
  
  console.log('\n📋 Alternative: Using Supabase CLI')
  console.log('\nIf you have Supabase CLI installed:')
  console.log('1. Run: npx supabase login')
  console.log('2. Run: npx supabase link --project-ref pdgqkfmghtvfubffzctq')
  console.log('3. Run: npx supabase db push')
  console.log('\nOr use the direct SQL editor link above.')
}

// Run the setup
setupTables()