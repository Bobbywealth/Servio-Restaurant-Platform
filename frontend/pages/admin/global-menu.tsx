import React from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import GlobalMenuManager from '../../components/Admin/GlobalMenuManager'

export default function AdminGlobalMenuPage() {
  return (
    <AdminLayout title="Global Menu" description="Distribute menu changes across restaurants.">
      <GlobalMenuManager />
    </AdminLayout>
  )
}
