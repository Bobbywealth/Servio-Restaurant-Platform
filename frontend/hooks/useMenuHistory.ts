import { useState, useCallback, useRef } from 'react';

/**
 * History entry for undo/redo functionality
 */
interface HistoryEntry<T> {
  state: T;
  timestamp: number;
  action: string;
}

/**
 * Options for useMenuHistory hook
 */
export interface UseMenuHistoryOptions<T> {
  maxHistory?: number;
  onUndo?: (state: T) => void;
  onRedo?: (state: T) => void;
  onPush?: (state: T) => void;
}

/**
 * Return type for useMenuHistory hook
 */
export interface UseMenuHistoryReturn<T> {
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentIndex: number;
  pushState: (state: T, action: string) => void;
  undo: () => T | null;
  redo: () => T | null;
  clearHistory: () => void;
  getCurrentState: () => T | null;
  getHistory: () => HistoryEntry<T>[];
}

/**
 * Custom hook for managing undo/redo history
 * Perfect for menu item edits, category changes, etc.
 */
export function useMenuHistory<T>(options: UseMenuHistoryOptions<T> = {}): UseMenuHistoryReturn<T> {
  const { maxHistory = 50, onUndo, onRedo, onPush } = options;

  const [history, setHistory] = useState<HistoryEntry<T>[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  // Keep a ref to avoid stale closures
  const historyRef = useRef<HistoryEntry<T>[]>(history);
  const indexRef = useRef<number>(currentIndex);
  
  historyRef.current = history;
  indexRef.current = currentIndex;

  /**
   * Push a new state to history
   */
  const pushState = useCallback((state: T, action: string) => {
    const entry: HistoryEntry<T> = {
      state,
      timestamp: Date.now(),
      action
    };

    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, indexRef.current + 1);
      
      // Add new entry
      newHistory.push(entry);
      
      // Trim to max history
      if (newHistory.length > maxHistory) {
        newHistory.shift();
        setCurrentIndex(newHistory.length - 1);
      } else {
        setCurrentIndex(newHistory.length - 1);
      }
      
      return newHistory;
    });

    onPush?.(state);
  }, [maxHistory, onPush]);

  /**
   * Undo to previous state
   */
  const undo = useCallback((): T | null => {
    if (indexRef.current <= 0) {
      return null;
    }

    const newIndex = indexRef.current - 1;
    setCurrentIndex(newIndex);
    
    const state = historyRef.current[newIndex]?.state || null;
    if (state !== null) {
      onUndo?.(state);
    }
    
    return state;
  }, [onUndo]);

  /**
   * Redo to next state
   */
  const redo = useCallback((): T | null => {
    if (indexRef.current >= historyRef.current.length - 1) {
      return null;
    }

    const newIndex = indexRef.current + 1;
    setCurrentIndex(newIndex);
    
    const state = historyRef.current[newIndex]?.state || null;
    if (state !== null) {
      onRedo?.(state);
    }
    
    return state;
  }, [onRedo]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  /**
   * Get current state
   */
  const getCurrentState = useCallback((): T | null => {
    if (indexRef.current < 0 || indexRef.current >= historyRef.current.length) {
      return null;
    }
    return historyRef.current[indexRef.current].state;
  }, []);

  /**
   * Get full history (read-only)
   */
  const getHistory = useCallback((): HistoryEntry<T>[] => {
    return [...historyRef.current];
  }, []);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    canUndo,
    canRedo,
    historyLength: history.length,
    currentIndex,
    pushState,
    undo,
    redo,
    clearHistory,
    getCurrentState,
    getHistory
  };
}

export default useMenuHistory;
