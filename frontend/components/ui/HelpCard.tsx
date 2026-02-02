import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface HelpCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'highlight' | 'warning';
  className?: string;
}

export const HelpCard: React.FC<HelpCardProps> = ({
  icon: Icon,
  title,
  description,
  href,
  onClick,
  variant = 'default',
  className = ''
}) => {
  const variants = {
    default: 'card-glass hover:shadow-glow hover:border-primary-500/30',
    highlight: 'card bg-gradient-to-br from-primary-500/10 to-primary-600/10 border-primary-500/30 hover:shadow-glow hover:border-primary-400/50',
    warning: 'card bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-500/30 hover:shadow-glow hover:border-amber-400/50'
  };

  const iconVariants = {
    default: 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400',
    highlight: 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400',
    warning: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
  };

  const content = (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`card rounded-2xl p-6 cursor-pointer transition-all duration-300 ${variants[variant]} ${className}`}
    >
      <div className="flex items-start gap-4">
        <motion.div
          className={`p-3 rounded-xl ${iconVariants[variant]}`}
          whileHover={{ rotate: 5 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <Icon className="w-6 h-6" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-2">
            {title}
          </h3>
          <p className="text-surface-600 dark:text-surface-400 text-sm leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  return content;
};

export default HelpCard;
