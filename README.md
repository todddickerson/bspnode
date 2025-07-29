# BSPNode - Interactive Streaming Platform

A Fireside Chat-like interactive streaming platform built with Next.js and Mux.

## Features

### MVP (Phase 1)
- [x] Live streaming with Mux
- [x] Real-time chat during streams
- [x] Stream discovery lobby
- [x] Creator dashboard
- [x] User authentication

### Planned Features
- [ ] WebRTC co-hosting
- [ ] Reactions and emojis
- [ ] Stream recording
- [ ] Mobile apps
- [ ] Monetization

## Tech Stack

- **Frontend**: Next.js 14, TailwindCSS, Video.js
- **Backend**: Next.js API Routes, Socket.io
- **Database**: PostgreSQL with Prisma
- **Streaming**: Mux.com
- **Authentication**: NextAuth.js
- **Hosting**: Vercel + Railway

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Mux account (free tier available)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/bspnode.git

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Environment Variables

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
MUX_TOKEN_ID="your-mux-token"
MUX_TOKEN_SECRET="your-mux-secret"
```

## Project Structure

```
├── app/                  # Next.js app directory
├── components/           # React components
├── lib/                  # Utility functions
├── prisma/              # Database schema
├── public/              # Static assets
└── docs/                # Documentation
```

## Documentation

- [Implementation Guide](docs/implementation-guide.md)
- [Claude Code Instructions](docs/claude.md)
- [Pricing Analysis](docs/pricing-comparison.md)
- [Architecture Overview](docs/architecture.md)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
