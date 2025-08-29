import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  Lock,
  Unlock,
  Merge,
  RotateCcw,
  Shield
} from 'lucide-react';

export interface ConflictEvent {
  id: string;
  timestamp: string;
  type: 'version_conflict' | 'simultaneous_edit' | 'data_corruption' | 'lock_timeout';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'resolved' | 'escalated';
  description: string;
  affectedResource: {
    type: 'container' | 'sample' | 'audit_log';
    id: string;
    name?: string;
  };
  involvedUsers: string[];
  conflictDetails: {
    localVersion?: any;
    remoteVersion?: any;
    proposedResolution?: any;
  };
  resolutionStrategy?: 'auto_merge' | 'manual_review' | 'prefer_local' | 'prefer_remote';
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ConflictLock {
  id: string;
  resourceType: 'container' | 'sample';
  resourceId: string;
  userId: string;
  userName: string;
  lockedAt: string;
  expiresAt: string;
  reason: string;
}

interface ConflictResolutionProps {
  currentUser: string;
  onConflictResolved: (conflict: ConflictEvent) => void;
  broadcastConflict: (conflict: ConflictEvent) => void;
  broadcastLock: (lock: ConflictLock) => void;
}

export function ConflictResolution({ 
  currentUser, 
  onConflictResolved, 
  broadcastConflict, 
  broadcastLock 
}: ConflictResolutionProps) {
  const [conflicts, setConflicts] = useState<ConflictEvent[]>([]);
  const [activeLocks, setActiveLocks] = useState<ConflictLock[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<ConflictEvent | null>(null);

  // Load conflicts and locks from localStorage
  useEffect(() => {
    const loadConflicts = () => {
      try {
        const saved = localStorage.getItem('saga-conflicts');
        if (saved) {
          setConflicts(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error loading conflicts:', error);
      }
    };

    const loadLocks = () => {
      try {
        const saved = localStorage.getItem('saga-locks');
        if (saved) {
          const locks = JSON.parse(saved);
          // Filter out expired locks
          const now = new Date();
          const activeLocks = locks.filter((lock: ConflictLock) => 
            new Date(lock.expiresAt) > now
          );
          setActiveLocks(activeLocks);
          
          // Save back filtered locks
          localStorage.setItem('saga-locks', JSON.stringify(activeLocks));
        }
      } catch (error) {
        console.error('Error loading locks:', error);
      }
    };

    loadConflicts();
    loadLocks();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadConflicts();
      loadLocks();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Listen for conflict events from other instances
  useEffect(() => {
    const handleConflict = (event: CustomEvent) => {
      const conflict = event.detail;
      setConflicts(prev => {
        const existing = prev.find(c => c.id === conflict.id);
        if (existing) {
          return prev.map(c => c.id === conflict.id ? conflict : c);
        } else {
          return [conflict, ...prev];
        }
      });
    };

    const handleLock = (event: CustomEvent) => {
      const lock = event.detail;
      setActiveLocks(prev => {
        const filtered = prev.filter(l => l.resourceId !== lock.resourceId);
        return [lock, ...filtered];
      });
    };

    window.addEventListener('saga-conflict', handleConflict as EventListener);
    window.addEventListener('saga-lock', handleLock as EventListener);

    return () => {
      window.removeEventListener('saga-conflict', handleConflict as EventListener);
      window.removeEventListener('saga-lock', handleLock as EventListener);
    };
  }, []);

  const createConflict = (
    type: ConflictEvent['type'],
    severity: ConflictEvent['severity'],
    description: string,
    affectedResource: ConflictEvent['affectedResource'],
    involvedUsers: string[],
    conflictDetails: ConflictEvent['conflictDetails']
  ) => {
    const conflict: ConflictEvent = {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      severity,
      status: 'pending',
      description,
      affectedResource,
      involvedUsers,
      conflictDetails
    };

    setConflicts(prev => [conflict, ...prev]);
    
    // Save to localStorage
    try {
      const updated = [conflict, ...conflicts];
      localStorage.setItem('saga-conflicts', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save conflict:', error);
    }

    // Broadcast to other instances
    broadcastConflict(conflict);

    return conflict;
  };

  const resolveConflict = (
    conflictId: string, 
    strategy: ConflictEvent['resolutionStrategy'],
    customResolution?: any
  ) => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    const resolvedConflict: ConflictEvent = {
      ...conflict,
      status: 'resolved',
      resolutionStrategy: strategy,
      resolvedAt: new Date().toISOString(),
      resolvedBy: currentUser,
      conflictDetails: {
        ...conflict.conflictDetails,
        proposedResolution: customResolution || conflict.conflictDetails.proposedResolution
      }
    };

    setConflicts(prev => prev.map(c => c.id === conflictId ? resolvedConflict : c));
    
    // Save to localStorage
    try {
      const updated = conflicts.map(c => c.id === conflictId ? resolvedConflict : c);
      localStorage.setItem('saga-conflicts', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save resolved conflict:', error);
    }

    onConflictResolved(resolvedConflict);
    broadcastConflict(resolvedConflict);
  };

  const createLock = (
    resourceType: ConflictLock['resourceType'],
    resourceId: string,
    reason: string,
    durationMinutes: number = 30
  ) => {
    const lock: ConflictLock = {
      id: `lock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resourceType,
      resourceId,
      userId: currentUser,
      userName: currentUser,
      lockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
      reason
    };

    setActiveLocks(prev => {
      const filtered = prev.filter(l => l.resourceId !== resourceId);
      return [lock, ...filtered];
    });

    // Save to localStorage
    try {
      const updated = activeLocks.filter(l => l.resourceId !== resourceId);
      updated.push(lock);
      localStorage.setItem('saga-locks', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save lock:', error);
    }

    broadcastLock(lock);
    return lock;
  };

  const releaseLock = (lockId: string) => {
    setActiveLocks(prev => prev.filter(l => l.id !== lockId));
    
    // Save to localStorage
    try {
      const updated = activeLocks.filter(l => l.id !== lockId);
      localStorage.setItem('saga-locks', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save locks after release:', error);
    }
  };

  // Demo function to create sample conflicts
  const createDemoConflict = () => {
    const demoConflicts = [
      {
        type: 'version_conflict' as const,
        severity: 'medium' as const,
        description: 'Container PB001 was modified simultaneously by multiple users',
        affectedResource: { type: 'container' as const, id: 'PB001', name: 'Demo Container' },
        involvedUsers: [currentUser, 'OtherUser'],
        conflictDetails: {
          localVersion: { occupiedSlots: 15 },
          remoteVersion: { occupiedSlots: 18 }
        }
      },
      {
        type: 'simultaneous_edit' as const,
        severity: 'high' as const,
        description: 'Sample placement conflict in position A1',
        affectedResource: { type: 'sample' as const, id: 'A1', name: 'Position A1' },
        involvedUsers: [currentUser, 'LabTech1'],
        conflictDetails: {
          localVersion: { sampleId: 'SAMPLE123' },
          remoteVersion: { sampleId: 'SAMPLE456' }
        }
      }
    ];

    const randomConflict = demoConflicts[Math.floor(Math.random() * demoConflicts.length)];
    createConflict(
      randomConflict.type,
      randomConflict.severity,
      randomConflict.description,
      randomConflict.affectedResource,
      randomConflict.involvedUsers,
      randomConflict.conflictDetails
    );
  };

  const createDemoLock = () => {
    const resourceId = `PB${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
    createLock('container', resourceId, 'Manual lock for testing', 5);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'medium': return <Clock className="w-4 h-4 text-yellow-600" />;
      default: return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'escalated': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  const resolvedConflicts = conflicts.filter(c => c.status === 'resolved');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle>Conflict Resolution Center</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {pendingConflicts.length} Pending
              </Badge>
              <Badge variant="outline">
                {activeLocks.length} Active Locks
              </Badge>
              <Button variant="outline" size="sm" onClick={createDemoConflict}>
                Create Demo Conflict
              </Button>
              <Button variant="outline" size="sm" onClick={createDemoLock}>
                Create Demo Lock
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="conflicts" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="conflicts">
                Active Conflicts ({pendingConflicts.length})
              </TabsTrigger>
              <TabsTrigger value="locks">
                Resource Locks ({activeLocks.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                Resolution History ({resolvedConflicts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conflicts" className="space-y-4">
              {pendingConflicts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600 opacity-50" />
                  <h3 className="mb-2">No Active Conflicts</h3>
                  <p className="text-sm text-muted-foreground">
                    System is operating normally without conflicts
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingConflicts.map((conflict) => (
                    <Card key={conflict.id} className="border-l-4 border-l-orange-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {getSeverityIcon(conflict.severity)}
                              <Badge className={getSeverityColor(conflict.severity)}>
                                {conflict.severity}
                              </Badge>
                              <Badge variant="outline">{conflict.type.replace('_', ' ')}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {formatTimestamp(conflict.timestamp)}
                              </span>
                            </div>
                            
                            <h4 className="font-medium">{conflict.description}</h4>
                            
                            <div className="text-sm text-muted-foreground">
                              <div>Affected: {conflict.affectedResource.type} - {conflict.affectedResource.id}</div>
                              <div>Users: {conflict.involvedUsers.join(', ')}</div>
                            </div>

                            {conflict.conflictDetails.localVersion && conflict.conflictDetails.remoteVersion && (
                              <div className="mt-3 p-3 bg-muted rounded-md">
                                <h5 className="text-sm font-medium mb-2">Conflict Details:</h5>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <strong>Local Version:</strong>
                                    <pre className="mt-1 text-xs">{JSON.stringify(conflict.conflictDetails.localVersion, null, 2)}</pre>
                                  </div>
                                  <div>
                                    <strong>Remote Version:</strong>
                                    <pre className="mt-1 text-xs">{JSON.stringify(conflict.conflictDetails.remoteVersion, null, 2)}</pre>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveConflict(conflict.id, 'prefer_local')}
                            >
                              Keep Local
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveConflict(conflict.id, 'prefer_remote')}
                            >
                              Keep Remote
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => resolveConflict(conflict.id, 'auto_merge')}
                            >
                              <Merge className="w-4 h-4 mr-1" />
                              Auto Merge
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="locks" className="space-y-4">
              {activeLocks.length === 0 ? (
                <div className="text-center py-12">
                  <Unlock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="mb-2">No Active Locks</h3>
                  <p className="text-sm text-muted-foreground">
                    No resources are currently locked
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Resource</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Locked By</TableHead>
                        <TableHead>Locked At</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeLocks.map((lock) => (
                        <TableRow key={lock.id}>
                          <TableCell className="font-mono">{lock.resourceId}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{lock.resourceType}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="w-3 h-3" />
                              {lock.userName}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {formatTimestamp(lock.lockedAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {formatTimestamp(lock.expiresAt)}
                          </TableCell>
                          <TableCell className="text-sm">{lock.reason}</TableCell>
                          <TableCell>
                            {lock.userId === currentUser && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => releaseLock(lock.id)}
                              >
                                <Unlock className="w-4 h-4 mr-1" />
                                Release
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {resolvedConflicts.length === 0 ? (
                <div className="text-center py-12">
                  <RotateCcw className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="mb-2">No Resolution History</h3>
                  <p className="text-sm text-muted-foreground">
                    No conflicts have been resolved yet
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Resolution</TableHead>
                        <TableHead>Resolved By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resolvedConflicts.map((conflict) => (
                        <TableRow key={conflict.id}>
                          <TableCell className="font-mono text-xs">
                            {formatTimestamp(conflict.resolvedAt || conflict.timestamp)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{conflict.type.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getSeverityColor(conflict.severity)}>
                              {conflict.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            {conflict.affectedResource.id}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {conflict.resolutionStrategy?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{conflict.resolvedBy}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}