'use client';

import React, { useState, useMemo } from 'react';
import { 
  Activity, Search, Filter, ChevronDown, ChevronUp,
  Clock, User, Store, Settings, Trash2, Edit2,
  Plus, Trash, Download, RefreshCw, AlertTriangle
} from 'lucide-react';

// Types
interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  entity_type: 'restaurant' | 'user' | 'order' | 'menu' | 'inventory' | 'settings';
  entity_id?: string;
  entity_name?: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  status: 'success' | 'failed';
}

interface AuditLogViewerProps {
  onClose?: () => void;
  restaurantId?: string;
}

// Mock data
const mockAuditLogs: AuditLogEntry[] = [
  { id: '1', timestamp: '2024-03-15T10:30:00Z', action: 'restaurant.created', entity_type: 'restaurant', entity_id: '3', entity_name: 'New Location', user_id: '1', user_name: 'John Smith', user_email: 'john@company.com', status: 'success' },
  { id: '2', timestamp: '2024-03-15T10:25:00Z', action: 'user.invited', entity_type: 'user', user_id: '2', user_name: 'Sarah Johnson', user_email: 'sarah@company.com', status: 'success' },
  { id: '3', timestamp: '2024-03-15T10:20:00Z', action: 'menu.item.updated', entity_type: 'menu', entity_id: '1', entity_name: 'Mozzarella Sticks', user_id: '3', user_name: 'Mike Wilson', status: 'success' },
  { id: '4', timestamp: '2024-03-15T10:15:00Z', action: 'order.cancelled', entity_type: 'order', entity_id: '1234', user_id: '1', user_name: 'John Smith', status: 'success' },
  { id: '5', timestamp: '2024-03-15T10:10:00Z', action: 'inventory.low_stock', entity_type: 'inventory', entity_id: '50', entity_name: 'Chicken Wings', status: 'warning' },
  { id: '6', timestamp: '2024-03-15T10:05:00Z', action: 'settings.updated', entity_type: 'settings', user_id: '2', user_name: 'Sarah Johnson', status: 'success' },
  { id: '7', timestamp: '2024-03-15T10:00:00Z', action: 'restaurant.updated', entity_type: 'restaurant', entity_id: '1', entity_name: 'Downtown Location', user_id: '1', user_name: 'John Smith', status: 'success' },
  { id: '8', timestamp: '2024-03-15T09:55:00Z', action: 'user.login', entity_type: 'user', user_id: '3', user_name: 'Mike Wilson', user_email: 'mike@company.com', status: 'success' },
  { id: '9', timestamp: '2024-03-15T09:50:00Z', action: 'menu.category.created', entity_type: 'menu', entity_id: '10', entity_name: 'Desserts', user_id: '2', user_name: 'Sarah Johnson', status: 'success' },
  { id: '10', timestamp: '2024-03-15T09:45:00Z', action: 'order.refunded', entity_type: 'order', entity_id: '1230', user_id: '1', user_name: 'John Smith', status: 'failed', details: { reason: 'Payment already processed' } },
];

const actionIcons: Record<string, React.ReactNode> = {
  restaurant: <Store className="w-4 h-4" />,
  user: <User className="w-4 h-4" />,
  order: <Activity className="w-4 h-4" />,
  menu: <Edit2 className="w-4 h-4" />,
  inventory: <Trash2 className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
};

const actionColors: Record<string, string> = {
  restaurant: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  user: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  order: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  menu: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  inventory: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  settings: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatAction(action: string): string {
  return action
    .split('.')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function AuditLogViewer({ onClose, restaurantId }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(mockAuditLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches = 
          log.action.toLowerCase().includes(query) ||
          log.entity_name?.toLowerCase().includes(query) ||
          log.user_name?.toLowerCase().includes(query) ||
          log.user_email?.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Entity type filter
      if (entityTypeFilter !== 'all' && log.entity_type !== entityTypeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && log.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [logs, searchQuery, entityTypeFilter, statusFilter]);

  // Toggle log details
  const toggleExpanded = (id: string) => {
    const next = new Set(expandedLogs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedLogs(next);
  };

  // Export logs
  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Action', 'Entity Type', 'Entity', 'User', 'Status', 'Details'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.action,
        log.entity_type,
        log.entity_name || '',
        log.user_name || '',
        log.status,
        JSON.stringify(log.details || {})
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Audit Logs
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track all activity across your organization
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportLogs}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronDown className="w-5 h-5 text-gray-500 rotate-90" />
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
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field w-full pl-10"
              />
            </div>

            {/* Entity Type Filter */}
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="input-field w-full sm:w-40"
            >
              <option value="all">All Types</option>
              <option value="restaurant">Restaurants</option>
              <option value="user">Users</option>
              <option value="order">Orders</option>
              <option value="menu">Menu</option>
              <option value="inventory">Inventory</option>
              <option value="settings">Settings</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-full sm:w-32"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="warning">Warning</option>
            </select>

            {/* Date Range */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="input-field w-full sm:w-32"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>

        {/* Logs List */}
        <div className="overflow-y-auto max-h-[60vh]">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                No audit logs found
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredLogs.map(log => (
                <div key={log.id}>
                  {/* Log Summary */}
                  <div 
                    className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => toggleExpanded(log.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${actionColors[log.entity_type]}`}>
                          {actionIcons[log.entity_type]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatAction(log.action)}
                            </span>
                            {log.status === 'success' ? (
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                            ) : log.status === 'failed' ? (
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {log.entity_name && <span className="mr-2">{log.entity_name}</span>}
                            {log.user_name && <span>by {log.user_name}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {expandedLogs.has(log.id) ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Log Details */}
                  {expandedLogs.has(log.id) && (
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="block text-gray-500 mb-1">Entity Type</span>
                          <span className="font-medium text-gray-900 dark:text-white capitalize">
                            {log.entity_type}
                          </span>
                        </div>
                        <div>
                          <span className="block text-gray-500 mb-1">Entity ID</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {log.entity_id || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-gray-500 mb-1">User</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {log.user_name || 'System'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-gray-500 mb-1">Status</span>
                          <span className={`font-medium capitalize ${
                            log.status === 'success' 
                              ? 'text-green-600 dark:text-green-400' 
                              : log.status === 'failed'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                        {log.ip_address && (
                          <div>
                            <span className="block text-gray-500 mb-1">IP Address</span>
                            <span className="font-mono text-gray-900 dark:text-white">
                              {log.ip_address}
                            </span>
                          </div>
                        )}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="col-span-2">
                            <span className="block text-gray-500 mb-1">Details</span>
                            <pre className="text-xs bg-gray-100 dark:bg-gray-600 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {filteredLogs.length} of {logs.length} entries
            </span>
            <div className="flex items-center gap-4">
              <span>
                Last updated: {formatTimestamp(new Date().toISOString())}
              </span>
              <button
                className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => setLogs(mockAuditLogs)}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditLogViewer;
