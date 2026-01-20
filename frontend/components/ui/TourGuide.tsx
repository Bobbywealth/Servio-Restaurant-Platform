import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, SkipForward, Sparkles, Target } from 'lucide-react';
import { useTour } from '../../contexts/TourContext';

interface TourGuideProps {}

export default function TourGuide({}: TourGuideProps) {
  const { isActive, currentStep, steps, nextStep, previousStep, skipTour, endTour } = useTour();
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep];

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const findTarget = () => {
      const element = document.querySelector(currentStepData.target) as HTMLElement;
      if (element) {
        setTargetElement(element);
        setTargetRect(element.getBoundingClientRect());
        
        // Scroll element into view if needed
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
      } else {
        // Retry after a short delay
        setTimeout(findTarget, 100);
      }
    };

    findTarget();

    // Update position on scroll/resize
    const updatePosition = () => {
      if (targetElement) {
        setTargetRect(targetElement.getBoundingClientRect());
      }
    };

    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isActive, currentStep, currentStepData, targetElement]);

  if (!isActive || !currentStepData || !targetRect) return null;

  const tooltipPosition = getTooltipPosition(currentStepData.position, targetRect);

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="fixed inset-0 z-[9999] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Dark overlay with cut-out */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm">
          {/* Highlight cutout */}
          <div
            className="absolute border-4 border-primary-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none"
            style={{
              left: targetRect.left - 8,
              top: targetRect.top - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: `
                0 0 0 8px rgba(59, 130, 246, 0.5),
                0 0 0 9999px rgba(0, 0, 0, 0.6)
              `,
            }}
          >
            {currentStepData.highlight && (
              <>
                {/* Pulsing highlight ring */}
                <motion.div
                  className="absolute -inset-2 border-2 border-primary-300 rounded-2xl"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                
                {/* Sparkle effects */}
                <motion.div
                  className="absolute -top-2 -right-2"
                  animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Sparkles className="w-6 h-6 text-primary-300" />
                </motion.div>
                
                <motion.div
                  className="absolute -bottom-2 -left-2"
                  animate={{ rotate: -360, scale: [1, 1.3, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                >
                  <Target className="w-5 h-5 text-primary-400" />
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* Tooltip */}
        <motion.div
          className="absolute pointer-events-auto"
          style={{
            left: tooltipPosition.left,
            top: tooltipPosition.top,
            transform: tooltipPosition.transform,
          }}
          initial={{ 
            opacity: 0, 
            scale: 0.8,
            y: currentStepData.position === 'top' ? 20 : currentStepData.position === 'bottom' ? -20 : 0,
            x: currentStepData.position === 'left' ? 20 : currentStepData.position === 'right' ? -20 : 0,
          }}
          animate={{ 
            opacity: 1, 
            scale: 1,
            y: 0,
            x: 0,
          }}
          exit={{ 
            opacity: 0, 
            scale: 0.8 
          }}
          transition={{ 
            type: "spring", 
            bounce: 0.3, 
            duration: 0.5 
          }}
        >
          <div className="relative max-w-sm w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <motion.div
                    className="bg-white/20 rounded-full p-2"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </motion.div>
                  <div>
                    <h3 className="font-bold text-lg">{currentStepData.title}</h3>
                    <p className="text-xs text-primary-100 font-medium">
                      Step {currentStep + 1} of {steps.length}
                    </p>
                  </div>
                </div>
                <button
                  onClick={skipTour}
                  className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3 bg-white/20 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="bg-white h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
                {currentStepData.description}
              </p>

              {/* Action buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {currentStep > 0 && (
                    <button
                      onClick={previousStep}
                      className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span className="text-sm font-medium">Back</span>
                    </button>
                  )}
                  
                  {currentStepData.skipable && (
                    <button
                      onClick={skipTour}
                      className="flex items-center space-x-2 px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                    >
                      <SkipForward className="w-4 h-4" />
                      <span>Skip tour</span>
                    </button>
                  )}
                </div>

                <motion.button
                  onClick={currentStep === steps.length - 1 ? endTour : nextStep}
                  className="flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-primary-200 dark:hover:shadow-primary-900/50 group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>{currentStepData.nextText || (currentStep === steps.length - 1 ? 'Finish' : 'Next')}</span>
                  {currentStep === steps.length - 1 ? (
                    <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
                  ) : (
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  )}
                </motion.button>
              </div>
            </div>

            {/* Tooltip arrow */}
            <div 
              className={`absolute w-4 h-4 bg-white dark:bg-gray-800 transform rotate-45 ${getArrowClasses(currentStepData.position)}`}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function getTooltipPosition(position: string, targetRect: DOMRect) {
  const spacing = 20;
  const tooltipWidth = 320; // max-w-sm = 24rem = 384px, but we use 320 for safer calc
  const tooltipHeight = 200; // approximate height

  switch (position) {
    case 'top':
      return {
        left: targetRect.left + targetRect.width / 2,
        top: targetRect.top - spacing,
        transform: 'translate(-50%, -100%)',
      };
    case 'bottom':
      return {
        left: targetRect.left + targetRect.width / 2,
        top: targetRect.bottom + spacing,
        transform: 'translate(-50%, 0)',
      };
    case 'left':
      return {
        left: targetRect.left - spacing,
        top: targetRect.top + targetRect.height / 2,
        transform: 'translate(-100%, -50%)',
      };
    case 'right':
      return {
        left: targetRect.right + spacing,
        top: targetRect.top + targetRect.height / 2,
        transform: 'translate(0, -50%)',
      };
    default:
      return {
        left: targetRect.left + targetRect.width / 2,
        top: targetRect.bottom + spacing,
        transform: 'translate(-50%, 0)',
      };
  }
}

function getArrowClasses(position: string) {
  switch (position) {
    case 'top':
      return 'bottom-[-8px] left-1/2 -translate-x-1/2 border-b border-r border-gray-200 dark:border-gray-700';
    case 'bottom':
      return 'top-[-8px] left-1/2 -translate-x-1/2 border-t border-l border-gray-200 dark:border-gray-700';
    case 'left':
      return 'right-[-8px] top-1/2 -translate-y-1/2 border-t border-r border-gray-200 dark:border-gray-700';
    case 'right':
      return 'left-[-8px] top-1/2 -translate-y-1/2 border-b border-l border-gray-200 dark:border-gray-700';
    default:
      return 'top-[-8px] left-1/2 -translate-x-1/2 border-t border-l border-gray-200 dark:border-gray-700';
  }
}