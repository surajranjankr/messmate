// ============================================================
// Admin User Management Page
// ============================================================

import React, { useState, useEffect } from 'react';
import { authService } from '@/services/authService';
import { User, UserRole, UserStatus } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Users, Plus, Search, UserCheck, UserX, Edit, Shield, CheckCircle2 } from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadUsers = () => {
    setUsers(authService.getUsers());
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingUserId(null);
    setDisplayName('');
    setEmail('');
    setRole(UserRole.STUDENT);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUserId(user.id);
    setDisplayName(user.displayName);
    setEmail(user.email);
    setRole(user.role);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!displayName.trim() || !email.trim()) {
      setModalError('Please fill in all required fields.');
      return;
    }

    try {
      if (editingUserId) {
        authService.updateUser(editingUserId, {
          displayName: displayName.trim(),
          email: email.trim(),
          role,
        });
        showToast('User details updated successfully.');
      } else {
        authService.addUser({
          displayName: displayName.trim(),
          email: email.trim(),
          role,
          status: UserStatus.ACTIVE,
        });
        showToast('New user added successfully.');
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving user.';
      setModalError(msg);
    }
  };

  const handleToggleStatus = (id: string) => {
    try {
      const updated = authService.toggleUserStatus(id);
      showToast(`User is now ${updated.status}.`);
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error changing status.';
      showToast(msg);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            User Management
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Manage student, vendor, and administrator demo accounts
          </p>
        </div>

        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          <span>Add Demo User</span>
        </Button>
      </div>

      {toastMessage && (
        <div className="p-3 bg-success-light text-success border border-success/30 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-text-secondary" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Role Filter */}
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs"
            >
              <option value="ALL">All Roles</option>
              <option value={UserRole.STUDENT}>Students</option>
              <option value={UserRole.VENDOR}>Vendors</option>
              <option value={UserRole.ADMIN}>Administrators</option>
            </Select>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value={UserStatus.ACTIVE}>Active</option>
              <option value={UserStatus.INACTIVE}>Inactive</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* User Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Institute Email</TableHead>
                <TableHead>Assigned Role</TableHead>
                <TableHead>Account Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-xs text-text-secondary">
                    No users matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold text-xs text-text-primary">
                      {u.displayName}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-text-secondary">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          u.role === UserRole.STUDENT
                            ? 'secondary'
                            : u.role === UserRole.VENDOR
                            ? 'warning'
                            : 'default'
                        }
                        className="text-[11px]"
                      >
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.status === UserStatus.ACTIVE ? 'success' : 'muted'}
                        className="text-[11px]"
                      >
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(u)}
                        className="h-8 px-2 text-xs"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        variant={u.status === UserStatus.ACTIVE ? 'ghost' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleStatus(u.id)}
                        className={`h-8 px-2 text-xs ${
                          u.status === UserStatus.ACTIVE ? 'text-error hover:bg-error-light' : ''
                        }`}
                      >
                        {u.status === UserStatus.ACTIVE ? (
                          <>
                            <UserX className="w-3.5 h-3.5 mr-1" /> Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5 mr-1" /> Activate
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUserId ? 'Edit Demo User' : 'Add New Demo User'}
            </DialogTitle>
          </DialogHeader>

          {modalError && (
            <div className="p-3 bg-error-light text-error border border-error/30 rounded-lg text-xs">
              {modalError}
            </div>
          )}

          <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Rohith Kumar"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Institute Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. rohith@iiitdwd.ac.in"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value={UserRole.STUDENT}>Student</option>
                <option value={UserRole.VENDOR}>Vendor</option>
                <option value={UserRole.ADMIN}>Administrator</option>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingUserId ? 'Update User' : 'Add User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
