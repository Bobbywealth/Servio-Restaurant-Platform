import React, { useState, useMemo } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { 
  Users, 
  Clock, 
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit3,
  Phone,
  Mail,
  Calendar,
  DollarSign
} from 'lucide-react'

const DashboardLayout = dynamic(() => import('../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />
})

export default function StaffPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')

  // Mock staff data
  const staffMembers = useMemo(() => [
    {
      id: 1,
      name: 'Marcus Johnson',
      role: 'Manager',
      status: 'on-shift',
      email: 'marcus@restaurant.com',
      phone: '(555) 123-4567',
      hourlyRate: '$18.00',
      hoursThisWeek: 38,
      avatar: 'MJ',
      shiftStart: '9:00 AM',
      shiftEnd: '5:00 PM'
    },
    {
      id: 2,
      name: 'Sarah Williams',
      role: 'Server',
      status: 'on-shift',
      email: 'sarah@restaurant.com',
      phone: '(555) 234-5678',
      hourlyRate: '$12.50',
      hoursThisWeek: 32,
      avatar: 'SW',
      shiftStart: '11:00 AM',
      shiftEnd: '7:00 PM'
    },
    {
      id: 3,
      name: 'David Chen',
      role: 'Cook',
      status: 'off-shift',
      email: 'david@restaurant.com',
      phone: '(555) 345-6789',
      hourlyRate: '$15.00',
      hoursThisWeek: 40,
      avatar: 'DC',
      shiftStart: '10:00 AM',
      shiftEnd: '6:00 PM'
    },
    {
      id: 4,
      name: 'Lisa Rodriguez',
      role: 'Server',
      status: 'on-break',
      email: 'lisa@restaurant.com',
      phone: '(555) 456-7890',
      hourlyRate: '$12.50',
      hoursThisWeek: 29,
      avatar: 'LR',
      shiftStart: '12:00 PM',
      shiftEnd: '8:00 PM'
    },
    {
      id: 5,
      name: 'James Thompson',
      role: 'Cook',
      status: 'on-shift',
      email: 'james@restaurant.com',
      phone: '(555) 567-8901',
      hourlyRate: '$16.00',
      hoursThisWeek: 35,
      avatar: 'JT',
      shiftStart: '2:00 PM',
      shiftEnd: '10:00 PM'
    }
  ], [])

  const roles = ['all', 'Manager', 'Server', 'Cook', 'Host']

  const filteredStaff = staffMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === 'all' || member.role === selectedRole
    return matchesSearch && matchesRole
  })

  const onShiftCount = staffMembers.filter(member => member.status === 'on-shift').length
  const totalHours = staffMembers.reduce((sum, member) => sum + member.hoursThisWeek, 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-shift':
        return 'status-success'
      case 'on-break':
        return 'status-warning'
      case 'off-shift':
        return 'status-neutral'
      default:
        return 'status-neutral'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'on-shift':
        return 'On Shift'
      case 'on-break':
        return 'On Break'
      case 'off-shift':
        return 'Off Shift'
      default:
        return 'Unknown'
    }
  }

  return (
    <>
      <Head>
        <title>Staff Management - Servio Restaurant Platform</title>
        <meta name="description" content="Manage restaurant staff, schedules, and shifts" />
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
                Staff Management
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Manage team members, schedules, and shifts
              </p>
            </div>
            <motion.button
              className="btn-primary inline-flex items-center space-x-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </motion.button>
          </div>

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
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
                    Total Staff
                  </p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    {staffMembers.length}
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
                <div className="p-3 rounded-xl bg-servio-green-500">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
                    Currently On Shift
                  </p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    {onShiftCount}
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
                <div className="p-3 rounded-xl bg-servio-orange-500">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
                    Total Hours This Week
                  </p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    {totalHours}
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
                placeholder="Search staff members..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-surface-500" />
              <select
                className="input-field"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {roles.map(role => (
                  <option key={role} value={role}>
                    {role === 'all' ? 'All Roles' : role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map((member, index) => (
              <motion.div
                key={member.id}
                className="card-hover"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center text-white font-semibold">
                      {member.avatar}
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900 dark:text-surface-100">
                        {member.name}
                      </h3>
                      <p className="text-sm text-surface-600 dark:text-surface-400">
                        {member.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`status-badge ${getStatusColor(member.status)}`}>
                      {getStatusText(member.status)}
                    </span>
                    <button className="btn-icon">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-surface-600 dark:text-surface-400">
                    <Mail className="w-4 h-4" />
                    <span>{member.email}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-surface-600 dark:text-surface-400">
                    <Phone className="w-4 h-4" />
                    <span>{member.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-surface-600 dark:text-surface-400">
                    <Clock className="w-4 h-4" />
                    <span>{member.shiftStart} - {member.shiftEnd}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
                    <div>
                      <span className="text-sm text-surface-600 dark:text-surface-400">Rate:</span>
                      <span className="ml-1 font-semibold text-surface-900 dark:text-surface-100">
                        {member.hourlyRate}/hr
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-surface-600 dark:text-surface-400">This week:</span>
                      <span className="ml-1 font-semibold text-surface-900 dark:text-surface-100">
                        {member.hoursThisWeek}h
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex space-x-2">
                  <button className="btn-secondary flex-1 text-sm">
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                  <button className="btn-secondary text-sm">
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredStaff.length === 0 && (
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Users className="w-12 h-12 text-surface-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                No staff members found
              </h3>
              <p className="text-surface-600 dark:text-surface-400">
                Try adjusting your search or filter criteria
              </p>
            </motion.div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}