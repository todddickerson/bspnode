# Claude Code Instructions for Fireside Chat Clone

## Project Overview
Building an interactive streaming platform similar to Fireside Chat with:
- Live streaming for hosts/presenters
- Real-time chat for viewers
- Stream discovery lobby
- Creator dashboard

## Tech Stack (MVP)
- **Frontend**: Next.js 14 (App Router) + TailwindCSS + shadcn/ui
- **Backend**: Next.js API routes + Socket.io
- **Database**: PostgreSQL with Prisma ORM
- **Streaming**: Mux.com (managed service)
- **Auth**: NextAuth.js

## Key Design Decisions
1. **Mux over Agora**: 5-10x cheaper for broadcasting to many viewers
2. **Managed services first**: Can migrate to self-hosted later
3. **Monolithic Next.js app**: Simpler deployment for MVP
4. **HLS streaming**: 5-10 second latency acceptable for audience

## Implementation Priority
1. Basic auth and user accounts
2. Stream creation and management
3. Live streaming with Mux
4. Real-time chat
5. Stream discovery page

## Cost Considerations
- Mux charges ~$26/hour for 500 viewers vs Agora's ~$60/hour
- Start with Mux free tier
- Consider hybrid approach later if needed (Agora for hosts, Mux for viewers)

## Future Enhancements
- WebRTC for host-to-host collaboration
- Mobile apps
- Recording and VOD
- Monetization features
