# MVP Implementation Guide for Fireside Chat Clone

## Core Features to Build (Priority Order)

### 1. Database & Auth Setup
- Prisma schema with User, Stream, Message models
- NextAuth configuration with credentials provider
- Login/Register pages

### 2. Stream Management API
- POST /api/streams - Create stream (calls Mux API)
- GET /api/streams - List all streams
- GET /api/streams/[id] - Get single stream
- POST /api/streams/[id]/start - Start stream
- POST /api/streams/[id]/end - End stream

### 3. Creator Dashboard (/dashboard)
- List user's streams
- Create new stream button
- Show stream key for OBS
- Start/End stream controls
- View stream analytics

### 4. Video Player Component
- Video.js with HLS support
- Mux playback URL integration
- Live indicator badge
- Responsive design

### 5. Chat System
- Socket.io server setup
- Real-time message broadcasting
- Chat component with auto-scroll
- Message persistence in database

### 6. Stream Lobby (/lobby)
- Grid of stream cards
- Live/Upcoming indicators
- Click to watch stream
- Real-time updates

### 7. Stream Viewer Page (/stream/[id])
- Video player (left/top)
- Chat panel (right/bottom)
- Stream info (title, host, description)
- Mobile responsive layout

## Key Technical Decisions

### Why Mux over Agora?
- 5-10x cheaper for viewer scaling
- Simpler implementation
- Standard HLS works everywhere
- Can add WebRTC later if needed

### Database Choice
- PostgreSQL for reliability
- Prisma for type safety
- Can scale to millions of users

### Real-time Stack
- Socket.io for chat (proven, simple)
- Consider migrating to Pusher/Ably later

## Testing Workflow
1. Create account
2. Create stream in dashboard
3. Copy RTMP URL + Stream Key
4. Stream with OBS to: rtmps://global-live.mux.com:443/app/{streamKey}
5. Start stream from dashboard
6. Open viewer page in another browser
7. Test chat functionality
