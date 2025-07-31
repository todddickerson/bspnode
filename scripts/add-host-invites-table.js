#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Adding HostInvite table to database...')
  
  try {
    // Check if table already exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'HostInvite'
      );
    `
    
    if (tableExists[0].exists) {
      console.log('HostInvite table already exists')
      return
    }
    
    // Create the HostInvite table
    await prisma.$executeRaw`
      CREATE TABLE "HostInvite" (
        "id" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "streamId" TEXT NOT NULL,
        "createdBy" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'HOST',
        "maxUses" INTEGER NOT NULL DEFAULT 1,
        "usedCount" INTEGER NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP(3),
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "HostInvite_pkey" PRIMARY KEY ("id")
      );
    `
    
    // Create indexes
    await prisma.$executeRaw`CREATE UNIQUE INDEX "HostInvite_token_key" ON "HostInvite"("token");`
    await prisma.$executeRaw`CREATE INDEX "HostInvite_streamId_idx" ON "HostInvite"("streamId");`
    await prisma.$executeRaw`CREATE INDEX "HostInvite_createdBy_idx" ON "HostInvite"("createdBy");`
    
    // Add foreign key constraints
    await prisma.$executeRaw`
      ALTER TABLE "HostInvite" ADD CONSTRAINT "HostInvite_streamId_fkey" 
      FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `
    
    await prisma.$executeRaw`
      ALTER TABLE "HostInvite" ADD CONSTRAINT "HostInvite_createdBy_fkey" 
      FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `
    
    console.log('✅ HostInvite table created successfully!')
    
  } catch (error) {
    console.error('Error creating HostInvite table:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()