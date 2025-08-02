'use client';

import { useState, useEffect } from 'react';
import { useSession, admin } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: string | Date | null;
  emailVerified: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface UserSession {
  id: string;
  token: string;
  userId: string;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
  impersonatedBy?: string | null;
}

export function AdminPageClient() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form states
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('');

  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsLoading(true);
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        const result = await admin.hasPermission({
          permissions: { user: ['list'] },
        });
        // Better Auth returns a response object with data property
        const hasPermission = Boolean(result?.data?.success);
        setIsAdmin(hasPermission);

        if (hasPermission) {
          await loadUsers();
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [session]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await admin.listUsers({
        query: { limit: '50', offset: '0' },
      });
      // Better Auth returns response object with data property
      setUsers(result?.data?.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadUserSessions = async (userId: string) => {
    setLoading(true);
    try {
      const result = await admin.listUserSessions({ userId });
      // Better Auth returns response object with data property
      setUserSessions(result?.data?.sessions || []);
    } catch (error) {
      console.error('Error loading user sessions:', error);
      toast.error('Failed to load user sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleSetRole = async (userId: string, role: 'user' | 'admin') => {
    try {
      await admin.setRole({ userId, role });
      toast.success(`User role updated to ${role}`);
      await loadUsers();
    } catch (error) {
      console.error('Error setting role:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleBanUser = async (userId: string) => {
    if (!banReason.trim()) {
      toast.error('Please provide a ban reason');
      return;
    }

    try {
      const banExpiresIn = banDuration
        ? parseInt(banDuration) * 24 * 60 * 60
        : undefined; // Convert days to seconds
      await admin.banUser({
        userId,
        banReason: banReason.trim(),
        banExpiresIn,
      });
      toast.success('User banned successfully');
      setBanReason('');
      setBanDuration('');
      await loadUsers();
    } catch (error) {
      console.error('Error banning user:', error);
      toast.error('Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await admin.unbanUser({ userId });
      toast.success('User unbanned successfully');
      await loadUsers();
    } catch (error) {
      console.error('Error unbanning user:', error);
      toast.error('Failed to unban user');
    }
  };

  const handleRevokeSession = async (sessionToken: string) => {
    try {
      await admin.revokeUserSession({ sessionToken });
      toast.success('Session revoked successfully');
      if (selectedUser) {
        await loadUserSessions(selectedUser.id);
      }
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Failed to revoke session');
    }
  };

  const handleImpersonateUser = async (userId: string) => {
    try {
      const result = await admin.impersonateUser({ userId });
      toast.success(
        'Impersonation session created. You can now act as this user.',
      );
      console.log('Impersonation result:', result);
    } catch (error) {
      console.error('Error impersonating user:', error);
      toast.error('Failed to create impersonation session');
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!session?.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            Please sign in to access the admin panel
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You do not have admin privileges. Contact an administrator if you
            believe this is an error.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Current user: {session.user.email}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="sessions">Session Management</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user roles, ban/unban users, and view user information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">All Users</h3>
                <Button onClick={loadUsers} disabled={loading}>
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>

              {loading ? (
                <div>Loading users...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.role === 'admin' ? 'default' : 'secondary'
                            }
                          >
                            {user.role || 'user'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.banned ? (
                            <Badge variant="destructive">Banned</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(user);
                                loadUserSessions(user.id);
                              }}
                            >
                              Sessions
                            </Button>
                            <Select
                              value={user.role || 'user'}
                              onValueChange={(role: 'user' | 'admin') =>
                                handleSetRole(user.id, role)
                              }
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            {user.banned ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnbanUser(user.id)}
                              >
                                Unban
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setSelectedUser(user)}
                              >
                                Ban
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleImpersonateUser(user.id)}
                            >
                              Impersonate
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Ban User Dialog */}
          {selectedUser && !selectedUser.banned && (
            <Card>
              <CardHeader>
                <CardTitle>Ban User: {selectedUser.name}</CardTitle>
                <CardDescription>
                  This will prevent the user from accessing the system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="banReason">Ban Reason *</Label>
                  <Textarea
                    id="banReason"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Enter reason for banning this user..."
                  />
                </div>
                <div>
                  <Label htmlFor="banDuration">Ban Duration (days)</Label>
                  <Input
                    id="banDuration"
                    type="number"
                    value={banDuration}
                    onChange={(e) => setBanDuration(e.target.value)}
                    placeholder="Leave empty for permanent ban"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleBanUser(selectedUser.id)}
                    disabled={!banReason.trim()}
                  >
                    Ban User
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedUser(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          {selectedUser ? (
            <Card>
              <CardHeader>
                <CardTitle>Sessions for {selectedUser.name}</CardTitle>
                <CardDescription>
                  Manage active sessions for this user
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>User Agent</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Impersonated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-mono text-xs">
                          {session.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>{session.ipAddress || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {session.userAgent || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {new Date(session.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {new Date(session.expiresAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {session.impersonatedBy ? (
                            <Badge variant="outline">Yes</Badge>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRevokeSession(session.token)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Session Management</CardTitle>
                <CardDescription>
                  Select a user from the User Management tab to view their
                  sessions
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
