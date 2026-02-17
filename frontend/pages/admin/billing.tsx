import React from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import CompanyBilling from '../../components/Admin/CompanyBilling'

export default function AdminBillingPage() {
  return (
    <AdminLayout title="Billing" description="Track subscriptions and invoices across restaurants.">
      <CompanyBilling />
    </AdminLayout>
  )
}
