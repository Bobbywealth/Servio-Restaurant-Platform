import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { 
  Plus,
  Search,
  Settings,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  MoreVertical,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react'

const DashboardLayout = dynamic(() => import('../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />
})

interface Integration {
  id: string
  name: string
  status: 'active' | 'inactive' | 'pending' | 'error'
  apiType: string
  referenceId?: string
  restaurantKey?: string
  masterKey?: string
  contactEmail?: string
  endpoint?: string
  protocol?: 'json' | 'xml' | 'rest' | 'webhook'
  protocolVersion?: string
  description?: string
  lastSync?: Date
  createdAt: Date
  updatedAt: Date
}

export default function IntegrationsPage() {
  const { user } = useUser()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadIntegrations = async () => {
      setIsLoading(true)
      try {
        const response = await api.get('/integrations', {
          params: { search: searchTerm }
        })
        setIntegrations(response.data.integrations || [])
      } catch (error) {
        console.error('Failed to load integrations:', error)
        setIntegrations([])
      } finally {
        setIsLoading(false)
      }
    }

    loadIntegrations()
  }, [searchTerm])

  const filteredIntegrations = integrations.filter(integration =>
    integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    integration.apiType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    integration.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleIntegrationStatus = async (id: string) => {
    try {
      const response = await api.post(`/integrations/${id}/toggle`)
      const updatedIntegration = response.data.integration

      setIntegrations(prev => prev.map(integration => 
        integration.id === id ? updatedIntegration : integration
      ))
    } catch (error) {
      console.error('Failed to toggle integration status:', error)
      // Optionally show an error message to the user
    }
  }

  const toggleApiKeyVisibility = (integrationId: string, field: string) => {
    const key = `${integrationId}-${field}`
    setShowApiKeys(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const copyToClipboard = async (text: string, integrationId: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      const key = `${integrationId}-${field}`
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'inactive':
        return <XCircle className="w-4 h-4 text-gray-400" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = (status: Integration['status']) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'inactive':
        return 'Inactive'
      case 'pending':
        return 'Pending'
      case 'error':
        return 'Error'
      default:
        return 'Unknown'
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const renderFieldValue = (integration: Integration, field: string, value: string) => {
    const key = `${integration.id}-${field}`
    const isVisible = showApiKeys[key]
    const isCopied = copiedKey === key
    const isSecret = field.toLowerCase().includes('key') || field.toLowerCase().includes('token') || field === 'referenceId'

    return (
      <div className="flex items-center space-x-2">
        <span className={`font-mono text-sm ${isSecret && !isVisible ? 'blur-sm select-none' : ''}`}>
          {isSecret && !isVisible ? '••••••••••••••••' : value}
        </span>
        {isSecret && (
          <button
            onClick={() => toggleApiKeyVisibility(integration.id, field)}
            className="text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300"
          >
            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        <button
          onClick={() => copyToClipboard(value, integration.id, field)}
          className="text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300"
        >
          {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
      <Head>
        <title>Integrations - Servio Restaurant Platform</title>
        <meta name="description" content="Manage API integrations and third-party services" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
                Your integrations
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Manage API connections and third-party services
              </p>
            </div>
            <motion.button
              className="btn-primary inline-flex items-center space-x-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4" />
              <span>Add integration</span>
            </motion.button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search integrations..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Integrations Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
                    <th className="text-left py-3 px-4 font-medium text-surface-900 dark:text-surface-100 text-sm">
                      STATUS
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-surface-900 dark:text-surface-100 text-sm">
                      NAME
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-surface-900 dark:text-surface-100 text-sm">
                      API TYPE
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-surface-900 dark:text-surface-100 text-sm">
                      DETAILS
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-surface-900 dark:text-surface-100 text-sm">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIntegrations.map((integration) => (
                    <tr 
                      key={integration.id} 
                      className="border-b border-surface-200 dark:border-surface-700 last:border-b-0 hover:bg-surface-50 dark:hover:bg-surface-800/30"
                    >
                      {/* Status Column */}
                      <td className="py-4 px-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={integration.status === 'active'}
                            onChange={() => toggleIntegrationStatus(integration.id)}
                          />
                          <div className={`w-11 h-6 rounded-full transition-colors ${
                            integration.status === 'active' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
                              integration.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                            } mt-1`} />
                          </div>
                        </label>
                      </td>

                      {/* Name Column */}
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {getStatusIcon(integration.status)}
                          </div>
                          <div>
                            <div className="font-medium text-surface-900 dark:text-surface-100">
                              {integration.name}
                            </div>
                            {integration.lastSync && (
                              <div className="text-xs text-surface-500 dark:text-surface-400">
                                Last sync: {formatDate(integration.lastSync)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* API Type Column */}
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-surface-900 dark:text-surface-100">
                            {integration.apiType}
                          </span>
                        </div>
                      </td>

                      {/* Details Column */}
                      <td className="py-4 px-4">
                        <div className="space-y-2 text-sm">
                          {integration.referenceId && (
                            <div>
                              <span className="text-surface-500 dark:text-surface-400 font-medium">Reference ID / Token:</span>
                              <div className="mt-1">
                                {renderFieldValue(integration, 'referenceId', integration.referenceId)}
                              </div>
                            </div>
                          )}
                          {integration.restaurantKey && (
                            <div>
                              <span className="text-surface-500 dark:text-surface-400 font-medium">Restaurant Key:</span>
                              <div className="mt-1 text-surface-900 dark:text-surface-100">
                                {integration.restaurantKey}
                              </div>
                            </div>
                          )}
                          {integration.masterKey && (
                            <div>
                              <span className="text-surface-500 dark:text-surface-400 font-medium">Master Key:</span>
                              <div className="mt-1">
                                {renderFieldValue(integration, 'masterKey', integration.masterKey)}
                              </div>
                            </div>
                          )}
                          {integration.contactEmail && (
                            <div>
                              <span className="text-surface-500 dark:text-surface-400 font-medium">Contact email:</span>
                              <div className="mt-1 text-surface-900 dark:text-surface-100">
                                {integration.contactEmail}
                              </div>
                            </div>
                          )}
                          {integration.endpoint && (
                            <div>
                              <span className="text-surface-500 dark:text-surface-400 font-medium">Endpoint:</span>
                              <div className="mt-1 text-surface-900 dark:text-surface-100 font-mono text-xs break-all">
                                {integration.endpoint}
                              </div>
                            </div>
                          )}
                          {integration.protocol && (
                            <div className="flex items-center space-x-4">
                              <div>
                                <span className="text-surface-500 dark:text-surface-400 font-medium">Protocol:</span>
                                <span className="ml-1 text-surface-900 dark:text-surface-100">
                                  {integration.protocol}
                                </span>
                              </div>
                              {integration.protocolVersion && (
                                <div>
                                  <span className="text-surface-500 dark:text-surface-400 font-medium">Protocol version:</span>
                                  <span className="ml-1 text-surface-900 dark:text-surface-100">
                                    {integration.protocolVersion}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            className="p-2 text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Empty State */}
            {filteredIntegrations.length === 0 && (
              <div className="text-center py-12">
                <Wifi className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                  {searchTerm ? 'No integrations found' : 'No integrations configured'}
                </h3>
                <p className="text-surface-500 dark:text-surface-400 mb-6">
                  {searchTerm 
                    ? 'Try adjusting your search terms.'
                    : 'Get started by adding your first integration.'
                  }
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary inline-flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add integration</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-surface-500 dark:text-surface-400">
              Showing {filteredIntegrations.length} integration{filteredIntegrations.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-surface-500 dark:text-surface-400">
                20 per page
              </span>
              <div className="flex items-center space-x-1">
                <button className="p-2 text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300">
                  <span>1</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add Integration Modal - Placeholder */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-xl p-6 max-w-md w-full mx-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
                Add Integration
              </h3>
              <p className="text-surface-600 dark:text-surface-400 mb-6">
                Integration setup functionality will be implemented here.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="btn-primary"
                >
                  Add Integration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </DashboardLayout>
    </>
  )
}