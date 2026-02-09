import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Clock,
  Coffee,
  LogOut,
  LogIn,
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Timer,
  User,
  TrendingUp,
  Briefcase,
  X
} from 'lucide-react';

// Confirmation Dialog Component
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'success' | 'warning' | 'danger';
}

function ConfirmDialog({ isOpen, title, message, confirmText, onConfirm, onCancel, variant = 'success' }: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variants = {
    success: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
    warning: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
    danger: 'bg-red-500/20 border-red-500/30 text-red-400'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm md:max-w-md lg:max-w-lg p-6 md:p-10 lg:p-12 border border-slate-700">
        <div className="text-center">
          <div className={`w-16 h-16 md:w-24 md:h-24 lg:w-28 lg:h-28 mx-auto mb-4 md:mb-6 rounded-full flex items-center justify-center ${variants[variant]}`}>
            {variant === 'success' ? (
              <CheckCircle className="w-8 h-8 md:w-12 md:h-12 lg:w-14 lg:h-14" />
            ) : variant === 'warning' ? (
              <Coffee className="w-8 h-8 md:w-12 md:h-12 lg:w-14 lg:h-14" />
            ) : (
              <LogOut className="w-8 h-8 md:w-12 md:h-12 lg:w-14 lg:h-14" />
            )}
          </div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2 md:mb-4">{title}</h2>
          <p className="text-slate-400 md:text-lg lg:text-xl mb-6 md:mb-8">{message}</p>
          <button
            onClick={onConfirm}
            className={`w-full py-4 md:py-5 lg:py-6 rounded-2xl md:rounded-3xl font-semibold text-white md:text-lg lg:text-xl mb-3 md:mb-4 transition-all ${
              variant === 'success'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
                : variant === 'warning'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
            }`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 md:py-4 rounded-2xl font-medium text-slate-400 hover:text-white md:text-lg transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// PIN entry component - Redesigned with modern styling
interface PINEntryProps {
  onLogin: (pin: string) => void;
  error?: string | null;
}

function PINEntry({ onLogin, error }: PINEntryProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [isFocused, setIsFocused] = useState<number | null>(0);
  const inputRefs = [React.useRef<HTMLInputElement>(null), React.useRef<HTMLInputElement>(null), React.useRef<HTMLInputElement>(null), React.useRef<HTMLInputElement>(null)];

  const handleChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newPin = [...pin];
      newPin[index] = value;
      setPin(newPin);
      if (value && index < 3) {
        inputRefs[index + 1].current?.focus();
        setIsFocused(index + 1);
      } else if (!value && index > 0) {
        inputRefs[index - 1].current?.focus();
        setIsFocused(index - 1);
      }
      // Auto-submit when all 4 digits are entered
      if (newPin.every(digit => digit !== '')) {
        onLogin(newPin.join(''));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pastedData.length > 0) {
      const newPin = ['', '', '', ''];
      for (let i = 0; i < Math.min(pastedData.length, 4); i++) {
        newPin[i] = pastedData[i];
      }
      setPin(newPin);
      if (pastedData.length === 4) {
        onLogin(newPin.join(''));
      } else {
        inputRefs[pastedData.length].current?.focus();
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header with Logo */}
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 px-6 py-4 md:py-6 lg:py-8">
        <div className="max-w-md md:max-w-xl lg:max-w-2xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-3 md:gap-4">
            <img
              src="/images/servio_icon_tight.png"
              alt="Servio Logo"
              className="h-10 md:h-14 lg:h-16 w-auto"
            />
            <div>
              <h1 className="text-lg md:text-2xl lg:text-3xl font-bold text-white">Servio</h1>
              <p className="text-xs md:text-sm lg:text-base text-slate-400">Staff Clock-In</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-8 lg:p-10">
        <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl">
          {/* Welcome Section */}
          <div className="text-center mb-8 md:mb-12 lg:mb-14">
            <div className="w-20 h-20 md:w-28 md:h-28 lg:w-32 lg:h-32 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-2xl shadow-orange-500/20">
              <User className="w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 text-white" />
            </div>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4">Welcome Back</h2>
            <p className="text-slate-400 md:text-xl lg:text-2xl">Enter your PIN to continue</p>
          </div>

          {/* PIN Input Card */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 md:p-12 lg:p-16 border border-slate-700/50 shadow-2xl">
            {/* PIN Dots */}
            <div className="flex justify-center gap-4 md:gap-6 lg:gap-8 mb-8 md:mb-12">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onPaste={handlePaste}
                  onFocus={() => setIsFocused(index)}
                  onBlur={() => setIsFocused(null)}
                  placeholder="•"
                  className={`
                    w-16 h-16 md:w-24 md:h-24 lg:w-28 lg:h-28 text-center text-3xl md:text-5xl lg:text-6xl font-bold rounded-2xl md:rounded-3xl
                    transition-all duration-300 ease-out
                    ${isFocused === index
                      ? 'bg-orange-500/20 border-orange-500 text-white shadow-lg shadow-orange-500/20 scale-105'
                      : 'bg-slate-700/50 border-slate-600/50 text-white'
                    }
                    border-2 md:border-3 outline-none
                  `}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center justify-center text-red-400 mb-4 md:mb-6 animate-pulse">
                <AlertCircle className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                <span className="text-sm md:text-lg lg:text-xl">{error}</span>
              </div>
            )}

            {/* Help Text */}
            <div className="text-center">
              <p className="text-slate-400 text-sm md:text-lg lg:text-xl mb-2 md:mb-3">
                Enter your 4-digit employee PIN
              </p>
              <p className="text-slate-500 text-xs md:text-base lg:text-lg">
                Ask your manager if you don&apos;t have one
              </p>
            </div>
          </div>

          {/* Quick Tips */}
          <div className="mt-8 md:mt-12 lg:mt-14 grid grid-cols-2 gap-3 md:gap-6">
            <div className="bg-slate-800/30 rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 border border-slate-700/30">
              <div className="flex items-center gap-2 md:gap-3 text-orange-400 mb-1 md:mb-2">
                <Clock className="w-4 h-4 md:w-6 md:h-6 lg:w-7 lg:h-7" />
                <span className="text-xs md:text-base lg:text-lg font-medium text-orange-400">Quick Clock-In</span>
              </div>
              <p className="text-xs md:text-sm lg:text-base text-slate-500">Enter PIN to start shift</p>
            </div>
            <div className="bg-slate-800/30 rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 border border-slate-700/30">
              <div className="flex items-center gap-2 md:gap-3 text-orange-400 mb-1 md:mb-2">
                <Coffee className="w-4 h-4 md:w-6 md:h-6 lg:w-7 lg:h-7" />
                <span className="text-xs md:text-base lg:text-lg font-medium text-orange-400">Take Breaks</span>
              </div>
              <p className="text-xs md:text-sm lg:text-base text-slate-500">Track your break time</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 md:py-6 border-t border-slate-800">
        <div className="text-center">
          <p className="text-xs md:text-sm lg:text-base text-slate-600">
            Powered by Servio Restaurant Platform
          </p>
        </div>
      </footer>
    </div>
  );
}

// Action Button - Modern Design
interface ActionButtonProps {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

function ActionButton({ onClick, icon: Icon, label, variant = 'primary', disabled = false, loading = false }: ActionButtonProps) {
  const variants = {
    primary: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/25',
    secondary: 'bg-slate-700/50 hover:bg-slate-600/50 text-white border border-slate-600/50',
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25',
    warning: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/25',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        w-full py-3 md:py-4 lg:py-5 px-5 md:px-6 rounded-xl md:rounded-2xl font-semibold text-base md:text-lg lg:text-xl
        flex items-center justify-center gap-2 md:gap-3
        transition-all duration-300 ease-out transform active:scale-95
        ${variants[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed transform-none' : 'hover:-translate-y-0.5'}
        shadow-lg hover:shadow-xl
      `}
    >
      {loading ? (
        <RefreshCw className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 animate-spin" />
      ) : (
        <>
          <Icon className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

// Status Badge
interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<string, { color: string; icon: any; label: string }> = {
    'clocked-in': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle, label: 'On Shift' },
    'on-break': { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Coffee, label: 'On Break' },
    'clocked-out': { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: Clock, label: 'Off Shift' }
  };

  const { color, icon: Icon, label } = config[status] || config['clocked-out'];

  return (
    <div className={`inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full border ${color}`}>
      <Icon className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6" />
      <span className="font-medium text-sm md:text-base lg:text-lg">{label}</span>
    </div>
  );
}

// Weekly Hours Card
interface WeeklyHoursCardProps {
  weeklyHours: number;
  breakMinutes?: number;
}

function WeeklyHoursCard({ weeklyHours, breakMinutes = 0 }: WeeklyHoursCardProps) {
  const progress = Math.min((weeklyHours / 40) * 100, 100);
  const isComplete = weeklyHours >= 40;

  const breakHours = (breakMinutes / 60).toFixed(1);

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl md:rounded-3xl p-4 md:p-5 lg:p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl md:rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white md:text-lg lg:text-xl">This Week</h3>
            <p className="text-xs md:text-sm text-slate-400">Hours tracked</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">{weeklyHours.toFixed(1)}</p>
          <p className="text-xs md:text-sm text-slate-400">hours</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 md:h-3 lg:h-4 bg-slate-700/50 rounded-full overflow-hidden mb-2 md:mb-3">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out ${
            isComplete
              ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              : 'bg-gradient-to-r from-orange-400 to-orange-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs md:text-sm lg:text-base">
        <p className={isComplete ? 'text-emerald-400' : 'text-slate-400'}>
          {isComplete
            ? '✓ Full week completed!'
            : `${(40 - weeklyHours).toFixed(1)} hours to reach 40`
          }
        </p>
        {breakMinutes > 0 && (
          <div className="flex items-center gap-1 md:gap-2 text-amber-400">
            <Coffee className="w-3 h-3 md:w-4 md:h-4" />
            <span>{breakHours}h breaks</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Current Shift Card
interface CurrentShiftCardProps {
  shift: {
    clockInTime: string;
    breakMinutes: number;
    position?: string | null;
    isOnBreak: boolean;
    currentBreakStart?: string | null;
    timeEntryId: string;
  } | null;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onClockOut: () => void;
  loading: boolean;
}

function CurrentShiftCard({ shift, onStartBreak, onEndBreak, onClockOut, loading }: CurrentShiftCardProps) {
  const [now, setNow] = useState(new Date());

  // Update timer every 5 seconds for live tracking
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 5000); // Update every 5 seconds for live counter
    return () => clearInterval(interval);
  }, []);

  if (!shift) return null;

  const clockInTime = new Date(shift.clockInTime);
  const totalSeconds = Math.floor((now.getTime() - clockInTime.getTime()) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Break timer
  let breakTimer = null;
  if (shift.isOnBreak && shift.currentBreakStart) {
    const breakStart = new Date(shift.currentBreakStart);
    const breakSeconds = Math.floor((now.getTime() - breakStart.getTime()) / 1000);
    const breakHours = Math.floor(breakSeconds / 3600);
    const breakMinutes = Math.floor((breakSeconds % 3600) / 60);
    const breakSecs = breakSeconds % 60;
    breakTimer = `${String(breakHours).padStart(2, '0')}:${String(breakMinutes).padStart(2, '0')}:${String(breakSecs).padStart(2, '0')}`;
  }

  // Time since last break (if not on break)
  const lastBreakTime = shift.breakMinutes > 0 ? `${Math.floor(shift.breakMinutes)}m` : null;

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl md:rounded-3xl p-4 md:p-5 lg:p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className={`w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-xl md:rounded-2xl flex items-center justify-center ${
            shift.isOnBreak
              ? 'bg-gradient-to-br from-amber-400 to-amber-500'
              : 'bg-gradient-to-br from-emerald-400 to-emerald-500'
          }`}>
            {shift.isOnBreak ? (
              <Coffee className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-white" />
            ) : (
              <Briefcase className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-white" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white md:text-lg lg:text-xl">
              {shift.isOnBreak ? 'On Break' : 'On Shift'}
            </h3>
            <p className="text-xs md:text-sm text-slate-400">
              Started at {formatTime(clockInTime)}
            </p>
          </div>
        </div>
        <StatusBadge status={shift.isOnBreak ? 'on-break' : 'clocked-in'} />
      </div>

      {/* Timer Display */}
      <div className={`text-center py-4 md:py-6 lg:py-8 rounded-2xl md:rounded-3xl mb-3 md:mb-4 ${
        shift.isOnBreak
          ? 'bg-amber-500/10 border-2 border-amber-500/30'
          : 'bg-slate-900/50'
      }`}>
        <div className="flex items-center justify-center gap-2 md:gap-3 mb-1 md:mb-2">
          {shift.isOnBreak ? (
            <>
              <Coffee className="w-5 h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-amber-400" />
              <span className="text-amber-400 font-medium md:text-lg lg:text-xl">BREAK TIME</span>
            </>
          ) : (
            <Timer className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-orange-400" />
          )}
        </div>
        <p className={`text-4xl md:text-5xl lg:text-6xl font-bold tabular-nums tracking-tight ${
          shift.isOnBreak ? 'text-amber-400' : 'text-white'
        }`}>
          {shift.isOnBreak && breakTimer ? breakTimer : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`}
        </p>
        <p className="text-xs md:text-sm lg:text-base text-slate-400 mt-1 md:mt-2">
          {shift.isOnBreak
            ? `Break in progress`
            : `Clocked in at ${formatTime(clockInTime)}`
          }
        </p>
        {shift.position && !shift.isOnBreak && (
          <p className="text-xs md:text-sm text-slate-500 mt-1">Position: {shift.position}</p>
        )}
      </div>

      {/* Break Summary Card */}
      {!shift.isOnBreak && lastBreakTime && (
        <div className="bg-slate-900/50 rounded-xl p-2 md:p-3 mb-3 md:mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
            <span className="text-xs md:text-sm lg:text-base text-slate-400">Total break time today</span>
          </div>
          <span className="text-sm md:text-base font-medium text-amber-400">{lastBreakTime}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2 md:space-y-3">
        {shift.isOnBreak ? (
          <ActionButton
            label="End Break & Return to Work"
            icon={Briefcase}
            variant="success"
            onClick={onEndBreak}
            disabled={loading}
            loading={loading}
          />
        ) : (
          <>
            <ActionButton
              label={shift.breakMinutes > 0
                ? `Take Break (${Math.floor(shift.breakMinutes)}m used)`
                : 'Start Break'
              }
              icon={Coffee}
              variant="warning"
              onClick={onStartBreak}
              disabled={loading}
              loading={loading}
            />
            <ActionButton
              label="Clock Out"
              icon={LogOut}
              variant="danger"
              onClick={onClockOut}
              disabled={loading}
              loading={loading}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Clock In Card
interface ClockInCardProps {
  onClockIn: () => void;
  loading: boolean;
}

function ClockInCard({ onClockIn, loading }: ClockInCardProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 border border-slate-700/50 text-center">
      <div className="w-20 h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-2xl shadow-orange-500/20">
        <LogIn className="w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 text-white" />
      </div>
      <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2 md:mb-3">Ready to Clock In?</h2>
      <p className="text-slate-400 md:text-lg lg:text-xl mb-4 md:mb-6 lg:mb-8">Tap below to start your shift</p>
      <ActionButton
        label="Clock In"
        icon={LogIn}
        variant="success"
        onClick={onClockIn}
        disabled={loading}
        loading={loading}
      />
    </div>
  );
}

// Error Banner
interface ErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
}

function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="fixed top-4 left-4 right-4 md:top-6 md:left-6 md:right-6 z-50">
      <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-2xl p-4 md:p-5 lg:p-6 flex items-center gap-3 md:gap-4">
        <AlertCircle className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-red-400 flex-shrink-0" />
        <p className="text-red-400 text-sm md:text-base lg:text-lg flex-1">{error}</p>
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-300 p-1 md:p-2 text-xl md:text-2xl"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Animated skeleton loader for staff clock page
function StaffClockSkeleton() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header skeleton */}
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 px-6 py-4">
        <div className="max-w-md mx-auto flex items-center justify-center">
          <div className="flex items-center gap-3">
            <motion.div
              className="h-10 w-10 bg-slate-700/80 rounded-lg"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <div className="space-y-2">
              <motion.div
                className="h-5 w-20 bg-slate-700/80 rounded"
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="h-3 w-16 bg-slate-700/60 rounded"
                animate={{ opacity: [0.5, 0.7, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main content skeleton */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            {/* Avatar skeleton */}
            <motion.div
              className="w-20 h-20 bg-slate-700/80 rounded-2xl mx-auto mb-4"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            {/* Text skeletons */}
            <motion.div
              className="h-8 w-40 bg-slate-700/80 rounded mx-auto mb-2"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
            <motion.div
              className="h-4 w-32 bg-slate-700/60 rounded mx-auto"
              animate={{ opacity: [0.5, 0.7, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            />
          </div>

          {/* PIN input skeleton */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50">
            <div className="flex justify-center gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="w-16 h-16 bg-slate-700/60 rounded-2xl"
                  animate={{ opacity: [0.5, 0.7, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>

            {/* Loading dots */}
            <motion.div
              className="flex items-center justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 h-2 bg-orange-500 rounded-full"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Main clock page
export default function StaffClockPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true); // Start with loading=true
  const [error, setError] = useState<string | null>(null);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [rememberDevice, setRememberDevice] = useState(false);
  const userRef = useRef<any>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    variant: 'success' | 'warning' | 'danger';
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    onConfirm: () => {},
    variant: 'success'
  });

  const fetchUserStatus = async (pin: string) => {
    try {
      const response = await fetch(`/api/staff/clock/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const data = await response.json();
      if (data.success) {
        setCurrentShift(data.data.currentShift);
        setWeeklyHours(data.data.weeklyHours);
      }
    } catch (err) {
      console.error('Failed to fetch user status:', err);
    }
  };

  const handleLogin = async (pin: string, options?: { silent?: boolean; remember?: boolean }) => {
    setLoading(true);
    if (!options?.silent) {
      setError(null);
    }

    try {
      const response = await fetch('/api/staff/clock/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const data = await response.json();

      if (data.success) {
        const userData = {
          ...data.data.user,
          pin
        };
        setUser(userData);
        userRef.current = userData;
        setCurrentShift(data.data.currentShift);
        setWeeklyHours(data.data.weeklyHours);
        localStorage.setItem('staffUser', JSON.stringify(userData));
        const shouldRemember = options?.remember ?? rememberDevice;
        if (shouldRemember) {
          localStorage.setItem('staffClockPin', pin);
          localStorage.setItem('staffClockRemember', 'true');
        } else {
          localStorage.removeItem('staffClockPin');
          localStorage.setItem('staffClockRemember', 'false');
        }
      } else {
        if (options?.silent) {
          localStorage.removeItem('staffClockPin');
          localStorage.setItem('staffClockRemember', 'false');
          setError('Saved PIN is no longer valid. Please enter your PIN again.');
        } else {
          setError(data.error?.message || 'Invalid PIN');
        }
      }
    } catch (err) {
      if (!options?.silent) {
        setError('Connection error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = (options?: { clearRememberedPin?: boolean }) => {
    setUser(null);
    setCurrentShift(null);
    setWeeklyHours(0);
    localStorage.removeItem('staffUser');
    if (options?.clearRememberedPin !== false) {
      localStorage.removeItem('staffClockPin');
      localStorage.setItem('staffClockRemember', 'false');
      setRememberDevice(false);
    }
  };

  // Check for existing session and set up periodic refresh
  useEffect(() => {
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any)?.standalone === true;
    const rememberSetting = localStorage.getItem('staffClockRemember');
    const shouldRemember = rememberSetting ? rememberSetting === 'true' : isStandalone;
    setRememberDevice(shouldRemember);

    const savedUser = localStorage.getItem('staffUser');
    let autoLoginStarted = false;
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        userRef.current = userData;
        fetchUserStatus(userData.pin);
      } catch {
        localStorage.removeItem('staffUser');
      }
    } else if (shouldRemember) {
      const storedPin = localStorage.getItem('staffClockPin');
      if (storedPin) {
        autoLoginStarted = true;
        handleLogin(storedPin, { silent: true, remember: shouldRemember });
      }
    }
    // Mark initial loading as complete
    if (!autoLoginStarted) {
      setLoading(false);
    }

    // Refresh status every 30 seconds for live updates
    const refreshInterval = setInterval(() => {
      if (userRef.current) {
        fetchUserStatus(userRef.current.pin);
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  const doClockIn = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const response = await fetch('/api/staff/clock/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: user.pin })
      });

      const data = await response.json();

      if (data.success) {
        setCurrentShift({
          timeEntryId: data.data.entryId,
          clockInTime: data.data.clockInTime,
          breakMinutes: 0,
          position: data.data.position,
          isOnBreak: false
        });
        // Show confirmation and auto-logout
        setConfirmDialog({
          isOpen: true,
          title: 'Clocked In!',
          message: `You clocked in at ${new Date(data.data.clockInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. Have a great shift!`,
          confirmText: 'Done',
          variant: 'success',
          onConfirm: () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            handleLogout({ clearRememberedPin: false });
          }
        });
      } else {
        setError(data.error?.message || 'Failed to clock in');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const doClockOut = async () => {
    if (!user || !currentShift) return;
    setLoading(true);

    try {
      const response = await fetch('/api/staff/clock/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: user.pin })
      });

      const data = await response.json();

      if (data.success) {
        const totalHours = data.data.totalHours;
        setCurrentShift(null);
        setWeeklyHours(prev => prev + totalHours);
        // Show confirmation and auto-logout
        setConfirmDialog({
          isOpen: true,
          title: 'Clocked Out!',
          message: `You worked ${totalHours.toFixed(2)} hours today. Thanks for your hard work!`,
          confirmText: 'Done',
          variant: 'success',
          onConfirm: () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            handleLogout({ clearRememberedPin: false });
          }
        });
      } else {
        setError(data.error?.message || 'Failed to clock out');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const doStartBreak = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // Verify current status from server
      const statusResponse = await fetch('/api/staff/clock/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: user.pin })
      });

      const statusData = await statusResponse.json();

      if (!statusData.success) {
        setError('Could not verify status. Please try again.');
        setLoading(false);
        return;
      }

      if (statusData.data.currentShift?.isOnBreak) {
        setError('You are already on a break!');
        setCurrentShift(statusData.data.currentShift);
        setLoading(false);
        return;
      }

      if (!statusData.data.currentShift) {
        setError('You are not currently clocked in. Please clock in first.');
        setLoading(false);
        return;
      }

      // Now try to start the break
      const response = await fetch('/api/staff/clock/start-break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: user.pin })
      });

      const data = await response.json();

      if (data.success) {
        // Update shift state to show on break status
        const updatedShift = {
          ...statusData.data.currentShift,
          isOnBreak: true,
          currentBreakStart: data.data.breakStart
        };
        setCurrentShift(updatedShift);

        // Show confirmation and auto-logout
        setConfirmDialog({
          isOpen: true,
          title: 'Break Started',
          message: 'Enjoy your break! Enter your PIN when you\'re ready to return to work.',
          confirmText: 'Done',
          variant: 'warning',
          onConfirm: () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            handleLogout({ clearRememberedPin: false });
          }
        });
      } else {
        setError(data.error?.message || 'Failed to start break');
        // Refresh to sync with server state
        await fetchUserStatus(userRef.current?.pin);
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const doEndBreak = async () => {
    if (!user) return;

    // First, verify with server that we're actually on a break
    setLoading(true);
    setError(null);

    try {
      // Verify current status from server
      const statusResponse = await fetch('/api/staff/clock/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: user.pin })
      });

      const statusData = await statusResponse.json();

      if (!statusData.success) {
        setError('Could not verify break status. Please try again.');
        setLoading(false);
        return;
      }

      // Get the current shift from server
      const serverShift = statusData.data.currentShift;

      if (!serverShift) {
        setError('You are not currently clocked in. Please clock in first.');
        setLoading(false);
        return;
      }

      if (serverShift.isOnBreak) {
        // Normal case: server says we're on break, use normal end-break
        const response = await fetch('/api/staff/clock/end-break', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: user.pin })
        });

        const data = await response.json();

        if (data.success) {
          setConfirmDialog({
            isOpen: true,
            title: 'Back to Work!',
            message: `Welcome back! You took a ${Math.floor(data.data.durationMinutes)} minute break.`,
            confirmText: 'Done',
            variant: 'success',
            onConfirm: () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              handleLogout({ clearRememberedPin: false });
            }
          });
        } else {
          setError(data.error?.message || 'Failed to end break');
        }
      } else {
        // Special case: server says not on break, but try to end pending break
        // This handles the case where user started break, logged out, logged back in
        const pendingResponse = await fetch('/api/staff/clock/end-pending-break', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: user.pin })
        });

        const pendingData = await pendingResponse.json();

        if (pendingData.success) {
          setConfirmDialog({
            isOpen: true,
            title: 'Back to Work!',
            message: `Welcome back! You took a ${Math.floor(pendingData.data.durationMinutes)} minute break.`,
            confirmText: 'Done',
            variant: 'success',
            onConfirm: () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              handleLogout({ clearRememberedPin: false });
            }
          });
        } else {
          setError('You are not currently on a break.');
        }
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading skeleton while checking session
  if (loading && !user) {
    return <StaffClockSkeleton />;
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <>
        <Head>
          <title>Staff Clock-In - Servio</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="theme-color" content="#0f172a" />
          <link rel="manifest" href="/manifest-staff.json" />
        </Head>
        <PINEntry
          onLogin={handleLogin}
          error={error}
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{currentShift ? 'On Shift' : 'Clock In'} - Servio Staff</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="manifest" href="/manifest-staff.json" />
      </Head>

      <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
        {/* Error Banner */}
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 flex-shrink-0">
          <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <img
                src="/images/servio_icon_tight.png"
                alt="Servio Logo"
                className="h-8 md:h-10 lg:h-12 w-auto"
              />
              <div>
                <h1 className="font-semibold text-white md:text-lg lg:text-xl">Servio Staff</h1>
                <p className="text-xs md:text-sm text-slate-400">{user.restaurantName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => {
                  setError(null);
                  fetchUserStatus(user.pin);
                }}
                className="p-2 md:p-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all"
                title="Refresh status"
              >
                <RefreshCw className={`w-5 h-5 md:w-6 md:h-6 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => handleLogout()}
                className="p-2 md:p-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all"
                title="Logout"
              >
                <LogOut className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-4 md:px-6 py-3 md:py-4 lg:py-5 w-full overflow-y-auto">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl md:rounded-3xl p-4 md:p-5 lg:p-6 shadow-2xl shadow-orange-500/20 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 md:gap-4 lg:gap-5">
                <div className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-white/20 backdrop-blur-xl rounded-xl md:rounded-2xl flex items-center justify-center">
                  <User className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-white" />
                </div>
                <div>
                  <p className="text-orange-100 text-xs md:text-sm lg:text-base">Welcome back,</p>
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">{user.name}</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tabular-nums">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs md:text-sm text-orange-200">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Cards Container - fills remaining space */}
          <div className="flex-1 flex flex-col justify-center gap-3 md:gap-4 py-3 md:py-4 min-h-0">
            {/* Weekly Hours */}
            <WeeklyHoursCard
              weeklyHours={weeklyHours}
              breakMinutes={currentShift?.breakMinutes || 0}
            />

            {/* Clock In/Out Section */}
            {currentShift ? (
              <CurrentShiftCard
                shift={currentShift}
                onStartBreak={doStartBreak}
                onEndBreak={doEndBreak}
                onClockOut={doClockOut}
                loading={loading}
              />
            ) : (
              <ClockInCard onClockIn={doClockIn} loading={loading} />
            )}
          </div>

          {/* Footer */}
          <div className="text-center py-2 md:py-3 flex-shrink-0">
            <p className="text-xs md:text-sm text-slate-600">
              Powered by Servio Restaurant Platform
            </p>
          </div>
        </main>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        variant={confirmDialog.variant}
      />

      {/* Register Service Worker */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw-staff.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed:', err));
            }
          `
        }}
      />
    </>
  );
}
