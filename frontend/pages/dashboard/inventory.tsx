import React, { useState, useMemo, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Package,
  AlertTriangle,
  TrendingDown,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit3,
  Trash2,
  AlertCircle,
  RefreshCw,
  X,
  Camera,
  Upload,
  FileText,
  Check,
  Loader2,
  Sparkles,
  DollarSign
} from 'lucide-react'
import { InventoryCardSkeleton, StatCardSkeleton } from '../../components/ui/Skeleton'
import { PullToRefresh } from '../../components/ui/PullToRefresh'
import { useHaptic } from '../../lib/haptics'

const DashboardLayout = dynamic(() => import('../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />
})

interface InventoryItem {
  id: string
  name: string
  sku?: string
  unit: string
  on_hand_qty: number
  low_stock_threshold: number
  category?: string
  unit_cost?: number
  vendor_name?: string
  vendor_payment_date?: string
  payment_status?: 'unpaid' | 'due' | 'paid'
  paid_at?: string
  payment_reference?: string
  payment_method?: string
  updated_at: string
}

interface ReceiptAnalysisItem {
  name: string
  description?: string
  quantity: number
  unit?: string
  unitCost?: number
  totalPrice?: number
  confidence: number
  category?: string
  selected?: boolean
}

interface ReceiptAnalysisResult {
  id: string
  supplierName?: string
  date?: string
  totalAmount?: number
  currency?: string
  items: ReceiptAnalysisItem[]
  analyzedAt: string
  confidence: number
  imageUrl?: string
}

interface InventoryTransaction {
  id: string
  inventory_item_id: string
  item_name: string
  item_unit?: string
  type: 'adjust' | 'restock' | 'use' | string
  quantity: number
  reason?: string
  unit_cost_snapshot?: number
  created_by_name?: string
  created_at: string
}

