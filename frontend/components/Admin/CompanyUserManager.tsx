'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Search, UserPlus, X } from 'lucide-react';
import { api } from '@/lib/api';

interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'viewer';
  permissions: string[];
  invited_at?: string;
  accepted_at?: string;
  is_active?: boolean;
}

interface CompanyUserManagerProps {
  onClose?: () => void;
}

const roleOptions: CompanyUser['role'][] = ['super_admin', 'admin', 'manager', 'viewer'];

const roleBadge: Record<CompanyUser['role'], string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  manager: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
};

export function CompanyUserManager({ onClose }: CompanyUserManagerProps) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'viewer'>('manager');
  const [isInviting, setIsInviting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data.users || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers().catch(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !q || user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await api.post('/api/admin/users/invite', { email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      setInviteRole('manager');
      setShowInviteModal(false);
      await loadUsers();
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleUpdate = async (userId: string, role: CompanyUser['role']) => {
    setUpdatingUserId(userId);
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role });
      await loadUsers();
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeactivate = async (userId: string, isActive: boolean) => {
    setUpdatingUserId(userId);
    try {
      await api.patch(`/api/admin/users/${userId}/deactivate`, { is_active: !isActive });
      await loadUsers();
    } finally {
      setUpdatingUserId(null);
    }
  };

  const shellClass = onClose
    ? 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'
    : 'w-full';
  const cardClass = onClose
    ? 'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden'
    : 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm w-full border border-gray-200 dark:border-gray-700';

  return (
    <div className={shellClass}>
      <div className={cardClass}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Company User Management</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage users and their access across your organization.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInviteModal(true)} className="btn-primary flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Invite User
            </button>
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field w-full pl-9" placeholder="Search users..." />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input-field sm:w-56">
            <option value="all">All Roles</option>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Invited</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                      <div className="text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${roleBadge[user.role]}`}>{user.role}</span>
                    </td>
                    <td className="px-6 py-3">{user.is_active ? 'Active' : 'Inactive'}</td>
                    <td className="px-6 py-3">{user.invited_at ? new Date(user.invited_at).toLocaleDateString() : '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleUpdate(user.id, e.target.value as CompanyUser['role'])}
                          className="input-field py-1"
                          disabled={updatingUserId === user.id}
                        >
                          {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                        <button
                          className="btn-secondary"
                          onClick={() => handleDeactivate(user.id, Boolean(user.is_active))}
                          disabled={updatingUserId === user.id}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && <div className="p-8 text-center text-gray-500">No users found.</div>}
          </div>
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Invite User</h3>
            <div>
              <label className="text-sm text-gray-500">Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="input-field w-full pl-9" />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Role</label>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} className="input-field w-full mt-1">
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowInviteModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleInvite} disabled={!inviteEmail.trim() || isInviting}>
                {isInviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyUserManager;
