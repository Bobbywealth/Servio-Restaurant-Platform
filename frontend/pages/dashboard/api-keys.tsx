import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/utils';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Activity,
  Webhook,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  Save,
  Settings,
  Shield,
  Zap,
  BarChart3,
  Calendar,
  MoreVertical,
} from 'lucide-react';

const DashboardLayout = dynamic(() => import('../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />,
});

// Types
interface ApiKeyScope {
  value: string;
  label: string;
  description: string;
}

interface ScopeGroup {
  label: string;
  scopes: ApiKeyScope[];
}

interface ApiKey {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiKeyUsage {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
  ipAddress?: string;
  createdAt: string;
}

interface ApiKeyStats {
  apiKeyId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgResponseTimeMs: number;
  requestsByEndpoint: Record<string, number>;
  requestsByMethod: Record<string, number>;
  recentUsage: ApiKeyUsage[];
}

interface Webhook {
  id: string;
  apiKeyId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  failureCount: number;
  lastTriggeredAt?: string;
  createdAt: string;
}

interface WebhookEvent {
  value: string;
  label: string;
  description: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800',
};

const STATUS_COLORS: Record<string, string> = {
  '2': 'text-green-600',
  '3': 'text-blue-600',
  '4': 'text-yellow-600',
  '5': 'text-red-600',
};

export default function ApiKeysPage() {
  const { user, isAdmin } = useUser();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [scopeGroups, setScopeGroups] = useState<Record<string, ScopeGroup>>({});
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showWebhooksModal, setShowWebhooksModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Stats state
  const [keyStats, setKeyStats] = useState<ApiKeyStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scopes: [] as string[],
    rateLimit: 1000,
    expiresAt: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Webhook form state
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    secret: '',
    events: [] as string[],
  });
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Fetch API keys
  const fetchApiKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/api-keys');
      setApiKeys(response.data.data || []);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch scope groups
  const fetchScopeGroups = useCallback(async () => {
    try {
      const response = await api.get('/api/api-keys/scopes/list');
      setScopeGroups(response.data.data || {});
    } catch (err) {
      console.error('Failed to fetch scope groups:', err);
    }
  }, []);

  // Fetch webhook events
  const fetchWebhookEvents = useCallback(async () => {
    try {
      const response = await api.get('/api/api-keys/webhooks/events');
      setWebhookEvents(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch webhook events:', err);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
    fetchScopeGroups();
    fetchWebhookEvents();
  }, [fetchApiKeys, fetchScopeGroups, fetchWebhookEvents]);

  // Create API key
  const handleCreateKey = async () => {
    if (!formData.name.trim()) {
      setError('API key name is required');
      return;
    }
    if (formData.scopes.length === 0) {
      setError('At least one scope is required');
      return;
    }

    try {
      setIsSaving(true);
      const response = await api.post('/api/api-keys', {
        name: formData.name,
        description: formData.description,
        scopes: formData.scopes,
        rateLimit: formData.rateLimit,
        expiresAt: formData.expiresAt || undefined,
      });

      setNewlyCreatedKey(response.data.data.key);
      setShowCreateModal(false);
      setShowKeyModal(true);
      resetForm();
      fetchApiKeys();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Update API key
  const handleUpdateKey = async () => {
    if (!selectedKey) return;
    if (!formData.name.trim()) {
      setError('API key name is required');
      return;
    }

    try {
      setIsSaving(true);
      await api.put(`/api/api-keys/${selectedKey.id}`, {
        name: formData.name,
        description: formData.description,
        scopes: formData.scopes,
        rateLimit: formData.rateLimit,
        expiresAt: formData.expiresAt || undefined,
      });

      setShowEditModal(false);
      setSelectedKey(null);
      resetForm();
      fetchApiKeys();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete API key
  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/api/api-keys/${keyId}`);
      fetchApiKeys();
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // Toggle key active status
  const handleToggleKey = async (key: ApiKey) => {
    try {
      await api.put(`/api/api-keys/${key.id}`, {
        isActive: !key.isActive,
      });
      fetchApiKeys();
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // Fetch key stats
  const fetchKeyStats = async (keyId: string) => {
    try {
      setIsLoadingStats(true);
      const response = await api.get(`/api/api-keys/${keyId}/stats?days=30`);
      setKeyStats(response.data.data);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Fetch webhooks
  const fetchWebhooks = async (keyId: string) => {
    try {
      setIsLoadingWebhooks(true);
      const response = await api.get(`/api/api-keys/${keyId}/webhooks`);
      setWebhooks(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch webhooks:', err);
    } finally {
      setIsLoadingWebhooks(false);
    }
  };

  // Create webhook
  const handleCreateWebhook = async () => {
    if (!selectedKey) return;
    if (!webhookForm.name.trim() || !webhookForm.url.trim()) {
      setError('Webhook name and URL are required');
      return;
    }
    if (webhookForm.events.length === 0) {
      setError('At least one event type is required');
      return;
    }

    try {
      setIsSavingWebhook(true);
      await api.post(`/api/api-keys/${selectedKey.id}/webhooks`, webhookForm);
      setWebhookForm({ name: '', url: '', secret: '', events: [] });
      setShowWebhookForm(false);
      fetchWebhooks(selectedKey.id);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsSavingWebhook(false);
    }
  };

  // Delete webhook
  const handleDeleteWebhook = async (webhookId: string) => {
    if (!selectedKey) return;
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      await api.delete(`/api/api-keys/${selectedKey.id}/webhooks/${webhookId}`);
      fetchWebhooks(selectedKey.id);
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      scopes: [],
      rateLimit: 1000,
      expiresAt: '',
    });
    setError(null);
  };

  // Open edit modal
  const openEditModal = (key: ApiKey) => {
    setSelectedKey(key);
    setFormData({
      name: key.name,
      description: key.description || '',
      scopes: key.scopes,
      rateLimit: key.rateLimit,
      expiresAt: key.expiresAt ? key.expiresAt.split('T')[0] : '',
    });
    setShowEditModal(true);
  };

  // Open stats modal
  const openStatsModal = (key: ApiKey) => {
    setSelectedKey(key);
    fetchKeyStats(key.id);
    setShowStatsModal(true);
  };

  // Open webhooks modal
  const openWebhooksModal = (key: ApiKey) => {
    setSelectedKey(key);
    fetchWebhooks(key.id);
    setShowWebhooksModal(true);
  };

  // Toggle scope selection
  const toggleScope = (scope: string) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  // Toggle webhook event selection
  const toggleWebhookEvent = (event: string) => {
    setWebhookForm(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Check if user can manage API keys
  const canManageKeys = isAdmin || user?.role === 'owner' || user?.role === 'admin';

  return (
    <>
      <Head>
        <title>API Keys | Servio Dashboard</title>
      </Head>

      <DashboardLayout>
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Key className="w-8 h-8 text-indigo-600" />
                API Keys
              </h1>
              <p className="text-gray-600 mt-1">
                Manage API keys for third-party integrations and external applications
              </p>
            </div>
            {canManageKeys && (
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create API Key
              </button>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : apiKeys.length === 0 ? (
            /* Empty State */
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <Key className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Create an API key to enable third-party integrations and external applications
                to access your Servio data securely.
              </p>
              {canManageKeys && (
                <button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First API Key
                </button>
              )}
            </div>
          ) : (
            /* API Keys List */
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <motion.div
                  key={key.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${key.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <Key className={`w-6 h-6 ${key.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">{key.name}</h3>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              key.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {key.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1 font-mono">{key.keyPrefix}...</p>
                        {key.description && (
                          <p className="text-sm text-gray-600 mt-1">{key.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Created {formatDate(key.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="w-4 h-4" />
                            Last used {formatDate(key.lastUsedAt)}
                          </span>
                          {key.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Expires {formatDate(key.expiresAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {key.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded-full"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openStatsModal(key)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="View Statistics"
                      >
                        <BarChart3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openWebhooksModal(key)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Manage Webhooks"
                      >
                        <Webhook className="w-5 h-5" />
                      </button>
                      {canManageKeys && (
                        <>
                          <button
                            onClick={() => handleToggleKey(key)}
                            className={`p-2 rounded-lg transition-colors ${
                              key.isActive
                                ? 'text-yellow-600 hover:bg-yellow-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={key.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <Shield className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => openEditModal(key)}
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteKey(key.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Revoke"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Documentation Link */}
          <div className="mt-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <Zap className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">API Documentation</h3>
                <p className="text-gray-600 mt-1">
                  Learn how to use the Servio API to build integrations and automate workflows.
                </p>
                <div className="mt-4 flex gap-4">
                  <a
                    href="/dashboard/api-docs"
                    className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                  >
                    View API Docs →
                  </a>
                  <a
                    href="/help/api-keys"
                    className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                  >
                    Getting Started Guide →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>

      {/* Create API Key Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Create API Key</h2>
                <p className="text-gray-600 mt-1">
                  Generate a new API key for external integrations
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., POS Integration"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the purpose of this API key"
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Scopes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Permissions <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
                    {Object.entries(scopeGroups).map(([groupKey, group]) => (
                      <div key={groupKey}>
                        <h4 className="font-medium text-gray-900 mb-2">{group.label}</h4>
                        <div className="space-y-2">
                          {group.scopes.map((scope) => (
                            <label
                              key={scope.value}
                              className="flex items-start gap-3 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.scopes.includes(scope.value)}
                                onChange={() => toggleScope(scope.value)}
                                className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <div>
                                <span className="text-sm font-medium text-gray-700">
                                  {scope.label}
                                </span>
                                <p className="text-xs text-gray-500">{scope.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rate Limit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rate Limit (requests per hour)
                  </label>
                  <input
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, rateLimit: parseInt(e.target.value, 10) || 1000 })
                    }
                    min={100}
                    max={10000}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum API requests allowed per hour. Default: 1000
                  </p>
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateKey}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Key className="w-5 h-5" />
                  )}
                  Create Key
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit API Key Modal */}
      <AnimatePresence>
        {showEditModal && selectedKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Edit API Key</h2>
                <p className="text-gray-600 mt-1">Update settings for {selectedKey.name}</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Scopes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Permissions
                  </label>
                  <div className="space-y-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
                    {Object.entries(scopeGroups).map(([groupKey, group]) => (
                      <div key={groupKey}>
                        <h4 className="font-medium text-gray-900 mb-2">{group.label}</h4>
                        <div className="space-y-2">
                          {group.scopes.map((scope) => (
                            <label
                              key={scope.value}
                              className="flex items-start gap-3 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.scopes.includes(scope.value)}
                                onChange={() => toggleScope(scope.value)}
                                className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <div>
                                <span className="text-sm font-medium text-gray-700">
                                  {scope.label}
                                </span>
                                <p className="text-xs text-gray-500">{scope.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rate Limit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rate Limit (requests per hour)
                  </label>
                  <input
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, rateLimit: parseInt(e.target.value, 10) || 1000 })
                    }
                    min={100}
                    max={10000}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedKey(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateKey}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show New Key Modal */}
      <AnimatePresence>
        {showKeyModal && newlyCreatedKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-lg w-full"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-green-600 flex items-center gap-2">
                  <Check className="w-6 h-6" />
                  API Key Created
                </h2>
              </div>

              <div className="p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 text-sm font-medium">
                    ⚠️ Save this key securely! It will not be shown again.
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono break-all">{newlyCreatedKey}</code>
                    <button
                      onClick={() => copyToClipboard(newlyCreatedKey)}
                      className="ml-4 p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => {
                    setShowKeyModal(false);
                    setNewlyCreatedKey(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Modal */}
      <AnimatePresence>
        {showStatsModal && selectedKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowStatsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Statistics: {selectedKey.name}
                </h2>
                <p className="text-gray-600 mt-1">Last 30 days of API usage</p>
              </div>

              {isLoadingStats ? (
                <div className="p-12 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              ) : keyStats ? (
                <div className="p-6 space-y-6">
                  {/* Overview Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Total Requests</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {keyStats.totalRequests.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600">Successful</p>
                      <p className="text-2xl font-bold text-green-700">
                        {keyStats.successfulRequests.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-sm text-red-600">Failed</p>
                      <p className="text-2xl font-bold text-red-700">
                        {keyStats.failedRequests.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600">Success Rate</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {keyStats.successRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Avg Response Time */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-2">Average Response Time</p>
                    <p className="text-xl font-bold text-gray-900">
                      {keyStats.avgResponseTimeMs.toFixed(0)} ms
                    </p>
                  </div>

                  {/* Requests by Endpoint */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Top Endpoints</h3>
                    <div className="space-y-2">
                      {Object.entries(keyStats.requestsByEndpoint)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 10)
                        .map(([endpoint, count]) => (
                          <div
                            key={endpoint}
                            className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                          >
                            <code className="text-sm text-gray-700">{endpoint}</code>
                            <span className="text-sm font-medium text-gray-900">
                              {count.toLocaleString()}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Requests by Method */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Requests by Method</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(keyStats.requestsByMethod).map(([method, count]) => (
                        <span
                          key={method}
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            METHOD_COLORS[method] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {method}: {count.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Recent Usage */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Requests</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">
                              Endpoint
                            </th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">
                              Method
                            </th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">
                              Status
                            </th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">
                              Time
                            </th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {keyStats.recentUsage.slice(0, 20).map((usage) => (
                            <tr key={usage.id} className="border-b border-gray-100">
                              <td className="py-2 px-3 font-mono text-xs">{usage.endpoint}</td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    METHOD_COLORS[usage.method] || 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {usage.method}
                                </span>
                              </td>
                              <td
                                className={`py-2 px-3 font-medium ${
                                  STATUS_COLORS[String(usage.statusCode)[0]] || 'text-gray-600'
                                }`}
                              >
                                {usage.statusCode}
                              </td>
                              <td className="py-2 px-3 text-gray-500">
                                {usage.responseTimeMs ? `${usage.responseTimeMs}ms` : '-'}
                              </td>
                              <td className="py-2 px-3 text-gray-500 text-xs">
                                {formatDate(usage.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500">No statistics available</div>
              )}

              <div className="p-6 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => {
                    setShowStatsModal(false);
                    setSelectedKey(null);
                    setKeyStats(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Webhooks Modal */}
      <AnimatePresence>
        {showWebhooksModal && selectedKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowWebhooksModal(false);
              setShowWebhookForm(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Webhooks</h2>
                  <p className="text-gray-600 mt-1">Manage webhooks for {selectedKey.name}</p>
                </div>
                {!showWebhookForm && (
                  <button
                    onClick={() => setShowWebhookForm(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Webhook
                  </button>
                )}
              </div>

              <div className="p-6">
                {isLoadingWebhooks ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                  </div>
                ) : showWebhookForm ? (
                  /* Webhook Form */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={webhookForm.name}
                        onChange={(e) =>
                          setWebhookForm({ ...webhookForm, name: e.target.value })
                        }
                        placeholder="e.g., Order notifications"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={webhookForm.url}
                        onChange={(e) =>
                          setWebhookForm({ ...webhookForm, url: e.target.value })
                        }
                        placeholder="https://your-server.com/webhook"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Secret (optional)
                      </label>
                      <input
                        type="text"
                        value={webhookForm.secret}
                        onChange={(e) =>
                          setWebhookForm({ ...webhookForm, secret: e.target.value })
                        }
                        placeholder="Webhook signing secret"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Used to sign webhook payloads for verification
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Events <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                        {webhookEvents.map((event) => (
                          <label
                            key={event.value}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={webhookForm.events.includes(event.value)}
                              onChange={() => toggleWebhookEvent(event.value)}
                              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">{event.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        onClick={() => {
                          setShowWebhookForm(false);
                          setWebhookForm({ name: '', url: '', secret: '', events: [] });
                        }}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateWebhook}
                        disabled={isSavingWebhook}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {isSavingWebhook ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                        Create Webhook
                      </button>
                    </div>
                  </div>
                ) : webhooks.length === 0 ? (
                  /* Empty State */
                  <div className="text-center py-12">
                    <Webhook className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No webhooks configured</p>
                    <button
                      onClick={() => setShowWebhookForm(true)}
                      className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Add your first webhook
                    </button>
                  </div>
                ) : (
                  /* Webhooks List */
                  <div className="space-y-4">
                    {webhooks.map((webhook) => (
                      <div
                        key={webhook.id}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900">{webhook.name}</h4>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  webhook.isActive
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {webhook.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{webhook.url}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {webhook.events.map((event) => (
                                <span
                                  key={event}
                                  className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded-full"
                                >
                                  {event}
                                </span>
                              ))}
                            </div>
                            {webhook.failureCount > 0 && (
                              <p className="text-xs text-red-600 mt-2">
                                {webhook.failureCount} recent failures
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteWebhook(webhook.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => {
                    setShowWebhooksModal(false);
                    setShowWebhookForm(false);
                    setSelectedKey(null);
                    setWebhooks([]);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
