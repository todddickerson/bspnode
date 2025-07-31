#!/usr/bin/env node

const { EgressClient } = require('livekit-server-sdk');
const { config } = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
config({ path: path.join(__dirname, '..', '.env.local') });

// LiveKit configuration
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';

const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

async function listActiveEgresses() {
  try {
    console.log('Fetching active egresses...');
    
    const allEgressList = await egressClient.listEgress({
      active: true,
    });
    
    // Filter to only show ACTIVE (status 1) egresses, not ENDING ones
    const egressList = allEgressList.filter(egress => egress.status === 1);

    if (egressList.length === 0) {
      console.log('No active egresses found.');
      return [];
    }

    console.log(`Found ${egressList.length} active egress(es):\n`);
    
    egressList.forEach((egress, index) => {
      console.log(`${index + 1}. Egress ID: ${egress.egressId}`);
      console.log(`   Room Name: ${egress.roomName || 'N/A'}`);
      console.log(`   Room ID: ${egress.roomId || 'N/A'}`);
      const statusMap = {
        0: 'STARTING',
        1: 'ACTIVE',
        2: 'ENDING',
        3: 'COMPLETE',
        4: 'FAILED',
        5: 'ABORTED',
        6: 'LIMIT_REACHED'
      };
      console.log(`   Status: ${statusMap[egress.status] || egress.status}`);
      console.log(`   Started: ${new Date(Number(egress.startedAt)).toLocaleString()}`);
      if (egress.stream) {
        console.log(`   Streaming to: ${egress.stream.info?.url?.replace(/\/[^\/]+$/, '/***')}`);
      }
      console.log('');
    });

    return egressList;
  } catch (error) {
    console.error('Failed to list egresses:', error);
    return [];
  }
}

async function stopEgressGracefully(egressId, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await egressClient.stopEgress(egressId);
      console.log('Egress stopped successfully:', egressId);
      return true;
    } catch (error) {
      retries++;
      console.error(`Failed to stop egress (attempt ${retries}):`, error.message);
      
      if (retries < maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }
  }
  
  return false;
}

async function stopAllActiveEgresses() {
  const egressList = await listActiveEgresses();
  
  if (egressList.length === 0) {
    return;
  }

  console.log('Stopping all active egresses...\n');
  
  for (const egress of egressList) {
    console.log(`Stopping egress ${egress.egressId}...`);
    const stopped = await stopEgressGracefully(egress.egressId);
    
    if (stopped) {
      console.log(`✓ Successfully stopped egress ${egress.egressId}`);
    } else {
      console.log(`✗ Failed to stop egress ${egress.egressId}`);
    }
  }
}

async function stopSpecificEgress(egressId) {
  console.log(`Stopping egress ${egressId}...`);
  const stopped = await stopEgressGracefully(egressId);
  
  if (stopped) {
    console.log(`✓ Successfully stopped egress ${egressId}`);
  } else {
    console.log(`✗ Failed to stop egress ${egressId}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('LiveKit Egress Manager\n');

  switch (command) {
    case 'list':
      await listActiveEgresses();
      break;
      
    case 'stop-all':
      await stopAllActiveEgresses();
      break;
      
    case 'stop':
      const egressId = args[1];
      if (!egressId) {
        console.error('Please provide an egress ID to stop');
        console.log('Usage: manage-egress stop <egress-id>');
        process.exit(1);
      }
      await stopSpecificEgress(egressId);
      break;
      
    default:
      console.log('Usage:');
      console.log('  manage-egress list           - List all active egresses');
      console.log('  manage-egress stop-all       - Stop all active egresses');
      console.log('  manage-egress stop <id>      - Stop a specific egress');
      console.log('');
      console.log('Example:');
      console.log('  npm run manage-egress list');
      console.log('  npm run manage-egress stop EG_mCRDaL5yNyzU');
  }
}

// Run the script
main().catch(console.error);