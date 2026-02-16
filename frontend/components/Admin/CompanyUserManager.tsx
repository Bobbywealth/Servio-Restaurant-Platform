'use client';

import React, { useState } from 'react';
import { 
  Users, UserPlus, Mail, Shield, MoreVertical,
  Edit2, Trash2, Check, X, Clock, Search,
  User, Crown, Eye, EyeOff, Loader2
} from 'lucide-react';
import { api } from '@/lib/api';

// Types
interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'viewer';
  permissions: string[];
  restaurant_access?: string[];
  invited_at?: string;
  accepted_at?: string;
  is_active?: boolean;
}

interface Restaurant {
  id: string;
  name: string;
}

interface CompanyUserManagerProps {
  onClose?: () => void;
}

// Mock data
const mockUsers: CompanyUser[] = [
  { id: '1', name: 'John Smith', email: 'john@company.com', role: 'super_admin', permissions: ['*'], invited_at: '2024-01-15', accepted_at: '2024-01-15', is_active: true },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@company.com', role: 'admin', permissions: ['restaurants:*', 'users:read', 'analytics:*', 'menus:*'], invited_at: '2024-02-01', accepted_at: '2024-02-02', is_active: true },
  { id: '3', name: 'Mike Wilson', email: 'mike@company.com', role: 'manager', permissions: ['restaurants:read', 'orders:*', 'staff:*'], invited_at: '2024-02-15', accepted_at: '2024-02-16', is_active: true },
  { id: '4', name: 'Emily Brown', email: 'emily@company.com', role: 'manager', permissions: ['restaurants:read', 'orders:*'], invited_at: '2024-03-01', is_active: false },
  { id: '5', name: 'David Lee', email: 'david@company.com', role: 'viewer', permissions: ['restaurants:read', 'analytics:read'], invited_at: '2024-03-10', accepted_at: '2024-03-11', is_active: true },
];

const mockRestaurants: Restaurant[] = [
  { id: '1', name: 'Downtown Location' },
  { id: '2', name: 'Airport Location' },
  { id: '3', name: 'Mall Location' },
];

const roleColors: Record<string, { bg: string; label: string }> = {
  super_admin: { bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', label: 'Super Admin' },
  admin: { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Admin' },
  manager: { bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Manager' },
  viewer: { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'Viewer' },
};

const roleDescriptions: Record<string, string> = {
  super_admin: 'Full access to all company and restaurant features',
  admin: 'Can manage restaurants, users, and view all analytics',
  manager: 'Can manage orders, staff, and view location analytics',
  viewer: 'Read-only access to restaurant data and analytics',
};

export function CompanyUserManager({ onClose }: CompanyUserManagerProps) {
  const [users, setUsers] = useState<CompanyUser[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'viewer'>('manager');
  const [isInviting, setIsInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Invite user
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    
    setIsInviting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newUser: CompanyUser = {
        id: String(users.length + 1),
        name: inviteEmail.split('@')[0],
        email: inviteEmail,
        role: inviteRole,
        permissions: getDefaultPermissions(inviteRole),
        invited_at: new Date().toISOString().split('T')[0],
        is_active: false,
      };
      
      setUsers(prev => [...prev, newUser]);
      setInviteEmail('');
      setInviteRole('manager');
      setShowInviteModal(false);
    } catch (error) {
      console.error('Failed to invite user:', error);
    } finally {
      setIsInviting(false);
    }
  };

  // Update user role
  const updateUserRole = (userId: string, newRole: CompanyUser['role']) => {
    setUsers(prev => prev.map(user => 
      user.id === userId 
        ? { ...user, role: newRole, permissions: getDefaultPermissions(newRole) }
        : user
    ));
    setEditingUser(null);
  };

  // Get default permissions for role
  const getDefaultPermissions = (role: string): string[] => {
    switch (role) {
      case 'super_admin': return ['*'];
      case 'admin': return ['restaurants:*', 'users:read', 'analytics:*', 'menus:*'];
      case 'manager': return ['restaurants:read', 'orders:*', 'staff:*'];
      case 'viewer': return ['restaurants:read', 'analytics:read'];
      default: return [];
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Company User Management
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage users and their access across your organization
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Invite User
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field w-full pl-10"
              />
            </div>
            
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-field w-full sm:w-48"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-6 font-semibold text-gray-600 dark:text-gray-400">
                  User
                </th>
                <th className="text-left py-3 px-6 font-semibold text-gray-600 dark:text-gray-400">
                  Role
                </th>
                <th className="text-left py-3 px-6 font-semibold text-gray-600 dark:text-gray-400">
                  Status
                </th>
                <th className="text-left py-3 px-6 font-semibold text-gray-600 dark:text-gray-400">
                  Invited
                </th>
                <th className="text-right py-3 px-6 font-semibold text-gray-600 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr 
                  key={user.id}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {editingUser === user.id ? (
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value as CompanyUser['role'])}
                        className="input-field w-36"
                        autoFocus
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${roleColors[user.role].bg}`}>
                        {roleColors[user.role].label}
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      {user.is_active ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">Active</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-gray-400" />
                          <span className="text-sm text-gray-500">Pending</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500">
                    {user.invited_at}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.role !== 'super_admin' && (
                        <>
                          <button
                            onClick={() => setEditingUser(user.id)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Edit role"
                          >
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Remove user"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                No users found matching your search
              </p>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <span>Total Users: <strong className="text-gray-900 dark:text-white">{users.length}</strong></span>
            <span>Active: <strong className="text-green-600 dark:text-green-400">{users.filter(u => u.is_active).length}</strong></span>
            <span>Pending: <strong className="text-amber-600 dark:text-amber-400">{users.filter(u => !u.is_active).length}</strong></span>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Invite New User
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="input-field w-full pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="input-field w-full"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {roleDescriptions[inviteRole]}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || isInviting}
                className="btn-primary flex items-center gap-2"
              >
                {isInviting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Invitation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyUserManager;
