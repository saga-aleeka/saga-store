import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Crown, 
  Edit, 
  Trash2, 
  Lock, 
  Unlock,
  Eye,
  Settings,
  Activity
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export interface UserRole {
  id: string;
  name: string;
  level: number; // 1=viewer, 2=operator, 3=supervisor, 4=admin
  permissions: {
    viewContainers: boolean;
    createContainers: boolean;
    editContainers: boolean;
    deleteContainers: boolean;
    scanSamples: boolean;
    editSamples: boolean;
    deleteSamples: boolean;
    accessArchive: boolean;
    manageUsers: boolean;
    viewAuditLogs: boolean;
    systemSettings: boolean;
    exportData: boolean;
  };
  color: string;
  description: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleId: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  createdBy: string;
  department?: string;
  phone?: string;
}

export interface CurrentUser extends User {
  role: UserRole;
}

// Default system roles
const DEFAULT_ROLES: UserRole[] = [
  {
    id: 'viewer',
    name: 'Viewer',
    level: 1,
    permissions: {
      viewContainers: true,
      createContainers: false,
      editContainers: false,
      deleteContainers: false,
      scanSamples: false,
      editSamples: false,
      deleteSamples: false,
      accessArchive: true,
      manageUsers: false,
      viewAuditLogs: false,
      systemSettings: false,
      exportData: false
    },
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Read-only access to view containers and samples'
  },
  {
    id: 'operator',
    name: 'Lab Operator',
    level: 2,
    permissions: {
      viewContainers: true,
      createContainers: true,
      editContainers: true,
      deleteContainers: false,
      scanSamples: true,
      editSamples: true,
      deleteSamples: false,
      accessArchive: true,
      manageUsers: false,
      viewAuditLogs: false,
      systemSettings: false,
      exportData: true
    },
    color: 'bg-green-100 text-green-800 border-green-200',
    description: 'Standard lab operations: scan samples, manage containers'
  },
  {
    id: 'supervisor',
    name: 'Lab Supervisor',
    level: 3,
    permissions: {
      viewContainers: true,
      createContainers: true,
      editContainers: true,
      deleteContainers: true,
      scanSamples: true,
      editSamples: true,
      deleteSamples: true,
      accessArchive: true,
      manageUsers: false,
      viewAuditLogs: true,
      systemSettings: false,
      exportData: true
    },
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Full lab operations plus audit log access and deletion rights'
  },
  {
    id: 'admin',
    name: 'System Administrator',
    level: 4,
    permissions: {
      viewContainers: true,
      createContainers: true,
      editContainers: true,
      deleteContainers: true,
      scanSamples: true,
      editSamples: true,
      deleteSamples: true,
      accessArchive: true,
      manageUsers: true,
      viewAuditLogs: true,
      systemSettings: true,
      exportData: true
    },
    color: 'bg-red-100 text-red-800 border-red-200',
    description: 'Complete system access including user management'
  }
];

const USERS_STORAGE_KEY = 'plasma-users';
const ROLES_STORAGE_KEY = 'plasma-roles';
const CURRENT_USER_KEY = 'plasma-current-user';

interface UserManagementProps {
  currentUser?: CurrentUser;
  onUserChange?: (user: CurrentUser | null) => void;
  onPermissionCheck?: (permission: keyof UserRole['permissions']) => boolean;
}

