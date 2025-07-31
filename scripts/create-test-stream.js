const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestStream() {
  try {
    // Get the test user
    const user = await prisma.user.findUnique({
      where: { email: 'testuser@example.com' }
    });

    if (!user) {
      console.log('Test user not found');
      return;
    }

    // Check if stream already exists
    const existingStream = await prisma.stream.findFirst({
      where: { userId: user.id }
    });

    if (existingStream) {
      console.log('Test stream already exists:', existingStream.id);
      console.log('Studio URL: http://localhost:3001/studio/' + existingStream.id);
      return;
    }

    // Create test stream
    const stream = await prisma.stream.create({
      data: {
        title: 'Test Stream',
        description: 'Test stream for video testing',
        userId: user.id,
        status: 'active',
        livekitRoomName: 'test-room-' + Date.now(),
        streamKey: 'test-stream-key-' + Date.now(),
      }
    });

    console.log('Test stream created successfully:', stream.id);
    console.log('Studio URL: http://localhost:3001/studio/' + stream.id);
  } catch (error) {
    console.error('Error creating test stream:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestStream();