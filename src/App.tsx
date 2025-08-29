import React, { useState, useEffect } from "react";
import { PlasmaContainerList, PlasmaContainer } from "./components/PlasmaContainerList";
import { AdminDashboard } from "./components/AdminDashboard";
import { UserActivity } from "./components/RealtimeSync";
import { CollaborationPanel } from "./components/CollaborationIndicators";
import { AuditTrail } from "./components/AuditTrail";
import { ConflictResolution, ConflictEvent, ConflictLock } from "./components/ConflictResolution";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner@2.0.3";
import {
  User as UserIcon,
  FileText,
  AlertTriangle,
  Settings,
  Database,
  Activity,
  Cloud,
  CloudOff,
  Edit3,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
} from "lucide-react";

const STORAGE_KEY = "saga-containers";
const USER_INITIALS_KEY = "saga-user-initials";

// Simple user interface for tracking
interface SimpleUser {
  initials: string;
  timestamp: string;
}

// Database connection status
interface DatabaseStatus {
  status: "connected" | "connecting" | "error" | "offline";
  message: string;
  serverFunctions: boolean;
  database: boolean;
}

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [containers, setContainers] = useState<PlasmaContainer[]>([]);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [lockedContainers, setLockedContainers] = useState<Map<string, { userId: string; userName: string }>>(new Map());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentUserInitials, setCurrentUserInitials] = useState<string>("");
  const [showInitialsDialog, setShowInitialsDialog] = useState(false);
  const [showSystemDialog, setShowSystemDialog] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictEvent[]>([]);
  const [conflictLocks, setConflictLocks] = useState<ConflictLock[]>([]);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus>({
    status: "offline",
    message: "Using local storage mode",
    serverFunctions: false,
    database: false,
  });
  const [tempInitials, setTempInitials] = useState("");

  // Load initials and containers on mount
  useEffect(() => {
    initializeApp();
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("🌐 Back online - local storage mode");
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("📡 Working offline - changes saved locally");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check URL parameters for admin mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const adminParam = urlParams.get("admin");
    setIsAdminMode(adminParam === "true");
  }, []);

  // Initialize app with immediate UI render
  const initializeApp = async () => {
    // Load user initials immediately (synchronous)
    loadUserInitials();

    // Load containers from localStorage immediately for fast startup
    loadContainersFromStorage();

    // Set database status to offline mode
    setDatabaseStatus({
      status: "offline",
      message: "StackBlitz local storage mode",
      serverFunctions: false,
      database: false,
    });
  };

  // Load user initials from localStorage (synchronous)
  const loadUserInitials = () => {
    try {
      const saved = localStorage.getItem(USER_INITIALS_KEY);
      if (saved) {
        const userData = JSON.parse(saved) as SimpleUser;
        setCurrentUserInitials(userData.initials);
      }
    } catch (error) {
      console.error("Error loading user initials:", error);
    }
  };

  // Save user initials
  const saveUserInitials = (initials: string) => {
    const userData: SimpleUser = {
      initials: initials.toUpperCase(),
      timestamp: new Date().toISOString(),
    };

    setCurrentUserInitials(userData.initials);
    localStorage.setItem(USER_INITIALS_KEY, JSON.stringify(userData));

    toast.success(`Welcome to SAGA Storage System, ${userData.initials}!`);
  };

  // Handle initials input
  const handleInitialsSubmit = () => {
    if (tempInitials.trim().length >= 2) {
      saveUserInitials(tempInitials.trim());
      setShowInitialsDialog(false);
      setTempInitials("");
    } else {
      toast.error("Please enter at least 2 characters for your initials");
    }
  };

  // Change user initials
  const handleChangeInitials = () => {
    setTempInitials(currentUserInitials);
    setShowInitialsDialog(true);
  };

  // Load containers from localStorage immediately (synchronous)
  const loadContainersFromStorage = () => {
    try {
      const savedContainers = localStorage.getItem(STORAGE_KEY);
      if (savedContainers) {
        const parsedContainers = JSON.parse(savedContainers);
        if (Array.isArray(parsedContainers)) {
          setContainers(parsedContainers);
        }
      }
    } catch (error) {
      console.error("Error loading containers from storage:", error);
    }
  };

  // Enhanced container update handler
  const handleContainersChange = async (newContainers: PlasmaContainer[]) => {
    setContainers(newContainers);

    // Always save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newContainers));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
      toast.error("Failed to save changes locally");
    }

    // Broadcast to other users using custom events (for demo purposes)
    if (isOnline) {
      try {
        broadcastContainerUpdate(newContainers);
      } catch (error) {
        console.warn("Failed to broadcast container update:", error);
      }
    }

    // Log container changes to localStorage audit
    if (currentUserInitials) {
      createLocalAuditLog(
        "container_updated",
        "container",
        "bulk_update",
        {
          description: `Container list updated - ${newContainers.length} containers`,
          newValues: { containerCount: newContainers.length },
        },
        currentUserInitials
      );
    }
  };

  // Create local audit log (localStorage fallback)
  const createLocalAuditLog = (
    actionType: string,
    resourceType: string,
    resourceId: string,
    details: any,
    userInitials: string
  ) => {
    try {
      const existingLogs = JSON.parse(localStorage.getItem('saga-audit-logs') || '[]');
      const newLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: userInitials,
        userName: userInitials,
        userRole: 'Lab User',
        action: actionType,
        entityType: resourceType,
        entityId: resourceId,
        details: { description: details },
        severity: 'low',
        success: true
      };
      
      const updatedLogs = [newLog, ...existingLogs].slice(0, 1000); // Keep last 1000 entries
      localStorage.setItem('saga-audit-logs', JSON.stringify(updatedLogs));
    } catch (error) {
      console.error('Failed to store audit log locally:', error);
    }
  };

  // Handle user activity updates
  const handleUserActivity = (activities: UserActivity[]) => {
    setUserActivities(activities);
  };

  // Handle container locking
  const handleContainerLocked = (containerId: string, userId: string, userName: string) => {
    setLockedContainers((prev) => new Map(prev).set(containerId, { userId, userName }));
    toast.info(`🔒 ${userName} is editing container ${containerId}`);
  };

  // Handle container unlocking
  const handleContainerUnlocked = (containerId: string) => {
    setLockedContainers((prev) => {
      const newMap = new Map(prev);
      newMap.delete(containerId);
      return newMap;
    });
  };

  const handleExitAdmin = () => {
    // Remove admin parameter from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("admin");
    window.history.replaceState({}, "", url.toString());
    setIsAdminMode(false);
  };

  // Simple real-time sync simulation using browser events
  const userId = currentUserInitials || 'anonymous';
  const userName = currentUserInitials || 'Anonymous User';

  const broadcastContainerUpdate = (containers: PlasmaContainer[]) => {
    const event = new CustomEvent('saga-container-update', { 
      detail: { containers, userId, userName } 
    });
    window.dispatchEvent(event);
  };

  const broadcastSampleUpdate = (containerId: string, samples: any) => {
    const event = new CustomEvent('saga-sample-update', { 
      detail: { containerId, samples, userId, userName } 
    });
    window.dispatchEvent(event);
  };

  const broadcastUserActivity = (activity: UserActivity) => {
    const event = new CustomEvent('saga-user-activity', { 
      detail: activity 
    });
    window.dispatchEvent(event);
  };

  const lockContainer = (containerId: string) => {
    handleContainerLocked(containerId, userId, userName);
    return Promise.resolve();
  };

  const unlockContainer = (containerId: string) => {
    handleContainerUnlocked(containerId);
    return Promise.resolve();
  };

  const isContainerLocked = (containerId: string) => {
    return lockedContainers.has(containerId);
  };

  // Handle conflicts
  const handleConflictResolved = (conflict: ConflictEvent) => {
    setConflicts((prev) => prev.map((c) => (c.id === conflict.id ? conflict : c)));
    toast.success("Conflict resolved successfully");
  };

  const handleBroadcastConflict = (conflict: ConflictEvent) => {
    const event = new CustomEvent("saga-conflict", { detail: conflict });
    window.dispatchEvent(event);
  };

  const handleBroadcastLock = (lock: ConflictLock) => {
    const event = new CustomEvent("saga-lock", { detail: lock });
    window.dispatchEvent(event);
  };

  // Enhanced collaboration props
  const collaborationProps = {
    userId,
    userName,
    currentUser: currentUserInitials ? { initials: currentUserInitials } : null,
    broadcastSampleUpdate,
    broadcastUserActivity,
    lockContainer,
    unlockContainer,
    isContainerLocked,
    lockedContainers,
    userActivities,
    isOnline,
    databaseStatus: databaseStatus.status,
  };

  // Get database status badge
  const getDatabaseStatusBadge = () => {
    if (!isOnline) {
      return (
        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
          <WifiOff className="h-3 w-3 mr-1" />
          Offline
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
        <Cloud className="h-3 w-3 mr-1" />
        Local Storage
      </Badge>
    );
  };

  // Show initials input if no current user initials
  if (!currentUserInitials) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <UserIcon className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h1>SAGA Storage System</h1>
              <p className="text-muted-foreground">
                Welcome to your clinical lab management platform
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Advanced sample tracking and freezer management for laboratory workflows
              </p>
              <div className="flex items-center justify-center gap-2 mt-3">
                {getDatabaseStatusBadge()}
                <Badge variant="outline" className="text-xs">
                  <Wifi className="h-3 w-3 mr-1" />
                  StackBlitz Demo
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="initials">Enter Your Initials</Label>
                <Input
                  id="initials"
                  placeholder="e.g. JS"
                  value={tempInitials}
                  onChange={(e) => setTempInitials(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleInitialsSubmit();
                    }
                  }}
                  maxLength={4}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will be used to track your sample handling activities
                </p>
              </div>

              <Button
                onClick={handleInitialsSubmit}
                className="w-full"
                disabled={tempInitials.trim().length < 2}
              >
                <UserIcon className="h-4 w-4 mr-2" />
                Start Using SAGA
              </Button>
            </div>
          </CardContent>
        </Card>

        <Toaster position="top-right" />
      </div>
    );
  }

  // Admin dashboard
  if (isAdminMode) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6" />
              <div>
                <h1>SAGA System Administration</h1>
                <p className="text-sm text-muted-foreground">User: {currentUserInitials}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Admin Mode</Badge>
              {getDatabaseStatusBadge()}
              <Button variant="outline" onClick={handleExitAdmin}>
                Exit Admin
              </Button>
              <Button variant="ghost" onClick={handleChangeInitials}>
                <Edit3 className="h-4 w-4 mr-2" />
                Change Initials
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="containers" className="p-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="containers" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Containers
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Audit Trail
            </TabsTrigger>
            <TabsTrigger value="conflicts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Conflicts
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="containers" className="mt-6">
            <AdminDashboard
              onExitAdmin={handleExitAdmin}
              containers={containers}
              onContainersChange={handleContainersChange}
              {...collaborationProps}
            />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <AuditTrail currentUser={currentUserInitials} />
          </TabsContent>

          <TabsContent value="conflicts" className="mt-6">
            <ConflictResolution
              currentUser={currentUserInitials}
              onConflictResolved={handleConflictResolved}
              broadcastConflict={handleBroadcastConflict}
              broadcastLock={handleBroadcastLock}
            />
          </TabsContent>

          <TabsContent value="system" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3>System Information</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Version</p>
                      <p>v2.3.0 StackBlitz Edition</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Storage</p>
                      <div className="flex flex-col gap-1">
                        {getDatabaseStatusBadge()}
                        <p className="text-xs text-muted-foreground">{databaseStatus.message}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Network Status</p>
                      <Badge variant={isOnline ? "default" : "secondary"}>
                        {isOnline ? (
                          <>
                            <Wifi className="h-3 w-3 mr-1" />
                            Online
                          </>
                        ) : (
                          <>
                            <WifiOff className="h-3 w-3 mr-1" />
                            Offline
                          </>
                        )}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Users</p>
                      <p>{new Set(userActivities.map((a) => a.userId)).size || 1}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Containers</p>
                      <p>{containers.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Locks</p>
                      <p>{lockedContainers.size}</p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">System Capabilities</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        Local Storage Access
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-red-600" />
                        Server Functions
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        Browser Events
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        Offline Support
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CollaborationPanel userActivities={userActivities} isOnline={isOnline} />
        <Toaster position="top-right" />
      </div>
    );
  }

  // Main application interface
  return (
    <div className="min-h-screen bg-background">
      {/* Header with user info and status */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6" />
            <div>
              <h1>SAGA Storage System</h1>
              <p className="text-sm text-muted-foreground">
                Welcome back, {currentUserInitials} - Ready to manage your lab samples
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">User: {currentUserInitials}</Badge>
            {getDatabaseStatusBadge()}
            <Dialog open={showSystemDialog} onOpenChange={setShowSystemDialog}>
              <Button variant="ghost" size="sm" onClick={() => setShowSystemDialog(true)}>
                <Settings className="h-4 w-4" />
              </Button>
              {showSystemDialog && (
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>System Tools</DialogTitle>
                    <DialogDescription>
                      Access administrative functions and system information
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set("admin", "true");
                        window.location.href = url.toString();
                      }}
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Open Admin Dashboard
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setShowSystemDialog(false);
                        toast.info("Audit logs available in admin dashboard");
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Audit Logs
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setShowSystemDialog(false);
                        toast.info(
                          `Storage: Local | Users: ${userActivities.length || 1} | Network: ${
                            isOnline ? "Online" : "Offline"
                          }`
                        );
                      }}
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      System Status
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setShowSystemDialog(false);
                        handleChangeInitials();
                      }}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Change Initials ({currentUserInitials})
                    </Button>
                  </div>
                </DialogContent>
              )}
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main content */}
      <PlasmaContainerList
        containers={containers}
        onContainersChange={handleContainersChange}
        {...collaborationProps}
      />

      <CollaborationPanel userActivities={userActivities} isOnline={isOnline} />

      {/* Initials Dialog */}
      <Dialog open={showInitialsDialog} onOpenChange={setShowInitialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Your Initials</DialogTitle>
            <DialogDescription>
              Change the initials used to track your activities
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-initials">Your Initials</Label>
              <Input
                id="new-initials"
                placeholder="e.g. JS"
                value={tempInitials}
                onChange={(e) => setTempInitials(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleInitialsSubmit();
                  }
                }}
                maxLength={4}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleInitialsSubmit}
                className="flex-1"
                disabled={tempInitials.trim().length < 2}
              >
                Update Initials
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowInitialsDialog(false);
                  setTempInitials("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="top-right" />
    </div>
  );
}