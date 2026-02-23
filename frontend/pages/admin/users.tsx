import React from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import CompanyUserManager from '../../components/Admin/CompanyUserManager'

export default function AdminUsersPage() {
  return (
    <AdminLayout title="Admin Users" description="Review platform admins and restaurant users with clear separation.">
      <CompanyUserManager />
    </AdminLayout>
  )
}
