import React from 'react'
import { motion, AnimatePresence, cubicBezier } from 'framer-motion'
import { useRouter } from 'next/router'

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

const smoothEase = cubicBezier(0.61, 1, 0.88, 1)

const pageVariants = {
  initial: {
    opacity: 0,
    y: 8
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: smoothEase // Custom easing for smooth feel
    }
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: smoothEase
    }
  }
}

/**
 * Page Transition Wrapper
 * Provides smooth fade + slide transitions between pages
 * Use this to wrap page content for native app-like transitions
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = ''
}) => {
  const router = useRouter()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={router.asPath}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Modal Transition
 * Smooth scale + fade for modals
 */
export const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: {
      duration: 0.2
    }
  }
}

/**
 * Slide Up Transition (for bottom sheets)
 */
export const slideUpVariants = {
  hidden: {
    y: '100%',
    opacity: 0
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30
    }
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: smoothEase
    }
  }
}

/**
 * Fade Transition (simple)
 */
export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3 }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 }
  }
}

/**
 * List Stagger Animation
 * For animating lists of items
 */
export const staggerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
}

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30
    }
  }
}
