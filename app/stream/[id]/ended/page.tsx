'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle, Clock, Video, Home, Copy, Share2, 
  RefreshCw, Loader2, AlertCircle 
} from 'lucide-react'
import Link from 'next/link'

interface Stream {
  id: string
  title: string
  description: string | null
  status: string
  recordingStatus: string | null
  recordingUrl: string | null
  duration: number | null
  endedAt: string | null
  user: {
    name: string
  }
}

export default function StreamEndedPage() {
  const params = useParams()
  const streamId = params.id as string
  const router = useRouter()
  const [stream, setStream] = useState<Stream | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkCount, setCheckCount] = useState(0)

  useEffect(() => {
    fetchStream()
    
    // Check for recording status every 5 seconds for up to 2 minutes
    const interval = setInterval(() => {
      if (checkCount < 24) { // 24 checks * 5 seconds = 2 minutes
        fetchStream()
        setCheckCount(prev => prev + 1)
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [streamId])

  const fetchStream = async () => {
    try {
      const response = await fetch(`/api/streams/${streamId}`)
      if (response.ok) {
        const data = await response.json()
        setStream(data)
        
        // If recording is ready, stop checking
        if (data.recordingStatus === 'READY') {
          setCheckCount(24)
        }
      }
    } catch (error) {
      console.error('Error fetching stream:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyStreamUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/stream/${streamId}`)
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    }
    return `${minutes}m ${secs}s`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Stream Not Found</h1>
          <p className="text-gray-600">This stream does not exist.</p>
        </div>
      </div>
    )
  }

  const isProcessing = stream.recordingStatus === 'PROCESSING' || stream.recordingStatus === 'UPLOADING'
  const isReady = stream.recordingStatus === 'READY'
  const isFailed = stream.recordingStatus === 'FAILED'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Stream Ended Successfully!</h1>
            <p className="text-gray-600">
              Great job! Your broadcast "{stream.title}" has ended.
            </p>
          </div>

          {/* Stream Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Clock className="h-6 w-6 mx-auto mb-2 text-gray-600" />
              <p className="text-sm text-gray-600">Duration</p>
              <p className="font-semibold">
                {stream.duration ? formatDuration(stream.duration) : 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Video className="h-6 w-6 mx-auto mb-2 text-gray-600" />
              <p className="text-sm text-gray-600">Recording Status</p>
              <p className="font-semibold">
                {isProcessing && 'Processing...'}
                {isReady && 'Ready to View'}
                {isFailed && 'Failed'}
                {!stream.recordingStatus && 'No Recording'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Share2 className="h-6 w-6 mx-auto mb-2 text-gray-600" />
              <p className="text-sm text-gray-600">Share Link</p>
              <button
                onClick={copyStreamUrl}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Copy URL
              </button>
            </div>
          </div>

          {/* Recording Status */}
          <div className="mb-8">
            {isProcessing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                  <h3 className="font-semibold text-blue-900">Recording is Processing</h3>
                </div>
                <p className="text-blue-800 mb-2">
                  Your recording is being processed and will be available shortly.
                </p>
                <p className="text-sm text-blue-700">
                  This usually takes 1-3 minutes depending on the stream duration. 
                  We'll automatically check for updates every 5 seconds.
                </p>
                <div className="mt-3 bg-blue-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-600 h-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {isReady && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">Recording is Ready!</h3>
                </div>
                <p className="text-green-800 mb-4">
                  Your recording has been processed and is now available for viewing.
                </p>
                <Button
                  onClick={() => router.push(`/stream/${streamId}`)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Video className="h-4 w-4 mr-2" />
                  Watch Recording
                </Button>
              </div>
            )}

            {isFailed && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-red-900">Recording Failed</h3>
                </div>
                <p className="text-red-800">
                  Unfortunately, there was an error processing your recording. 
                  Please contact support if this issue persists.
                </p>
              </div>
            )}
          </div>

          {/* Next Steps */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">What's Next?</h3>
            <div className="space-y-3">
              <Link href="/dashboard" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Home className="h-4 w-4 mr-2" />
                  Return to Dashboard
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/dashboard')}
              >
                <Video className="h-4 w-4 mr-2" />
                Start Another Stream
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={copyStreamUrl}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Stream URL to Share
              </Button>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Pro tip:</strong> Even though your live stream has ended, 
              viewers can still visit your stream page to watch the recording once 
              it's ready. Share the link on social media to reach more people!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}