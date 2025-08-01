'use client'

import { useEffect, useState, useRef } from 'react'
import { Heart } from 'lucide-react'

interface FloatingHeart {
  id: number
  x: number
  delay: number
  duration: number
  size: number
}

interface FloatingHeartsProps {
  heartCount: number
  enabled?: boolean
}

export function FloatingHearts({ heartCount, enabled = true }: FloatingHeartsProps) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([])
  const [heartId, setHeartId] = useState(0)
  const previousCountRef = useRef(heartCount)

  useEffect(() => {
    if (!enabled) return

    // Detect new hearts by comparing with previous count
    const newHeartsCount = heartCount - previousCountRef.current
    
    if (newHeartsCount > 0) {
      // Add multiple hearts for batch updates (limit to prevent spam)
      const heartsToAdd = Math.min(newHeartsCount, 5)
      
      for (let i = 0; i < heartsToAdd; i++) {
        setTimeout(() => addHeart(), i * 100) // Stagger hearts slightly
      }
    }
    
    previousCountRef.current = heartCount
  }, [heartCount, enabled])

  const addHeart = () => {
    const newHeart: FloatingHeart = {
      id: heartId + Math.random(), // Use random to ensure uniqueness
      x: 10 + Math.random() * 80, // Random position between 10% and 90%
      delay: 0,
      duration: 3 + Math.random() * 2, // 3-5 seconds
      size: 24 + Math.random() * 16, // 24-40px
    }
    
    setHearts(prev => [...prev, newHeart])
    setHeartId(prev => prev + 1)

    // Remove heart after animation completes
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id))
    }, newHeart.duration * 1000)
  }

  if (!enabled) return null

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute bottom-0 animate-float-up opacity-80"
          style={{
            left: `${heart.x}%`,
            animationDelay: `${heart.delay}s`,
            animationDuration: `${heart.duration}s`,
          }}
        >
          <Heart
            className="text-red-500 fill-red-500 animate-pulse"
            style={{
              width: `${heart.size}px`,
              height: `${heart.size}px`,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}
          />
        </div>
      ))}
    </div>
  )
}