import React, { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Card, CardContent } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Users, Eye, Edit3, Scan, Clock, Wifi, WifiOff } from 'lucide-react';
import { UserActivity } from './RealtimeSync';

interface CollaborationIndicatorsProps {
  userActivities: UserActivity[];
  currentContainerId?: string;
  lockedBy?: { userId: string; userName: string };
  isOnline?: boolean;
  className?: string;
}

export function CollaborationIndicators({ 
  userActivities, 
  currentContainerId,
  lockedBy,
  isOnline = true,
  className = ''
}: CollaborationIndicatorsProps) {
  const [timeNow, setTimeNow] = useState(Date.now());

  // Update time every 10 seconds for relative time display
  useEffect(() => {
    const interval = setInterval(() => setTimeNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Filter activities for current container or show all recent activities
  const relevantActivities = currentContainerId 
    ? userActivities.filter(activity => activity.containerId === currentContainerId)
    : userActivities.slice(0, 5); // Show last 5 activities

  const getActivityIcon = (action: UserActivity['action']) => {
    switch (action) {
      case 'viewing': return <Eye className="h-3 w-3" />;
      case 'editing': return <Edit3 className="h-3 w-3" />;
      case 'scanning': return <Scan className="h-3 w-3" />;
      default: return <Users className="h-3 w-3" />;
    }
  };

  const getActivityColor = (action: UserActivity['action']) => {
    switch (action) {
      case 'viewing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'editing': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'scanning': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((timeNow - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getUserInitials = (userName: string) => {
    return userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (relevantActivities.length === 0 && !lockedBy) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span>No active collaborators</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-500" />
            <span>Offline mode</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
            <Wifi className="h-3 w-3 mr-1" />
            Live
          </Badge>
        ) : (
          <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">
            <WifiOff className="h-3 w-3 mr-1" />
            Offline
          </Badge>
        )}
      </div>

      {/* Container Lock Indicator */}
      {lockedBy && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-800">
                <strong>{lockedBy.userName}</strong> is editing this container
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Users */}
      {relevantActivities.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{currentContainerId ? 'Active on this container' : 'Recent activity'}</span>
          </div>
          
          <div className="space-y-1">
            {relevantActivities.map((activity) => (
              <TooltipProvider key={`${activity.userId}-${activity.timestamp}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {getUserInitials(activity.userName)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {activity.userName}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getActivityColor(activity.action)}`}
                          >
                            {getActivityIcon(activity.action)}
                            {activity.action}
                          </Badge>
                        </div>
                        {!currentContainerId && (
                          <div className="text-xs text-muted-foreground truncate">
                            {activity.containerId}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(activity.timestamp)}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div><strong>{activity.userName}</strong></div>
                      <div>{activity.action} {activity.containerId}</div>
                      <div>{new Date(activity.timestamp).toLocaleString()}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Floating collaboration panel
export function CollaborationPanel({ 
  userActivities, 
  isOnline,
  className = '' 
}: {
  userActivities: UserActivity[];
  isOnline?: boolean;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeUsers = new Set(userActivities.map(a => a.userId)).size;

  if (activeUsers === 0 && isOnline) return null;

  return (
    <div className={`fixed bottom-4 left-4 z-50 ${className}`}>
      <Card className="shadow-lg">
        <CardContent className="p-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 p-3 w-full text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">
                {activeUsers} {activeUsers === 1 ? 'user' : 'users'} active
              </span>
            </div>
          </button>
          
          {isExpanded && (
            <div className="border-t p-3 max-h-64 overflow-y-auto">
              <CollaborationIndicators 
                userActivities={userActivities}
                isOnline={isOnline}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}