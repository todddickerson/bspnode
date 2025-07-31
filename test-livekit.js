const { RoomServiceClient } = require('livekit-server-sdk');

async function testLiveKit() {
  const LIVEKIT_API_KEY = 'APIwfca4dwNrmwM';
  const LIVEKIT_API_SECRET = 'n94NfMMIThFzxtq8SozK6CH6F35UlPRIUG7z80XO9vD';
  const LIVEKIT_URL = 'wss://backstagepass-yl6ukwtf.livekit.cloud';

  try {
    console.log('Testing LiveKit connection...');
    const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    
    // List rooms
    const rooms = await roomService.listRooms();
    console.log('✅ LiveKit connection successful!');
    console.log(`Found ${rooms.length} rooms`);
    
    // Try to create a test room
    const testRoom = await roomService.createRoom({
      name: 'test-room-' + Date.now(),
      maxParticipants: 2,
    });
    console.log('✅ Successfully created test room:', testRoom.name);
    
    // Delete test room
    await roomService.deleteRoom(testRoom.name);
    console.log('✅ Successfully deleted test room');
    
  } catch (error) {
    console.error('❌ LiveKit connection failed:', error.message);
    console.error('Error details:', error);
  }
}

testLiveKit();