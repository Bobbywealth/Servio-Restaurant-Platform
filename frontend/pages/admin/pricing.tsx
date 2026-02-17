import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'

type Plan = {
  id: string
  name: string
  slug: string
  description: string
  price_monthly: number
  is_featured: boolean
  is_active: boolean
}

export default function AdminPricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [priceMonthly, setPriceMonthly] = useState('')

  const load = async () => {
    const response = await api.get('/api/admin/pricing-structures')
    setPlans(response.data.plans || [])
  }

  useEffect(() => { load().catch(() => undefined) }, [])

  const createPlan = async () => {
    if (!name.trim() || !slug.trim() || !priceMonthly.trim()) return
    await api.post('/api/admin/pricing-structures', {
      name,
      slug,
      price_monthly: Number(priceMonthly),
      description: '',
      features: []
    })
    setName('')
    setSlug('')
    setPriceMonthly('')
    await load()
  }

  const togglePlan = async (plan: Plan) => {
    await api.patch(`/api/admin/pricing-structures/${plan.id}`, { is_active: !plan.is_active })
    await load()
  }

  return (
    <AdminLayout title="Pricing Structures" description="Control homepage pricing from the admin panel">
      <div className="grid gap-4 md:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name" className="rounded border border-gray-300 px-3 py-2 dark:bg-gray-900" />
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug" className="rounded border border-gray-300 px-3 py-2 dark:bg-gray-900" />
        <input value={priceMonthly} onChange={(e) => setPriceMonthly(e.target.value)} placeholder="Monthly price" className="rounded border border-gray-300 px-3 py-2 dark:bg-gray-900" />
      </div>
      <button onClick={createPlan} className="mt-3 rounded bg-red-600 px-4 py-2 text-white">Create plan</button>

      <div className="mt-4 space-y-3">
        {plans.map((plan) => (
          <div key={plan.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div>
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="text-sm text-gray-500">${Number(plan.price_monthly).toFixed(2)}/mo • {plan.slug}</p>
            </div>
            <button onClick={() => togglePlan(plan)} className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600">
              {plan.is_active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
