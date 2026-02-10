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
  CreditCard,
  Wallet,
  DollarSign
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
    restaurantName: 'Servio Restaurant',
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

  // Payment Settings State
  const [paymentSettings, setPaymentSettings] = useState({
    onlinePaymentsEnabled: false,
    payAtPickupEnabled: true // Always enabled by default
  })
  const [isSavingPayments, setIsSavingPayments] = useState(false)

  // Printer Settings State
  const [printerSettings, setPrinterSettings] = useState({
    autoPrintEnabled: false,
    paperWidth: '80mm',
    printMode: 'system',
    numberOfCopies: 1,
    receiptHeaderText: '',
    receiptFooterText: '',
    fontSize: 'medium'  // small, medium, large, xlarge
  })
  const [isSavingPrinterSettings, setIsSavingPrinterSettings] = useState(false)
  const [isTestingPrinter, setIsTestingPrinter] = useState(false)
  const [printerSaveStatus, setPrinterSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Load Vapi settings when phone tab is active
  useEffect(() => {
    if (activeTab === 'phone' && user?.restaurantId) {
      loadVapiSettings()
    }
  }, [activeTab, user?.restaurantId])

  // Load Payment settings when payments tab is active
  useEffect(() => {
    if (activeTab === 'payments' && user?.restaurantId) {
      loadPaymentSettings()
    }
  }, [activeTab, user?.restaurantId])

  // Load Printer settings when printer tab is active
  useEffect(() => {
    if (activeTab === 'printing' && user?.restaurantId) {
      loadPrinterSettings()
    }
  }, [activeTab, user?.restaurantId])

  const loadPaymentSettings = async () => {
    if (!user?.restaurantId) return
    try {
      const response = await api.get('/api/restaurant/profile')
      const settings = response.data?.data?.settings || {}
      setPaymentSettings({
        onlinePaymentsEnabled: settings.online_payments_enabled || false,
        payAtPickupEnabled: true // Always enabled
      })
    } catch (err) {
      console.error('Failed to load payment settings:', err)
    }
  }

  const loadPrinterSettings = async () => {
    if (!user?.restaurantId) return
    try {
      const response = await api.get('/api/restaurant/profile')
      const settings = response.data?.data?.settings || {}
      setPrinterSettings({
        autoPrintEnabled: Boolean(settings.printer_auto_print_enabled),
        paperWidth: settings.printer_paper_width || '80mm',
        printMode: settings.printer_mode || 'system',
        numberOfCopies: settings.printer_number_of_copies || 1,
        receiptHeaderText: settings.printer_receipt_header_text || '',
        receiptFooterText: settings.printer_receipt_footer_text || '',
        fontSize: settings.printer_font_size || 'medium'
      })
    } catch (err) {
      console.error('Failed to load printer settings:', err)
    }
  }

  const savePaymentSettings = async () => {
    if (!user?.restaurantId) return
    setIsSavingPayments(true)
    try {
      await api.put('/api/restaurant/settings', {
        online_payments_enabled: paymentSettings.onlinePaymentsEnabled
      })
      alert('Payment settings saved!')
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to save payment settings'))
    } finally {
      setIsSavingPayments(false)
    }
  }

  const savePrinterSettings = async () => {
    if (!user?.restaurantId) return
    setIsSavingPrinterSettings(true)
    setPrinterSaveStatus('saving')
    try {
      await api.put('/api/restaurant/settings', {
        printer_auto_print_enabled: printerSettings.autoPrintEnabled,
        printer_paper_width: printerSettings.paperWidth,
        printer_mode: printerSettings.printMode,
        printer_number_of_copies: printerSettings.numberOfCopies,
        printer_receipt_header_text: printerSettings.receiptHeaderText,
        printer_receipt_footer_text: printerSettings.receiptFooterText,
        printer_font_size: printerSettings.fontSize
      })
      setPrinterSaveStatus('saved')
      setTimeout(() => setPrinterSaveStatus('idle'), 2000)
    } catch (err: any) {
      setPrinterSaveStatus('error')
      setTimeout(() => setPrinterSaveStatus('idle'), 3000)
      console.error(getErrorMessage(err, 'Failed to save printer settings'))
    } finally {
      setIsSavingPrinterSettings(false)
    }
  }

  const testPrinter = async () => {
    if (!user?.restaurantId) return
    setIsTestingPrinter(true)
    try {
      await api.post('/api/restaurant/printer-test')
      alert('Test print sent to tablet!')
    } catch (err: any) {
      alert(getErrorMessage(err, 'Failed to send test print'))
    } finally {
      setIsTestingPrinter(false)
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
    { id: 'payments', name: 'Payments', icon: CreditCard },
    { id: 'printing', name: 'Printing', icon: Printer },
    { id: 'phone', name: 'Phone System', icon: Phone },
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
                    <span>{user?.email || 'No email'}</span>
                  </p>
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

      case 'payments':
        return (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-green-900 dark:text-green-300">
                    Online Ordering Payment Options
                  </h3>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                    Configure how customers can pay for their orders when ordering from your public menu page.
                  </p>
                </div>
              </div>
            </div>

            {/* Pay at Pickup - Always enabled */}
            <div className="flex items-start justify-between py-4 border-b border-surface-200 dark:border-surface-700">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-surface-900 dark:text-surface-100">Pay at Pickup</h4>
                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                    Customers pay with cash or card when they arrive to pick up their order
                  </p>
                  <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium rounded-full">
                    Always Enabled
                  </span>
                </div>
              </div>
              <div className="flex items-center">
                <Check className="w-6 h-6 text-green-500" />
              </div>
            </div>

            {/* Online Payments - Toggleable */}
            <div className="flex items-start justify-between py-4 border-b border-surface-200 dark:border-surface-700">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-surface-900 dark:text-surface-100">Online Card Payments</h4>
                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                    Allow customers to pay securely with credit/debit cards during checkout
                  </p>
                  {!paymentSettings.onlinePaymentsEnabled && (
                    <span className="inline-block mt-2 px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium rounded-full">
                      Coming Soon - Stripe Integration
                    </span>
                  )}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={paymentSettings.onlinePaymentsEnabled}
                  onChange={(e) => setPaymentSettings(prev => ({ ...prev, onlinePaymentsEnabled: e.target.checked }))}
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  paymentSettings.onlinePaymentsEnabled ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
                    paymentSettings.onlinePaymentsEnabled ? 'translate-x-6' : 'translate-x-1'
                  } mt-1`} />
                </div>
              </label>
            </div>

            {paymentSettings.onlinePaymentsEnabled && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-amber-900 dark:text-amber-300">
                      Stripe Integration Required
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      To accept online payments, you'll need to connect your Stripe account. 
                      This feature is coming soon. For now, customers will see "Pay at Pickup" as the only option.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4">
              <motion.button
                onClick={savePaymentSettings}
                disabled={isSavingPayments}
                className="btn-primary inline-flex items-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSavingPayments ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSavingPayments ? 'Saving...' : 'Save Payment Settings'}</span>
              </motion.button>
            </div>
          </div>
        )

      case 'printing':
        return (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
              <div className="flex items-start">
                <Printer className="w-5 h-5 text-primary-600 dark:text-primary-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-primary-900 dark:text-primary-300">
                    Receipt Printing Configuration
                  </h3>
                  <p className="text-xs text-primary-700 dark:text-primary-400 mt-1">
                    Configure how order receipts are printed on your tablet. These settings will be used across all devices.
                  </p>
                </div>
              </div>
            </div>

            {/* Auto-Print Toggle */}
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-surface-900 dark:text-surface-100 flex items-center space-x-2">
                    <span>Auto-Print Orders</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      printerSettings.autoPrintEnabled
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                    }`}>
                      {printerSettings.autoPrintEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </h4>
                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                    Automatically print receipts when new orders arrive. When disabled, you'll be prompted to print manually.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={printerSettings.autoPrintEnabled}
                    onChange={(e) => setPrinterSettings(prev => ({ ...prev, autoPrintEnabled: e.target.checked }))}
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors ${
                    printerSettings.autoPrintEnabled ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
                      printerSettings.autoPrintEnabled ? 'translate-x-6' : 'translate-x-1'
                    } mt-1`} />
                  </div>
                </label>
              </div>
            </div>

            {/* Print Mode Selection */}
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5">
              <h4 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">Print Mode</h4>
              <div className="space-y-3">
                <label className="flex items-start p-4 rounded-lg border-2 transition-all cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700/50 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20">
                  <input
                    type="radio"
                    name="printMode"
                    value="rawbt"
                    checked={printerSettings.printMode === 'rawbt'}
                    onChange={(e) => setPrinterSettings(prev => ({ ...prev, printMode: e.target.value as any }))}
                    className="mt-1 w-4 h-4 text-primary-600"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-surface-900 dark:text-surface-100">RawBT (Recommended)</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium rounded-full">
                        Best for Android
                      </span>
                    </div>
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                      Prints directly to Bluetooth thermal printers via the RawBT app - no dialogs or prompts. Fast and reliable.
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-4 rounded-lg border-2 transition-all cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700/50 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20">
                  <input
                    type="radio"
                    name="printMode"
                    value="system"
                    checked={printerSettings.printMode === 'system'}
                    onChange={(e) => setPrinterSettings(prev => ({ ...prev, printMode: e.target.value as any }))}
                    className="mt-1 w-4 h-4 text-primary-600"
                  />
                  <div className="ml-3 flex-1">
                    <span className="font-medium text-surface-900 dark:text-surface-100">System Print Dialog</span>
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                      Uses the device's native print dialog. Requires selecting the printer each time. Works with most printers.
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-4 rounded-lg border-2 transition-all cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700/50 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20">
                  <input
                    type="radio"
                    name="printMode"
                    value="bluetooth"
                    checked={printerSettings.printMode === 'bluetooth'}
                    onChange={(e) => setPrinterSettings(prev => ({ ...prev, printMode: e.target.value as any }))}
                    className="mt-1 w-4 h-4 text-primary-600"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-surface-900 dark:text-surface-100">WebBluetooth ESC/POS</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium rounded-full">
                        BLE Only
                      </span>
                    </div>
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                      Direct ESC/POS printing via WebBluetooth. Only works with BLE thermal printers (not Classic Bluetooth).
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-4 rounded-lg border-2 transition-all cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700/50 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20">
                  <input
                    type="radio"
                    name="printMode"
                    value="bridge"
                    checked={printerSettings.printMode === 'bridge'}
                    onChange={(e) => setPrinterSettings(prev => ({ ...prev, printMode: e.target.value as any }))}
                    className="mt-1 w-4 h-4 text-primary-600"
                  />
                  <div className="ml-3 flex-1">
                    <span className="font-medium text-surface-900 dark:text-surface-100">Print Bridge</span>
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                      For network (LAN) or USB connected printers via a bridge service. Requires additional setup.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Paper Configuration */}
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5">
              <h4 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">Paper Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                    Paper Width
                  </label>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setPrinterSettings(prev => ({ ...prev, paperWidth: '80mm' }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg border-2 font-medium transition-all ${
                        printerSettings.paperWidth === '80mm'
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                          : 'border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:border-surface-400 dark:hover:border-surface-500'
                      }`}
                    >
                      80mm
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrinterSettings(prev => ({ ...prev, paperWidth: '58mm' }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg border-2 font-medium transition-all ${
                        printerSettings.paperWidth === '58mm'
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                          : 'border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:border-surface-400 dark:hover:border-surface-500'
                      }`}
                    >
                      58mm
                    </button>
                  </div>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">
                    Most thermal printers use 80mm paper. Use 58mm for compact portable printers.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                    Number of Copies
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={printerSettings.numberOfCopies}
                    onChange={(e) => setPrinterSettings(prev => ({ ...prev, numberOfCopies: Math.max(1, Math.min(5, parseInt(e.target.value) || 1)) }))}
                    className="input-field w-full"
                  />
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">
                    How many copies to print per order (1-5). Kitchen copy, customer copy, etc.
                  </p>
                </div>
              </div>
            </div>

            {/* Receipt Customization */}
            <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5">
              <h4 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">Receipt Customization</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                    Font Size
                  </label>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setPrinterSettings(prev => ({ ...prev, fontSize: 'small' }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg border-2 font-medium transition-all ${
                        printerSettings.fontSize === 'small'
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                          : 'border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:border-surface-400 dark:hover:border-surface-500'
                      }`}
                    >
                      Small
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrinterSettings(prev => ({ ...prev, fontSize: 'medium' }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg border-2 font-medium transition-all ${
                        printerSettings.fontSize === 'medium'
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                          : 'border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:border-surface-400 dark:hover:border-surface-500'
                      }`}
                    >
                      Medium
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrinterSettings(prev => ({ ...prev, fontSize: 'large' }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg border-2 font-medium transition-all ${
                        printerSettings.fontSize === 'large'
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                          : 'border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:border-surface-400 dark:hover:border-surface-500'
                      }`}
                    >
                      Large
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrinterSettings(prev => ({ ...prev, fontSize: 'xlarge' }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg border-2 font-medium transition-all ${
                        printerSettings.fontSize === 'xlarge'
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                          : 'border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:border-surface-400 dark:hover:border-surface-500'
                      }`}
                    >
                      Extra Large
                    </button>
                  </div>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">
                    Adjusts the text size on printed receipts. Larger sizes may cause text to wrap on narrow paper.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                    Header Text (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Thank you for your order!"
                    value={printerSettings.receiptHeaderText}
                    onChange={(e) => setPrinterSettings(prev => ({ ...prev, receiptHeaderText: e.target.value }))}
                    className="input-field w-full"
                    maxLength={50}
                  />
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                    Custom text to appear at the top of receipts. Max 50 characters.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100 mb-2">
                    Footer Text (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Visit us again soon!"
                    value={printerSettings.receiptFooterText}
                    onChange={(e) => setPrinterSettings(prev => ({ ...prev, receiptFooterText: e.target.value }))}
                    className="input-field w-full"
                    maxLength={50}
                  />
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                    Custom text to appear at the bottom of receipts. Max 50 characters.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2">
              <div className="flex flex-wrap gap-3">
                <motion.button
                  onClick={savePrinterSettings}
                  disabled={isSavingPrinterSettings}
                  className="btn-primary inline-flex items-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSavingPrinterSettings ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : printerSaveStatus === 'saved' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>
                    {isSavingPrinterSettings ? 'Saving...' : printerSaveStatus === 'saved' ? 'Saved!' : 'Save Settings'}
                  </span>
                </motion.button>
                <motion.button
                  onClick={testPrinter}
                  disabled={isTestingPrinter}
                  className="btn-secondary inline-flex items-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isTestingPrinter ? (
                    <div className="w-4 h-4 border-2 border-surface-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  <span>{isTestingPrinter ? 'Sending Test...' : 'Send Test Print'}</span>
                </motion.button>
              </div>

              {/* Status Messages */}
              {printerSaveStatus === 'saved' && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center space-x-2">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300">Settings saved successfully!</span>
                </div>
              )}
              {printerSaveStatus === 'error' && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-700 dark:text-red-300">Failed to save settings. Please try again.</span>
                </div>
              )}
            </div>

            {/* Receipt Logo Info */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-1">Receipt Logo</h4>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Your restaurant logo appears at the top of printed receipts. To upload or change your logo, go to{' '}
                <a href="/dashboard/restaurant-profile" className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-200">
                  Restaurant Profile
                </a>.
              </p>
            </div>

            {/* Help Section */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">Need Help?</h4>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <li>• <strong>RawBT Mode:</strong> Install the RawBT app from Play Store and pair your printer in the app first</li>
                <li>• <strong>System Print:</strong> Works with any printer but requires manual selection each time</li>
                <li>• <strong>Test Print:</strong> Sends a test signal to your tablet - make sure your tablet is connected</li>
                <li>• <strong>Auto-Print:</strong> Only works when your tablet app is open and connected</li>
              </ul>
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