// Extended Cost Feature Added
export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<'all' | 'unpaid' | 'due' | 'paid'>('all')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    sku: '',
    unit: 'each',
    onHandQty: '',
    lowStockThreshold: '',
    category: '',
    unitCost: '',
    vendorName: '',
    vendorPaymentDate: '',
    paymentStatus: 'unpaid',
    paidAt: '',
    paymentReference: '',
    paymentMethod: ''
  })
  const [editItem, setEditItem] = useState({
    id: '',
    name: '',
    sku: '',
    unit: 'each',
    onHandQty: '',
    lowStockThreshold: '',
    category: '',
    unitCost: '',
    vendorName: '',
    vendorPaymentDate: '',
    paymentStatus: 'unpaid',
    paidAt: '',
    paymentReference: '',
    paymentMethod: ''
  })
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptImage, setReceiptImage] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<ReceiptAnalysisResult | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [isCreatingItems, setIsCreatingItems] = useState(false)
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [budgetTarget, setBudgetTarget] = useState('')
  const [isSavingBudget, setIsSavingBudget] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const resp = await api.get('/api/inventory/search', {
        params: {
          q: searchTerm || undefined,
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          paymentStatus: selectedPaymentFilter === 'all' ? undefined : selectedPaymentFilter
        }
      })
      setItems(resp.data?.data || [])
    } catch (e: any) {
      setError('Failed to load inventory')
    } finally {
      setIsLoading(false)
    }
  }, [searchTerm, selectedCategory, selectedPaymentFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchTransactions = useCallback(async () => {
    setIsLoadingTransactions(true)
    try {
      const resp = await api.get('/api/inventory/transactions', {
        params: { limit: 25 }
      })
      setTransactions(resp.data?.data || [])
    } catch (e) {
      console.warn('Failed to load inventory transactions', e)
      setTransactions([])
    } finally {
      setIsLoadingTransactions(false)
    }
  }, [])

  const loadBudgetTarget = useCallback(async () => {
    try {
      const resp = await api.get('/api/restaurant/profile')
      const settings = resp.data?.data?.settings || {}
      if (settings.inventory_weekly_budget_target !== undefined && settings.inventory_weekly_budget_target !== null) {
        setBudgetTarget(String(settings.inventory_weekly_budget_target))
      }
    } catch (e) {
      console.warn('Failed to load inventory budget target', e)
    }
  }, [])

  useEffect(() => {
    fetchTransactions()
    loadBudgetTarget()
  }, [fetchTransactions, loadBudgetTarget])

  const handleCreateItem = async () => {
    if (!newItem.name.trim()) {
      toast.error('Item name is required')
      return
    }
    if (!newItem.unit.trim()) {
      toast.error('Unit is required')
      return
    }

    setIsSaving(true)
    try {
      await api.post('/api/inventory', {
        name: newItem.name.trim(),
        sku: newItem.sku.trim() || undefined,
        unit: newItem.unit.trim(),
        onHandQty: newItem.onHandQty ? Number(newItem.onHandQty) : 0,
        lowStockThreshold: newItem.lowStockThreshold ? Number(newItem.lowStockThreshold) : 10,
        category: newItem.category.trim() || undefined,
        unitCost: newItem.unitCost ? Number(newItem.unitCost) : undefined,
        vendorName: newItem.vendorName.trim() || undefined,
        vendorPaymentDate: newItem.vendorPaymentDate || undefined,
        paymentStatus: newItem.paymentStatus,
        paidAt: newItem.paidAt || undefined,
        paymentReference: newItem.paymentReference.trim() || undefined,
        paymentMethod: newItem.paymentMethod.trim() || undefined
      })
      toast.success('Inventory item created')
      setShowAddModal(false)
      setNewItem({
        name: '',
        sku: '',
        unit: 'each',
        onHandQty: '',
        lowStockThreshold: '',
        category: '',
        unitCost: '',
        vendorName: '',
        vendorPaymentDate: '',
        paymentStatus: 'unpaid',
        paidAt: '',
        paymentReference: '',
        paymentMethod: ''
      })
      await fetchData()
      await fetchTransactions()
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to create item'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const openEditModal = (item: InventoryItem) => {
    setEditItem({
      id: item.id,
      name: item.name,
      sku: item.sku || '',
      unit: item.unit,
      onHandQty: String(item.on_hand_qty),
      lowStockThreshold: String(item.low_stock_threshold),
      category: item.category || '',
      unitCost: item.unit_cost !== undefined ? String(item.unit_cost) : '',
      vendorName: item.vendor_name || '',
      vendorPaymentDate: item.vendor_payment_date || '',
      paymentStatus: item.payment_status || 'unpaid',
      paidAt: formatDateTimeLocal(item.paid_at),
      paymentReference: item.payment_reference || '',
      paymentMethod: item.payment_method || ''
    })
    setEditingItem(item)
    setShowEditModal(true)
  }

  const handleUpdateItem = async () => {
    if (!editItem.name.trim()) {
      toast.error('Item name is required')
      return
    }

    setIsSaving(true)
    try {
      await api.put(`/api/inventory/${editItem.id}`, {
        name: editItem.name.trim(),
        sku: editItem.sku.trim() || undefined,
        unit: editItem.unit.trim(),
        onHandQty: editItem.onHandQty ? Number(editItem.onHandQty) : 0,
        lowStockThreshold: editItem.lowStockThreshold ? Number(editItem.lowStockThreshold) : 10,
        category: editItem.category.trim() || undefined,
        unitCost: editItem.unitCost ? Number(editItem.unitCost) : undefined,
        vendorName: editItem.vendorName.trim() || undefined,
        vendorPaymentDate: editItem.vendorPaymentDate || undefined,
        paymentStatus: editItem.paymentStatus,
        paidAt: editItem.paidAt || undefined,
        paymentReference: editItem.paymentReference.trim() || undefined,
        paymentMethod: editItem.paymentMethod.trim() || undefined
      })
      toast.success('Inventory item updated')
      setShowEditModal(false)
      setEditingItem(null)
      await fetchData()
      await fetchTransactions()
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to update item'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAdjustQuantity = async (itemId: string, delta: number) => {
    try {
      await api.post('/api/inventory/adjust', {
        itemId,
        delta,
        reason: delta > 0 ? 'Manual addition' : 'Manual reduction'
      })
      toast.success('Quantity updated')
      await fetchData()
      await fetchTransactions()
    } catch (e: any) {
      toast.error('Failed to adjust quantity')
    }
  }

  const handleReceiptImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be less than 10MB')
        return
      }
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.')
        return
      }
      setReceiptImage(file)
      setReceiptPreview(URL.createObjectURL(file))
      setAnalysisResult(null)
      setAnalysisError(null)
    }
  }

  const handleAnalyzeReceipt = async () => {
    if (!receiptImage) {
      toast.error('Please select a receipt image first')
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)

    try {
      const formData = new FormData()
      formData.append('receipt', receiptImage)

      const response = await api.post('/api/inventory/analyze-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data?.success) {
        const { analysis, inventoryItems } = response.data.data

        // Convert inventory items to receipt analysis items format
        const items: ReceiptAnalysisItem[] = analysis.items.map((item: any, index: number) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'each',
          unitCost: item.unitCost,
          totalPrice: item.totalPrice,
          confidence: item.confidence,
          category: item.category,
          selected: true
        }))

        setAnalysisResult({
          id: analysis.id,
          supplierName: analysis.supplierName,
          date: analysis.date,
          totalAmount: analysis.totalAmount,
          currency: analysis.currency,
          items,
          analyzedAt: analysis.analyzedAt,
          confidence: analysis.confidence,
          imageUrl: response.data.data.imageUrl
        })
        toast.success(`Found ${items.length} items in the receipt`)
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to analyze receipt'
      setAnalysisError(msg)
      toast.error(msg)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCreateItemsFromReceipt = async () => {
    if (!analysisResult) return

    const selectedItems = analysisResult.items.filter(item => item.selected)
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item')
      return
    }

    setIsCreatingItems(true)
    try {
      const response = await api.post('/api/inventory/create-from-receipt', {
        items: selectedItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          category: item.category
        })),
        source: 'receipt_scan',
        sourceAnalysisId: analysisResult.id !== analysisResult.id ? analysisResult.id : null
      })

      if (response.data?.success) {
        const { created, summary } = response.data.data
        toast.success(`Created ${summary.created} items, updated ${summary.updated} items`)

        // Close modal and refresh data
        setShowReceiptModal(false)
        resetReceiptModal()
        await fetchData()
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to create items'
      toast.error(msg)
    } finally {
      setIsCreatingItems(false)
    }
  }

  const resetReceiptModal = () => {
    setReceiptImage(null)
    setReceiptPreview(null)
    setAnalysisResult(null)
    setAnalysisError(null)
  }

  const toggleItemSelection = (index: number) => {
    if (!analysisResult) return
    const updatedItems = [...analysisResult.items]
    updatedItems[index] = { ...updatedItems[index], selected: !updatedItems[index].selected }
    setAnalysisResult({ ...analysisResult, items: updatedItems })
  }

  const updateAnalysisItem = (index: number, field: keyof ReceiptAnalysisItem, value: any) => {
    if (!analysisResult) return
    const updatedItems = [...analysisResult.items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setAnalysisResult({ ...analysisResult, items: updatedItems })
  }

  const categories = useMemo(() => {
    const set = new Set<string>()
    items.forEach(i => { if (i.category) set.add(i.category) })
    return ['all', ...Array.from(set).sort()]
  }, [items])

  const paymentFilterChips = useMemo(() => {
    const counts = {
      unpaid: items.filter(item => (item.payment_status || 'unpaid') === 'unpaid').length,
      due: items.filter(item => item.payment_status === 'due').length,
      paid: items.filter(item => item.payment_status === 'paid').length
    }

    return [
      { key: 'all', label: 'All', count: items.length },
      { key: 'unpaid', label: 'Unpaid', count: counts.unpaid },
      { key: 'due', label: 'Due', count: counts.due },
      { key: 'paid', label: 'Paid', count: counts.paid }
    ] as const
  }, [items])

  const isOverdueUnpaid = (item: InventoryItem) => {
    const status = item.payment_status || 'unpaid'
    if ((status !== 'unpaid' && status !== 'due') || !item.vendor_payment_date) {
      return false
    }
    const dueDate = new Date(item.vendor_payment_date)
    if (Number.isNaN(dueDate.getTime())) {
      return false
    }
    dueDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return dueDate < today
  }

  const formatDateTimeLocal = (value?: string) => {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    const local = new Date(parsed.getTime() - (parsed.getTimezoneOffset() * 60_000))
    return local.toISOString().slice(0, 16)
  }

  const getPaymentStatusBadgeClasses = (status?: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'due':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
      default:
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    }
  }

  const lowStockCount = items.filter(item => item.on_hand_qty <= item.low_stock_threshold).length

  const totalInventoryValue = items.reduce((sum, item) => {
    const cost = item.unit_cost !== undefined ? item.unit_cost : 0
    return sum + (cost * item.on_hand_qty)
  }, 0)

  const weeklyBudgetTarget = Number(budgetTarget || 0)
  const budgetVariance = weeklyBudgetTarget > 0 ? weeklyBudgetTarget - totalInventoryValue : null

  const saveBudgetTarget = async () => {
    if (budgetTarget !== '' && (!Number.isFinite(Number(budgetTarget)) || Number(budgetTarget) < 0)) {
      toast.error('Budget target must be a non-negative number')
      return
    }

    setIsSavingBudget(true)
    try {
      await api.put('/api/restaurant/settings', {
        inventory_weekly_budget_target: budgetTarget === '' ? null : Number(budgetTarget)
      })
      toast.success('Inventory budget target saved')
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to save budget target')
    } finally {
      setIsSavingBudget(false)
    }
  }

  return (
    <>
      <Head>
        <title>Inventory Management - Servio Restaurant Platform</title>
        <meta name="description" content="Manage restaurant inventory and stock levels" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
                Inventory Management
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Track stock levels and manage restaurant inventory
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                className="btn-secondary inline-flex items-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowReceiptModal(true)}
              >
                <Camera className="w-4 h-4" />
                <span>Scan Receipt</span>
              </motion.button>
              <motion.button
                className="btn-primary inline-flex items-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </motion.button>
            </div>
          </div>

          {/* Alert Banner for Low Stock */}
          {lowStockCount > 0 && (
            <motion.div
              className="bg-servio-red-50 dark:bg-servio-red-900/20 border border-servio-red-200 dark:border-servio-red-800 rounded-xl p-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-servio-red-600 dark:text-servio-red-400" />
                <div>
                  <h3 className="text-sm font-medium text-servio-red-800 dark:text-servio-red-300">
                    Low Stock Alert
                  </h3>
                  <p className="text-servio-red-700 dark:text-servio-red-400 text-sm">
                    {lowStockCount} item{lowStockCount > 1 ? 's' : ''} running low on stock
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div
              className="card-hover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center">
                <div className="p-3 rounded-xl bg-primary-500">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
                    Total Items
                  </p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    {items.length}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="card-hover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center">
                <div className="p-3 rounded-xl bg-servio-red-500">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
                    Low Stock
                  </p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    {lowStockCount}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="card-hover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center">
                <div className="p-3 rounded-xl bg-servio-green-500">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
                    Well Stocked
                  </p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    {items.length - lowStockCount}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="card-hover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center">
                <div className="p-3 rounded-xl bg-amber-500">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
                    Total Value
                  </p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    ${totalInventoryValue.toFixed(2)}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card lg:col-span-1">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Inventory Budget</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-4">
                Set a weekly inventory spend target and compare against current on-hand value.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Weekly Budget Target ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={budgetTarget}
                    onChange={(e) => setBudgetTarget(e.target.value)}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div className="text-sm text-surface-700 dark:text-surface-300">
                  Current Value: <span className="font-semibold">${totalInventoryValue.toFixed(2)}</span>
                </div>
                {budgetVariance !== null && (
                  <div className={`text-sm font-medium ${budgetVariance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {budgetVariance >= 0 ? 'Remaining Budget' : 'Over Budget'}: ${Math.abs(budgetVariance).toFixed(2)}
                  </div>
                )}
                <button
                  onClick={saveBudgetTarget}
                  disabled={isSavingBudget}
                  className="btn-primary w-full"
                >
                  {isSavingBudget ? 'Saving...' : 'Save Budget Target'}
                </button>
              </div>
            </div>

            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Recent Inventory Transactions</h3>
                <button className="btn-secondary" onClick={fetchTransactions} disabled={isLoadingTransactions}>
                  {isLoadingTransactions ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-surface-500 dark:text-surface-400 border-b border-surface-200 dark:border-surface-700">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Item</th>
                      <th className="py-2 pr-3">Qty</th>
                      <th className="py-2 pr-3">Unit Cost Snapshot</th>
                      <th className="py-2 pr-3">Value Impact</th>
                      <th className="py-2 pr-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-surface-500 dark:text-surface-400">
                          {isLoadingTransactions ? 'Loading transactions...' : 'No transactions found'}
                        </td>
                      </tr>
                    ) : transactions.map((tx) => {
                      const snapshotCost = tx.unit_cost_snapshot !== undefined && tx.unit_cost_snapshot !== null
                        ? Number(tx.unit_cost_snapshot)
                        : null
                      const valueImpact = snapshotCost !== null ? snapshotCost * Number(tx.quantity || 0) : null
                      return (
                        <tr key={tx.id} className="border-b border-surface-100 dark:border-surface-800">
                          <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 text-surface-900 dark:text-surface-100 font-medium">
                            {tx.item_name}
                          </td>
                          <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                            {tx.quantity} {tx.item_unit || ''}
                          </td>
                          <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                            {snapshotCost !== null ? `$${snapshotCost.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                            {valueImpact !== null ? `$${valueImpact.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2 pr-3 text-surface-600 dark:text-surface-400">
                            {tx.reason || tx.type}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="sticky top-2 z-10 bg-white/95 dark:bg-surface-900/95 backdrop-blur rounded-xl p-3 border border-surface-200 dark:border-surface-700 flex flex-col gap-3 sm:static sm:bg-transparent sm:border-0 sm:p-0 sm:flex-row sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search inventory items..."
                className="input-field pl-10 min-h-[44px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-surface-500" />
              <select
                className="input-field min-h-[44px] w-full"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {paymentFilterChips.map(chip => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setSelectedPaymentFilter(chip.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selectedPaymentFilter === chip.key
                      ? 'bg-primary-100 text-primary-800 border-primary-300 dark:bg-primary-900/30 dark:text-primary-200 dark:border-primary-700'
                      : 'bg-white text-surface-600 border-surface-300 hover:bg-surface-100 dark:bg-surface-800 dark:text-surface-300 dark:border-surface-600 dark:hover:bg-surface-700'
                  }`}
                >
                  {chip.label} ({chip.count})
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Inventory Table */}
          <motion.div
            className="hidden md:block card overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-200 dark:divide-surface-700">
                <thead className="bg-surface-50 dark:bg-surface-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      Stock Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      Unit Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      Extended Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      Vendor Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                  {items.map((item, index) => (
                    (() => {
                      const overdueUnpaid = isOverdueUnpaid(item)
                      return (
                    <motion.tr
                      key={item.id}
                      className={`hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors ${
                        overdueUnpaid ? 'bg-red-50/70 dark:bg-red-900/10' : ''
                      }`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                            {item.name}
                          </div>
                          {item.sku && (
                            <div className="text-xs text-surface-500 dark:text-surface-400">
                              SKU: {item.sku}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500 dark:text-surface-400">
                        {item.category || 'Uncategorized'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-surface-900 dark:text-surface-100">
                          {item.on_hand_qty} {item.unit}
                        </div>
                        <div className="text-xs text-surface-500 dark:text-surface-400">
                          Min: {item.low_stock_threshold} {item.unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900 dark:text-surface-100">
                        {item.unit_cost !== undefined ? `${Number(item.unit_cost).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-surface-900 dark:text-surface-100">
                        {item.unit_cost !== undefined ? `${((item.on_hand_qty || 0) * item.unit_cost).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900 dark:text-surface-100">
                        {item.vendor_payment_date ? (
                          <div>
                            <div>{new Date(item.vendor_payment_date).toLocaleDateString()}</div>
                            <div className="text-xs text-surface-500 dark:text-surface-400">{item.vendor_name || 'No vendor'}</div>
                            {overdueUnpaid && (
                              <div className="text-xs font-semibold text-red-600 dark:text-red-400">Overdue</div>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusBadgeClasses(item.payment_status)}`}>
                          {(item.payment_status || 'unpaid').toUpperCase()}
                        </span>
                        {item.paid_at && (
                          <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                            Paid {new Date(item.paid_at).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button 
                            className="btn-icon text-primary-600 hover:text-primary-700"
                            onClick={() => openEditModal(item)}
                            title="Edit item"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            className="btn-icon text-green-600 hover:text-green-700"
                            onClick={() => handleAdjustQuantity(item.id, 1)}
                            title="Add 1"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button 
                            className="btn-icon text-red-600 hover:text-red-700"
                            onClick={() => handleAdjustQuantity(item.id, -1)}
                            title="Remove 1"
                          >
                            <TrendingDown className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                      )
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Mobile Inventory Cards */}
          <div className="md:hidden space-y-4">
            {items.length === 0 ? (
              <div className="card text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
                <p className="text-surface-500 dark:text-surface-400">
                  {isLoading ? 'Loading inventory...' : 'No items found'}
                </p>
              </div>
            ) : (
              items.map((item, index) => (
                (() => {
                  const overdueUnpaid = isOverdueUnpaid(item)
                  return (
                <motion.div
                  key={item.id}
                  className={`card hover:shadow-lg transition-shadow ${overdueUnpaid ? 'ring-1 ring-red-300 dark:ring-red-700' : ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base text-surface-900 dark:text-surface-100 truncate">
                        {item.name}
                      </h3>
                      {item.sku && (
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                          SKU: {item.sku}
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ml-2 ${getPaymentStatusBadgeClasses(item.payment_status)}`}>
                      {(item.payment_status || 'unpaid').toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Category</div>
                      <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                        {item.category || 'Uncategorized'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Stock Level</div>
                      <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                        {item.on_hand_qty} {item.unit}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Low Stock Threshold</div>
                      <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                        {item.low_stock_threshold} {item.unit}
                      </div>
                    </div>
                    <div className="col-span-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">Extended Cost</span>
                        <span className="text-lg font-bold text-amber-900 dark:text-amber-100">
                          {item.unit_cost !== undefined ? `$${((item.on_hand_qty || 0) * item.unit_cost).toFixed(2)}` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Vendor Payment Day</div>
                      <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                        {item.vendor_payment_date ? new Date(item.vendor_payment_date).toLocaleDateString() : 'Not set'}
                        {item.vendor_name ? ` • ${item.vendor_name}` : ''}
                        {overdueUnpaid ? ' • OVERDUE' : ''}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-surface-500 dark:text-surface-400 mb-1">Payment Reference</div>
                      <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                        {item.payment_reference || 'Not set'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-surface-200 dark:border-surface-700">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => openEditModal(item)}
                        className="btn-secondary flex-1 min-h-[44px] inline-flex items-center justify-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAdjustQuantity(item.id, -1)}
                          className="btn-icon bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 min-w-[44px] min-h-[44px]"
                          aria-label="Remove 1"
                        >
                          <TrendingDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAdjustQuantity(item.id, 1)}
                          className="btn-icon bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 min-w-[44px] min-h-[44px]"
                          aria-label="Add 1"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
                  )
                })()
              ))
            )}
          </div>

          {/* Add Item Modal */}
          <AnimatePresence>
            {showAddModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                onClick={() => setShowAddModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">Add Inventory Item</h2>
                    <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Item Name *</label>
                      <input
                        type="text"
                        value={newItem.name}
                        onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                        className="input-field"
                        placeholder="e.g. Chicken Breast"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">SKU</label>
                        <input
                          type="text"
                          value={newItem.sku}
                          onChange={(e) => setNewItem(prev => ({ ...prev, sku: e.target.value }))}
                          className="input-field"
                          placeholder="e.g. CHK-001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Unit *</label>
                        <select
                          value={newItem.unit}
                          onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                          className="input-field"
                        >
                          <option value="each">Each</option>
                          <option value="lb">Pound (lb)</option>
                          <option value="kg">Kilogram (kg)</option>
                          <option value="oz">Ounce (oz)</option>
                          <option value="g">Gram (g)</option>
                          <option value="gal">Gallon</option>
                          <option value="L">Liter</option>
                          <option value="case">Case</option>
                          <option value="box">Box</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Quantity On Hand</label>
                        <input
                          type="number"
                          value={newItem.onHandQty}
                          onChange={(e) => setNewItem(prev => ({ ...prev, onHandQty: e.target.value }))}
                          className="input-field"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Low Stock Alert</label>
                        <input
                          type="number"
                          value={newItem.lowStockThreshold}
                          onChange={(e) => setNewItem(prev => ({ ...prev, lowStockThreshold: e.target.value }))}
                          className="input-field"
                          placeholder="10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Category</label>
                      <input
                        type="text"
                        value={newItem.category}
                        onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                        className="input-field"
                        placeholder="e.g. Proteins, Produce, Dairy"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Unit Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newItem.unitCost}
                        onChange={(e) => setNewItem(prev => ({ ...prev, unitCost: e.target.value }))}
                        className="input-field"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Vendor Name</label>
                        <input
                          type="text"
                          value={newItem.vendorName}
                          onChange={(e) => setNewItem(prev => ({ ...prev, vendorName: e.target.value }))}
                          className="input-field"
                          placeholder="e.g. Fresh Farms Co."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Payment Day</label>
                        <input
                          type="date"
                          value={newItem.vendorPaymentDate}
                          onChange={(e) => setNewItem(prev => ({ ...prev, vendorPaymentDate: e.target.value }))}
                          className="input-field"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Payment Status</label>
                        <select
                          value={newItem.paymentStatus}
                          onChange={(e) => setNewItem(prev => ({ ...prev, paymentStatus: e.target.value }))}
                          className="input-field"
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="due">Due</option>
                          <option value="paid">Paid</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Paid At</label>
                        <input
                          type="datetime-local"
                          value={newItem.paidAt}
                          onChange={(e) => setNewItem(prev => ({ ...prev, paidAt: e.target.value }))}
                          className="input-field"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Payment Reference</label>
                        <input
                          type="text"
                          value={newItem.paymentReference}
                          onChange={(e) => setNewItem(prev => ({ ...prev, paymentReference: e.target.value }))}
                          className="input-field"
                          placeholder="Invoice/transaction id"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Payment Method (Optional)</label>
                        <input
                          type="text"
                          value={newItem.paymentMethod}
                          onChange={(e) => setNewItem(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="input-field"
                          placeholder="ACH, check, card"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="btn-secondary"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateItem}
                      className="btn-primary"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Add Item'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Edit Item Modal */}
          <AnimatePresence>
            {showEditModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                onClick={() => { setShowEditModal(false); setEditingItem(null); }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">Edit Inventory Item</h2>
                    <button onClick={() => { setShowEditModal(false); setEditingItem(null); }} className="text-surface-400 hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Item Name *</label>
                      <input
                        type="text"
                        value={editItem.name}
                        onChange={(e) => setEditItem(prev => ({ ...prev, name: e.target.value }))}
                        className="input-field"
                        placeholder="e.g. Chicken Breast"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">SKU</label>
                        <input
                          type="text"
                          value={editItem.sku}
                          onChange={(e) => setEditItem(prev => ({ ...prev, sku: e.target.value }))}
                          className="input-field"
                          placeholder="e.g. CHK-001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Unit *</label>
                        <select
                          value={editItem.unit}
                          onChange={(e) => setEditItem(prev => ({ ...prev, unit: e.target.value }))}
                          className="input-field"
                        >
                          <option value="each">Each</option>
                          <option value="lb">Pound (lb)</option>
                          <option value="kg">Kilogram (kg)</option>
                          <option value="oz">Ounce (oz)</option>
                          <option value="g">Gram (g)</option>
                          <option value="gal">Gallon</option>
                          <option value="L">Liter</option>
                          <option value="case">Case</option>
                          <option value="box">Box</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Quantity On Hand</label>
                        <input
                          type="number"
                          value={editItem.onHandQty}
                          onChange={(e) => setEditItem(prev => ({ ...prev, onHandQty: e.target.value }))}
                          className="input-field"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Low Stock Alert</label>
                        <input
                          type="number"
                          value={editItem.lowStockThreshold}
                          onChange={(e) => setEditItem(prev => ({ ...prev, lowStockThreshold: e.target.value }))}
                          className="input-field"
                          placeholder="10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Category</label>
                      <input
                        type="text"
                        value={editItem.category}
                        onChange={(e) => setEditItem(prev => ({ ...prev, category: e.target.value }))}
                        className="input-field"
                        placeholder="e.g. Proteins, Produce, Dairy"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Unit Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editItem.unitCost}
                        onChange={(e) => setEditItem(prev => ({ ...prev, unitCost: e.target.value }))}
                        className="input-field"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Vendor Name</label>
                        <input
                          type="text"
                          value={editItem.vendorName}
                          onChange={(e) => setEditItem(prev => ({ ...prev, vendorName: e.target.value }))}
                          className="input-field"
                          placeholder="e.g. Fresh Farms Co."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Payment Day</label>
                        <input
                          type="date"
                          value={editItem.vendorPaymentDate}
                          onChange={(e) => setEditItem(prev => ({ ...prev, vendorPaymentDate: e.target.value }))}
                          className="input-field"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Payment Status</label>
                        <select
                          value={editItem.paymentStatus}
                          onChange={(e) => setEditItem(prev => ({ ...prev, paymentStatus: e.target.value }))}
                          className="input-field"
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="due">Due</option>
                          <option value="paid">Paid</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Paid At</label>
                        <input
                          type="datetime-local"
                          value={editItem.paidAt}
                          onChange={(e) => setEditItem(prev => ({ ...prev, paidAt: e.target.value }))}
                          className="input-field"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Payment Reference</label>
                        <input
                          type="text"
                          value={editItem.paymentReference}
                          onChange={(e) => setEditItem(prev => ({ ...prev, paymentReference: e.target.value }))}
                          className="input-field"
                          placeholder="Invoice/transaction id"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Payment Method (Optional)</label>
                        <input
                          type="text"
                          value={editItem.paymentMethod}
                          onChange={(e) => setEditItem(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="input-field"
                          placeholder="ACH, check, card"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => { setShowEditModal(false); setEditingItem(null); }}
                      className="btn-secondary"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateItem}
                      className="btn-primary"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Update Item'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Receipt Scan Modal */}
          <AnimatePresence>
            {showReceiptModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                onClick={() => { setShowReceiptModal(false); resetReceiptModal(); }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Scan Receipt
                    </h2>
                    <button onClick={() => { setShowReceiptModal(false); resetReceiptModal(); }} className="text-surface-400 hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {!analysisResult ? (
                    // Upload and Analyze Section
                    <div className="space-y-6">
                      <div className="text-center py-4">
                        <p className="text-surface-600 dark:text-surface-400 mb-4">
                          Upload a photo of your receipt and AI will automatically extract the items and add them to your inventory.
                        </p>
                      </div>

                      {!receiptPreview ? (
                        <div className="border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-xl p-8 text-center">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleReceiptImageChange}
                            className="hidden"
                            id="receipt-upload"
                          />
                          <label htmlFor="receipt-upload" className="cursor-pointer">
                            <div className="flex flex-col items-center">
                              <div className="p-4 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-3">
                                <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                              </div>
                              <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-1">
                                Upload Receipt Photo
                              </h3>
                              <p className="text-sm text-surface-500 dark:text-surface-400 mb-3">
                                Supports JPEG, PNG, WebP up to 10MB
                              </p>
                              <span className="btn-secondary inline-flex items-center gap-2">
                                <Camera className="w-4 h-4" />
                                Choose Image
                              </span>
                            </div>
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative">
                            <img
                              src={receiptPreview}
                              alt="Receipt preview"
                              className="w-full h-64 object-contain rounded-lg bg-surface-100 dark:bg-surface-900"
                            />
                            <button
                              onClick={() => {
                                setReceiptImage(null)
                                setReceiptPreview(null)
                              }}
                              className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {analysisError && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                              {analysisError}
                            </div>
                          )}

                          <button
                            onClick={handleAnalyzeReceipt}
                            disabled={isAnalyzing}
                            className="w-full btn-primary inline-flex items-center justify-center gap-2"
                          >
                            {isAnalyzing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Analyzing Receipt...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                Analyze Receipt with AI
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Analysis Results Section
                    <div className="space-y-6">
                      {/* Analysis Summary */}
                      <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-surface-900 dark:text-surface-100">
                            Receipt from {analysisResult.supplierName || 'Unknown Supplier'}
                          </h3>
                          <span className="text-sm text-surface-500 dark:text-surface-400">
                            {Math.round(analysisResult.confidence * 100)}% confidence
                          </span>
                        </div>
                        {analysisResult.totalAmount && (
                          <p className="text-sm text-surface-600 dark:text-surface-400">
                            Total: {analysisResult.currency || '$'}{analysisResult.totalAmount.toFixed(2)}
                          </p>
                        )}
                        <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                          Found {analysisResult.items.length} items
                        </p>
                      </div>

                      {/* Items List */}
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        <h4 className="font-medium text-surface-900 dark:text-surface-100 mb-2">
                          Items Detected ({analysisResult.items.filter(i => i.selected).length} selected)
                        </h4>
                        {analysisResult.items.map((item, index) => (
                          <div
                            key={index}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              item.selected
                                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800'
                                : 'bg-surface-50 dark:bg-surface-900 border-surface-200 dark:border-surface-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleItemSelection(index)}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateAnalysisItem(index, 'name', e.target.value)}
                                className="w-full bg-transparent text-sm font-medium text-surface-900 dark:text-surface-100 focus:outline-none"
                              />
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateAnalysisItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                                  className="w-16 text-xs bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-600 rounded px-1 py-0.5"
                                />
                                <input
                                  type="text"
                                  value={item.unit || 'each'}
                                  onChange={(e) => updateAnalysisItem(index, 'unit', e.target.value)}
                                  className="w-16 text-xs bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-600 rounded px-1 py-0.5"
                                />
                                <span className="text-xs text-surface-500 dark:text-surface-400">
                                  {item.category && `• ${item.category}`}
                                </span>
                                {item.totalPrice && (
                                  <span className="text-xs text-surface-500 dark:text-surface-400">
                                    • ${item.totalPrice.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${
                              item.confidence > 0.8 ? 'bg-green-500' :
                              item.confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} title={`Confidence: ${Math.round(item.confidence * 100)}%`} />
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={resetReceiptModal}
                          className="btn-secondary flex-1"
                        >
                          Scan Another
                        </button>
                        <button
                          onClick={handleCreateItemsFromReceipt}
                          disabled={isCreatingItems || !analysisResult.items.some(i => i.selected)}
                          className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
                        >
                          {isCreatingItems ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Create {analysisResult.items.filter(i => i.selected).length} Items
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </>
  )
}