export function UserManagement({ 
  currentUser, 
  onUserChange, 
  onPermissionCheck 
}: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>(DEFAULT_ROLES);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleManager, setShowRoleManager] = useState(false);

  // Form states
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    fullName: '',
    roleId: 'operator',
    department: '',
    phone: ''
  });

  // Load data on mount
  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = () => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        setUsers(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadRoles = () => {
    try {
      const saved = localStorage.getItem(ROLES_STORAGE_KEY);
      if (saved) {
        const savedRoles = JSON.parse(saved);
        // Merge with defaults to ensure we have all default roles
        const mergedRoles = DEFAULT_ROLES.map(defaultRole => 
          savedRoles.find((r: UserRole) => r.id === defaultRole.id) || defaultRole
        );
        setRoles(mergedRoles);
      } else {
        localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(DEFAULT_ROLES));
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      setRoles(DEFAULT_ROLES);
    }
  };

  const saveUsers = (updatedUsers: User[]) => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
      setUsers(updatedUsers);
    } catch (error) {
      console.error('Error saving users:', error);
      toast.error('Failed to save user changes');
    }
  };

  const createUser = () => {
    if (!newUser.username || !newUser.email || !newUser.fullName) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check for duplicate username/email
    const duplicate = users.find(u => 
      u.username === newUser.username || u.email === newUser.email
    );
    if (duplicate) {
      toast.error('Username or email already exists');
      return;
    }

    const user: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...newUser,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.id || 'system'
    };

    saveUsers([...users, user]);
    setShowCreateUser(false);
    setNewUser({
      username: '',
      email: '',
      fullName: '',
      roleId: 'operator',
      department: '',
      phone: ''
    });
    toast.success('User created successfully');
  };

  const updateUser = (userId: string, updates: Partial<User>) => {
    const updatedUsers = users.map(user =>
      user.id === userId ? { ...user, ...updates } : user
    );
    saveUsers(updatedUsers);
    
    // If updating current user, update context
    if (currentUser?.id === userId && onUserChange) {
      const updatedUser = updatedUsers.find(u => u.id === userId);
      const userRole = roles.find(r => r.id === updatedUser?.roleId);
      if (updatedUser && userRole) {
        onUserChange({ ...updatedUser, role: userRole });
      }
    }
  };

  const toggleUserStatus = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      updateUser(userId, { isActive: !user.isActive });
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
    }
  };

  const deleteUser = (userId: string) => {
    const updatedUsers = users.filter(u => u.id !== userId);
    saveUsers(updatedUsers);
    toast.success('User deleted successfully');
  };

  const getRoleById = (roleId: string) => {
    return roles.find(r => r.id === roleId);
  };

  const canManageUsers = () => {
    return currentUser?.role.permissions.manageUsers || false;
  };

  const hasPermission = (permission: keyof UserRole['permissions']) => {
    return currentUser?.role.permissions[permission] || false;
  };

  if (!canManageUsers()) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-5 w-5" />
            <p>You don't have permission to manage users.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">
            Manage users, roles, and permissions for the lab system
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRoleManager(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Manage Roles
          </Button>
          <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to the system with appropriate role and permissions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={newUser.username}
                      onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="john.doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={newUser.fullName}
                      onChange={(e) => setNewUser(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john.doe@lab.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={newUser.roleId} onValueChange={(value) => 
                      setNewUser(prev => ({ ...prev, roleId: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={newUser.department}
                      onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Clinical Lab"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newUser.phone}
                    onChange={(e) => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={createUser} className="flex-1">
                    Create User
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateUser(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Current User Info */}
      {currentUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Current User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <p>{currentUser.fullName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Username</Label>
                <p>{currentUser.username}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Role</Label>
                <Badge className={`${currentUser.role.color} w-fit`}>
                  {currentUser.role.name}
                </Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Department</Label>
                <p>{currentUser.department || 'Not specified'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const role = getRoleById(user.roleId);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {role && (
                          <Badge className={`${role.color} text-xs`}>
                            {role.name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{user.department || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditUser(true);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserStatus(user.id)}
                          >
                            {user.isActive ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {user.fullName}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteUser(user.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Role Management Modal */}
      <Dialog open={showRoleManager} onOpenChange={setShowRoleManager}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Role Management</DialogTitle>
            <DialogDescription>
              View and manage user roles and their associated permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {roles.map(role => (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={`${role.color}`}>
                        {role.name}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        Level {role.level} • {role.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(role.permissions).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <Badge variant={value ? 'default' : 'secondary'} className="text-xs">
                          {value ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Hook for using permissions in components
export function usePermissions(currentUser?: CurrentUser) {
  const hasPermission = (permission: keyof UserRole['permissions']): boolean => {
    return currentUser?.role.permissions[permission] || false;
  };

  const canAccess = (requiredLevel: number): boolean => {
    return (currentUser?.role.level || 0) >= requiredLevel;
  };

  const getRoleName = (): string => {
    return currentUser?.role.name || 'Unknown';
  };

  const getUserName = (): string => {
    return currentUser?.fullName || currentUser?.username || 'Unknown User';
  };

  return {
    hasPermission,
    canAccess,
    getRoleName,
    getUserName,
    currentUser,
    isLoggedIn: !!currentUser
  };
}