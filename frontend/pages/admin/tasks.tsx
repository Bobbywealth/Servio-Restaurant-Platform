import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { LayoutGrid, List, Plus, Trash2 } from 'lucide-react'

interface AdminTask {
  id: string
  scope: 'company' | 'restaurant'
  company_id: string | null
  restaurant_id: string | null
  restaurant_name: string | null
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  assigned_to: string | null
  assigned_to_name: string | null
  due_date: string | null
  created_at: string
}

type TaskScope = 'company' | 'restaurant'
type TaskScopeSelection = TaskScope | ''

interface RestaurantOption {
  id: string
  name: string
  company_id?: string | null
}

interface PaginationPayload {
  page: number
  pages: number
  total: number
}

const statusOptions: Array<AdminTask['status']> = ['pending', 'in_progress', 'completed']
const priorityOptions: Array<AdminTask['priority']> = ['low', 'medium', 'high']

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<AdminTask[]>([])
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [scopeFilter, setScopeFilter] = useState<'all' | TaskScope>('all')
  const [restaurantId, setRestaurantId] = useState('')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')
  const [pagination, setPagination] = useState<PaginationPayload>({ page: 1, pages: 1, total: 0 })
  const [newTask, setNewTask] = useState({
    scope: '' as TaskScopeSelection,
    company_id: '',
    restaurant_id: '',
    title: '',
    description: '',
    priority: 'medium' as AdminTask['priority'],
    due_date: ''
  })

  const fetchRestaurants = async () => {
    try {
      const res = await api.get('/api/admin/restaurants', { params: { limit: 200 } })
      setRestaurants(res.data?.restaurants || [])
      if (!newTask.company_id && res.data?.restaurants?.[0]?.company_id) {
        setNewTask((prev) => ({ ...prev, company_id: res.data.restaurants[0].company_id }))
      }
    } catch (fetchError) {
      console.error('Failed to fetch restaurants', fetchError)
    }
  }

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (search.trim()) params.search = search.trim()
      if (status !== 'all') params.status = status
      if (priority !== 'all') params.priority = priority
      if (scopeFilter !== 'all') params.scope = scopeFilter
      if (restaurantId) params.restaurantId = restaurantId

      const res = await api.get('/api/admin/tasks', { params })
      setTasks(res.data?.tasks || [])
      setPagination(res.data?.pagination || { page: 1, pages: 1, total: 0 })
    } catch (fetchError: any) {
      setError(fetchError?.response?.data?.error || 'Failed to load tasks')
    } finally {
      setIsLoading(false)
    }
  }, [page, priority, restaurantId, scopeFilter, search, status])

  useEffect(() => {
    fetchRestaurants()
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault()
    const isSingleRestaurant = newTask.scope === 'restaurant'
    if (!newTask.scope || !newTask.title.trim()) return
    if (isSingleRestaurant && !newTask.restaurant_id) return
    if (newTask.scope === 'company' && !newTask.company_id) return

    setIsSaving(true)
    try {
      await api.post('/api/admin/tasks', {
        scope: newTask.scope,
        company_id: newTask.scope === 'company' ? newTask.company_id : undefined,
        restaurant_id: newTask.scope === 'restaurant' ? newTask.restaurant_id : undefined,
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        priority: newTask.priority,
        due_date: newTask.due_date || null
      })

      setNewTask({
        scope: newTask.scope,
        company_id: newTask.company_id,
        restaurant_id: newTask.scope === 'restaurant' ? newTask.restaurant_id : '',
        title: '',
        description: '',
        priority: 'medium',
        due_date: ''
      })
      await fetchTasks()
    } catch (saveError: any) {
      setError(saveError?.response?.data?.error || 'Failed to create task')
    } finally {
      setIsSaving(false)
    }
  }

  const updateTaskStatus = async (taskId: string, nextStatus: AdminTask['status']) => {
    try {
      await api.patch(`/api/admin/tasks/${taskId}`, { status: nextStatus })
      await fetchTasks()
    } catch (updateError: any) {
      setError(updateError?.response?.data?.error || 'Failed to update task')
    }
  }

  const deleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return

    try {
      await api.delete(`/api/admin/tasks/${taskId}`)
      await fetchTasks()
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.error || 'Failed to delete task')
    }
  }

  const totalByStatus = useMemo(() => {
    return {
      pending: tasks.filter((task) => task.status === 'pending').length,
      in_progress: tasks.filter((task) => task.status === 'in_progress').length,
      completed: tasks.filter((task) => task.status === 'completed').length
    }
  }, [tasks])

  const tasksByStatus = useMemo(() => {
    return {
      pending: tasks.filter((task) => task.status === 'pending'),
      in_progress: tasks.filter((task) => task.status === 'in_progress'),
      completed: tasks.filter((task) => task.status === 'completed')
    }
  }, [tasks])

  return (
    <AdminLayout title="Task Management" description="Manage company tasks across all restaurants">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Pending" value={totalByStatus.pending} />
          <StatCard label="In Progress" value={totalByStatus.in_progress} />
          <StatCard label="Completed" value={totalByStatus.completed} />
        </div>

        <form onSubmit={createTask} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Task</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 self-center">Task scope *</label>
            <select
              aria-label="Task scope"
              value={newTask.scope}
              onChange={(event) => setNewTask((prev) => ({ ...prev, scope: event.target.value as TaskScopeSelection, restaurant_id: event.target.value === 'company' ? '' : prev.restaurant_id }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              required
            >
              <option value="" disabled>Select task scope</option>
              <option value="company">Company-wide</option>
              <option value="restaurant">Single restaurant</option>
            </select>
            {newTask.scope === 'restaurant' && (
            <select
              value={newTask.restaurant_id}
              onChange={(event) => setNewTask((prev) => ({ ...prev, restaurant_id: event.target.value }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              required
            >
              <option value="">Select restaurant</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
              ))}
            </select>
            )}
            <input
              value={newTask.title}
              onChange={(event) => setNewTask((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Task title"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              required
            />
            <select
              value={newTask.priority}
              onChange={(event) => setNewTask((prev) => ({ ...prev, priority: event.target.value as AdminTask['priority'] }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <input
              type="date"
              value={newTask.due_date}
              onChange={(event) => setNewTask((prev) => ({ ...prev, due_date: event.target.value }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              {isSaving ? 'Creating...' : 'Create'}
            </button>
          </div>
          <textarea
            value={newTask.description}
            onChange={(event) => setNewTask((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            rows={2}
          />
        </form>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
              <option value="all">All priorities</option>
              {priorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
              <option value="">All restaurants</option>
              {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>
            <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as 'all' | TaskScope)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
              <option value="all">All scopes</option>
              <option value="company">Company-wide</option>
              <option value="restaurant">Single restaurant</option>
            </select>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${viewMode === 'table' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'}`}
                type="button"
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${viewMode === 'board' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'}`}
                type="button"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
            </div>
            <button onClick={() => { setPage(1); fetchTasks() }} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm">Apply filters</button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">Task</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Restaurant</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Assigned</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  <tr><td className="px-3 py-4 text-sm text-gray-500" colSpan={8}>Loading tasks...</td></tr>
                ) : tasks.length === 0 ? (
                  <tr><td className="px-3 py-4 text-sm text-gray-500" colSpan={8}>No tasks found.</td></tr>
                ) : tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-3 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</p>
                      {task.description && <p className="text-xs text-gray-500 truncate max-w-sm">{task.description}</p>}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {task.scope === 'company' ? 'Company-wide' : 'Single restaurant'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">{task.scope === 'company' ? 'All restaurants' : (task.restaurant_name || 'Unknown')}</td>
                    <td className="px-3 py-3">
                      <select
                        value={task.status}
                        onChange={(event) => updateTaskStatus(task.id, event.target.value as AdminTask['status'])}
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs"
                      >
                        {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-sm capitalize">{task.priority}</td>
                    <td className="px-3 py-3 text-sm">{task.assigned_to_name || 'Unassigned'}</td>
                    <td className="px-3 py-3 text-sm">{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => deleteTask(task.id)} className="text-red-600 hover:text-red-700" title="Delete task">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {statusOptions.map((option) => (
                <div key={option} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{option.replace('_', ' ')}</h4>
                    <span className="text-xs text-gray-500">{tasksByStatus[option].length}</span>
                  </div>
                  <div className="space-y-2">
                    {tasksByStatus[option].length === 0 ? (
                      <p className="text-xs text-gray-500">No tasks</p>
                    ) : tasksByStatus[option].map((task) => (
                      <div key={task.id} className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
                          <button onClick={() => deleteTask(task.id)} className="text-red-600 hover:text-red-700" title="Delete task">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {task.description && <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>}
                        <div className="flex items-center justify-between text-xs">
                          <span className="capitalize text-gray-600 dark:text-gray-300">{task.priority}</span>
                          <select
                            value={task.status}
                            onChange={(event) => updateTaskStatus(task.id, event.target.value as AdminTask['status'])}
                            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs"
                          >
                            {statusOptions.map((statusOption) => <option key={statusOption} value={statusOption}>{statusOption}</option>)}
                          </select>
                        </div>
                        <p className="text-xs text-gray-500">{task.scope === 'company' ? 'Company-wide' : (task.restaurant_name || 'Single restaurant')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <p>Total tasks: {pagination.total}</p>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50">Previous</button>
              <span>Page {pagination.page} / {Math.max(pagination.pages, 1)}</span>
              <button disabled={pagination.page >= pagination.pages} onClick={() => setPage((prev) => prev + 1)} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}
