import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Plus, Minus, ShoppingCart, Check, AlertTriangle } from 'lucide-react';
import { resolveMediaUrl } from '../../lib/utils';
import type { MenuItem, ItemSize, SelectedModifier, ModifierGroup } from './types';

interface ItemDetailModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (item: MenuItem, size: ItemSize | null, modifiers: Record<string, SelectedModifier[]>) => boolean;
}

export function ItemDetailModal({ item, onClose, onAddToCart }: ItemDetailModalProps) {
  const [selectedSize, setSelectedSize] = useState<ItemSize | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, SelectedModifier[]>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset state when item changes
  const initializeForItem = useCallback((menuItem: MenuItem) => {
    setCurrentStep(0);
    setValidationError(null);
    if (menuItem.sizes && menuItem.sizes.length > 0) {
      const preselected = menuItem.sizes.find(s => s.isPreselected);
      setSelectedSize(preselected || menuItem.sizes[0]);
    } else {
      setSelectedSize(null);
    }
    const preselectedMods: Record<string, SelectedModifier[]> = {};
    if (menuItem.modifierGroups) {
      menuItem.modifierGroups.forEach(group => {
        const preselectedOptions = group.options.filter(opt => opt.isPreselected && !opt.isSoldOut);
        if (preselectedOptions.length > 0) {
          preselectedMods[group.id] = preselectedOptions.map(opt => ({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: opt.priceDelta,
            quantity: group.selectionType === 'quantity' ? 1 : undefined
          }));
        }
      });
    }
    setSelectedModifiers(preselectedMods);
  }, []);

  // Initialize when item appears
  React.useEffect(() => {
    if (item) initializeForItem(item);
  }, [item, initializeForItem]);

  if (!item) return null;

  const getSteps = (): Array<{ type: 'size' | 'modifier'; data?: ModifierGroup }> => {
    const steps: Array<{ type: 'size' | 'modifier'; data?: ModifierGroup }> = [];
    if (item.sizes && item.sizes.length > 0) {
      steps.push({ type: 'size' });
    }
    if (item.modifierGroups) {
      const validGroups = item.modifierGroups.filter(
        group => group.options && group.options.length > 0 && group.options.some(opt => opt.isActive && !opt.isSoldOut)
      );
      validGroups.forEach(group => steps.push({ type: 'modifier', data: group }));
    }
    return steps;
  };

  const steps = getSteps();

  const validateCurrentStep = () => {
    if (currentStep >= steps.length) return true;
    const step = steps[currentStep];
    if (step.type === 'size') {
      if (!selectedSize) {
        setValidationError('Please select a size to continue');
        return false;
      }
    } else if (step.type === 'modifier' && step.data) {
      const group = step.data;
      if (group.isRequired) {
        const selections = selectedModifiers[group.id] || [];
        const totalSelected = selections.reduce((sum, sel) => sum + (sel.quantity || 1), 0);
        if (totalSelected < group.minSelections) {
          setValidationError(`Please select at least ${group.minSelections} option(s) for ${group.name}`);
          return false;
        }
      }
    }
    setValidationError(null);
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setValidationError(null);
    } else {
      const success = onAddToCart(item, selectedSize, selectedModifiers);
      if (success) {
        onClose();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setValidationError(null);
    }
  };

  const handleModifierToggle = (group: ModifierGroup, option: ModifierGroup['options'][0]) => {
    setValidationError(null);
    if (group.selectionType === 'single') {
      setSelectedModifiers(prev => ({
        ...prev,
        [group.id]: [{
          groupId: group.id, groupName: group.name,
          optionId: option.id, optionName: option.name, priceDelta: option.priceDelta
        }]
      }));
    } else if (group.selectionType === 'multiple') {
      setSelectedModifiers(prev => {
        const current = prev[group.id] || [];
        const isSelected = current.some(m => m.optionId === option.id);
        if (isSelected) {
          const filtered = current.filter(m => m.optionId !== option.id);
          if (filtered.length === 0) {
            const { [group.id]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [group.id]: filtered };
        } else {
          if (current.length >= group.maxSelections) {
            setValidationError(`Maximum ${group.maxSelections} selections allowed`);
            return prev;
          }
          return {
            ...prev,
            [group.id]: [...current, {
              groupId: group.id, groupName: group.name,
              optionId: option.id, optionName: option.name, priceDelta: option.priceDelta
            }]
          };
        }
      });
    } else if (group.selectionType === 'quantity') {
      const isSelected = selectedModifiers[group.id]?.some(m => m.optionId === option.id);
      if (!isSelected) {
        setSelectedModifiers(prev => ({
          ...prev,
          [group.id]: [...(prev[group.id] || []), {
            groupId: group.id, groupName: group.name,
            optionId: option.id, optionName: option.name,
            priceDelta: option.priceDelta, quantity: 1
          }]
        }));
      }
    }
  };

  const handleQuantityChange = (groupId: string, optionId: string, delta: number) => {
    setSelectedModifiers(prev => {
      const current = prev[groupId] || [];
      const modIndex = current.findIndex(m => m.optionId === optionId);
      if (modIndex === -1) return prev;
      const newQuantity = (current[modIndex].quantity || 1) + delta;
      if (newQuantity <= 0) {
        const filtered = current.filter(m => m.optionId !== optionId);
        if (filtered.length === 0) {
          const { [groupId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [groupId]: filtered };
      }
      const updated = [...current];
      updated[modIndex] = { ...updated[modIndex], quantity: newQuantity };
      return { ...prev, [groupId]: updated };
    });
  };

  const allSelectedModifiers: SelectedModifier[] = [];
  const modGroups = Object.keys(selectedModifiers);
  for (const groupId of modGroups) {
    const mods = selectedModifiers[groupId];
    if (mods) {
      for (const mod of mods) {
        allSelectedModifiers.push(mod);
      }
    }
  }
  const itemTotal = (
    (selectedSize ? selectedSize.price : item.price) +
    allSelectedModifiers.reduce((sum: number, mod: SelectedModifier) => sum + (mod.priceDelta * (mod.quantity || 1)), 0)
  );

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="fixed bottom-0 left-0 right-0 w-full bg-white rounded-t-3xl z-[70] overflow-hidden gpu-accelerated will-change-transform"
            style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 2rem)' }}
          >
            <div className="overflow-y-auto overscroll-contain px-5 sm:px-6 pt-6" style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 2rem)' }}>
              <div className="max-w-xl mx-auto">
                <div className="flex justify-center mb-4">
                  <div className="w-10 h-1 bg-slate-300 rounded-full" />
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold">{item.name}</h2>
                    <p className="text-gray-600 mt-1 text-sm sm:text-base">{item.description}</p>
                  </div>
                  <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 font-bold ml-2 shrink-0">Close</button>
                </div>

                {item.image && (
                  <div className="w-full h-40 sm:h-48 rounded-xl overflow-hidden bg-gray-100 mb-6">
                    <img src={resolveMediaUrl(item.image)} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Step Progress */}
                {steps.length > 1 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between">
                      {steps.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <div className="flex flex-col items-center flex-1 min-w-0">
                            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shrink-0 ${
                              idx < currentStep ? 'bg-green-600 text-white' :
                              idx === currentStep ? 'bg-blue-600 text-white' :
                              'bg-gray-200 text-gray-500'
                            }`}>
                              {idx < currentStep ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                            </div>
                            <div className={`text-[10px] sm:text-xs mt-1 text-center truncate max-w-[60px] sm:max-w-[80px] ${
                              idx === currentStep ? 'font-semibold text-blue-600' : 'text-gray-500'
                            }`}>
                              {step.type === 'size' ? 'Size' : step.data?.name}
                            </div>
                          </div>
                          {idx < steps.length - 1 && (
                            <div className={`h-0.5 flex-1 mx-1 sm:mx-2 mb-6 ${idx < currentStep ? 'bg-green-600' : 'bg-gray-200'}`} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step Content */}
                {steps.length > 0 && (() => {
                  const step = steps[currentStep];
                  if (step.type === 'size') {
                    return (
                      <div className="mb-6">
                        <h3 className="font-semibold text-lg mb-3">Select Size *</h3>
                        <div className="space-y-2">
                          {item.sizes?.map(size => (
                            <button
                              key={size.id}
                              onClick={() => { setSelectedSize(size); setValidationError(null); }}
                              className={`w-full p-4 rounded-xl border-2 flex justify-between items-center transition-all ${
                                selectedSize?.id === size.id
                                  ? 'border-blue-600 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <span className="font-semibold">{size.sizeName}</span>
                              <span className="font-bold text-lg">${size.price.toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (step.type === 'modifier' && step.data) {
                    const group = step.data;
                    return (
                      <div className="mb-6">
                        <div className="flex justify-between items-baseline mb-3">
                          <h3 className="font-semibold text-lg">
                            {group.name}
                            {group.isRequired && <span className="text-red-500 ml-1">*</span>}
                          </h3>
                          <span className="text-sm text-gray-500">
                            {group.selectionType === 'single' && 'Choose 1'}
                            {group.selectionType === 'multiple' && `Choose ${group.minSelections}-${group.maxSelections}`}
                            {group.selectionType === 'quantity' && 'Add quantity'}
                          </span>
                        </div>
                        {group.description && <p className="text-sm text-gray-500 mb-3">{group.description}</p>}

                        <div className="space-y-2">
                          {group.options.map(option => {
                            const isSelected = selectedModifiers[group.id]?.some(m => m.optionId === option.id);
                            const selectedMod = selectedModifiers[group.id]?.find(m => m.optionId === option.id);

                            return (
                              <div key={option.id}>
                                <button
                                  onClick={() => handleModifierToggle(group, option)}
                                  disabled={option.isSoldOut}
                                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                                    option.isSoldOut ? 'opacity-50 cursor-not-allowed bg-gray-50' :
                                    isSelected ? 'border-blue-600 bg-blue-50' :
                                    'border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex justify-between items-center w-full">
                                    <div className="text-left flex-1">
                                      <div className="font-semibold">
                                        {option.name}
                                        {option.isSoldOut && <span className="ml-2 text-sm text-red-500">(Sold Out)</span>}
                                      </div>
                                      {option.description && <div className="text-sm text-gray-500 mt-1">{option.description}</div>}
                                    </div>
                                    {option.priceDelta !== 0 && (
                                      <span className="text-sm font-medium text-gray-700 ml-2">
                                        {option.priceDelta > 0 ? '+' : ''}${option.priceDelta.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </button>
                                {group.selectionType === 'quantity' && isSelected && selectedMod && (
                                  <div className="flex items-center gap-2 ml-4 mt-2">
                                    <button onClick={() => handleQuantityChange(group.id, option.id, -1)} className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300">
                                      <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="font-bold w-6 text-center">{selectedMod.quantity || 1}</span>
                                    <button onClick={() => handleQuantityChange(group.id, option.id, 1)} className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300">
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* Validation Error */}
                {validationError && (
                  <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-2">Selection Required</h3>
                          <p className="text-gray-600">{validationError}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setValidationError(null)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold"
                      >
                        Got it
                      </button>
                    </motion.div>
                  </div>
                )}

                {/* Price & Navigation */}
                <div className="border-t pt-4 bg-white" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-base sm:text-lg font-semibold">Item Total</span>
                    <span className="text-xl sm:text-2xl font-bold">${itemTotal.toFixed(2)}</span>
                  </div>

                  <div className="flex gap-3">
                    {!isFirstStep && (
                      <button
                        onClick={handlePrevious}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3.5 sm:py-4 rounded-xl text-base sm:text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                      >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                      </button>
                    )}
                    <button
                      onClick={handleNext}
                      className={`${isFirstStep ? 'w-full' : 'flex-1'} bg-blue-600 hover:bg-blue-700 text-white py-3.5 sm:py-4 rounded-xl text-base sm:text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform`}
                    >
                      {isLastStep ? (
                        <>
                          <ShoppingCart className="w-5 h-5" />
                          Add to Cart
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
