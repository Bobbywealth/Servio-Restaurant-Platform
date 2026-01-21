import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type SplashScreenProps = {
  message?: string;
};

export default function SplashScreen({ message = 'Loading…' }: SplashScreenProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-surface-950 flex flex-col items-center justify-center overflow-hidden">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: 0.5,
          ease: "easeOut"
        }}
        className="flex flex-col items-center"
      >
        <div className="relative mb-8">
          <motion.div
            className="gpu-accelerated"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: 1.1,
                    repeat: Infinity,
                    ease: 'linear',
                  }
            }
          >
            <img
              src="/icons/servio-icon-192.svg"
              alt="Servio"
              className="h-16 w-16"
            />
          </motion.div>
          
          {/* Pulsing ring around logo */}
          <motion.div
            className="absolute -inset-4 border-2 border-blue-500/20 rounded-full"
            animate={
              reduceMotion
                ? undefined
                : {
                    scale: [1, 1.5],
                    opacity: [0.5, 0],
                  }
            }
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }
            }
          />
        </div>

        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 200 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="h-1 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden relative"
        >
          <motion.div
            animate={reduceMotion ? undefined : { x: [-200, 200] }}
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: 1,
                    repeat: Infinity,
                    ease: 'linear',
                  }
            }
            className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400"
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-sm font-medium text-surface-500 dark:text-surface-400 tracking-widest uppercase"
        >
          {message}
        </motion.p>
      </motion.div>

      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-50">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full filter blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full filter blur-[100px]" />
      </div>
    </div>
  );
}
