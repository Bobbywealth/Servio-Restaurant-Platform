import React from 'react';
import { motion } from 'framer-motion';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center overflow-hidden">
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
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <img
              src="/images/servio_logo_transparent_tight.png"
              alt="Servio Logo"
              className="h-20 w-auto"
            />
          </motion.div>
          
          {/* Pulsing ring around logo */}
          <motion.div
            className="absolute -inset-4 border-2 border-blue-500/20 rounded-full"
            animate={{
              scale: [1, 1.5],
              opacity: [0.5, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        </div>

        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 200 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="h-1 bg-gray-100 rounded-full overflow-hidden relative"
        >
          <motion.div
            animate={{
              x: [-200, 200]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400"
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-sm font-medium text-gray-500 tracking-widest uppercase"
        >
          Initializing OS
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
