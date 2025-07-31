const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function createTestUser() {
  const prisma = new PrismaClient()
  
  try {
    // Check if test user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'testuser@example.com' }
    })
    
    if (existingUser) {
      console.log('Test user already exists')
      return
    }
    
    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 12)
    
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'testuser@example.com',
        password: hashedPassword
      }
    })
    
    console.log('Test user created:', user.email)
  } catch (error) {
    console.error('Error creating test user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()