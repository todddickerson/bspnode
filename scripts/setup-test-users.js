const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const TEST_USERS = [
  {
    email: 'test-owner@example.com',
    password: 'test123456',
    name: 'Stream Owner'
  },
  {
    email: 'test-host1@example.com', 
    password: 'test123456',
    name: 'Host One'
  },
  {
    email: 'test-host2@example.com',
    password: 'test123456', 
    name: 'Host Two'
  }
]

async function setupTestUsers() {
  console.log('Setting up test users...')
  
  for (const user of TEST_USERS) {
    try {
      // Check if user exists
      const existing = await prisma.user.findUnique({
        where: { email: user.email }
      })
      
      if (existing) {
        console.log(`User ${user.email} already exists`)
        continue
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10)
      
      // Create user
      await prisma.user.create({
        data: {
          email: user.email,
          password: hashedPassword,
          name: user.name
        }
      })
      
      console.log(`Created user: ${user.email}`)
    } catch (error) {
      console.error(`Error creating user ${user.email}:`, error)
    }
  }
  
  console.log('Test users setup complete!')
}

setupTestUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect())