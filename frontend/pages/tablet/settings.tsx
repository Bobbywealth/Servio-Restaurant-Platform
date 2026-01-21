'use client';

import React from 'react'
import TabletLayout from '../../components/Layout/TabletLayout'
import { api } from '../../lib/api'
import { useUser } from '../../contexts/UserContext'
import { 
  Printer, 
  PhoneCall, 
  Save, 
  Volume2, 
  TestTube,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  Settings as SettingsIcon
} from 'lucide-react'

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
  printMode: 'browser' | 'agent' | 'bluetooth'
  agentUrl: string
  agentPrinter: { host: string; port: number } | null
}

type AlertSettings = {
  enabled: boolean
  supervisorPhone: string
  failureThresholdMinutes: number
  retryAttempts: number
  enabledForOrderFailures: boolean
  enabledForSystemDown: boolean
}

export default function TabletSettingsPage() {
  const { user } = useUser()
  
  const [activeTab, setActiveTab] = React.useState('printing')
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  // Receipt/Printing Settings
  const [receiptSettings, setReceiptSettings] = React.useState<ReceiptSettings>({
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

  // Alert Settings
  const [alertSettings, setAlertSettings] = React.useState<AlertSettings>({
    enabled: false,
    supervisorPhone: '',
    failureThresholdMinutes: 5,
    retryAttempts: 3,
    enabledForOrderFailures: true,
    enabledForSystemDown: true
  })

  // Printer discovery
  const [availablePrinters, setAvailablePrinters] = React.useState<any[]>([])
  const [scanningPrinters, setScanningPrinters] = React.useState(false)

  const loadSettings = React.useCallback(async () => {
    if (!user?.restaurantId) return
    setLoading(true)
    setError(null)
    
    try {
      const [receiptResp, alertResp] = await Promise.all([
        api.get(`/api/restaurants/${user.restaurantId}/receipt`),
        api.get(`/api/restaurants/${user.restaurantId}/alert-settings`)
      ])
      
      if (receiptResp.data?.data?.receipt) {
        setReceiptSettings(prev => ({ ...prev, ...receiptResp.data.data.receipt }))
      }
      
      if (alertResp.data?.data) {
        setAlertSettings(prev => ({ ...prev, ...alertResp.data.data }))
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [user?.restaurantId])

  React.useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const saveReceiptSettings = async () => {
    if (!user?.restaurantId) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      await api.put(`/api/restaurants/${user.restaurantId}/receipt`, receiptSettings)
      setSuccess('Receipt settings saved!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const saveAlertSettings = async () => {
    if (!user?.restaurantId) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      await api.put(`/api/restaurants/${user.restaurantId}/alert-settings`, alertSettings)
      setSuccess('Alert call settings saved!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const testAlertCall = async () => {
    if (!user?.restaurantId) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      await api.post(`/api/restaurants/${user.restaurantId}/test-alert-call`)
      setSuccess('Test alert call sent! Check the supervisor phone.')
      setTimeout(() => setSuccess(null), 5000)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Test call failed')
    } finally {
      setSaving(false)
    }
  }

  const scanForPrinters = async () => {
    setScanningPrinters(true)
    setError(null)
    
    try {
      const url = (receiptSettings.agentUrl || 'http://localhost:8787').replace(/\/+$/, '')
      const resp = await fetch(`${url}/printers`)
      const data = await resp.json()
      setAvailablePrinters(data?.data?.printers || [])
      if (data?.data?.printers?.length === 0) {
        setError('No printers found. Make sure print agent is running and printers are on.')
      } else {
        setSuccess(`Found ${data.data.printers.length} printer(s)!`)
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (e: any) {
      setError('Failed to scan printers. Is the print agent running?')
    } finally {
      setScanningPrinters(false)
    }
  }

  const tabs = [
    { id: 'printing', name: 'Printing', icon: Printer },
    { id: 'alerts', name: 'Alert Calls', icon: PhoneCall },
    { id: 'sound', name: 'Sound', icon: Volume2 }
  ]

  return (
    <TabletLayout title="Tablet Settings">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-200 rounded-2xl p-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="bg-green-500/15 border border-green-500/30 text-green-200 rounded-2xl p-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <div>{success}</div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 rounded-xl font-bold inline-flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-950'
                  : 'bg-white/10 hover:bg-white/15 active:bg-white/20'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/20 mx-auto"></div>
              <p className="mt-4 text-white/60">Loading settings...</p>
            </div>
          ) : (
            <>
              {activeTab === 'printing' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Printer className="w-6 h-6" />
                      Receipt & Ticket Printing
                    </h2>
                    <p className="text-white/70 mb-6">
                      Configure how your order tickets print when you tap "Print" on orders.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-white mb-2">Paper Size</label>
                        <select
                          className="w-full bg-gray-900 border border-white/10 rounded-xl p-3 text-white"
                          value={receiptSettings.paperSize}
                          onChange={(e) => setReceiptSettings({...receiptSettings, paperSize: e.target.value as any})}
                        >
                          <option value="80mm">80mm (Standard)</option>
                          <option value="58mm">58mm (Compact)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-white mb-2">Print Method</label>
                        <select
                          className="w-full bg-gray-900 border border-white/10 rounded-xl p-3 text-white"
                          value={receiptSettings.printMode}
                          onChange={(e) => setReceiptSettings({...receiptSettings, printMode: e.target.value as any})}
                        >
                          <option value="browser">Browser / AirPrint (iPad friendly)</option>
                          <option value="agent">LAN Printer (via Print Agent)</option>
                          <option value="bluetooth">Bluetooth (Android only)</option>
                        </select>
                      </div>

                      {receiptSettings.printMode === 'agent' && (
                        <div>
                          <label className="block text-sm font-bold text-white mb-2">Print Agent URL</label>
                          <input
                            className="w-full bg-gray-900 border border-white/10 rounded-xl p-3 text-white"
                            value={receiptSettings.agentUrl}
                            onChange={(e) => setReceiptSettings({...receiptSettings, agentUrl: e.target.value})}
                            placeholder="http://localhost:8787"
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={scanForPrinters}
                              disabled={scanningPrinters}
                              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm inline-flex items-center gap-2"
                            >
                              <Wifi className="w-4 h-4" />
                              {scanningPrinters ? 'Scanning...' : 'Find Printers'}
                            </button>
                            {availablePrinters.length > 0 && (
                              <select
                                className="bg-gray-900 border border-white/10 rounded-lg p-2 text-white text-sm"
                                value={receiptSettings.agentPrinter ? `${receiptSettings.agentPrinter.host}:${receiptSettings.agentPrinter.port}` : ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const [host, port] = e.target.value.split(':')
                                    setReceiptSettings({...receiptSettings, agentPrinter: { host, port: parseInt(port) || 9100 }})
                                  } else {
                                    setReceiptSettings({...receiptSettings, agentPrinter: null})
                                  }
                                }}
                              >
                                <option value="">Select printer...</option>
                                {availablePrinters.map((p, i) => (
                                  <option key={i} value={`${p.host}:${p.port || 9100}`}>
                                    {p.name || p.host}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-white mb-2">Header Title</label>
                        <input
                          className="w-full bg-gray-900 border border-white/10 rounded-xl p-3 text-white"
                          value={receiptSettings.headerTitle}
                          onChange={(e) => setReceiptSettings({...receiptSettings, headerTitle: e.target.value})}
                          placeholder="Restaurant Name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-white mb-2">Footer Text</label>
                        <input
                          className="w-full bg-gray-900 border border-white/10 rounded-xl p-3 text-white"
                          value={receiptSettings.footerText}
                          onChange={(e) => setReceiptSettings({...receiptSettings, footerText: e.target.value})}
                          placeholder="Thank you!"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-white mb-3">What to Print</label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { key: 'showLogo', label: 'Logo' },
                            { key: 'showOrderId', label: 'Order ID' },
                            { key: 'showPlacedAt', label: 'Placed Time' },
                            { key: 'showCustomerName', label: 'Customer Name' },
                            { key: 'showCustomerPhone', label: 'Customer Phone' },
                            { key: 'showChannel', label: 'Channel' }
                          ].map(field => (
                            <label key={field.key} className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={(receiptSettings as any)[field.key]}
                                onChange={(e) => setReceiptSettings({
                                  ...receiptSettings,
                                  [field.key]: e.target.checked
                                })}
                                className="w-5 h-5 rounded"
                              />
                              <span className="text-white text-sm font-medium">{field.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={saveReceiptSettings}
                        disabled={saving}
                        className="w-full px-4 py-3 rounded-xl bg-white text-gray-950 font-extrabold hover:bg-white/90 active:bg-white/80 transition-colors inline-flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <div className="w-5 h-5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                        <span>{saving ? 'Saving...' : 'Save Printing Settings'}</span>
                      </button>
                    </div>

                    {/* Print Preview */}
                    <div>
                      <h3 className="text-lg font-bold text-white mb-3">Preview</h3>
                      <div className="bg-white/10 border border-white/10 rounded-xl p-4">
                        <div
                          className="bg-white text-black rounded-lg mx-auto p-3"
                          style={{
                            width: receiptSettings.paperSize === '58mm' ? '220px' : '300px',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}
                        >
                          {receiptSettings.showLogo && <div className="text-center mb-2">🏪 LOGO</div>}
                          <div className="text-center font-bold mb-2">
                            {receiptSettings.headerTitle || 'Restaurant Name'}
                          </div>
                          {receiptSettings.headerSubtitle && (
                            <div className="text-center mb-2">{receiptSettings.headerSubtitle}</div>
                          )}
                          <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
                            {receiptSettings.showOrderId && <div>Order: WEB-1001</div>}
                            <div>Status: received</div>
                            {receiptSettings.showPlacedAt && <div>Placed: {new Date().toLocaleString()}</div>}
                            {receiptSettings.showCustomerName && <div>Customer: Jane Doe</div>}
                            {receiptSettings.showCustomerPhone && <div>Phone: +1 (555) 123-4567</div>}
                            {receiptSettings.showChannel && <div>Channel: website</div>}
                          </div>
                          <div className="mb-2">
                            <div className="font-bold mb-1">ITEMS</div>
                            <div>1x Jerk Chicken Plate</div>
                            <div className="text-xs ml-2">Extra spicy, Brown rice</div>
                          </div>
                          <div className="border-t border-dashed border-gray-400 pt-2">
                            <div className="font-bold">Total: $15.99</div>
                            {receiptSettings.footerText && (
                              <div className="text-center mt-2">{receiptSettings.footerText}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'alerts' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <PhoneCall className="w-6 h-6" />
                      Automatic Alert Calls
                    </h2>
                    <p className="text-white/70 mb-6">
                      Get an automatic phone call when orders can't reach your system. Configure your supervisor's phone number below.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={alertSettings.enabled}
                        onChange={(e) => setAlertSettings({...alertSettings, enabled: e.target.checked})}
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-white font-bold">Enable Alert Calls</span>
                    </label>

                    <div>
                      <label className="block text-sm font-bold text-white mb-2">
                        Supervisor Phone Number
                      </label>
                      <input
                        type="tel"
                        className="w-full bg-gray-900 border border-white/10 rounded-xl p-3 text-white"
                        value={alertSettings.supervisorPhone}
                        onChange={(e) => setAlertSettings({...alertSettings, supervisorPhone: e.target.value})}
                        placeholder="+1 (555) 123-4567"
                      />
                      <p className="text-xs text-white/60 mt-1">
                        Phone number to call when critical issues occur
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-white mb-2">
                          Failure Threshold
                        </label>
                        <select
                          className="w-full bg-gray-900 border border-white/10 rounded-xl p-3 text-white"
                          value={alertSettings.failureThresholdMinutes}
                          onChange={(e) => setAlertSettings({...alertSettings, failureThresholdMinutes: Number(e.target.value)})}
                        >
                          <option value={3}>3 minutes</option>
                          <option value={5}>5 minutes</option>
                          <option value={10}>10 minutes</option>
                          <option value={15}>15 minutes</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-white mb-2">
                          Retry Attempts
                        </label>
                        <select
                          className="w-full bg-gray-900 border border-white/10 rounded-xl p-3 text-white"
                          value={alertSettings.retryAttempts}
                          onChange={(e) => setAlertSettings({...alertSettings, retryAttempts: Number(e.target.value)})}
                        >
                          <option value={1}>1 attempt</option>
                          <option value={2}>2 attempts</option>
                          <option value={3}>3 attempts</option>
                          <option value={5}>5 attempts</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={saveAlertSettings}
                        disabled={saving}
                        className="px-4 py-3 rounded-xl bg-white text-gray-950 font-extrabold hover:bg-white/90 active:bg-white/80 transition-colors inline-flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <div className="w-5 h-5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                        <span>{saving ? 'Saving...' : 'Save'}</span>
                      </button>

                      <button
                        onClick={testAlertCall}
                        disabled={saving || !alertSettings.enabled || !alertSettings.supervisorPhone}
                        className="px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold inline-flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <TestTube className="w-5 h-5" />
                        )}
                        <span>{saving ? 'Calling...' : 'Test Call'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                    <h3 className="text-sm font-bold text-white mb-2">How It Works</h3>
                    <ul className="text-sm text-white/70 space-y-1">
                      <li>• When an order fails to reach your system</li>
                      <li>• After the threshold time, Servio calls the supervisor</li>
                      <li>• Voice message explains the issue</li>
                      <li>• Calls retry based on your settings</li>
                      <li>• All calls are logged for your records</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'sound' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Volume2 className="w-6 h-6" />
                      Sound Settings
                    </h2>
                    <p className="text-white/70 mb-6">
                      Configure notification sounds for new orders and alerts.
                    </p>
                  </div>

                  <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-amber-200 text-sm font-medium">
                      <Volume2 className="w-4 h-4" />
                      <span>Sound settings require user interaction to work properly on mobile devices.</span>
                    </div>
                  </div>

                  <div className="text-center py-8 text-white/60">
                    <Volume2 className="w-12 h-12 mx-auto mb-4 text-white/40" />
                    <p>Sound customization coming soon!</p>
                    <p className="text-sm mt-2">The new order alarm is currently built-in and activates automatically.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </TabletLayout>
  )
}