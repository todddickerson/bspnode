const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Track stream viewers and stats
const streamStats = new Map() // streamId -> { viewers: Set, hearts: number }

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(server, {
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3001',
      methods: ['GET', 'POST']
    }
  })

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    socket.on('join-stream', async ({ streamId, userId, isHost }) => {
      socket.join(streamId)
      socket.data.streamId = streamId
      socket.data.userId = userId
      socket.data.isHost = isHost
      
      // Initialize stream stats if needed
      if (!streamStats.has(streamId)) {
        streamStats.set(streamId, { viewers: new Set(), hearts: 0 })
      }
      
      // Add viewer to count (excluding hosts)
      const stats = streamStats.get(streamId)
      if (!isHost && userId) {
        stats.viewers.add(userId)
      }
      
      // Emit updated viewer count to all in stream
      io.to(streamId).emit('viewer-count', stats.viewers.size)
      
      console.log(`User ${socket.id} joined stream ${streamId} as ${isHost ? 'host' : 'viewer'}`)
    })

    socket.on('leave-stream', ({ streamId }) => {
      socket.leave(streamId)
      
      // Remove from viewer count if was a viewer
      if (streamStats.has(streamId) && !socket.data.isHost && socket.data.userId) {
        const stats = streamStats.get(streamId)
        stats.viewers.delete(socket.data.userId)
        io.to(streamId).emit('viewer-count', stats.viewers.size)
      }
      
      console.log(`User ${socket.id} left stream ${streamId}`)
    })

    socket.on('send-message', async (data) => {
      try {
        // Get user info from socket data or database
        let userName = 'Anonymous'
        let userId = socket.data.userId
        
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
          })
          userName = user?.name || 'Anonymous'
        }
        
        const message = {
          id: Date.now().toString(),
          message: data.message,
          userId: userId || 'anonymous',
          userName: userName,
          timestamp: new Date(),
          streamId: data.streamId
        }
        
        // Save to database (optional)
        try {
          await prisma.message.create({
            data: {
              content: data.message,
              userId: userId,
              streamId: data.streamId,
            }
          })
        } catch (dbError) {
          console.error('Failed to save message to DB:', dbError)
        }
        
        // Emit to all users in the stream room
        io.to(data.streamId).emit('chat-message', message)
        
      } catch (error) {
        console.error('Error handling chat message:', error)
      }
    })

    // Handle heart reactions
    socket.on('send-heart', ({ streamId }) => {
      if (streamStats.has(streamId)) {
        const stats = streamStats.get(streamId)
        stats.hearts++
        io.to(streamId).emit('heart-sent', { total: stats.hearts })
      }
    })
    
    // Handle get initial messages
    socket.on('get-messages', async ({ streamId }) => {
      try {
        const messages = await prisma.message.findMany({
          where: { streamId },
          orderBy: { createdAt: 'asc' },
          take: 100,
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })
        
        const formattedMessages = messages.map(msg => ({
          id: msg.id,
          message: msg.content,
          userId: msg.userId,
          userName: msg.user?.name || 'Anonymous',
          timestamp: msg.createdAt,
          streamId: msg.streamId
        }))
        
        socket.emit('messages-history', formattedMessages)
      } catch (error) {
        console.error('Error fetching messages:', error)
        socket.emit('messages-history', [])
      }
    })
    
    socket.on('disconnect', () => {
      // Clean up viewer count on disconnect
      if (socket.data.streamId && socket.data.userId && !socket.data.isHost) {
        const stats = streamStats.get(socket.data.streamId)
        if (stats) {
          stats.viewers.delete(socket.data.userId)
          io.to(socket.data.streamId).emit('viewer-count', stats.viewers.size)
        }
      }
      console.log('User disconnected:', socket.id)
    })
  })

  const PORT = process.env.PORT || 3001
  server.listen(PORT, (err) => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${PORT}`)
  })
})