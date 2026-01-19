import React, { useState } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
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
  Check
} from 'lucide-react'

const DashboardLayout = dynamic(() => import('../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />
})

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')
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

  const tabs = [
    { id: 'general', name: 'General', icon: SettingsIcon },
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

  const renderTabContent = () => {
    switch (activeTab) {
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