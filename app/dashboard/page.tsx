'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Copy, Video, Users, Clock } from 'lucide-react'

interface Stream {
  id: string
  title: string
  description: string | null
  status: string
  streamType: 'RTMP' | 'BROWSER' | 'LIVEKIT'
  muxPlaybackId: string | null
  muxStreamKey: string | null
  liveKitRoomName: string | null
  maxHosts: number | null
  viewerCount: number
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  recordingUrl?: string | null
  recordingStatus?: string
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [streams, setStreams] = useState<Stream[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [streamType, setStreamType] = useState<'RTMP' | 'BROWSER' | 'LIVEKIT'>('LIVEKIT')
  const [maxHosts, setMaxHosts] = useState(1)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    fetchStreams()
  }, [])

  const fetchStreams = async () => {
    try {
      const response = await fetch('/api/streams')
      if (response.ok) {
        const data = await response.json()
        const userStreams = data.filter((stream: any) => stream.user.id === session?.user?.id)
        setStreams(userStreams)
      }
    } catch (error) {
      console.error('Error fetching streams:', error)
    }
  }

  const createStream = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      const response = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, streamType, maxHosts }),
      })

      if (response.ok) {
        const stream = await response.json()
        toast({
          title: 'Success',
          description: 'Stream created successfully',
        })
        setShowCreateForm(false)
        setTitle('')
        setDescription('')
        setStreamType('RTMP')
        setMaxHosts(4)
        fetchStreams()
        
        // Redirect based on stream type
        if (streamType === 'BROWSER') {
          router.push(`/stream/${stream.id}/broadcast`)
        } else if (streamType === 'LIVEKIT') {
          router.push(`/stream/${stream.id}/studio`)
        }
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create stream',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    })
  }

  const startStream = async (streamId: string) => {
    try {
      const response = await fetch(`/api/streams/${streamId}/start`, {
        method: 'POST',
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Stream started',
        })
        fetchStreams()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start stream',
        variant: 'destructive',
      })
    }
  }

  const endStream = async (streamId: string) => {
    try {
      const response = await fetch(`/api/streams/${streamId}/end`, {
        method: 'POST',
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Stream ended',
        })
        fetchStreams()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to end stream',
        variant: 'destructive',
      })
    }
  }

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Creator Dashboard</h1>
          <p className="text-gray-600">Manage your streams</p>
        </div>

        {!showCreateForm ? (
          <Button onClick={() => setShowCreateForm(true)} className="mb-8">
            Create New Stream
          </Button>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Create New Stream</h2>
            <form onSubmit={createStream} className="space-y-4">
              <div>
                <Label htmlFor="title">Stream Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My awesome stream"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this stream about?"
                />
              </div>
              
              <div>
                <Label>How do you want to stream?</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStreamType('LIVEKIT')
                      setMaxHosts(1)
                    }}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      streamType === 'LIVEKIT' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Video className="w-8 h-8 mx-auto mb-2" />
                    <div className="font-medium">Studio Stream</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Stream solo or with co-hosts
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setStreamType('RTMP')}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      streamType === 'RTMP' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Video className="w-8 h-8 mx-auto mb-2" />
                    <div className="font-medium">Stream with OBS</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Professional software
                    </div>
                  </button>
                </div>
              </div>
              
              {streamType === 'LIVEKIT' && (
                <div>
                  <Label htmlFor="maxHosts">Maximum number of hosts</Label>
                  <Input
                    id="maxHosts"
                    type="number"
                    min="1"
                    max="10"
                    value={maxHosts}
                    onChange={(e) => setMaxHosts(parseInt(e.target.value))}
                    placeholder="1"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    How many people can join as hosts (including you). Set to 1 for solo streaming.
                  </p>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Stream'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false)
                    setTitle('')
                    setDescription('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {streams.map((stream) => (
            <div key={stream.id} className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{stream.title}</h3>
                {stream.description && (
                  <p className="text-gray-600 text-sm">{stream.description}</p>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Video className="w-4 h-4 mr-2" />
                  Status: <span className={`ml-1 font-medium ${
                    stream.status === 'LIVE' ? 'text-green-600' : 
                    stream.status === 'ENDED' ? 'text-gray-600' : 'text-yellow-600'
                  }`}>{stream.status}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  Type: <span className="ml-1 font-medium">
                    {stream.streamType === 'BROWSER' ? 'Solo Browser' : 
                     stream.streamType === 'LIVEKIT' ? (stream.maxHosts === 1 ? 'Solo Studio' : 'Collaborative Studio') : 'RTMP/OBS'}
                  </span>
                </div>
                {stream.streamType === 'LIVEKIT' && stream.maxHosts && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    Max Hosts: {stream.maxHosts}
                  </div>
                )}
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="w-4 h-4 mr-2" />
                  Viewers: {stream.viewerCount}
                </div>
                {stream.startedAt && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2" />
                    Started: {new Date(stream.startedAt).toLocaleString()}
                  </div>
                )}
              </div>

              {stream.status === 'CREATED' && stream.streamType === 'RTMP' && stream.muxStreamKey && (
                <div className="space-y-2 mb-4">
                  <div>
                    <Label className="text-xs">RTMP URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value="rtmps://global-live.mux.com:443/app"
                        className="text-xs"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard('rtmps://global-live.mux.com:443/app')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Stream Key</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        type="password"
                        value={stream.muxStreamKey}
                        className="text-xs"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(stream.muxStreamKey!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {stream.status === 'CREATED' && (stream.streamType === 'BROWSER' || stream.streamType === 'LIVEKIT') && (
                  <Button 
                    onClick={() => router.push(`/stream/${stream.id}/studio`)} 
                    size="sm"
                  >
                    Enter Studio
                  </Button>
                )}
                {stream.status === 'CREATED' && stream.streamType === 'RTMP' && (
                  <Button onClick={() => startStream(stream.id)} size="sm">
                    Start Stream
                  </Button>
                )}
                {stream.status === 'LIVE' && (
                  <Button onClick={() => endStream(stream.id)} size="sm" variant="destructive">
                    End Stream
                  </Button>
                )}
                <Button
                  onClick={() => router.push(`/stream/${stream.id}`)}
                  size="sm"
                  variant="outline"
                >
                  View Stream
                </Button>
              </div>
            </div>
          ))}
        </div>

        {streams.length === 0 && !showCreateForm && (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">You haven't created any streams yet.</p>
            <Button onClick={() => setShowCreateForm(true)}>
              Create Your First Stream
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}