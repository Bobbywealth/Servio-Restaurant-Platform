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
  X
} from 'lucide-react'

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

          {/* Inventory Table */}
          <motion.div
            className="card overflow-hidden"
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
        </div>
      </DashboardLayout>
    </>
  )
}