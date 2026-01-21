import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/utils'
import { 
  Settings as SettingsIcon, 
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Database,
  Wifi,
  Save,
  AlertCircle,
  Check,
  LogOut,
  UserCog,
  Mail,
  Calendar,
  Phone,
  Printer,
  PhoneCall
} from 'lucide-react'

const DashboardLayout = dynamic(() => import('../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />
})

export default function SettingsPage() {
  const { user, logout, availableAccounts, switchAccount, isAdmin } = useUser()
  const [activeTab, setActiveTab] = useState('account')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [settings, setSettings] = useState({
    // General Settings
    restaurantName: 'Sasheyskitchen',
    timeZone: 'America/New_York',
    currency: 'USD',
    language: 'English',
    
    // Notifications
    orderNotifications: true,
    inventoryAlerts: true,
    staffNotifications: false,
    emailNotifications: true,
    
    // Security
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordRequirement: 'strong',
    
    // Display
    theme: 'auto',
    compactMode: false,
    animations: true,
    
    // Integration
    posIntegration: false,
    paymentProvider: 'stripe',
    deliveryPartners: ['ubereats', 'doordash']
  })

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // Vapi Phone System State
  const [vapiSettings, setVapiSettings] = useState<any>(null)
  const [isLoadingVapi, setIsLoadingVapi] = useState(false)
  const [isSavingVapi, setIsSavingVapi] = useState(false)
  const [isTestingVapi, setIsTestingVapi] = useState(false)
  const [vapiTestResult, setVapiTestResult] = useState<any>(null)
  const [vapiFormData, setVapiFormData] = useState({
    enabled: false,
    apiKey: '',
    webhookSecret: '',
    assistantId: '',
    phoneNumberId: '',
    phoneNumber: ''
  })

  type ReceiptSettings = {
    paperSize: '80mm' | '58mm'
    headerTitle: string
    headerSubtitle: string
    showLogo: boolean
    showOrderId: boolean
    showPlacedAt: boolean
    showCustomerName: boolean
    showCustomerPhone: boolean
    showChannel: boolean
    footerText: string
    printMode?: 'browser' | 'agent' | 'bluetooth'
    agentUrl?: string
    agentPrinter?: null | { name?: string; host: string; port?: number; type?: string }
  }

  const [receiptMeta, setReceiptMeta] = useState<any>(null)
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false)
  const [isSavingReceipt, setIsSavingReceipt] = useState(false)
  const [agentPrinters, setAgentPrinters] = useState<Array<any>>([])
  const [isScanningAgent, setIsScanningAgent] = useState(false)
  const [receiptFormData, setReceiptFormData] = useState<ReceiptSettings>({
    paperSize: '80mm',
    headerTitle: '',
    headerSubtitle: 'Online Order',
    showLogo: true,
    showOrderId: true,
    showPlacedAt: true,
    showCustomerName: true,
    showCustomerPhone: true,
    showChannel: true,
    footerText: 'Thank you!',
    printMode: 'browser',
    agentUrl: 'http://localhost:8787',
    agentPrinter: null
  })

  // Alert Settings State
  const [alertSettings, setAlertSettings] = useState<any>(null)
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false)
  const [isSavingAlerts, setIsSavingAlerts] = useState(false)
  const [isTestingAlert, setIsTestingAlert] = useState(false)
  const [alertTestResult, setAlertTestResult] = useState<any>(null)
  const [alertFormData, setAlertFormData] = useState({
    enabled: false,
    supervisorPhone: '',
    failureThresholdMinutes: 5,
    retryAttempts: 3,
    enabledForOrderFailures: true,
    enabledForSystemDown: true
  })

  // Menu Settings (public menu link + heading)
  const [isLoadingMenu, setIsLoadingMenu] = useState(false)
  const [isSavingMenu, setIsSavingMenu] = useState(false)
  const [menuRestaurantSlug, setMenuRestaurantSlug] = useState<string>('')
  const [menuFormData, setMenuFormData] = useState<{ heading: string; subheading: string; showLogo: boolean }>({
    heading: '',
    subheading: '',
    showLogo: true
  })

  useEffect(() => {
    if (activeTab === 'menu' && user?.restaurantId) {
      loadMenuSettings()
    }
  }, [activeTab, user?.restaurantId])

  // Load Vapi settings when phone tab is active
  useEffect(() => {
    if (activeTab === 'phone' && user?.restaurantId) {
      loadVapiSettings()
    }
  }, [activeTab, user?.restaurantId])

  // Load receipt settings when printing tab is active
  useEffect(() => {
    if (activeTab === 'printing' && user?.restaurantId) {
      loadReceiptSettings()
    }
  }, [activeTab, user?.restaurantId])

  // Load alert settings when alerts tab is active
  useEffect(() => {
    if (activeTab === 'alerts' && user?.restaurantId) {
      loadAlertSettings()
    }
  }, [activeTab, user?.restaurantId])

  const loadMenuSettings = async () => {
    if (!user?.restaurantId) return
    setIsLoadingMenu(true)
    try {
      const [settingsResp, profileResp] = await Promise.all([
        api.get(`/api/restaurants/${user.restaurantId}/menu-settings`),
        api.get('/api/restaurant/profile')
      ])
      const data = settingsResp.data?.data
      const profile = profileResp.data?.data
      if (profile?.slug) setMenuRestaurantSlug(String(profile.slug))
      if (data) {
        setMenuFormData({
          heading: data.heading || '',
          subheading: data.subheading || '',
          showLogo: data.showLogo !== false
        })
      }
    } catch (err: any) {
      console.error('Failed to load menu settings:', err)
    } finally {
      setIsLoadingMenu(false)
    }
  }

  const saveMenuSettings = async () => {
    if (!user?.restaurantId) return
    setIsSavingMenu(true)
    try {
      await api.put(`/api/restaurants/${user.restaurantId}/menu-settings`, menuFormData)
      alert('Menu settings saved successfully!')
      await loadMenuSettings()
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to save menu settings'))
    } finally {
      setIsSavingMenu(false)
    }
  }

  const loadVapiSettings = async () => {
    if (!user?.restaurantId) return
    
    setIsLoadingVapi(true)
    try {
      const response = await api.get(`/api/restaurants/${user.restaurantId}/vapi`)
      setVapiSettings(response.data)
      setVapiFormData({
        enabled: response.data.enabled || false,
        apiKey: '',  // Don't pre-fill sensitive data
        webhookSecret: '',
        assistantId: response.data.assistantId || '',
        phoneNumberId: response.data.phoneNumberId || '',
        phoneNumber: response.data.phoneNumber || ''
      })
    } catch (err: any) {
      console.error('Failed to load Vapi settings:', err)
    } finally {
      setIsLoadingVapi(false)
    }
  }

  const saveVapiSettings = async () => {
    if (!user?.restaurantId) return
    
    setIsSavingVapi(true)
    try {
      await api.put(`/api/restaurants/${user.restaurantId}/vapi`, vapiFormData)
      alert('Phone system settings saved successfully!')
      await loadVapiSettings()
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to save settings'))
    } finally {
      setIsSavingVapi(false)
    }
  }

  const loadReceiptSettings = async () => {
    if (!user?.restaurantId) return
    setIsLoadingReceipt(true)
    try {
      const resp = await api.get(`/api/restaurants/${user.restaurantId}/receipt`)
      const data = resp.data?.data
      setReceiptMeta(data?.restaurant || null)
      if (data?.receipt) {
        setReceiptFormData((prev) => ({ ...prev, ...data.receipt }))
      }
    } catch (err: any) {
      console.error('Failed to load receipt settings:', err)
    } finally {
      setIsLoadingReceipt(false)
    }
  }

  const saveReceiptSettings = async () => {
    if (!user?.restaurantId) return
    setIsSavingReceipt(true)
    try {
      await api.put(`/api/restaurants/${user.restaurantId}/receipt`, receiptFormData)
      alert('Receipt / printing settings saved successfully!')
      await loadReceiptSettings()
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to save receipt settings'))
    } finally {
      setIsSavingReceipt(false)
    }
  }

  const loadAlertSettings = async () => {
    if (!user?.restaurantId) return
    setIsLoadingAlerts(true)
    try {
      const resp = await api.get(`/api/restaurants/${user.restaurantId}/alert-settings`)
      const data = resp.data?.data
      setAlertSettings(data)
      if (data) {
        setAlertFormData(prev => ({ ...prev, ...data }))
      }
    } catch (err: any) {
      console.error('Failed to load alert settings:', err)
    } finally {
      setIsLoadingAlerts(false)
    }
  }

  const saveAlertSettings = async () => {
    if (!user?.restaurantId) return
    setIsSavingAlerts(true)
    try {
      await api.put(`/api/restaurants/${user.restaurantId}/alert-settings`, alertFormData)
      alert('Alert call settings saved successfully!')
      await loadAlertSettings()
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to save alert settings'))
    } finally {
      setIsSavingAlerts(false)
    }
  }

  const testAlertCall = async () => {
    if (!user?.restaurantId) return
    setIsTestingAlert(true)
    setAlertTestResult(null)
    try {
      const response = await api.post(`/api/restaurants/${user.restaurantId}/test-alert-call`)
      setAlertTestResult({ success: true, data: response.data })
    } catch (err: any) {
      setAlertTestResult({ success: false, error: getErrorMessage(err, 'Test alert call failed') })
    } finally {
      setIsTestingAlert(false)
    }
  }

  const scanAgentPrinters = async () => {
    const url = (receiptFormData.agentUrl || 'http://localhost:8787').replace(/\/+$/, '')
    setIsScanningAgent(true)
    try {
      const resp = await fetch(`${url}/printers`)
      const data = await resp.json()
      const printers = data?.data?.printers || []
      setAgentPrinters(printers)
      if (printers.length === 0) {
        alert('No printers discovered. Make sure the print agent is running on the tablet computer.')
      }
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to reach print agent. Is it running at the URL above?'))
    } finally {
      setIsScanningAgent(false)
    }
  }

  const testAgentPrint = async () => {
    if (receiptFormData.printMode !== 'agent') {
      alert('Switch to "LAN (Print Agent)" mode to test printing.')
      return
    }
    if (!receiptFormData.agentUrl || !receiptFormData.agentPrinter?.host) {
      alert('Select a print agent URL and printer before testing.')
      return
    }
    setIsSavingReceipt(true)
    try {
      const url = (receiptFormData.agentUrl || 'http://localhost:8787').replace(/\/+$/, '')
      const resp = await fetch(`${url}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printer: receiptFormData.agentPrinter,
          text: [
            'SERVIO TEST PRINT',
            '------------------------------',
            `Restaurant: ${receiptMeta?.name || user?.name || 'Servio'}`,
            `Time: ${new Date().toLocaleString()}`,
            '',
            'If this printed, the agent is working.',
            ''
          ].join('\n')
        })
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || data?.success === false) {
        throw new Error(data?.error?.message || 'Print agent test failed')
      }
      alert('Test print sent successfully!')
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to send test print.'))
    } finally {
      setIsSavingReceipt(false)
    }
  }

  const testVapiConnection = async () => {
    if (!user?.restaurantId) return
    
    setIsTestingVapi(true)
    setVapiTestResult(null)
    try {
      const response = await api.post(`/api/restaurants/${user.restaurantId}/vapi/test`)
      setVapiTestResult({ success: true, data: response.data })
    } catch (err: any) {
      setVapiTestResult({ success: false, error: getErrorMessage(err, 'Connection test failed') })
    } finally {
      setIsTestingVapi(false)
    }
  }

  const tabs = [
    { id: 'account', name: 'Account', icon: User },
    { id: 'general', name: 'General', icon: SettingsIcon },
    { id: 'menu', name: 'Menu Page', icon: Globe },
    { id: 'phone', name: 'Phone System', icon: Phone },
    { id: 'printing', name: 'Receipt / Printing', icon: Printer },
    { id: 'alerts', name: 'Alert Calls', icon: PhoneCall },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'display', name: 'Display', icon: Palette },
    { id: 'integrations', name: 'Integrations', icon: Wifi }
  ]

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      logout()
      // Redirect will happen automatically due to auth state change
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <div className="space-y-6">
            {/* User Profile Section */}
            <div className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-xl p-6 border border-primary-200 dark:border-primary-800">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-surface-900 dark:text-surface-100">
                    {user?.name || 'User'}
                  </h3>
                  <p className="text-surface-600 dark:text-surface-400 flex items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span className="font-mono text-sm">{user?.email || 'No email'}</span>
                  </p>
                  <div className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    Logged in as: <span className="font-semibold text-blue-600 dark:text-blue-400">{user?.email}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user?.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                      user?.role === 'owner' ? 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-300' :
                      user?.role === 'manager' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                    }`}>
                      {user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                Account Actions
              </h4>
              
              {/* Account Switching */}
              {isAdmin && Object.keys(availableAccounts).length > 0 && (
                <div className="border border-surface-200 dark:border-surface-700 rounded-xl p-4">
                  <h5 className="font-medium text-surface-900 dark:text-surface-100 mb-3 flex items-center space-x-2">
                    <UserCog className="w-4 h-4" />
                    <span>Switch Account</span>
                  </h5>
                  <div className="space-y-2">
                    {Object.entries(availableAccounts).map(([restaurant, accounts]) => (
                      <div key={restaurant}>
                        <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">{restaurant}</p>
                        <div className="grid grid-cols-1 gap-2">
                          {accounts.map((account) => (
                            <button
                              key={account.id}
                              onClick={() => switchAccount(account.email)}
                              className={`text-left p-2 rounded-lg border transition-colors ${
                                user?.email === account.email
                                  ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                                  : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-800/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm text-surface-900 dark:text-surface-100">
                                    {account.name}
                                  </p>
                                  <p className="text-xs text-surface-600 dark:text-surface-400">
                                    {account.email} • {account.role}
                                  </p>
                                </div>
                                {user?.email === account.email && (
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Logout Section */}
              <div className="border border-servio-red-200 dark:border-servio-red-800 rounded-xl p-4 bg-servio-red-50/50 dark:bg-servio-red-900/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-surface-900 dark:text-surface-100 mb-2 flex items-center space-x-2">
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </h5>
                    <p className="text-sm text-surface-600 dark:text-surface-400 mb-4">
                      {"This will log you out of your account and return you to the login page. Make sure you've saved any important work."}
                    </p>
                    <motion.button
                      className="btn-danger inline-flex items-center space-x-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                    >
                      {isLoggingOut ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      <span>
                        {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
                      </span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                Restaurant Name
              </label>
              <input
                type="text"
                className="input-field"
                value={settings.restaurantName}
                onChange={(e) => handleSettingChange('restaurantName', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                  Time Zone
                </label>
                <select
                  className="input-field"
                  value={settings.timeZone}
                  onChange={(e) => handleSettingChange('timeZone', e.target.value)}
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                  Currency
                </label>
                <select
                  className="input-field"
                  value={settings.currency}
                  onChange={(e) => handleSettingChange('currency', e.target.value)}
                >
                  <option value="USD">USD ($)</option>
                  <option value="CAD">CAD (C$)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-6">
            {[
              { key: 'orderNotifications', label: 'Order Notifications', description: 'Get notified when new orders come in' },
              { key: 'inventoryAlerts', label: 'Inventory Alerts', description: 'Alerts when items are running low' },
              { key: 'staffNotifications', label: 'Staff Notifications', description: 'Notifications about staff schedules and updates' },
              { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive important updates via email' }
            ].map((item) => (
              <div key={item.key} className="flex items-start justify-between py-4 border-b border-surface-200 dark:border-surface-700 last:border-b-0">
                <div>
                  <h4 className="font-medium text-surface-900 dark:text-surface-100">{item.label}</h4>
                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{item.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    onChange={(e) => handleSettingChange(item.key, e.target.checked)}
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors ${
                    settings[item.key as keyof typeof settings] ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
                      settings[item.key as keyof typeof settings] ? 'translate-x-6' : 'translate-x-1'
                    } mt-1`} />
                  </div>
                </label>
              </div>
            ))}
          </div>
        )

      case 'security':
        return (
          <div className="space-y-6">
            <div className="flex items-start justify-between py-4 border-b border-surface-200 dark:border-surface-700">
              <div>
                <h4 className="font-medium text-surface-900 dark:text-surface-100">Two-Factor Authentication</h4>
                <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">Add an extra layer of security to your account</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={settings.twoFactorAuth}
                  onChange={(e) => handleSettingChange('twoFactorAuth', e.target.checked)}
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  settings.twoFactorAuth ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.twoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                  } mt-1`} />
                </div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                Session Timeout (minutes)
              </label>
              <select
                className="input-field"
                value={settings.sessionTimeout}
                onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>
        )

      case 'display':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                Theme
              </label>
              <select
                className="input-field"
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
              >
                <option value="auto">Auto (System)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div className="flex items-start justify-between py-4 border-b border-surface-200 dark:border-surface-700">
              <div>
                <h4 className="font-medium text-surface-900 dark:text-surface-100">Compact Mode</h4>
                <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">Reduce spacing and padding for more content</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={settings.compactMode}
                  onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  settings.compactMode ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.compactMode ? 'translate-x-6' : 'translate-x-1'
                  } mt-1`} />
                </div>
              </label>
            </div>
            <div className="flex items-start justify-between py-4">
              <div>
                <h4 className="font-medium text-surface-900 dark:text-surface-100">Animations</h4>
                <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">Enable smooth transitions and animations</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={settings.animations}
                  onChange={(e) => handleSettingChange('animations', e.target.checked)}
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  settings.animations ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.animations ? 'translate-x-6' : 'translate-x-1'
                  } mt-1`} />
                </div>
              </label>
            </div>
          </div>
        )

      case 'menu':
        if (isLoadingMenu) {
          return <div className="text-center py-8">Loading menu settings...</div>
        }

        const menuUrl =
          typeof window !== 'undefined' && menuRestaurantSlug
            ? `${window.location.origin}/r/${menuRestaurantSlug}`
            : ''

        return (
          <div className="space-y-6">
            <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700">
              <h3 className="text-sm font-medium text-surface-900 dark:text-surface-100 mb-1">Public Menu URL</h3>
              <p className="text-xs text-surface-600 dark:text-surface-400">
                Share this link with customers to view your menu and place orders.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input className="input-field font-mono" value={menuUrl} readOnly />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (!menuUrl) return
                    navigator.clipboard.writeText(menuUrl)
                    alert('Menu URL copied!')
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                  Menu Heading
                </label>
                <input
                  className="input-field"
                  value={menuFormData.heading}
                  onChange={(e) => setMenuFormData({ ...menuFormData, heading: e.target.value })}
                  placeholder="Leave blank to use restaurant name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                  Menu Subheading
                </label>
                <input
                  className="input-field"
                  value={menuFormData.subheading}
                  onChange={(e) => setMenuFormData({ ...menuFormData, subheading: e.target.value })}
                  placeholder="e.g. Authentic Jamaican • Union, NJ"
                />
              </div>

              <label className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={menuFormData.showLogo}
                  onChange={(e) => setMenuFormData({ ...menuFormData, showLogo: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-surface-800 dark:text-surface-200 font-medium">Show restaurant logo</span>
              </label>

              <div className="pt-2">
                <motion.button
                  onClick={saveMenuSettings}
                  disabled={isSavingMenu}
                  className="btn-primary inline-flex items-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSavingMenu ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isSavingMenu ? 'Saving...' : 'Save Menu Settings'}</span>
                </motion.button>
              </div>
            </div>
          </div>
        )

      case 'phone':
        if (isLoadingVapi) {
          return <div className="text-center py-8">Loading phone system settings...</div>
        }
        
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start">
                <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    Phone System (Vapi) - Answer Customer Calls Automatically
                  </h3>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Configure Vapi to handle incoming phone calls from customers who want to place orders. This is separate from the in-app AI Assistant.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={vapiFormData.enabled}
                  onChange={(e) => setVapiFormData({ ...vapiFormData, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium text-surface-900 dark:text-surface-100">
                  Enable Phone System
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Vapi API Key {vapiSettings?.hasApiKey && <span className="text-green-600">(Configured ✓)</span>}
                </label>
                <input
                  type="password"
                  value={vapiFormData.apiKey}
                  onChange={(e) => setVapiFormData({ ...vapiFormData, apiKey: e.target.value })}
                  placeholder={vapiSettings?.hasApiKey ? '••••••••••••' : 'Enter your Vapi API key'}
                  className="input-field"
                />
                <p className="text-xs text-surface-500 mt-1">
                  Get this from <a href="https://vapi.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">vapi.ai</a> dashboard
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={vapiFormData.phoneNumberId}
                  onChange={(e) => setVapiFormData({ ...vapiFormData, phoneNumberId: e.target.value })}
                  placeholder="e.g., 12345678-1234-1234-1234-123456789012"
                  className="input-field"
                />
                <p className="text-xs text-surface-500 mt-1">
                  The Vapi phone number ID from your dashboard
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Phone Number (Display)
                </label>
                <input
                  type="text"
                  value={vapiFormData.phoneNumber}
                  onChange={(e) => setVapiFormData({ ...vapiFormData, phoneNumber: e.target.value })}
                  placeholder="e.g., +1 (555) 123-4567"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Assistant ID (Optional)
                </label>
                <input
                  type="text"
                  value={vapiFormData.assistantId}
                  onChange={(e) => setVapiFormData({ ...vapiFormData, assistantId: e.target.value })}
                  placeholder="Optional - Vapi assistant ID"
                  className="input-field"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <motion.button
                  onClick={saveVapiSettings}
                  disabled={isSavingVapi}
                  className="btn-primary inline-flex items-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSavingVapi ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isSavingVapi ? 'Saving...' : 'Save Settings'}</span>
                </motion.button>
                
                <motion.button
                  onClick={testVapiConnection}
                  disabled={isTestingVapi || !vapiFormData.enabled || !vapiSettings?.hasApiKey}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 inline-flex items-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isTestingVapi ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{isTestingVapi ? 'Testing...' : 'Test Connection'}</span>
                </motion.button>
              </div>

              {vapiTestResult && (
                <div className={`p-4 rounded-lg ${vapiTestResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className={`text-sm ${vapiTestResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    {vapiTestResult.success ? '✓ Connection successful!' : '✗ ' + vapiTestResult.error}
                  </div>
                  {vapiTestResult.data && (
                    <div className="text-xs text-surface-600 dark:text-surface-400 mt-2">
                      Phone: {vapiTestResult.data.phoneNumber}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700">
              <h3 className="text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">Setup Instructions</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-surface-600 dark:text-surface-400">
                <li>Sign up at <a href="https://vapi.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">vapi.ai</a></li>
                <li>Purchase a phone number ($2/month)</li>
                <li>Create an assistant in the Vapi dashboard</li>
                <li>Copy your API key and phone number ID here</li>
                <li>Configure webhook URL in Vapi: <code className="text-xs bg-surface-200 dark:bg-surface-900 px-2 py-1 rounded">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/vapi/webhook</code></li>
                <li>Enable the phone system and test!</li>
              </ol>
            </div>
          </div>
        )
      
      case 'printing':
        if (isLoadingReceipt) {
          return <div className="text-center py-8">Loading receipt / printing settings...</div>
        }

        const previewWidth = receiptFormData.paperSize === '58mm' ? 240 : 320
        const restaurantName = receiptMeta?.name || 'Restaurant'
        const logoUrl = receiptMeta?.logoUrl as string | null | undefined
        const sample = {
          id: 'order_123',
          externalId: 'WEB-1001',
          status: 'received',
          createdAt: new Date().toISOString(),
          customerName: 'Jane Doe',
          customerPhone: '+1 (555) 123-4567',
          channel: 'website',
          totalAmount: 29.97,
          items: [
            { quantity: 1, name: 'Jerk Chicken Plate', notes: '' },
            { quantity: 2, name: 'Patties', notes: 'Extra spicy' }
          ]
        }

        return (
          <div className="space-y-6">
            <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700">
              <h3 className="text-sm font-medium text-surface-900 dark:text-surface-100 mb-1">Receipt / Ticket Layout</h3>
              <p className="text-xs text-surface-600 dark:text-surface-400">
                Customize what prints when you tap “Print” on the tablet orders screen.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-2">Printer Connection</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className={`p-3 rounded-xl border cursor-pointer ${
                      receiptFormData.printMode === 'browser'
                        ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                        : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800/50'
                    }`}>
                      <input
                        type="radio"
                        className="mr-2"
                        name="printMode"
                        checked={receiptFormData.printMode === 'browser'}
                        onChange={() => setReceiptFormData({ ...receiptFormData, printMode: 'browser' })}
                      />
                      <span className="text-sm font-medium">Browser / AirPrint</span>
                      <div className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                        Best for iPad (AirPrint).
                      </div>
                    </label>
                    <label className={`p-3 rounded-xl border cursor-pointer ${
                      receiptFormData.printMode === 'agent'
                        ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                        : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800/50'
                    }`}>
                      <input
                        type="radio"
                        className="mr-2"
                        name="printMode"
                        checked={receiptFormData.printMode === 'agent'}
                        onChange={() => setReceiptFormData({ ...receiptFormData, printMode: 'agent' })}
                      />
                      <span className="text-sm font-medium">LAN (Print Agent)</span>
                      <div className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                        Discovers nearby LAN printers.
                      </div>
                    </label>
                    <label className={`p-3 rounded-xl border cursor-pointer ${
                      receiptFormData.printMode === 'bluetooth'
                        ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                        : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800/50'
                    }`}>
                      <input
                        type="radio"
                        className="mr-2"
                        name="printMode"
                        checked={receiptFormData.printMode === 'bluetooth'}
                        onChange={() => setReceiptFormData({ ...receiptFormData, printMode: 'bluetooth' })}
                      />
                      <span className="text-sm font-medium">Bluetooth</span>
                      <div className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                        Android/Chrome only.
                      </div>
                    </label>
                  </div>

                  {receiptFormData.printMode === 'agent' && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                          Print Agent URL
                        </label>
                        <input
                          className="input-field"
                          value={receiptFormData.agentUrl || ''}
                          onChange={(e) => setReceiptFormData({ ...receiptFormData, agentUrl: e.target.value })}
                          placeholder="http://localhost:8787"
                        />
                        <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                          Run the agent from `print-agent/` on the tablet computer.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={scanAgentPrinters}
                          disabled={isScanningAgent}
                        >
                          {isScanningAgent ? 'Scanning…' : 'Find Nearby Printers'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={testAgentPrint}
                          disabled={isSavingReceipt || !receiptFormData.agentPrinter}
                        >
                          Test Print
                        </button>
                        {receiptFormData.agentPrinter ? (
                          <div className="text-sm text-surface-700 dark:text-surface-300">
                            Selected: <span className="font-semibold">{receiptFormData.agentPrinter.name || receiptFormData.agentPrinter.host}</span>
                          </div>
                        ) : (
                          <div className="text-sm text-surface-500 dark:text-surface-400">
                            No printer selected
                          </div>
                        )}
                      </div>

                      {agentPrinters.length > 0 && (
                        <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden">
                          <div className="px-4 py-2 bg-surface-50 dark:bg-surface-800 text-sm font-semibold text-surface-800 dark:text-surface-200">
                            Discovered printers
                          </div>
                          <div className="max-h-56 overflow-auto">
                            {agentPrinters.map((p: any, idx: number) => (
                              <button
                                key={`${p.host}:${p.port}:${idx}`}
                                type="button"
                                className="w-full text-left px-4 py-3 border-t border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800/50"
                                onClick={() =>
                                  setReceiptFormData({
                                    ...receiptFormData,
                                    agentPrinter: { name: p.name, host: p.host, port: p.port, type: p.type }
                                  })
                                }
                              >
                                <div className="font-medium text-surface-900 dark:text-surface-100">
                                  {p.name || 'Printer'} <span className="text-xs text-surface-500">({p.type})</span>
                                </div>
                                <div className="text-xs text-surface-600 dark:text-surface-400">
                                  {p.host}:{p.port}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {receiptFormData.printMode === 'bluetooth' && (
                    <div className="mt-4 text-xs text-surface-600 dark:text-surface-400">
                      Bluetooth printer discovery/printing works only on supported browsers (usually Android Chrome).
                      On iPad/iOS, use Browser/AirPrint or LAN Print Agent.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                      Paper Size
                    </label>
                    <select
                      className="input-field"
                      value={receiptFormData.paperSize}
                      onChange={(e) => setReceiptFormData({ ...receiptFormData, paperSize: e.target.value as any })}
                    >
                      <option value="80mm">80mm (standard)</option>
                      <option value="58mm">58mm (compact)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                      Header Title
                    </label>
                    <input
                      className="input-field"
                      value={receiptFormData.headerTitle}
                      onChange={(e) => setReceiptFormData({ ...receiptFormData, headerTitle: e.target.value })}
                      placeholder={restaurantName}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                    Header Subtitle
                  </label>
                  <input
                    className="input-field"
                    value={receiptFormData.headerSubtitle}
                    onChange={(e) => setReceiptFormData({ ...receiptFormData, headerSubtitle: e.target.value })}
                    placeholder="Online Order"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'showLogo', label: 'Show Logo' },
                    { key: 'showOrderId', label: 'Show Order ID' },
                    { key: 'showPlacedAt', label: 'Show Placed Time' },
                    { key: 'showCustomerName', label: 'Show Customer Name' },
                    { key: 'showCustomerPhone', label: 'Show Customer Phone' },
                    { key: 'showChannel', label: 'Show Channel' }
                  ].map((t) => (
                    <label key={t.key} className="flex items-center gap-3 py-2">
                      <input
                        type="checkbox"
                        checked={(receiptFormData as any)[t.key]}
                        onChange={(e) => setReceiptFormData({ ...receiptFormData, [t.key]: e.target.checked } as any)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-surface-800 dark:text-surface-200 font-medium">{t.label}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                    Footer Text
                  </label>
                  <input
                    className="input-field"
                    value={receiptFormData.footerText}
                    onChange={(e) => setReceiptFormData({ ...receiptFormData, footerText: e.target.value })}
                    placeholder="Thank you!"
                  />
                </div>

                <div className="pt-2">
                  <motion.button
                    onClick={saveReceiptSettings}
                    disabled={isSavingReceipt}
                    className="btn-primary inline-flex items-center space-x-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isSavingReceipt ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{isSavingReceipt ? 'Saving...' : 'Save Receipt Settings'}</span>
                  </motion.button>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3">Live Preview</div>
                <div className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl p-4 overflow-auto">
                  <div
                    className="bg-white text-black rounded-lg shadow-sm mx-auto"
                    style={{ width: previewWidth, padding: 10, fontFamily: 'ui-sans-serif, system-ui' }}
                  >
                    <div style={{ borderBottom: '1px dashed #111', paddingBottom: 8, marginBottom: 8 }}>
                      {receiptFormData.showLogo && logoUrl ? (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                          <img src={logoUrl} alt="Logo" style={{ maxHeight: 48, maxWidth: '100%', objectFit: 'contain' }} />
                        </div>
                      ) : null}
                      <div style={{ fontSize: 16, fontWeight: 800, textAlign: 'center' }}>
                        {(receiptFormData.headerTitle || restaurantName) as any}
                      </div>
                      {receiptFormData.headerSubtitle ? (
                        <div style={{ fontSize: 12, textAlign: 'center', marginTop: 2 }}>{receiptFormData.headerSubtitle}</div>
                      ) : null}
                      <div style={{ fontSize: 12, marginTop: 6 }}>
                        {receiptFormData.showOrderId ? <div>Order: {sample.externalId}</div> : null}
                        <div>Status: {sample.status}</div>
                        {receiptFormData.showPlacedAt ? <div>Placed: {new Date(sample.createdAt).toLocaleString()}</div> : null}
                        {receiptFormData.showCustomerName ? <div>Customer: {sample.customerName}</div> : null}
                        {receiptFormData.showCustomerPhone ? <div>Phone: {sample.customerPhone}</div> : null}
                        {receiptFormData.showChannel ? <div>Channel: {sample.channel}</div> : null}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Items
                      </div>
                      <div style={{ marginTop: 6 }}>
                        {sample.items.map((it: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', gap: 10, margin: '8px 0' }}>
                            <div style={{ width: 36, fontWeight: 800 }}>{it.quantity}x</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700 }}>{it.name}</div>
                              {it.notes ? <div style={{ fontSize: 12, color: '#333' }}>{it.notes}</div> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ borderTop: '1px dashed #111', marginTop: 10, paddingTop: 8, fontSize: 12 }}>
                      Total: <strong>${Number(sample.totalAmount).toFixed(2)}</strong>
                      {receiptFormData.footerText ? (
                        <div style={{ marginTop: 6, textAlign: 'center' }}>{receiptFormData.footerText}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'alerts':
        if (isLoadingAlerts) {
          return <div className="text-center py-8">Loading alert call settings...</div>
        }
        
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start">
                <PhoneCall className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-orange-900 dark:text-orange-300">
                    Automatic Alert Calls - Order Failure Protection
                  </h3>
                  <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                    Get an alert call when orders can&apos;t be pushed to your system in real-time. Requires Twilio phone system configuration.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={alertFormData.enabled}
                  onChange={(e) => setAlertFormData({ ...alertFormData, enabled: e.target.checked })}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <label className="ml-2 text-sm font-medium text-surface-900 dark:text-surface-100">
                  Enable Alert Calls
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Supervisor Phone Number *
                </label>
                <input
                  type="tel"
                  value={alertFormData.supervisorPhone}
                  onChange={(e) => setAlertFormData({ ...alertFormData, supervisorPhone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  className="input-field"
                />
                <p className="text-xs text-surface-500 mt-1">
                  Phone number to call when critical issues occur (include country code)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Failure Threshold (minutes)
                  </label>
                  <select
                    value={alertFormData.failureThresholdMinutes}
                    onChange={(e) => setAlertFormData({ ...alertFormData, failureThresholdMinutes: Number(e.target.value) })}
                    className="input-field"
                  >
                    <option value={3}>3 minutes</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                  </select>
                  <p className="text-xs text-surface-500 mt-1">
                    How long to wait before calling about order issues
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Retry Attempts
                  </label>
                  <select
                    value={alertFormData.retryAttempts}
                    onChange={(e) => setAlertFormData({ ...alertFormData, retryAttempts: Number(e.target.value) })}
                    className="input-field"
                  >
                    <option value={1}>1 attempt</option>
                    <option value={2}>2 attempts</option>
                    <option value={3}>3 attempts</option>
                    <option value={5}>5 attempts</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-surface-900 dark:text-surface-100">Alert Types</h4>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={alertFormData.enabledForOrderFailures}
                      onChange={(e) => setAlertFormData({ ...alertFormData, enabledForOrderFailures: e.target.checked })}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="ml-2 text-sm text-surface-700 dark:text-surface-300">Order Processing Failures</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={alertFormData.enabledForSystemDown}
                      onChange={(e) => setAlertFormData({ ...alertFormData, enabledForSystemDown: e.target.checked })}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="ml-2 text-sm text-surface-700 dark:text-surface-300">System Downtime</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <motion.button
                  onClick={saveAlertSettings}
                  disabled={isSavingAlerts}
                  className="btn-primary inline-flex items-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSavingAlerts ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isSavingAlerts ? 'Saving...' : 'Save Alert Settings'}</span>
                </motion.button>
                
                <motion.button
                  onClick={testAlertCall}
                  disabled={isTestingAlert || !alertFormData.enabled || !alertFormData.supervisorPhone}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 inline-flex items-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isTestingAlert ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PhoneCall className="w-4 h-4" />
                  )}
                  <span>{isTestingAlert ? 'Calling...' : 'Test Alert Call'}</span>
                </motion.button>
              </div>

              {alertTestResult && (
                <div className={`p-4 rounded-lg ${alertTestResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className={`text-sm ${alertTestResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    {alertTestResult.success ? '✓ Test alert call sent successfully!' : '✗ ' + alertTestResult.error}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700">
              <h3 className="text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">How Alert Calls Work</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-surface-600 dark:text-surface-400">
                <li>When an order fails to reach your system, Servio detects it</li>
                <li>After the failure threshold time, an automated call is made to the supervisor</li>
                <li>The call explains what happened and asks them to check the system</li>
                <li>Calls will retry based on your retry settings</li>
                <li>All alert calls are logged for your records</li>
              </ol>
            </div>
          </div>
        )
      
      case 'integrations':
        return (
          <div className="space-y-6">
            <div className="flex items-start justify-between py-4 border-b border-surface-200 dark:border-surface-700">
              <div>
                <h4 className="font-medium text-surface-900 dark:text-surface-100">POS Integration</h4>
                <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">Connect with your point-of-sale system</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={settings.posIntegration}
                  onChange={(e) => handleSettingChange('posIntegration', e.target.checked)}
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  settings.posIntegration ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.posIntegration ? 'translate-x-6' : 'translate-x-1'
                  } mt-1`} />
                </div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                Payment Provider
              </label>
              <select
                className="input-field"
                value={settings.paymentProvider}
                onChange={(e) => handleSettingChange('paymentProvider', e.target.value)}
              >
                <option value="stripe">Stripe</option>
                <option value="square">Square</option>
                <option value="paypal">PayPal</option>
                <option value="clover">Clover</option>
              </select>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      <Head>
        <title>Settings - Servio Restaurant Platform</title>
        <meta name="description" content="Configure system settings and preferences" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
                Settings
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Configure your restaurant platform preferences
              </p>
            </div>
            <motion.button
              className="btn-primary inline-flex items-center space-x-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : saveStatus === 'saved' ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
              </span>
            </motion.button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Settings Navigation */}
            <div className="lg:col-span-1">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-3 ${
                      activeTab === tab.id
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-200'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span>{tab.name}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Settings Content */}
            <div className="lg:col-span-3">
              <motion.div
                className="card"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                key={activeTab}
              >
                <div className="border-b border-surface-200 dark:border-surface-700 pb-4 mb-6">
                  <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-100 capitalize">
                    {activeTab} Settings
                  </h2>
                </div>
                {renderTabContent()}
              </motion.div>
            </div>
          </div>

          {/* Status Messages */}
          {saveStatus === 'error' && (
            <motion.div
              className="fixed bottom-4 right-4 bg-servio-red-50 dark:bg-servio-red-900/20 border border-servio-red-200 dark:border-servio-red-800 rounded-xl p-4 flex items-center space-x-3"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
            >
              <AlertCircle className="w-5 h-5 text-servio-red-600 dark:text-servio-red-400" />
              <span className="text-servio-red-700 dark:text-servio-red-300">
                Failed to save settings. Please try again.
              </span>
            </motion.div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}