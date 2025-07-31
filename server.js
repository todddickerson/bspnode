const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

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

    socket.on('join-stream', (streamId) => {
      socket.join(streamId)
      console.log(`User ${socket.id} joined stream ${streamId}`)
    })

    socket.on('leave-stream', (streamId) => {
      socket.leave(streamId)
      console.log(`User ${socket.id} left stream ${streamId}`)
    })

    socket.on('send-message', async (data) => {
      try {
        const message = await prisma.message.create({
          data: {
            content: data.content,
            userId: data.user.id,
            streamId: data.streamId,
          }
        })

        const messageWithUser = await prisma.message.findUnique({
          where: { id: message.id },
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })

        io.to(data.streamId).emit('new-message', {
          id: messageWithUser.id,
          content: messageWithUser.content,
          user: messageWithUser.user,
          streamId: messageWithUser.streamId,
          createdAt: messageWithUser.createdAt.toISOString()
        })
      } catch (error) {
        console.error('Error saving chat message:', error)
        // Fallback to memory-only message if database fails
        io.to(data.streamId).emit('new-message', {
          id: Date.now().toString(),
          content: data.content,
          user: data.user,
          streamId: data.streamId,
          createdAt: new Date().toISOString()
        })
      }
    })

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id)
    })
  })

  const PORT = process.env.PORT || 3001
  server.listen(PORT, (err) => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${PORT}`)
  })
})