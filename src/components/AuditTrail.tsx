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
  fromContainerId?: string;
  fromContainerName?: string;
  fromPosition?: string;
  toContainerId?: string;
  toContainerName?: string;
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
      // Always pull userId and userName from the badge/tag at the top right (saga-user-info or saga-user-initials)
      let userId = userInitials;
      let userName = userInitials;
      try {
        const userInfo = JSON.parse(localStorage.getItem('saga-user-info') || 'null');
        if (userInfo && userInfo.id) userId = userInfo.id;
        if (userInfo && userInfo.name) userName = userInfo.name;
      } catch {}
      const existingLogs = JSON.parse(localStorage.getItem('saga-audit-logs') || '[]');
      const newLog: AuditLogEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId,
        userName,
        userRole: 'Lab User',
        action: actionType,
        entityType: resourceType,
        entityId: resourceId,
        details: { 
          description: typeof details === 'string' ? details : details.description,
          oldValues: options.oldValues,
          newValues: options.newValues,
          metadata: options.metadata
        },
  // severity removed
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
  // Pagination state
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
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
        // Ensure fallback to empty array if parsing fails or result is not an array
        let parsedLogs = [];
        if (savedLogs) {
          parsedLogs = JSON.parse(savedLogs);
          if (!Array.isArray(parsedLogs)) parsedLogs = [];
        }
        setLogs(parsedLogs);
      } catch (error) {
        console.error('Error loading audit logs:', error);
        setLogs([]); // fallback on error
      }
    };

    loadLogs();

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
          fromContainerId: log.details.metadata?.fromContainerId,
          fromContainerName: log.details.metadata?.fromContainerName,
          fromPosition: log.details.metadata?.fromPosition,
          toContainerId: log.details.metadata?.toContainerId || log.details.metadata?.containerId,
          toContainerName: log.details.metadata?.toContainerName,
          toPosition: log.details.metadata?.toPosition || log.details.metadata?.position,
          notes: log.details.description,
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
                  userId: historyEntry.user || 'Unknown',
                  userName: historyEntry.user || 'Unknown',
                  sampleId: sample.sampleId,
                  actionType: historyEntry.action,
                  toContainerId: container.id,
                  toContainerName: container.name,
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
    return Array.isArray(movements) ? movements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
  }, [logs]);

  // Filter sample movements for the movements tab
  const filteredMovements = useMemo(() => {
    return sampleMovements.filter(movement => {
      const matchesSearch = searchQuery === '' ||
        (movement.sampleId && movement.sampleId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (movement.userName && movement.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (movement.notes && movement.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesUser = userFilter === 'all' || movement.userId === userFilter;
      const matchesSuccess = successFilter === 'all' ||
        (successFilter === 'success' && movement.success) ||
        (successFilter === 'failure' && !movement.success);

      let matchesDate = true;
      if (dateFilter !== 'all') {
        const movementDate = new Date(movement.timestamp);
        const now = new Date();
        switch (dateFilter) {
          case 'today':
            matchesDate = movementDate.toDateString() === now.toDateString();
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = movementDate >= weekAgo;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchesDate = movementDate >= monthAgo;
            break;
        }
      }

      return matchesSearch && matchesUser && matchesSuccess && matchesDate;
    });
  }, [sampleMovements, searchQuery, userFilter, successFilter, dateFilter]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return Array.isArray(logs)
          ? logs.filter(log => {
              const matchesSearch = searchQuery === '' ||
                log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.entityId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.details.description?.toLowerCase().includes(searchQuery.toLowerCase());

              const matchesAction = actionFilter === 'all' || log.action === actionFilter;
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

              return matchesSearch && matchesAction && matchesUser && matchesSuccess && matchesDate;
            })
      : [];
  }, [logs, searchQuery, actionFilter, severityFilter, userFilter, successFilter, dateFilter]);


  // Get unique values for filters
  const uniqueActions = Array.isArray(logs) ? [...new Set(logs.map(log => log.action))] : [];
  const uniqueUsers = Array.isArray(logs) ? [...new Set(logs.map(log => log.userId))] : [];

  // Filter out empty/undefined values for Selects
  const filteredUniqueActions = uniqueActions.filter(a => a && a !== '');
  const filteredUniqueUsers = uniqueUsers.filter(u => u && u !== '');

  // Removed severity related functions

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

  // Fix exportLogs: remove severity, use filteredLogs and filteredMovements
  const exportLogs = () => {
    if (activeTab === 'movements') {
      const containers = JSON.parse(localStorage.getItem('saga-containers') || '[]');
      let csvSections: string[] = [];
      const movementsByContainer: { [containerId: string]: SampleMovement[] } = {};
      filteredMovements.forEach(movement => {
        const cid = movement.toContainerId || movement.fromContainerId || 'Unknown';
        if (!movementsByContainer[cid]) movementsByContainer[cid] = [];
        movementsByContainer[cid].push(movement);
      });
      Object.entries(movementsByContainer).forEach(([containerId, movements]) => {
        const container = containers.find((c: any) => c.id === containerId);
        const containerName = container?.name || containerId;
        let columns: string[] = [];
        let rows: string[] = [];
        if (container?.containerType === '5x5-box') {
          columns = ['1','2','3','4','5'];
          rows = ['A','B','C','D','E'];
        } else if (container?.containerType === '9x9-box') {
          columns = ['1','2','3','4','5','6','7','8','9'];
          rows = ['A','B','C','D','E','F','G','H','I'];
        } else {
          const allPositions = movements.map(m => m.toPosition).filter((p): p is string => typeof p === 'string' && p.length > 1);
          columns = Array.from(new Set(allPositions.map((p: string) => p[0]))).sort();
          rows = Array.from(new Set(allPositions.map((p: string) => p.slice(1)))).sort((a,b) => Number(a)-Number(b));
        }
        csvSections.push(`${containerName}`);
        csvSections.push(["", ...columns].join(","));
        rows.forEach(rowLetter => {
          const row = [rowLetter];
          columns.forEach(colNum => {
            const pos = `${rowLetter}${colNum}`;
            const sample = movements.find((m: any) => m.toPosition === pos);
            row.push(sample ? sample.sampleId : "");
          });
          csvSections.push(row.join(","));
        });
        csvSections.push("");
      });
      const csvContent = csvSections.join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saga-sample-movements-grid-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const csvContent = [
        ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Success', 'Description'].join(','),
        ...filteredLogs.map(log => [
          log.timestamp,
          log.userName,
          log.action,
          log.entityType,
          log.entityId,
          log.success,
          `"${log.details.description?.replace(/"/g, '""') || ''}"`
        ].join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saga-audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  // Pagination for logs and movements
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  const paginatedMovements = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMovements.slice(start, start + pageSize);
  }, [filteredMovements, page, pageSize]);

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
          <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'audit' | 'movements')}>
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
              {/* Page size selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows per page:</span>
                <Select value={String(pageSize)} onValueChange={(v: string) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search logs, actions, users, or entities..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
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
                    {filteredUniqueActions.map((action: string) => (
                      <SelectItem key={action} value={action}>{action}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>



                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {filteredUniqueUsers.map((user: string) => (
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
                        {/* Severity removed */}
                        <TableHead>Status</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.map((log: AuditLogEntry) => (
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
                            {log.success ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="text-sm">
                              {typeof log.details?.description === 'string'
                                ? log.details.description
                                : log.details?.description
                                  ? JSON.stringify(log.details.description)
                                  : ''}
                              {log.details?.metadata && (
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
                  {/* Pagination controls for audit tab */}
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1}>
                      Prev
                    </Button>
                    <span className="text-xs">Page {page} of {Math.max(1, Math.ceil(filteredLogs.length / pageSize))}</span>
                    <Button size="sm" variant="outline" onClick={() => setPage((p: number) => p + 1)} disabled={page >= Math.ceil(filteredLogs.length / pageSize)}>
                      Next
                    </Button>
                  </div>
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
                <>
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
                        {paginatedMovements.map((movement: SampleMovement) => (
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
                              {/* Show container name or ID, but strip trailing _numbers if present */}
                              {(() => {
                                const raw = movement.toContainerName || movement.fromContainerName || movement.toContainerId || '-';
                                if (typeof raw !== 'string') return raw;
                                // If the string ends with _<digits>, remove only the trailing digits, keep the rest (e.g., MNC_BOX_001_1759187760335 => MNC_BOX_001)
                                // If no trailing _digits, show as-is
                                const match = raw.match(/^(.*?)(_\d+)?$/);
                                if (match) {
                                  // If there are at least two underscores, and the last part is all digits, remove it
                                  const parts = raw.split('_');
                                  if (parts.length > 2 && /^\d+$/.test(parts[parts.length - 1])) {
                                    return parts.slice(0, -1).join('_');
                                  }
                                }
                                return raw;
                              })()}
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
                  {/* Pagination controls for movements tab */}
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1}>
                      Prev
                    </Button>
                    <span className="text-xs">Page {page} of {Math.max(1, Math.ceil(filteredMovements.length / pageSize))}</span>
                    <Button size="sm" variant="outline" onClick={() => setPage((p: number) => p + 1)} disabled={page >= Math.ceil(filteredMovements.length / pageSize)}>
                      Next
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}