'use client'

import { useState } from 'react'
import { 
  Signal, 
  SignalHigh, 
  SignalLow, 
  SignalZero, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface StreamingHealth {
  hasVideo: boolean
  hasAudio: boolean
  egressConnected: boolean
  isHealthy: boolean
  issues: string[]
}

interface EgressStatus {
  isConnected: boolean
  isReconnecting: boolean
  lastRestartTime: number | null
  restartCount: number
  error: string | null
}

interface StreamingStatusProps {
  streamingHealth: StreamingHealth
  egressStatus: EgressStatus
  onRestartEgress?: () => void
  isLive?: boolean
  compact?: boolean
}

export function StreamingStatus({
  streamingHealth,
  egressStatus,
  onRestartEgress,
  isLive = false,
  compact = false
}: StreamingStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Determine overall status
  const getStatusInfo = () => {
    if (!isLive) {
      return {
        icon: <SignalZero className="h-4 w-4" />,
        color: 'bg-gray-500',
        label: 'Offline',
        description: 'Stream is not live'
      }
    }

    if (egressStatus.isReconnecting) {
      return {
        icon: <RefreshCw className="h-4 w-4 animate-spin" />,
        color: 'bg-yellow-500',
        label: 'Reconnecting',
        description: 'Restarting video output...'
      }
    }

    if (!streamingHealth.isHealthy) {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'bg-red-500',
        label: 'Issues',
        description: streamingHealth.issues.join(', ')
      }
    }

    if (streamingHealth.egressConnected) {
      return {
        icon: <SignalHigh className="h-4 w-4" />,
        color: 'bg-green-500',
        label: 'Live',
        description: 'Video output active'
      }
    }

    return {
      icon: <SignalLow className="h-4 w-4" />,
      color: 'bg-yellow-500',
      label: 'Warning',
      description: 'Video output may be interrupted'
    }
  }

  const statusInfo = getStatusInfo()

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusInfo.color}`} />
        <span className="text-sm text-gray-600">{statusInfo.label}</span>
        {egressStatus.isReconnecting && (
          <RefreshCw className="h-3 w-3 animate-spin text-gray-500" />
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${statusInfo.color} text-white`}>
                {statusInfo.icon}
              </div>
              <div>
                <div className="font-medium">{statusInfo.label}</div>
                <div className="text-sm text-gray-500">{statusInfo.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLive && (
                <Badge variant="outline" className="text-red-600 border-red-200">
                  LIVE
                </Badge>
              )}
              {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-3">
          {/* Track Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${streamingHealth.hasVideo ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Video Track</span>
              {streamingHealth.hasVideo ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-gray-400" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${streamingHealth.hasAudio ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Audio Track</span>
              {streamingHealth.hasAudio ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-gray-400" />
              )}
            </div>
          </div>

          {/* Egress Status */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Video Output Status</span>
              {egressStatus.isConnected ? (
                <Badge variant="outline" className="text-green-600 border-green-200">
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-600 border-red-200">
                  Disconnected
                </Badge>
              )}
            </div>

            {egressStatus.error && (
              <div className="text-sm text-red-600 mb-2">
                Error: {egressStatus.error}
              </div>
            )}

            {egressStatus.restartCount > 0 && (
              <div className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Restarts: {egressStatus.restartCount}
                {egressStatus.lastRestartTime && (
                  <span className="text-gray-500">
                    (last: {new Date(egressStatus.lastRestartTime).toLocaleTimeString()})
                  </span>
                )}
              </div>
            )}

            {onRestartEgress && isLive && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRestartEgress}
                disabled={egressStatus.isReconnecting}
                className="w-full"
              >
                {egressStatus.isReconnecting ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                    Restarting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Restart Video Output
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Issues */}
          {streamingHealth.issues.length > 0 && (
            <div className="border-t pt-3">
              <span className="text-sm font-medium text-red-600">Issues:</span>
              <ul className="mt-1 space-y-1">
                {streamingHealth.issues.map((issue, index) => (
                  <li key={index} className="text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}