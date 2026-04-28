import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { AlertCircle, Edit3, Filter, Plus, Search, RefreshCw, BookOpen, Power } from 'lucide-react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { api } from '../../lib/api'
import { TableRowSkeleton } from '../../components/ui/Skeleton'

interface Recipe {
  id: string
  name: string
  category?: string | null
  isActive?: boolean
  prepTimeMinutes?: number | null
  yield?: string | null
  updatedAt?: string | null
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRecipes = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get('/api/recipes', {
        params: {
          includeInactive: true
        }
      })

      const rows = response.data?.data || response.data?.recipes || []
      setRecipes(Array.isArray(rows) ? rows : [])
    } catch (err) {
      console.warn('Failed to load recipes', err)
      setError('Failed to load recipes. Please try again.')
      setRecipes([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  const categories = useMemo(() => {
    const values = new Set<string>()
    recipes.forEach((recipe) => {
      if (recipe.category) {
        values.add(recipe.category)
      }
    })

    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }, [recipes])

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const searchTarget = `${recipe.name} ${recipe.category || ''}`.toLowerCase()
      const matchesSearch = !searchTerm.trim() || searchTarget.includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [recipes, searchTerm, selectedCategory])

  const isEmpty = !isLoading && !error && filteredRecipes.length === 0

  return (
    <>
      <Head>
        <title>Recipes | Servio Dashboard</title>
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Recipes</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Manage prep recipes, categories, and activation status.
              </p>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Create Recipe
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search recipes"
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-8 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={fetchRecipes}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-900/20">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={fetchRecipes}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300"
              >
                Retry
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Recipe</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Prep Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Yield</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {isLoading && Array.from({ length: 6 }).map((_, index) => <TableRowSkeleton key={index} columns={6} />)}

                  {!isLoading && filteredRecipes.map((recipe) => {
                    const isActive = recipe.isActive !== false
                    return (
                      <tr key={recipe.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-primary-500" />
                            <span className="font-medium">{recipe.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{recipe.category || 'Uncategorized'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {typeof recipe.prepTimeMinutes === 'number' ? `${recipe.prepTimeMinutes} min` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{recipe.yield || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                              isActive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
                            >
                              <Power className="h-3.5 w-3.5" />
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {isEmpty && (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <BookOpen className="mb-3 h-8 w-8 text-gray-400" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">No recipes found</h3>
                <p className="mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">
                  Try adjusting your search or category filter, or create a new recipe to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}
