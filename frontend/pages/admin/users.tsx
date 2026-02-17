import React from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import CompanyUserManager from '../../components/Admin/CompanyUserManager'

export default function AdminUsersPage() {
  return (
    <AdminLayout title="Admin Users" description="Invite and manage platform-level company access.">
      <CompanyUserManager />
    </AdminLayout>
  )
}
