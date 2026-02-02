import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  icon: Icon,
  iconColor = 'text-primary-500',
  className = ''
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`mb-8 ${className}`}
    >
      <div className="flex items-center gap-3 mb-2">
        {Icon && (
          <motion.div
            className={`p-2 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/50 dark:to-primary-800/30 ${iconColor}`}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Icon className="w-6 h-6" />
          </motion.div>
        )}
        <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          {title}
        </h2>
      </div>
      {description && (
        <p className="text-surface-600 dark:text-surface-400 text-lg leading-relaxed max-w-3xl">
          {description}
        </p>
      )}
      <div className="mt-4 h-1 w-24 bg-gradient-to-r from-primary-500 to-primary-300 dark:from-primary-400 dark:to-primary-600 rounded-full" />
    </motion.div>
  );
};

export default SectionHeader;
