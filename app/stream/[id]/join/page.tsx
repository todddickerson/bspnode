'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Users, Video, AlertCircle } from 'lucide-react'

interface Stream {
  id: string
  title: string
  description: string | null
  status: string
  streamType: string
  maxHosts: number | null
  user: {
    id: string
    name: string
  }
  _count: {
    hosts: number
  }
}

export default function JoinStreamPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const streamId = params.id as string
  const inviteToken = searchParams.get('token')
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [stream, setStream] = useState<Stream | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      const callbackUrl = inviteToken 
        ? `/stream/${streamId}/join?token=${inviteToken}`
        : `/stream/${streamId}/join`
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    } else if (status === 'authenticated') {
      fetchStream()
    }
  }, [status, streamId, inviteToken])

  const fetchStream = async () => {
    try {
      const response = await fetch(`/api/streams/${streamId}`)
      if (response.ok) {
        const data = await response.json()
        
        // Include host count
        const hostsResponse = await fetch(`/api/streams/${streamId}/hosts`)
        if (hostsResponse.ok) {
          const hosts = await hostsResponse.json()
          data._count = { hosts: hosts.length }
        }
        
        setStream(data)
      }
    } catch (error) {
      console.error('Error fetching stream:', error)
    } finally {
      setLoading(false)
    }
  }

  const joinAsHost = async () => {
    if (!session?.user?.id) return
    
    setJoining(true)
    setInviteError(null)
    
    try {
      // If we have an invite token, validate it instead of directly adding to hosts
      if (inviteToken) {
        const response = await fetch('/api/invites/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: inviteToken,
            streamId: streamId,
          }),
        })

        if (response.ok) {
          toast({
            title: 'Success!',
            description: 'You have been added as a host via invite',
          })
          router.push(`/stream/${streamId}/studio`)
        } else {
          const error = await response.json()
          setInviteError(error.message || 'Invalid invite')
          toast({
            title: 'Invite Error',
            description: error.message || 'Failed to join with invite',
            variant: 'destructive',
          })
        }
      } else {
        // Legacy behavior - direct join without invite (should be restricted)
        setInviteError('An invite token is required to join as a host')
        toast({
          title: 'Access Denied',
          description: 'You need a valid invite link to join as a host',
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
      setJoining(false)
    }
  }

  if (loading || status === 'loading') {
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

  if (stream.streamType !== 'LIVEKIT') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Stream Type</h1>
          <p className="text-gray-600">This stream does not support multiple hosts.</p>
        </div>
      </div>
    )
  }

  const hostsRemaining = (stream.maxHosts || 4) - (stream._count?.hosts || 0)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-6">
            <Video className="h-16 w-16 mx-auto mb-4 text-blue-600" />
            <h1 className="text-2xl font-bold mb-2">Join as Co-Host</h1>
            <p className="text-gray-600">You've been invited to co-host a stream</p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h2 className="font-semibold text-lg">{stream.title}</h2>
              {stream.description && (
                <p className="text-gray-600 text-sm mt-1">{stream.description}</p>
              )}
              <div className="mt-3 flex items-center text-sm text-gray-500">
                <Users className="h-4 w-4 mr-1" />
                <span>Hosted by {stream.user.name}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <span className="text-sm text-gray-600">Available host slots:</span>
              <span className="font-medium">
                {hostsRemaining > 0 ? `${hostsRemaining} remaining` : 'Full'}
              </span>
            </div>

            {stream.status === 'LIVE' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Stream is Live!</strong> Join now to participate.
                </p>
              </div>
            )}
          </div>

          {inviteError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-800 mr-2" />
                <p className="text-sm text-red-800">{inviteError}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={joinAsHost}
              disabled={joining || hostsRemaining <= 0 || (!inviteToken)}
              className="w-full"
            >
              {joining ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Joining...</>
              ) : !inviteToken ? (
                'Valid Invite Required'
              ) : hostsRemaining <= 0 ? (
                'Stream is Full'
              ) : (
                'Join as Co-Host'
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push(`/stream/${streamId}`)}
              className="w-full"
            >
              Watch as Viewer Instead
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}