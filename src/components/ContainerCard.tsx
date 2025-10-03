import { safeReplace, safeTrim } from '../utils/safeString';
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Thermometer, MoreVertical, Edit, Trash2, Archive, ArchiveRestore, GraduationCap, Users, Eye, Edit3, Scan, Wifi, WifiOff, Lock } from 'lucide-react';

interface ContainerCardProps {
  container: any;
  onSelect: (container: any) => void;
  onEdit?: (container: any) => void;
  onDelete?: (container: any) => void;
  onArchive?: (container: any) => void;
  onRestore?: (container: any) => void;
  onToggleTraining?: (container: any) => void;
  liveOccupiedSlots: number;
  userActivities?: any[];
  lockedBy?: { userId: string; userName: string };
  isOnline?: boolean;
  broadcastUserActivity?: (containerId: string, action: string) => void;
  broadcastSampleUpdate?: (containerId: string, samples: any) => void;
  userId?: string;
  userName?: string;
}

export function ContainerCard(props: ContainerCardProps) {
  const {
    container,
    onSelect,
    onEdit,
    onDelete,
    onArchive,
    onRestore,
    onToggleTraining,
    liveOccupiedSlots,
    userActivities = [],
    lockedBy,
    isOnline = true,
    broadcastUserActivity,
    broadcastSampleUpdate,
    userId,
    userName
  } = props;

  // Calculate active users and lock state
  const containerActivities = (userActivities || []).filter(activity => activity.containerId === container.id);
  const activeUsers = new Set(containerActivities.map(a => a.userId)).size;
  const isLocked = !!lockedBy;

  // Edit click handler
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      if (broadcastUserActivity) {
        broadcastUserActivity(container.id, 'editing');
      }
      onEdit(container);
    }
  };

  // Get user initials
  const getUserInitials = (userName: string) => {
    return safeTrim(userName).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get activity icon
  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'viewing': return <Eye className="h-3 w-3" />;
      case 'editing': return <Edit3 className="h-3 w-3" />;
      case 'scanning': return <Scan className="h-3 w-3" />;
      default: return <Users className="h-3 w-3" />;
    }
  };

  // Calculate effective total slots and utilization
  let effectiveTotalSlots = 0;
  try {
    // Dynamically import getGridDimensions to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getGridDimensions } = require('./PlasmaContainerList');
    effectiveTotalSlots = getGridDimensions(container.containerType, container.sampleType).total;
  } catch {
    effectiveTotalSlots = 0;
  }
  const utilizationPercent = effectiveTotalSlots > 0 ? Math.round((liveOccupiedSlots / effectiveTotalSlots) * 100) : 0;

  // Helper for occupancy color
  const getOccupancyColor = () => {
    if (utilizationPercent === 100) return 'destructive';
    if (utilizationPercent >= 80) return 'secondary';
    return 'default';
  };

  // Helper for occupancy status
  const getOccupancyStatus = () => {
    if (utilizationPercent === 100) return 'Full';
    if (utilizationPercent >= 80) return 'Nearly Full';
    if (utilizationPercent >= 50) return 'Half Full';
    return 'Available';
  };

  // Helper for sample type color (fallback to gray)
  const getSampleTypeColor = (sampleType: string) => {
    switch (sampleType) {
      case 'DP Pools': return 'bg-green-100 text-green-800 border-green-200';
      case 'cfDNA Tubes': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'DTC Tubes': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'MNC Tubes': return 'bg-red-100 text-red-800 border-red-200';
      case 'PA Pool Tubes': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Plasma Tubes': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'BC Tubes': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'IDT Plates': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-md relative ${
        isLocked ? 'ring-2 ring-orange-200 bg-orange-50/50' : ''
      } ${!isOnline ? 'opacity-75' : ''}`}
      onClick={() => onSelect(container)}
    >
      {/* Online/Offline indicator */}
      <div className="absolute top-2 right-2 z-10">
        {isOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
      </div>

      {/* Lock indicator */}
      {isLocked && (
        <div className="absolute top-2 left-2 z-10">
          <div className="flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
            <Lock className="h-3 w-3" />
            <span>{lockedBy?.userName}</span>
          </div>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">{container.name}</CardTitle>
            <CardDescription className="truncate">{container.location}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Active users indicator */}
            {activeUsers > 0 && (
              <div className="flex items-center gap-1">
                {containerActivities.slice(0, 3).map((activity, index) => (
                  <div key={activity.userId} className="relative">
                    <Avatar className="h-6 w-6 border-2 border-background">
                      <AvatarFallback className="text-xs">
                        {getUserInitials(activity.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                      {getActivityIcon(activity.action)}
                    </div>
                  </div>
                ))}
                {activeUsers > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{activeUsers - 3}
                  </div>
                )}
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={handleEditClick} disabled={isLocked}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onToggleTraining && (
                  <DropdownMenuItem 
                    onClick={e => {
                      e.stopPropagation();
                      onToggleTraining(container);
                    }}
                    disabled={isLocked}
                  >
                    <GraduationCap className="h-4 w-4 mr-2" />
                    {container.isTraining ? 'Remove Training' : 'Mark as Training'}
                  </DropdownMenuItem>
                )}
                {onArchive && !container.isArchived && (
                  <DropdownMenuItem 
                    onClick={e => {
                      e.stopPropagation();
                      onArchive(container);
                    }}
                    disabled={isLocked}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                )}
                {onRestore && container.isArchived && (
                  <DropdownMenuItem 
                    onClick={e => {
                      e.stopPropagation();
                      onRestore(container);
                    }}
                  >
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                    Restore
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={e => {
                      e.stopPropagation();
                      onDelete(container);
                    }}
                    className="text-destructive"
                    disabled={isLocked}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-blue-500" />
            <span className="text-sm">{container.temperature}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {safeReplace(container.containerType, '-', ' ')}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Capacity</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {liveOccupiedSlots}/{effectiveTotalSlots}
              </span>
              {liveOccupiedSlots !== container.occupiedSlots && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <Wifi className="h-3 w-3" />
                  Live
                </div>
              )}
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                utilizationPercent === 100 
                  ? 'bg-red-500' 
                  : utilizationPercent >= 80 
                  ? 'bg-yellow-500' 
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <Badge variant={utilizationPercent === 100 ? 'destructive' : utilizationPercent >= 80 ? 'secondary' : 'default'} className="text-xs">
              {utilizationPercent === 100 ? 'Full' : utilizationPercent >= 80 ? 'Nearly Full' : utilizationPercent >= 50 ? 'Half Full' : 'Available'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {utilizationPercent}% full
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={`text-xs ${getSampleTypeColor(container.sampleType)}`}>
            {container.sampleType}
          </Badge>
          {container.isTraining && (
            <Badge className="text-xs bg-training text-training-foreground">
              <GraduationCap className="w-3 h-3 mr-1" />
              Training
            </Badge>
          )}
          {container.isArchived && (
            <Badge className="text-xs bg-archive text-archive-foreground">
              <Archive className="w-3 h-3 mr-1" />
              Archived
            </Badge>
          )}
        </div>
        {(activeUsers > 0 || isLocked) && (
          <div className="pt-2 border-t">
            {isLocked ? (
              <div className="text-xs text-orange-600 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Being edited by {lockedBy?.userName}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {activeUsers} active {activeUsers === 1 ? 'user' : 'users'}
              </div>
            )}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          Last updated: {container.lastUpdated}
        </div>
      </CardContent>
    </Card>
  );
}