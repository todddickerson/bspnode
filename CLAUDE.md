# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Handoff Protocol

When starting a new session:
1. **Check for HANDOFF.md**: Look for a handoff file in the root directory
2. **Review Status**: Read through active issues and TODOs
3. **Verify Completed Items**: Test features marked as completed
4. **Clean Up**: Remove items from HANDOFF.md that are verified working
5. **Continue Work**: Pick up from where the previous session left off

If HANDOFF.md exists but all items are completed, delete the file.

## Project Overview

BSPNode is a Fireside Chat clone - an interactive streaming platform with live broadcasting and real-time chat. It's built as a monolithic Next.js application for MVP simplicity.

## Essential Commands

```bash
# Development
npm run dev              # Start development server (http://localhost:3000)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run prisma:generate  # Generate Prisma client types
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio GUI for database management
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TailwindCSS, Radix UI
- **Backend**: Next.js API Routes, Socket.io for real-time features
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js
- **Streaming**: Mux.com (managed service), HLS protocol with Video.js

### Key Architectural Decisions
1. **Monolithic MVP**: All code in one Next.js app for rapid development
2. **Managed Streaming**: Using Mux instead of self-hosted (5-10x cheaper than Agora)
3. **HLS Streaming**: 5-10 second latency (acceptable for audience experience)
4. **Real-time Chat**: Socket.io for WebSocket connections

### Core Features Structure
- **Authentication**: NextAuth.js with email/password and OAuth providers
- **Streaming**: Broadcaster uses Mux API, viewers use HLS playback
- **Chat**: Real-time messaging with Socket.io rooms
- **User Management**: Prisma models for users, streams, messages

## Development Workflow

1. **Database Changes**: 
   - Modify schema in `prisma/schema.prisma`
   - Run `npm run prisma:migrate` to create migration
   - Run `npm run prisma:generate` to update types

2. **API Development**:
   - API routes in `app/api/` directory
   - Socket.io handlers in `app/api/socket/`
   - Use Prisma client for database operations

3. **Component Development**:
   - Components in `components/` directory
   - Use TypeScript for type safety
   - Follow existing patterns for consistency

## Environment Setup

Required environment variables in `.env.local`:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Authentication secret
- `MUX_TOKEN_ID` & `MUX_TOKEN_SECRET` - Mux API credentials
- OAuth provider credentials (Google, GitHub, etc.)

## Important Notes

- The project uses Next.js App Router (not Pages Router)
- Socket.io integration requires special handling in Next.js
- Mux webhook endpoints needed for stream status updates
- Check `docs/` directory for detailed implementation guides
- Always run `npm run dev` after pulling changes to ensure Prisma client is updated
- Device preferences are stored in localStorage
- Host invites use secure tokens with expiration