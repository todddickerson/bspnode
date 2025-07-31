#!/usr/bin/env node

import { egressClient } from '../lib/livekit-enhanced'
import { stopEgressGracefully } from '../lib/livekit-enhanced'

async function listActiveEgresses() {
  try {
    console.log('Fetching active egresses...')
    
    const egressList = await egressClient.listEgress({
      active: true,
    })

    if (egressList.length === 0) {
      console.log('No active egresses found.')
      return []
    }

    console.log(`Found ${egressList.length} active egress(es):\n`)
    
    egressList.forEach((egress, index) => {
      console.log(`${index + 1}. Egress ID: ${egress.egressId}`)
      console.log(`   Room Name: ${egress.roomName || 'N/A'}`)
      console.log(`   Room ID: ${egress.roomId || 'N/A'}`)
      console.log(`   Status: ${egress.status}`)
      console.log(`   Started: ${new Date(egress.startedAt).toLocaleString()}`)
      if (egress.stream) {
        console.log(`   Streaming to: ${egress.stream.info?.url?.replace(/\/[^\/]+$/, '/***')}`)
      }
      console.log('')
    })

    return egressList
  } catch (error) {
    console.error('Failed to list egresses:', error)
    return []
  }
}

async function stopAllActiveEgresses() {
  const egressList = await listActiveEgresses()
  
  if (egressList.length === 0) {
    return
  }

  console.log('Stopping all active egresses...\n')
  
  for (const egress of egressList) {
    console.log(`Stopping egress ${egress.egressId}...`)
    const stopped = await stopEgressGracefully(egress.egressId)
    
    if (stopped) {
      console.log(`✓ Successfully stopped egress ${egress.egressId}`)
    } else {
      console.log(`✗ Failed to stop egress ${egress.egressId}`)
    }
  }
}

async function stopSpecificEgress(egressId: string) {
  console.log(`Stopping egress ${egressId}...`)
  const stopped = await stopEgressGracefully(egressId)
  
  if (stopped) {
    console.log(`✓ Successfully stopped egress ${egressId}`)
  } else {
    console.log(`✗ Failed to stop egress ${egressId}`)
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  console.log('LiveKit Egress Manager\n')

  switch (command) {
    case 'list':
      await listActiveEgresses()
      break
      
    case 'stop-all':
      await stopAllActiveEgresses()
      break
      
    case 'stop':
      const egressId = args[1]
      if (!egressId) {
        console.error('Please provide an egress ID to stop')
        console.log('Usage: manage-egress stop <egress-id>')
        process.exit(1)
      }
      await stopSpecificEgress(egressId)
      break
      
    default:
      console.log('Usage:')
      console.log('  manage-egress list           - List all active egresses')
      console.log('  manage-egress stop-all       - Stop all active egresses')
      console.log('  manage-egress stop <id>      - Stop a specific egress')
      console.log('')
      console.log('Example:')
      console.log('  npm run manage-egress list')
      console.log('  npm run manage-egress stop EG_mCRDaL5yNyzU')
  }
}

// Run the script
main().catch(console.error)