import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '../../contexts/UserContext'
import { 
  ChevronDown, 
  User, 
  Crown, 
  Shield, 
  Users, 
  Settings,
  CheckCircle,
  Loader2,
  AlertCircle
} from 'lucide-react'

interface AccountSwitcherProps {
  className?: string
}

const roleIcons = {
  admin: Shield,
  'platform-admin': Shield,
  owner: Crown, 
  manager: Settings,
  staff: User
}

const roleColors = {
  admin: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
  'platform-admin': 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  owner: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
  manager: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  staff: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
}

const roleNames = {
  admin: 'System Admin',
  'platform-admin': 'Platform Admin',
  owner: 'Restaurant Owner',
  manager: 'Restaurant Manager', 
  staff: 'Restaurant Staff'
}

export function AccountSwitcher({ className = '' }: AccountSwitcherProps) {
  const { user, availableAccounts, switchAccount, isLoading } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSwitchAccount = async (targetEmail: string) => {
    if (switchingTo || !targetEmail) return
    
    setSwitchingTo(targetEmail)
    setError(null)
    
    try {
      await switchAccount(targetEmail)
      setIsOpen(false)
    } catch (err) {
      setError('Failed to switch account. Please try again.')
      console.error('Account switch error:', err)
    } finally {
      setSwitchingTo(null)
    }
  }

  if (!user) return null

  const totalAccounts = Object.values(availableAccounts).flat().length
  const currentUserIcon = roleIcons[user.role] || User
  const currentUserColor = roleColors[user.role] || roleColors.staff

  return (
    <div className={`relative ${className}`}>
      {/* Compact Account Toggle for Header */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 transition-all duration-200"
        whileTap={{ scale: 0.98 }}
      >
        <div className={`p-1.5 rounded-lg ${currentUserColor}`}>
          {React.createElement(currentUserIcon, { className: 'w-4 h-4' })}
        </div>
        
        <div className="hidden sm:block text-left">
          <div className="font-medium text-surface-900 dark:text-surface-100 text-sm">
            {user.name}
          </div>
        </div>
        
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3 h-3 text-surface-400" />
        </motion.div>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 shadow-lg z-50 max-h-96 overflow-y-auto"
          >
            <div className="p-3">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="w-4 h-4 text-surface-500" />
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Switch Account for Testing
                </span>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                </motion.div>
              )}

              {Object.keys(availableAccounts).length === 0 ? (
                <div className="text-center py-6 text-surface-500 dark:text-surface-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No accounts available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(availableAccounts).map(([role, accounts]) => (
                    <div key={role}>
                      <div className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-2">
                        {roleNames[role as keyof typeof roleNames] || role}
                      </div>
                      
                      <div className="space-y-1">
                        {accounts.map((account) => {
                          const Icon = roleIcons[account.role] || User
                          const colorClass = roleColors[account.role] || roleColors.staff
                          const isCurrentUser = account.email === user.email
                          const isSwitching = switchingTo === account.email

                          return (
                            <motion.button
                              key={account.id}
                              onClick={() => !isCurrentUser && handleSwitchAccount(account.email)}
                              disabled={isCurrentUser || isSwitching || !!switchingTo}
                              className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left transition-all duration-200 ${
                                isCurrentUser
                                  ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                                  : 'hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                              whileTap={!isCurrentUser ? { scale: 0.98 } : {}}
                            >
                              <div className={`p-1.5 rounded ${colorClass}`}>
                                <Icon className="w-3 h-3" />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-surface-900 dark:text-surface-100 truncate">
                                    {account.name}
                                  </span>
                                  {isCurrentUser && (
                                    <CheckCircle className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                  )}
                                  {isSwitching && (
                                    <Loader2 className="w-4 h-4 text-primary-500 animate-spin flex-shrink-0" />
                                  )}
                                </div>
                                <div className="text-xs text-surface-500 dark:text-surface-400 truncate">
                                  {account.email}
                                </div>
                              </div>
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AccountSwitcher