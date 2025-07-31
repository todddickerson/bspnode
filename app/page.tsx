import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Welcome to BSPNode
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Interactive streaming platform with real-time chat
        </p>
        
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg">
              Get Started
            </Button>
          </Link>
          <Link href="/lobby">
            <Button size="lg" variant="outline">
              Browse Streams
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}