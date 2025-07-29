#!/bin/bash

# BSPNode Quick Start Script

echo "🚀 Setting up BSPNode - Fireside Chat Clone"
echo "=========================================="

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file
if [ ! -f .env.local ]; then
    echo "📋 Creating .env.local from template..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your credentials!"
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your Mux and database credentials"
echo "2. Run 'npx prisma migrate dev' to set up the database"
echo "3. Run 'npm run dev' to start the development server"
echo ""
echo "📚 Check docs/mvp-guide.md for implementation details"
