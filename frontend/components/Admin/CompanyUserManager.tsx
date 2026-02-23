'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Mail, Search, UserPlus, Users, UtensilsCrossed, X } from 'lucide-react';
import { api } from '@/lib/api';
import StatusChip from './StatusChip';
import AdminRowActions from './AdminRowActions';

type UserCategory = 'platform' | 'restaurant';
type UserTab = 'platform' | 'restaurant' | 'all';

interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: string;
  category: UserCategory;
  restaurant_id?: string;
  restaurant_name?: string;
  permissions: string[];
  invited_at?: string;
  accepted_at?: string;
  is_active?: boolean;
}

interface UserSummary {
  total: number;
  platformAdmins: number;
  restaurantOwners: number;
  restaurantManagers: number;
  staffMembers: number;
}

interface CompanyUserManagerProps {
  onClose?: () => void;
}

const editableRoleOptions = ['super_admin', 'admin', 'manager', 'viewer'] as const;
type EditableRole = typeof editableRoleOptions[number];

const roleBadge: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  'platform-admin': 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  owner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  manager: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  staff: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
};

const tabOptions: Array<{ value: UserTab; label: string }> = [
  { value: 'platform', label: 'Platform Admins' },
  { value: 'restaurant', label: 'Restaurant Users' },
  { value: 'all', label: 'All Users' }
];

export function CompanyUserManager({ onClose }: CompanyUserManagerProps) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [summary, setSummary] = useState<UserSummary>({
    total: 0,
    platformAdmins: 0,
    restaurantOwners: 0,
    restaurantManagers: 0,
    staffMembers: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<UserTab>('platform');
  const [roleFilter, setRoleFilter] = useState('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'viewer'>('manager');
  const [isInviting, setIsInviting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const category = activeTab === 'all' ? undefined : activeTab;
      const restaurantId = restaurantFilter !== 'all' ? restaurantFilter : undefined;
      const response = await api.get('/api/admin/users', {
        params: {
          ...(category ? { category } : {}),
          ...(restaurantId ? { restaurant_id: restaurantId } : {})
        }
      });
      setUsers(response.data.users || []);
      if (response.data.summary) {
        setSummary(response.data.summary);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, restaurantFilter]);

  useEffect(() => {
    loadUsers().catch(() => setLoading(false));
  }, [loadUsers]);

  const availableRoles = useMemo(() => {
    const roles = Array.from(new Set(users.map((user) => user.role))).sort();
    return roles;
  }, [users]);

  const availableRestaurants = useMemo(() => {
    const deduped = new Map<string, string>();
    users.forEach((user) => {
      if (user.restaurant_id && user.restaurant_name) {
        deduped.set(user.restaurant_id, user.restaurant_name);
      }
    });
    return Array.from(deduped.entries()).map(([id, name]) => ({ id, name }));
  }, [users]);

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

  const handleRoleUpdate = async (userId: string, role: EditableRole) => {
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
    ? 'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden'
    : 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm w-full border border-gray-200 dark:border-gray-700';

  return (
    <div className={shellClass}>
      <div className={cardClass}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Admin Users</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage platform admins and restaurant staff separately.</p>
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

        <div className="px-6 pt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-2 text-gray-500 text-xs"><Users className="w-4 h-4" />Platform Admins</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.platformAdmins}</div>
          </article>
          <article className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-2 text-gray-500 text-xs"><Building2 className="w-4 h-4" />Restaurant Owners</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.restaurantOwners}</div>
          </article>
          <article className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-2 text-gray-500 text-xs"><UtensilsCrossed className="w-4 h-4" />Staff Members</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.staffMembers}</div>
          </article>
          <article className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-2 text-gray-500 text-xs"><Users className="w-4 h-4" />Total Users</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.total}</div>
          </article>
        </div>

        <div className="px-6 pt-4 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
          {tabOptions.map((tab) => (
            <button
              key={tab.value}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${activeTab === tab.value ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
              onClick={() => {
                setActiveTab(tab.value);
                setRoleFilter('all');
                setRestaurantFilter('all');
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field w-full pl-9" placeholder="Search users..." />
          </div>
          <select value={restaurantFilter} onChange={(e) => setRestaurantFilter(e.target.value)} className="input-field lg:w-56" disabled={activeTab === 'platform'}>
            <option value="all">All Restaurants</option>
            {availableRestaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
          </select>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input-field lg:w-56">
            <option value="all">All Roles</option>
            {availableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading users...</div>
        ) : (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Restaurant</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const editable = editableRoleOptions.includes(user.role as EditableRole);
                  return (
                    <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                        <div className="text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-3">
                        <StatusChip label={user.category === 'platform' ? 'Platform' : 'Restaurant'} toneClassName={user.category === 'platform' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'} />
                      </td>
                      <td className="px-6 py-3">{user.restaurant_name || '—'}</td>
                      <td className="px-6 py-3">
                        <StatusChip label={user.role} toneClassName={roleBadge[user.role] || roleBadge.viewer} />
                      </td>
                      <td className="px-6 py-3">
                        <StatusChip label={user.is_active ? 'Active' : 'Inactive'} toneClassName={user.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'} />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <AdminRowActions className="inline-flex">
                          {editable ? (
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleUpdate(user.id, e.target.value as EditableRole)}
                              className="input-field py-1"
                              disabled={updatingUserId === user.id}
                            >
                              {editableRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-500">Role locked</span>
                          )}
                          <button
                            className="btn-secondary"
                            onClick={() => handleDeactivate(user.id, Boolean(user.is_active))}
                            disabled={updatingUserId === user.id}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </AdminRowActions>
                      </td>
                    </tr>
                  );
                })}
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
