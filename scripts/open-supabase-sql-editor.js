const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

// Read the migration SQL
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250131_create_tables.sql')
const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

// Copy SQL to clipboard (works on macOS)
exec(`echo '${migrationSQL.replace(/'/g, "'\\''")}' | pbcopy`, (error) => {
  if (!error) {
    console.log('✅ Migration SQL copied to clipboard!')
  }
})

// Open the Supabase SQL editor
const sqlEditorURL = 'https://supabase.com/dashboard/project/pdgqkfmghtvfubffzctq/sql/new'

console.log('🚀 Opening Supabase SQL Editor...')
console.log('📋 Migration SQL has been copied to your clipboard')
console.log('\nSteps:')
console.log('1. The browser will open to your Supabase SQL Editor')
console.log('2. Paste (Cmd+V) the SQL that\'s been copied to your clipboard')
console.log('3. Click the "Run" button')
console.log('\nOpening browser...')

// Open browser
exec(`open "${sqlEditorURL}"`, (error) => {
  if (error) {
    console.error('Failed to open browser:', error)
    console.log(`\nPlease open this URL manually:\n${sqlEditorURL}`)
  }
})