import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ClipboardList,
  Package,
  Users,
  Clock,
  DollarSign,
  AlertTriangle,
  ChefHat,
  Phone,
  MessageSquare,
  Settings
} from 'lucide-react'

interface QuickCommand {
  id: string
  label: string
  command: string
  icon: React.ComponentType<{ className?: string }>
  category: 'orders' | 'inventory' | 'staff' | 'general'
  description: string
}

interface QuickCommandsProps {
  onCommand: (command: string) => void
  disabled?: boolean
  className?: string
}

const QUICK_COMMANDS: QuickCommand[] = [
  // Orders
  {
    id: 'check-new-orders',
    label: 'New Orders',
    command: 'Check for new orders',
    icon: ClipboardList,
    category: 'orders',
    description: 'Check for new incoming orders'
  },
  {
    id: 'order-status',
    label: 'Order Status',
    command: 'What is the status of table 5?',
    icon: Clock,
    category: 'orders',
    description: 'Check order status for a specific table'
  },
  {
    id: 'urgent-orders',
    label: 'Urgent Orders',
    command: 'Show me urgent orders',
    icon: AlertTriangle,
    category: 'orders',
    description: 'List orders that need immediate attention'
  },

  // Inventory
  {
    id: 'check-inventory',
    label: 'Check Stock',
    command: 'Check inventory levels for today',
    icon: Package,
    category: 'inventory',
    description: 'Get current inventory status'
  },
  {
    id: 'low-stock',
    label: 'Low Stock',
    command: 'What items are running low?',
    icon: Package,
    category: 'inventory',
    description: 'List items with low inventory'
  },
  {
    id: 'kitchen-supplies',
    label: 'Kitchen Needs',
    command: 'What does the kitchen need?',
    icon: ChefHat,
    category: 'inventory',
    description: 'Check what kitchen supplies are needed'
  },

  // Staff
  {
    id: 'staff-schedule',
    label: 'Who\'s Working',
    command: 'Who is scheduled to work today?',
    icon: Users,
    category: 'staff',
    description: 'Check current staff schedule'
  },
  {
    id: 'call-manager',
    label: 'Call Manager',
    command: 'I need to contact the manager',
    icon: Phone,
    category: 'staff',
    description: 'Get manager contact information'
  },
  {
    id: 'break-request',
    label: 'Request Break',
    command: 'I need to take a break',
    icon: Clock,
    category: 'staff',
    description: 'Request permission for break'
  },

  // General
  {
    id: 'sales-today',
    label: 'Today\'s Sales',
    command: 'How are sales looking today?',
    icon: DollarSign,
    category: 'general',
    description: 'Get current sales summary'
  },
  {
    id: 'customer-complaint',
    label: 'Customer Issue',
    command: 'A customer has a complaint',
    icon: MessageSquare,
    category: 'general',
    description: 'Report a customer complaint'
  },
  {
    id: 'system-help',
    label: 'Help',
    command: 'What can you help me with?',
    icon: Settings,
    category: 'general',
    description: 'Get help with Servio commands'
  }
]

const CATEGORIES = {
  orders: { label: 'Orders', color: 'blue' },
  inventory: { label: 'Inventory', color: 'green' },
  staff: { label: 'Staff', color: 'purple' },
  general: { label: 'General', color: 'gray' }
}

export default function QuickCommands({
  onCommand,
  disabled = false,
  className = ''
}: QuickCommandsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [hoveredCommand, setHoveredCommand] = useState<string | null>(null)

  const filteredCommands = selectedCategory
    ? QUICK_COMMANDS.filter(cmd => cmd.category === selectedCategory)
    : QUICK_COMMANDS

  const getCategoryColor = (category: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200',
      green: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
      purple: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200',
      gray: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
    }
    return colors[category as keyof typeof colors] || colors.gray
  }

  const getCommandButtonColor = (category: string) => {
    const colors = {
      orders: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
      inventory: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200',
      staff: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200',
      general: 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
    }
    return colors[category as keyof typeof colors] || colors.general
  }

  return (
    <div className={`${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Commands</h3>
        <p className="text-sm text-gray-600">
          Click any command to quickly ask Servio for help
        </p>
      </div>

      {/* Category Filter */}
      <div className="mb-4">
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`flex-shrink-0 px-3 py-2 sm:py-1 rounded-full text-sm sm:text-xs font-medium border transition-colors duration-200 touch-manipulation mobile-tap-highlight min-h-touch ${
              selectedCategory === null
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {Object.entries(CATEGORIES).map(([key, category]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex-shrink-0 px-3 py-2 sm:py-1 rounded-full text-sm sm:text-xs font-medium border transition-colors duration-200 touch-manipulation mobile-tap-highlight min-h-touch ${
                selectedCategory === key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : getCategoryColor(category.color)
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Commands List - Horizontal Scroll */}
      <div className="flex overflow-x-auto gap-4 pb-4 -mx-1 px-1 snap-x mobile-scrolling scrollbar-hide">
        {filteredCommands.map((command, index) => (
          <motion.button
            key={command.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => !disabled && onCommand(command.command)}
            onMouseEnter={() => setHoveredCommand(command.id)}
            onMouseLeave={() => setHoveredCommand(null)}
            disabled={disabled}
            className={`
              flex-shrink-0 w-72 snap-start flex items-start space-x-3 p-4 rounded-xl border text-left transition-all duration-200
              ${getCommandButtonColor(command.category)}
              ${disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md touch-manipulation mobile-tap-highlight'
              }
              min-h-[100px]
            `}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              <command.icon className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium truncate">
                  {command.label}
                </h4>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(CATEGORIES[command.category].color)}`}>
                  {CATEGORIES[command.category].label}
                </span>
              </div>

              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                {hoveredCommand === command.id ? command.command : command.description}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
