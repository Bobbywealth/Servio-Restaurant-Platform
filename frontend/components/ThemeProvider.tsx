'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';
type MotionPreference = 'reduce' | 'normal';

interface ThemeContextType {
  theme: Theme;
  motionPreference: MotionPreference;
  setTheme: (theme: Theme) => void;
  setMotionPreference: (preference: MotionPreference) => void;
  isDarkMode: boolean;
  isReducedMotion: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [motionPreference, setMotionPreference] = useState<MotionPreference>('normal');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const savedMotion = localStorage.getItem('motion') as MotionPreference | null;
    if (savedTheme) setThemeState(savedTheme);
    if (savedMotion) setMotionPreference(savedMotion);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark', 'light');

    const resolvedTheme =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;

    setIsDarkMode(resolvedTheme === 'dark');
    root.classList.add(resolvedTheme);

    if (motionPreference === 'reduce') {
      root.style.setProperty('--tw-animate-duration', '0.01ms');
    } else {
      root.style.removeProperty('--tw-animate-duration');
    }
  }, [theme, motionPreference]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setMotionPreference = (preference: MotionPreference) => {
    setMotionPreference(preference);
    localStorage.setItem('motion', preference);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        motionPreference,
        setTheme,
        setMotionPreference,
        isDarkMode,
        isReducedMotion: motionPreference === 'reduce',
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeToggle() {
  const { theme, setTheme, toggleTheme, isDarkMode } = useTheme();

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--tablet-surface)] border border-[var(--tablet-border)]">
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-md transition-all ${
          theme === 'light'
            ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
            : 'text-[var(--tablet-text)] hover:bg-[var(--tablet-border)]'
        }`}
        title="Light mode"
      >
        <Sun className="h-5 w-5" />
      </button>
      <button
        onClick={toggleTheme}
        className={`p-2 rounded-md transition-all ${
          isDarkMode
            ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
            : 'text-[var(--tablet-text)] hover:bg-[var(--tablet-border)]'
        }`}
        title="Toggle dark mode"
      >
        {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-md transition-all ${
          theme === 'dark'
            ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
            : 'text-[var(--tablet-text)] hover:bg-[var(--tablet-border)]'
        }`}
        title="Dark mode"
      >
        <Monitor className="h-5 w-5" />
      </button>
    </div>
  );
}

export function MotionPreferenceToggle() {
  const { motionPreference, setMotionPreference, isReducedMotion } = useTheme();

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--tablet-surface)] border border-[var(--tablet-border)]">
      <button
        onClick={() => setMotionPreference('normal')}
        className={`p-2 rounded-md transition-all ${
          motionPreference === 'normal'
            ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
            : 'text-[var(--tablet-text)] hover:bg-[var(--tablet-border)]'
        }`}
        title="Normal motion"
      >
        <Sun className="h-5 w-5" />
      </button>
      <button
        onClick={() => setMotionPreference('reduce')}
        className={`p-2 rounded-md transition-all ${
          motionPreference === 'reduce'
            ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
            : 'text-[var(--tablet-text)] hover:bg-[var(--tablet-border)]'
        }`}
        title="Reduced motion"
      >
        <Sun className="h-4 w-4" />
      </button>
    </div>
  );
}
