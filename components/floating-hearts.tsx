'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'

interface FloatingHeart {
  id: number
  x: number
  delay: number
  duration: number
  size: number
}

interface FloatingHeartsProps {
  triggerHeart?: number
}

export function FloatingHearts({ triggerHeart = 0 }: FloatingHeartsProps) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([])
  const [heartId, setHeartId] = useState(0)

  useEffect(() => {
    if (triggerHeart > 0) {
      addHeart()
    }
  }, [triggerHeart])

  const addHeart = () => {
    const newHeart: FloatingHeart = {
      id: heartId,
      x: 10 + Math.random() * 80, // Random position between 10% and 90%
      delay: Math.random() * 0.5,
      duration: 3 + Math.random() * 2, // 3-5 seconds
      size: 24 + Math.random() * 16, // 24-40px
    }
    
    setHearts(prev => [...prev, newHeart])
    setHeartId(prev => prev + 1)

    // Remove heart after animation completes
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id))
    }, (newHeart.duration + newHeart.delay) * 1000)
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute bottom-0 animate-float-up"
          style={{
            left: `${heart.x}%`,
            animationDelay: `${heart.delay}s`,
            animationDuration: `${heart.duration}s`,
          }}
        >
          <Heart
            className="text-red-500 fill-red-500"
            style={{
              width: `${heart.size}px`,
              height: `${heart.size}px`,
            }}
          />
        </div>
      ))}
    </div>
  )
}