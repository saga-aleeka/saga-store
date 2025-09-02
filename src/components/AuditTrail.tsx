import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  Shuffle,
  Users,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { PlasmaContainer } from './PlasmaContainerList';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: {
    description?: string;
    oldValues?: any;
    newValues?: any;
    metadata?: any;
    notes?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
}

interface SampleMovement {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  sampleId: string;
  actionType: 'check-in' | 'check-out' | 'move' | 'update';
  fromContainer?: string;
  fromPosition?: string;
  toContainer?: string;
  toPosition?: string;
  notes?: string;
  success: boolean;
}

interface AuditTrailProps {
  currentUser: string;
}

interface PlateMapState {
  positions: { [key: string]: { sampleId: string; status: 'before' | 'after' | 'new' | 'removed' } };
  rows: number;
  cols: number;
}

function getDescription(details: any): string {
  if (!details) return '';
  if (typeof details === 'string') return details;
  if (Array.isArray(details)) return JSON.stringify(details);
  const desc = details.description;
  if (typeof desc === 'string') return desc;
  if (Array.isArray(desc)) return JSON.stringify(desc);
  if (desc && typeof desc === 'object') {
    return typeof desc.description === 'string'
      ? desc.description
      : JSON.stringify(desc);
  }
  return String(desc ?? '');
}

// Sample movement tracking with enhanced plate maps
export function createAuditLog(
  actionType: string,
  resourceType: string,
  resourceId: string,
  details: any,
  userInitials: string,
  options: {
    oldValues?: any;
    newValues?: any;
    metadata?: any;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    success?: boolean;
  } = {}
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const existingLogs = JSON.parse(localStorage.getItem('saga-audit-logs') || '[]');
      const newLog: AuditLogEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: userInitials,
        userName: userInitials,
        userRole: 'Lab User',
        action: actionType,
        entityType: resourceType,
        entityId: resourceId,
        details: {
          description: getDescription(details),
          oldValues: options.oldValues,
          newValues: options.newValues,
          metadata: options.metadata
        },
        severity: options.severity || 'low',
        success: options.success !== false,
      };
      
      const updatedLogs = [newLog, ...existingLogs].slice(0, 1000); // Keep last 1000 entries
      localStorage.setItem('saga-audit-logs', JSON.stringify(updatedLogs));
      resolve();
    } catch (error) {
      console.error('Failed to store audit log locally:', error);
      resolve();
    }
  });
}

