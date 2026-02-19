import React, { useState, useEffect, useMemo, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { api } from '../../../lib/api'
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  X,
  Upload,
  Calendar,
  Building2,
  DollarSign,
  Trash2,
  PackageCheck,
  ChevronRight
} from 'lucide-react'

const DashboardLayout = dynamic(() => import('../../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />
})

interface ReceiptItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  total_price: number;
  inventory_item_id: string | null;
  matched_item_name?: string;
  matched_item_unit?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unit_type: string;
  current_quantity: number;
}

interface Receipt {
  id: string;
  restaurant_id: string;
  supplier_name: string | null;
  receipt_date: string | null;
  total_amount: number | null;
  processing_status: 'pending' | 'uploaded' | 'needs_review' | 'processed' | 'failed';
  created_at: string;
  previewUrl: string | null;
  storage_key: string | null;
}

export default function ReceiptsPage() {
  const router = useRouter()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [lineItems, setLineItems] = useState<ReceiptItem[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'generating' | 'uploading' | 'confirming' | 'success'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  
  // Line Item Editing State
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [newItem, setNewItem] = useState({ itemName: '', quantity: 1, unitCost: 0, inventoryItemId: '' })
  const [invSearch, setInvSearch] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('servio_access_token')
    if (!token) {
      router.replace('/login')
    }
  }, [router])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('servio_access_token')
      if (!token) {
        setLoading(false)
        return
      }
    }
    fetchReceipts()
    fetchInventory()
  }, [])

  useEffect(() => {
    if (selectedReceipt) {
      fetchLineItems(selectedReceipt.id)
    }
  }, [selectedReceipt])

  const fetchReceipts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/receipts/list')
      const data = res.data
      if (data.success) setReceipts(data.data.receipts)
    } catch (error) {
      console.error('Failed to fetch receipts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchInventory = async () => {
    try {
      const res = await api.get('/api/inventory/search')
      const data = res.data
      if (data.success) setInventoryItems(data.data || [])
    } catch (error) {
      console.error('Failed to fetch inventory:', error)
    }
  }

  const fetchLineItems = async (id: string) => {
    try {
      const res = await api.get(`/api/receipts/${id}/items`)
      const data = res.data
      if (data.success) setLineItems(data.data.items)
    } catch (error) {
      console.error('Failed to fetch line items:', error)
    }
  }

  const handleAddLineItem = async () => {
    if (!selectedReceipt || !newItem.itemName) return
    try {
      await api.post(`/api/receipts/${selectedReceipt.id}/items`, newItem)
      setIsAddingItem(false)
      setNewItem({ itemName: '', quantity: 1, unitCost: 0, inventoryItemId: '' })
      fetchLineItems(selectedReceipt.id)
    } catch (error) {
      console.error('Failed to add item:', error)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Remove this line item?')) return
    try {
      await api.delete(`/api/receipts/items/${itemId}`)
      fetchLineItems(selectedReceipt!.id)
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const handleMatchItem = (item: ReceiptItem) => {
    const searchValue = item.matched_item_name || item.item_name
    router.push(`/dashboard/inventory?search=${encodeURIComponent(searchValue)}`)
  }

  const handleApplyToInventory = async () => {
    if (!selectedReceipt) return
    const matchedCount = lineItems.filter(i => i.inventory_item_id).length
    if (matchedCount === 0) {
      alert('Please match at least one item to inventory before applying.')
      return
    }

    const preview = lineItems
      .filter(i => i.inventory_item_id)
      .map(i => `• ${i.matched_item_name}: +${i.quantity} ${i.matched_item_unit}`)
      .join('\n')

    if (!confirm(`Apply the following to inventory?\n\n${preview}`)) return

    try {
      const res = await api.post(`/api/receipts/${selectedReceipt.id}/apply`)
      const data = res.data
      if (data.success) {
        alert(data.data.message)
        setSelectedReceipt(null)
        fetchReceipts()
      }
    } catch (error) {
      console.error('Failed to apply inventory:', error)
    }
  }

  const filteredInv = useMemo(() => {
    if (!invSearch) return inventoryItems.slice(0, 5)
    return inventoryItems
      .filter(i => i.name.toLowerCase().includes(invSearch.toLowerCase()))
      .slice(0, 5)
  }, [inventoryItems, invSearch])

  const handleUpload = async () => {
    if (!uploadFile) return

    try {
      setUploadProgress('generating')
      
      const createRes = await api.post('/api/receipts/create-upload', {
        fileName: uploadFile.name,
        contentType: uploadFile.type
      })
      
      const createData = createRes.data
      if (!createData.success) throw new Error(createData.error?.message || 'Failed to initiate upload')
      
      const { receiptId, uploadUrl } = createData.data

      setUploadProgress('uploading')
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: uploadFile,
        headers: { 'Content-Type': uploadFile.type }
      })

      if (!uploadRes.ok) throw new Error('Failed to upload file to storage')

      setUploadProgress('confirming')
      const confirmRes = await api.post(`/api/receipts/${receiptId}/confirm-upload`, { fileSize: uploadFile.size })
      const confirmData = confirmRes.data
      if (!confirmData.success) throw new Error(confirmData.error?.message || 'Failed to confirm upload')

      setUploadProgress('success')
      setTimeout(() => {
        setIsUploadModalOpen(false)
        setUploadProgress('idle')
        setUploadFile(null)
        fetchReceipts()
      }, 1500)

    } catch (error: any) {
      console.error('Upload failed:', error)
      alert(error.message)
      setUploadProgress('idle')
    }
  }

  const resetUploadState = () => {
    setUploadFile(null)
    setUploadProgress('idle')
    setUploadError(null)
    setIsDragging(false)
  }

  const closeUploadModal = () => {
    setIsUploadModalOpen(false)
    resetUploadState()
  }

  const handleSelectedFile = (file: File | null) => {
    if (!file) return
    const maxBytes = 10 * 1024 * 1024
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) {
      setUploadError('Unsupported file type. Please upload an image or PDF.')
      setUploadFile(null)
      return
    }
    if (file.size > maxBytes) {
      setUploadError('File is too large. Max size is 10MB.')
      setUploadFile(null)
      return
    }
    setUploadError(null)
    setUploadFile(file)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    handleSelectedFile(file || null)
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const file = event.clipboardData?.files?.[0]
    if (file) {
      event.preventDefault()
      handleSelectedFile(file)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed': return <CheckCircle2 className="w-4 h-4 text-servio-green-500" />
      case 'failed': return <AlertCircle className="w-4 h-4 text-servio-red-500" />
      case 'needs_review': return <Clock className="w-4 h-4 text-amber-500" />
      default: return <Clock className="w-4 h-4 text-surface-400" />
    }
  }

  const filteredReceipts = receipts.filter(r => 
    r.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <>
      <Head>
        <title>Receipts Management - Servio Restaurant Platform</title>
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
                Receipts & Invoices
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Upload and track supplier receipts for inventory tracking
              </p>
            </div>
            <motion.button
              onClick={() => setIsUploadModalOpen(true)}
              className="btn-primary inline-flex items-center space-x-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Upload className="w-4 h-4" />
              <span>Upload Receipt</span>
            </motion.button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by supplier or ID..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn-secondary flex items-center space-x-2">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>

          {/* Receipts Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="card h-48 animate-pulse bg-surface-100 dark:bg-surface-800" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredReceipts.map((receipt) => (
                  <motion.div
                    key={receipt.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="card-hover group cursor-pointer"
                    onClick={() => setSelectedReceipt(receipt)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                        <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(receipt.processing_status)}
                        <span className="text-xs font-medium uppercase tracking-wider text-surface-500">
                          {receipt.processing_status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-surface-900 dark:text-surface-100 truncate">
                        {receipt.supplier_name || 'New Receipt'}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1 text-sm text-surface-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{receipt.receipt_date || new Date(receipt.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-4 border-t border-surface-100 dark:border-surface-800">
                      <span className="text-lg font-bold text-surface-900 dark:text-surface-100">
                        {receipt.total_amount ? `$${receipt.total_amount.toFixed(2)}` : '---'}
                      </span>
                      <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="btn-icon p-1.5 bg-surface-100 dark:bg-surface-800">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="btn-icon p-1.5 bg-surface-100 dark:bg-surface-800">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredReceipts.length === 0 && (
            <div className="text-center py-20 bg-surface-50 dark:bg-surface-800/50 rounded-2xl border-2 border-dashed border-surface-200 dark:border-surface-700">
              <FileText className="w-12 h-12 text-surface-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100">No receipts found</h3>
              <p className="text-surface-500 mt-1">Upload your first receipt to get started</p>
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="btn-primary mt-6 inline-flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Now</span>
              </button>
            </div>
          )}
        </div>

        {/* Upload Modal */}
        <AnimatePresence>
          {isUploadModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeUploadModal}
              />
              <motion.div 
                className="card w-full max-w-md relative z-10"
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">Upload Receipt</h2>
                  <button onClick={closeUploadModal} className="btn-icon">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {uploadProgress === 'idle' ? (
                    <div className="space-y-4">
                      <div 
                        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                          isDragging
                            ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-900/20'
                            : 'border-surface-200 dark:border-surface-700 hover:border-primary-500'
                        }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={(event) => {
                          event.preventDefault()
                          setIsDragging(true)
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onPaste={handlePaste}
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          className="hidden" 
                          accept="image/*,application/pdf"
                          onChange={(e) => handleSelectedFile(e.target.files?.[0] || null)}
                        />
                        <Upload className="w-10 h-10 text-surface-300 mx-auto mb-4" />
                        <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
                          {uploadFile ? uploadFile.name : 'Click to select, drag and drop, or paste a screenshot'}
                        </p>
                        <p className="text-xs text-surface-500 mt-1">
                          Supports images or PDFs up to 10MB
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          ref={cameraInputRef}
                          className="hidden"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleSelectedFile(e.target.files?.[0] || null)}
                        />
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="btn-secondary flex-1"
                        >
                          Take Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-secondary flex-1"
                        >
                          Upload File
                        </button>
                      </div>

                      {uploadError && (
                        <p className="text-sm text-servio-red-500">{uploadError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="py-10 text-center space-y-4">
                      <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="font-medium text-surface-900 dark:text-surface-100">
                        {uploadProgress === 'generating' && 'Generating secure link...'}
                        {uploadProgress === 'uploading' && 'Uploading to storage...'}
                        {uploadProgress === 'confirming' && 'Confirming upload...'}
                        {uploadProgress === 'success' && 'Upload successful!'}
                      </p>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button 
                      onClick={closeUploadModal}
                      className="btn-secondary flex-1"
                      disabled={uploadProgress !== 'idle'}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleUpload}
                      className="btn-primary flex-1"
                      disabled={!uploadFile || uploadProgress !== 'idle' || !!uploadError}
                    >
                      Upload
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Receipt Detail Sidebar */}
        <AnimatePresence>
          {selectedReceipt && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <motion.div 
                className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedReceipt(null)}
              />
              <motion.div 
                className="w-full max-w-2xl bg-white dark:bg-surface-900 h-full relative z-10 shadow-2xl flex flex-col"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              >
                <div className="p-6 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">Receipt Details</h2>
                  <button onClick={() => setSelectedReceipt(null)} className="btn-icon">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Grid: Preview & Info */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Preview */}
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-surface-500 uppercase tracking-widest">Document Preview</p>
                      <div className="aspect-[3/4] rounded-xl bg-surface-100 dark:bg-surface-800 overflow-hidden relative group border border-surface-200 dark:border-surface-700">
                        {selectedReceipt.previewUrl ? (
                          <iframe src={selectedReceipt.previewUrl} className="w-full h-full border-0" title="Receipt Preview" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                            <AlertCircle className="w-8 h-8 text-surface-300 mb-2" />
                            <p className="text-sm text-surface-500">Preview not available.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span className={`status-badge ${
                          selectedReceipt.processing_status === 'processed' ? 'status-success' : 'status-warning'
                        }`}>
                          {selectedReceipt.processing_status.replace('_', ' ')}
                        </span>
                        <p className="text-2xs font-mono text-surface-400">ID: {selectedReceipt.id.slice(0,8)}</p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-surface-500 uppercase">Supplier</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            defaultValue={selectedReceipt.supplier_name || ''} 
                            placeholder="e.g. Sysco, Local Farm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-surface-500 uppercase">Date</label>
                            <input type="date" className="input-field" defaultValue={selectedReceipt.receipt_date?.split('T')[0] || ''} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-surface-500 uppercase">Total ($)</label>
                            <input type="number" className="input-field" defaultValue={selectedReceipt.total_amount || 0} step="0.01" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100">Line Items</h3>
                      <button 
                        onClick={() => setIsAddingItem(true)}
                        className="btn-secondary py-1.5 px-3 text-sm flex items-center space-x-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Item</span>
                      </button>
                    </div>

                    <div className="hidden md:block border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden">
                      <table className="min-w-full divide-y divide-surface-200 dark:divide-surface-700">
                        <thead className="bg-surface-50 dark:bg-surface-800">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold text-surface-500 uppercase">Description</th>
                            <th className="px-4 py-2 text-left text-xs font-bold text-surface-500 uppercase">Qty</th>
                            <th className="px-4 py-2 text-left text-xs font-bold text-surface-500 uppercase">Cost</th>
                            <th className="px-4 py-2 text-left text-xs font-bold text-surface-500 uppercase">Matched To</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                          {lineItems.map(item => (
                            <tr key={item.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                              <td className="px-4 py-3 text-sm text-surface-900 dark:text-surface-100">{item.item_name}</td>
                              <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">{item.quantity}</td>
                              <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">${item.unit_cost.toFixed(2)}</td>
                              <td className="px-4 py-3">
                                {item.inventory_item_id ? (
                                  <div className="flex items-center space-x-2 text-servio-green-600 dark:text-servio-green-400">
                                    <PackageCheck className="w-4 h-4" />
                                    <span className="text-sm font-medium">{item.matched_item_name}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium text-surface-400 italic">Needs match</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleMatchItem(item)}
                                  className="text-primary-600 hover:text-primary-700 text-sm font-medium px-2 py-1"
                                >
                                  Match
                                </button>
                                <button onClick={() => handleDeleteItem(item.id)} className="text-surface-400 hover:text-servio-red-500 p-1">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {isAddingItem && (
                            <tr className="bg-primary-50/30 dark:bg-primary-900/10">
                              <td className="px-4 py-3">
                                <input 
                                  className="input-field py-1" 
                                  placeholder="Item name..." 
                                  value={newItem.itemName}
                                  onChange={e => setNewItem({...newItem, itemName: e.target.value})}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="number" 
                                  className="input-field py-1 w-16" 
                                  value={newItem.quantity}
                                  onChange={e => setNewItem({...newItem, quantity: parseFloat(e.target.value)})}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="number" 
                                  className="input-field py-1 w-20" 
                                  value={newItem.unitCost}
                                  onChange={e => setNewItem({...newItem, unitCost: parseFloat(e.target.value)})}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="relative">
                                  <input 
                                    className="input-field py-1" 
                                    placeholder="Search inventory..." 
                                    value={invSearch}
                                    onChange={e => setInvSearch(e.target.value)}
                                  />
                                  {invSearch && (
                                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-surface-800 shadow-xl rounded-lg border border-surface-200 dark:border-surface-700 max-h-40 overflow-y-auto">
                                      {filteredInv.map(inv => (
                                        <button 
                                          key={inv.id}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-700 flex justify-between"
                                          onClick={() => {
                                            setNewItem({...newItem, inventoryItemId: inv.id, itemName: newItem.itemName || inv.name});
                                            setInvSearch(inv.name);
                                          }}
                                        >
                                          <span>{inv.name}</span>
                                          <span className="text-2xs text-surface-400">{inv.unit_type}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex space-x-1">
                                  <button onClick={handleAddLineItem} className="text-primary-600 font-bold p-1"><CheckCircle2 className="w-5 h-5"/></button>
                                  <button onClick={() => setIsAddingItem(false)} className="text-surface-400 p-1"><X className="w-5 h-5"/></button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden space-y-3">
                      {lineItems.map(item => (
                        <div key={item.id} className="border border-surface-200 dark:border-surface-700 rounded-xl p-4 space-y-3 bg-white dark:bg-surface-900">
                          <div>
                            <p className="text-xs font-bold uppercase text-surface-500">Description</p>
                            <p className="text-sm font-medium text-surface-900 dark:text-surface-100 mt-1">{item.item_name}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase text-surface-500">Qty</p>
                              <p className="text-sm text-surface-900 dark:text-surface-100 mt-1">{item.quantity}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase text-surface-500">Cost</p>
                              <p className="text-sm text-surface-900 dark:text-surface-100 mt-1">${item.unit_cost.toFixed(2)}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase text-surface-500">Matched Inventory</p>
                            {item.inventory_item_id ? (
                              <button
                                type="button"
                                onClick={() => handleMatchItem(item)}
                                className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-servio-green-600 dark:text-servio-green-400 hover:underline min-h-11"
                              >
                                <PackageCheck className="w-4 h-4" />
                                <span>{item.matched_item_name}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMatchItem(item)}
                                className="mt-1 text-sm font-medium text-primary-600 hover:underline min-h-11"
                              >
                                Match inventory
                              </button>
                            )}
                          </div>

                          <div className="pt-3 border-t border-surface-200 dark:border-surface-700 space-y-2">
                            <button
                              type="button"
                              onClick={() => handleMatchItem(item)}
                              className="w-full min-h-11 rounded-lg border border-primary-200 text-primary-700 dark:text-primary-300 dark:border-primary-700 font-medium"
                            >
                              Match Item
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="w-full min-h-11 rounded-lg border border-servio-red-200 text-servio-red-600 dark:border-servio-red-700 dark:text-servio-red-400 font-medium"
                            >
                              Delete Item
                            </button>
                          </div>
                        </div>
                      ))}

                      {isAddingItem && (
                        <div className="border border-primary-200 dark:border-primary-800 rounded-xl p-4 space-y-4 bg-primary-50/30 dark:bg-primary-900/10">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-surface-500 uppercase">Description</label>
                            <input
                              className="input-field"
                              placeholder="Item name..."
                              value={newItem.itemName}
                              onChange={e => setNewItem({ ...newItem, itemName: e.target.value })}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-surface-500 uppercase">Qty</label>
                              <input
                                type="number"
                                className="input-field"
                                value={newItem.quantity}
                                onChange={e => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-surface-500 uppercase">Unit Cost</label>
                              <input
                                type="number"
                                className="input-field"
                                value={newItem.unitCost}
                                onChange={e => setNewItem({ ...newItem, unitCost: parseFloat(e.target.value) })}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-surface-500 uppercase">Match inventory</label>
                            <div className="relative">
                              <input
                                className="input-field"
                                placeholder="Search inventory..."
                                value={invSearch}
                                onChange={e => setInvSearch(e.target.value)}
                              />
                              {invSearch && (
                                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-surface-800 shadow-xl rounded-lg border border-surface-200 dark:border-surface-700 max-h-40 overflow-y-auto">
                                  {filteredInv.map(inv => (
                                    <button
                                      key={inv.id}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-700 flex justify-between"
                                      onClick={() => {
                                        setNewItem({ ...newItem, inventoryItemId: inv.id, itemName: newItem.itemName || inv.name })
                                        setInvSearch(inv.name)
                                      }}
                                    >
                                      <span>{inv.name}</span>
                                      <span className="text-2xs text-surface-400">{inv.unit_type}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <button onClick={handleAddLineItem} className="btn-primary w-full min-h-11">Add Line Item</button>
                            <button onClick={() => setIsAddingItem(false)} className="btn-secondary w-full min-h-11">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-surface-100 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm">
                      <span className="text-surface-500 font-medium">Matched Items:</span>
                      <span className="ml-2 font-bold text-surface-900 dark:text-surface-100">
                        {lineItems.filter(i => i.inventory_item_id).length} / {lineItems.length}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-surface-500 font-medium">Applied Amount:</span>
                      <span className="ml-2 font-bold text-primary-600">
                        ${lineItems.filter(i => i.inventory_item_id).reduce((sum, i) => sum + i.total_price, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <button 
                    className="btn-primary w-full py-4 flex items-center justify-center space-x-3"
                    disabled={selectedReceipt.processing_status === 'processed' || lineItems.filter(i => i.inventory_item_id).length === 0}
                    onClick={handleApplyToInventory}
                  >
                    <PackageCheck className="w-5 h-5" />
                    <span className="text-lg font-bold">Apply to Inventory</span>
                  </button>
                  <p className="text-center text-2xs text-surface-400 mt-3">
                    Only matched items will generate inventory transactions.
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </>
  )
}
