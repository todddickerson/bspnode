#!/bin/bash

echo "Setting up BSPNode development environment..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install PostgreSQL first."
    echo "On macOS: brew install postgresql"
    echo "On Ubuntu: sudo apt-get install postgresql"
    exit 1
fi

# Create database if it doesn't exist
echo "Creating database..."
createdb bspnode 2>/dev/null || echo "Database 'bspnode' already exists"

# Update .env.local with proper DATABASE_URL
echo "Updating .env.local..."
if [ -f .env.local ]; then
    # Update existing DATABASE_URL
    sed -i.bak 's|DATABASE_URL=".*"|DATABASE_URL="postgresql://localhost:5432/bspnode"|' .env.local
else
    # Create new .env.local
    cp .env.local.example .env.local
    sed -i.bak 's|DATABASE_URL=".*"|DATABASE_URL="postgresql://localhost:5432/bspnode"|' .env.local
fi

echo "Running database migrations..."
npm run prisma:migrate -- --name init

echo "Generating Prisma client..."
npm run prisma:generate

echo "Setup complete! You can now run 'npm run dev' to start the application."