export function AuditTrail({ currentUser }: AuditTrailProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [successFilter, setSuccessFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedMovement, setSelectedMovement] = useState<SampleMovement | null>(null);
  const [beforePlateMap, setBeforePlateMap] = useState<PlateMapState | null>(null);
  const [afterPlateMap, setAfterPlateMap] = useState<PlateMapState | null>(null);
  const [activeTab, setActiveTab] = useState<'audit' | 'movements'>('audit');

  // Load audit logs from localStorage
  useEffect(() => {
    const loadLogs = () => {
      try {
        const savedLogs = localStorage.getItem('saga-audit-logs');
        if (savedLogs) {
          setLogs(JSON.parse(savedLogs));
        }
      } catch (error) {
        console.error('Error loading audit logs:', error);
      }
    };

    loadLogs();
    
    // Refresh every 5 seconds to catch new logs
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Enhanced sample movements from all sources
  const sampleMovements = useMemo(() => {
    const movements: SampleMovement[] = [];
    
    // Extract from audit logs
    logs.forEach(log => {
      if (log.action.includes('sample') || log.action.includes('scan') || log.action.includes('check')) {
        const movement: SampleMovement = {
          id: log.id,
          timestamp: log.timestamp,
          userId: log.userId,
          userName: log.userName,
          sampleId: log.details.metadata?.sampleId || log.entityId,
          actionType: log.action.includes('check-out') ? 'check-out' : 
                     log.action.includes('move') ? 'move' : 
                     log.action.includes('update') ? 'update' : 'check-in',
          fromContainer: log.details.metadata?.fromContainer,
          fromPosition: log.details.metadata?.fromPosition,
          toContainer: log.details.metadata?.toContainer || log.details.metadata?.containerId,
          toPosition: log.details.metadata?.toPosition || log.details.metadata?.position,
          notes: getDescription(log.details),
          success: log.success
        };
        movements.push(movement);
      }
    });

    // Also check sample history from containers
    try {
      const containers = JSON.parse(localStorage.getItem('saga-containers') || '[]') as PlasmaContainer[];
      containers.forEach(container => {
        const samplesKey = `samples-${container.id}`;
        const savedSamples = localStorage.getItem(samplesKey);
        
        if (savedSamples) {
          const samplesData = JSON.parse(savedSamples);
          
          // Handle both object and array formats
          const samples = Array.isArray(samplesData) ? samplesData : 
            Object.entries(samplesData).map(([position, data]: [string, any]) => ({
              position,
              sampleId: data.id || data.sampleId,
              history: data.history || []
            }));

          samples.forEach((sample: any) => {
            if (sample.history && Array.isArray(sample.history)) {
              sample.history.forEach((historyEntry: any) => {
                const movement: SampleMovement = {
                  id: `${sample.sampleId}-${historyEntry.timestamp}`,
                  timestamp: historyEntry.timestamp,
                  userId: historyEntry.userInitials || 'Unknown',
                  userName: historyEntry.userInitials || 'Unknown',
                  sampleId: sample.sampleId,
                  actionType: historyEntry.action,
                  toContainer: container.id,
                  toPosition: sample.position,
                  notes: historyEntry.notes,
                  success: true
                };
                
                // Avoid duplicates
                if (!movements.find(m => m.id === movement.id)) {
                  movements.push(movement);
                }
              });
            }
          });
        }
      });
    } catch (error) {
      console.error('Error loading sample movements:', error);
    }

    return movements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return logs.filter(log => {
      const description = getDescription(log.details);
      const matchesSearch = searchLower === '' ||
        log.action.toLowerCase().includes(searchLower) ||
        log.entityId.toLowerCase().includes(searchLower) ||
        log.userName.toLowerCase().includes(searchLower) ||
        description.toLowerCase().includes(searchLower);

      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
      const matchesUser = userFilter === 'all' || log.userId === userFilter;
      const matchesSuccess = successFilter === 'all' || 
        (successFilter === 'success' && log.success) ||
        (successFilter === 'failure' && !log.success);

      let matchesDate = true;
      if (dateFilter !== 'all') {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        
        switch (dateFilter) {
          case 'today':
            matchesDate = logDate.toDateString() === now.toDateString();
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = logDate >= weekAgo;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchesDate = logDate >= monthAgo;
            break;
        }
      }

      return matchesSearch && matchesAction && matchesSeverity && matchesUser && matchesSuccess && matchesDate;
    });
  }, [logs, searchQuery, actionFilter, severityFilter, userFilter, successFilter, dateFilter]);

  // Filter movements
  const filteredMovements = useMemo(() => {
    return sampleMovements.filter(movement => {
      const matchesSearch = searchQuery === '' ||
        movement.sampleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movement.actionType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movement.toContainer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movement.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [sampleMovements, searchQuery]);

  // Get unique values for filters
  const uniqueActions = [...new Set(logs.map(log => log.action))];
  const uniqueUsers = [...new Set(logs.map(log => log.userId))];

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

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('all');
    setSeverityFilter('all');
    setUserFilter('all');
    setSuccessFilter('all');
    setDateFilter('all');
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Severity', 'Success', 'Description'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.userName,
        log.action,
        log.entityType,
        log.entityId,
        log.severity,
        log.success,
        `"${getDescription(log.details).replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saga-audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <CardTitle>System Audit Trail</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {logs.length} Total Entries
              </Badge>
              <Button variant="outline" size="sm" onClick={exportLogs}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'audit' | 'movements')}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                System Audit ({filteredLogs.length})
              </TabsTrigger>
              <TabsTrigger value="movements" className="flex items-center gap-2">
                <Shuffle className="w-4 h-4" />
                Sample Movements ({filteredMovements.length})
              </TabsTrigger>
            </TabsList>

            {/* Search and Filter Controls */}
            <div className="mt-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search logs, actions, users, or entities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={clearFilters}>
                  <Filter className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {uniqueActions.map(action => (
                      <SelectItem key={action} value={action}>{action}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueUsers.map(user => (
                      <SelectItem key={user} value={user}>{user}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={successFilter} onValueChange={setSuccessFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failure">Failure</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="audit" className="mt-6">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="mb-2">No audit entries found</h3>
                  <p className="text-sm text-muted-foreground">
                    {logs.length === 0 
                      ? "No system activities have been logged yet"
                      : "Try adjusting your search or filter criteria"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">
                            {formatTimestamp(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium">{log.userName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Layers className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{log.entityType}</span>
                              </div>
                              <div className="font-mono text-xs">{log.entityId}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getSeverityColor(log.severity)}>
                              {getSeverityIcon(log.severity)}
                              <span className="ml-1">{log.severity}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.success ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="text-sm">
                              {getDescription(log.details)}
                              {log.details.metadata && (
                                <div className="text-xs text-muted-foreground mt-1 font-mono">
                                  {JSON.stringify(log.details.metadata, null, 1)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="movements" className="mt-6">
              {filteredMovements.length === 0 ? (
                <div className="text-center py-12">
                  <Shuffle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="mb-2">No sample movements found</h3>
                  <p className="text-sm text-muted-foreground">
                    {sampleMovements.length === 0 
                      ? "No sample movements have been tracked yet"
                      : "Try adjusting your search criteria"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Sample ID</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Container</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell className="font-mono text-xs">
                            {formatTimestamp(movement.timestamp)}
                          </TableCell>
                          <TableCell className="font-mono">
                            {movement.sampleId}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                movement.actionType === 'check-in' ? 'bg-green-50 text-green-700 border-green-200' :
                                movement.actionType === 'check-out' ? 'bg-red-50 text-red-700 border-red-200' :
                                movement.actionType === 'move' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }
                            >
                              {movement.actionType}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {movement.toContainer || movement.fromContainer || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {movement.toPosition || movement.fromPosition || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="w-3 h-3 text-muted-foreground" />
                              {movement.userName}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md text-sm">
                            {movement.notes || '-'}
                          </TableCell>
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