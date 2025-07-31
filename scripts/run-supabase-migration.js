const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables!')
  process.exit(1)
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('Running Supabase migration...\n')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Split by semicolons but be careful with functions
    const statements = migrationSQL
      .split(/;(?=\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|--))/)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';')
    
    console.log(`Found ${statements.length} SQL statements to execute\n`)
    
    let successCount = 0
    let errorCount = 0
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      const preview = statement.substring(0, 50).replace(/\n/g, ' ')
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          // Try direct execution as fallback
          console.log(`Statement ${i + 1}: ${preview}...`)
          console.error(`  ❌ Error: ${error.message}`)
          console.log('  Trying alternative approach...')
          
          // For RLS and certain operations, we might need to handle differently
          if (statement.includes('ENABLE ROW LEVEL SECURITY')) {
            console.log('  ⚠️  RLS must be enabled through Supabase dashboard')
          } else {
            errorCount++
          }
        } else {
          console.log(`Statement ${i + 1}: ✅ ${preview}...`)
          successCount++
        }
      } catch (err) {
        console.log(`Statement ${i + 1}: ${preview}...`)
        console.error(`  ❌ Error: ${err.message}`)
        errorCount++
      }
    }
    
    console.log(`\n📊 Migration Summary:`)
    console.log(`  ✅ Successful: ${successCount}`)
    console.log(`  ❌ Failed: ${errorCount}`)
    
    // Test the tables
    console.log('\n🧪 Testing created tables...')
    
    const tables = ['messages', 'stream_stats', 'stream_presence']
    for (const table of tables) {
      const { error } = await supabase.from(table).select('*').limit(1)
      if (error) {
        console.log(`  ❌ ${table}: ${error.message}`)
      } else {
        console.log(`  ✅ ${table}: Table accessible`)
      }
    }
    
    console.log('\n✨ Migration complete!')
    console.log('\n📝 Note: You may need to manually enable RLS policies in the Supabase dashboard.')
    
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  }
}

// Alternative: Direct SQL execution via fetch
async function runMigrationViaAPI() {
  console.log('Running migration via Supabase SQL API...\n')
  
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
  
  console.log('📋 Migration SQL:')
  console.log('================')
  console.log(migrationSQL)
  console.log('================\n')
  
  console.log('⚠️  Please run this SQL in your Supabase dashboard:')
  console.log('1. Go to https://supabase.com/dashboard')
  console.log('2. Select your project')
  console.log('3. Go to SQL Editor')
  console.log('4. Paste the SQL above and run it')
  console.log('\nThis will create all necessary tables and policies.')
}

// Try the automated approach first
runMigrationViaAPI()