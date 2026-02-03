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
  Sparkles
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

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
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
    category: ''
  })
  const [editItem, setEditItem] = useState({
    id: '',
    name: '',
    sku: '',
    unit: 'each',
    onHandQty: '',
    lowStockThreshold: '',
    category: ''
  })
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptImage, setReceiptImage] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<ReceiptAnalysisResult | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [isCreatingItems, setIsCreatingItems] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const resp = await api.get('/api/inventory/search', {
        params: {
          q: searchTerm || undefined,
          category: selectedCategory === 'all' ? undefined : selectedCategory
        }
      })
      setItems(resp.data?.data || [])
    } catch (e: any) {
      setError('Failed to load inventory')
    } finally {
      setIsLoading(false)
    }
  }, [searchTerm, selectedCategory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
        category: newItem.category.trim() || undefined
      })
      toast.success('Inventory item created')
      setShowAddModal(false)
      setNewItem({ name: '', sku: '', unit: 'each', onHandQty: '', lowStockThreshold: '', category: '' })
      await fetchData()
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
      category: item.category || ''
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
        category: editItem.category.trim() || undefined
      })
      toast.success('Inventory item updated')
      setShowEditModal(false)
      setEditingItem(null)
      await fetchData()
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

  const lowStockCount = items.filter(item => item.on_hand_qty <= item.low_stock_threshold).length

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search inventory items..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-surface-500" />
              <select
                className="input-field"
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
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                  {items.map((item, index) => (
                    <motion.tr
                      key={item.id}
                      className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
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
                        —
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`status-badge ${
                          item.on_hand_qty <= item.low_stock_threshold ? 'status-warning' : 'status-success'
                        }`}>
                          {item.on_hand_qty <= item.low_stock_threshold ? 'Low Stock' : 'Good'}
                        </span>
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
                <motion.div
                  key={item.id}
                  className="card hover:shadow-lg transition-shadow"
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
                    <span className={`status-badge ml-2 ${
                      item.on_hand_qty <= item.low_stock_threshold ? 'status-warning' : 'status-success'
                    }`}>
                      {item.on_hand_qty <= item.low_stock_threshold ? 'Low' : 'Good'}
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