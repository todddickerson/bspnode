# Architecture Overview

## System Components

### Frontend (Next.js)
```
User Browser
    ↓
Next.js App (Vercel)
    ├── Stream Viewer (Video.js + HLS)
    ├── Chat Interface (Socket.io)
    └── Dashboard (React)
```

### Backend Services
```
Next.js API Routes
    ├── /api/auth (NextAuth)
    ├── /api/streams (CRUD)
    ├── /api/mux (Webhooks)
    └── /api/socket (Chat)
         ↓
    PostgreSQL (Railway)
```

### Streaming Pipeline
```
Host (OBS/Mobile)
    ↓ RTMP
Mux Ingest
    ↓ Transcode
Mux CDN
    ↓ HLS
Viewers (Video.js)
```

## Data Flow

1. **Stream Creation**
   - Host creates stream → API → Mux → Database
   - Returns RTMP URL + Stream Key

2. **Going Live**
   - Host streams to Mux via RTMP
   - Mux transcodes and creates HLS manifest
   - Webhook updates stream status

3. **Viewer Experience**
   - Load stream page → Fetch HLS URL
   - Video.js plays HLS stream
   - Socket.io connects for chat
