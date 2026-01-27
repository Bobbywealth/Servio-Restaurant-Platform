import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
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
  Briefcase
} from 'lucide-react';

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
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 px-6 py-4">
        <div className="max-w-md mx-auto flex items-center justify-center">
          <div className="flex items-center gap-3">
            <img
              src="/images/servio_icon_tight.png"
              alt="Servio Logo"
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-lg font-bold text-white">Servio</h1>
              <p className="text-xs text-slate-400">Staff Clock-In</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-orange-500/20">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-slate-400">Enter your PIN to continue</p>
          </div>

          {/* PIN Input Card */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
            {/* PIN Dots */}
            <div className="flex justify-center gap-4 mb-8">
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
                    w-16 h-16 text-center text-3xl font-bold rounded-2xl
                    transition-all duration-300 ease-out
                    ${isFocused === index 
                      ? 'bg-orange-500/20 border-orange-500 text-white shadow-lg shadow-orange-500/20 scale-105' 
                      : 'bg-slate-700/50 border-slate-600/50 text-white'
                    }
                    border-2 outline-none
                  `}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center justify-center text-red-400 mb-4 animate-pulse">
                <AlertCircle className="w-5 h-5 mr-2" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Help Text */}
            <div className="text-center">
              <p className="text-slate-400 text-sm mb-2">
                Enter your 4-digit employee PIN
              </p>
              <p className="text-slate-500 text-xs">
                Ask your manager if you don&apos;t have one
              </p>
            </div>
          </div>

          {/* Quick Tips */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <div className="flex items-center gap-2 text-orange-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium text-orange-400">Quick Clock-In</span>
              </div>
              <p className="text-xs text-slate-500">Enter PIN to start shift</p>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <div className="flex items-center gap-2 text-orange-400 mb-1">
                <Coffee className="w-4 h-4" />
                <span className="text-xs font-medium text-orange-400">Take Breaks</span>
              </div>
              <p className="text-xs text-slate-500">Track your break time</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-800">
        <div className="text-center">
          <p className="text-xs text-slate-600">
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
        w-full py-4 px-6 rounded-2xl font-semibold text-lg
        flex items-center justify-center gap-3
        transition-all duration-300 ease-out transform active:scale-95
        ${variants[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed transform-none' : 'hover:-translate-y-0.5'}
        shadow-lg hover:shadow-xl
      `}
    >
      {loading ? (
        <RefreshCw className="w-6 h-6 animate-spin" />
      ) : (
        <>
          <Icon className="w-6 h-6" />
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
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${color}`}>
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
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
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">This Week</h3>
            <p className="text-xs text-slate-400">Hours tracked</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-white">{weeklyHours.toFixed(1)}</p>
          <p className="text-xs text-slate-400">hours</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 bg-slate-700/50 rounded-full overflow-hidden mb-3">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out ${
            isComplete
              ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              : 'bg-gradient-to-r from-orange-400 to-orange-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm mb-4">
        <p className={isComplete ? 'text-emerald-400' : 'text-slate-400'}>
          {isComplete
            ? '✓ Full week completed!'
            : `${(40 - weeklyHours).toFixed(1)} hours to reach 40`
          }
        </p>
        {breakMinutes > 0 && (
          <div className="flex items-center gap-1 text-amber-400">
            <Coffee className="w-3 h-3" />
            <span>{breakHours}h breaks</span>
          </div>
        )}
      </div>

      {/* Break Summary */}
      {breakMinutes > 0 && (
        <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400">Total Break Time</span>
            </div>
            <span className="text-lg font-bold text-amber-400">{breakHours}h</span>
          </div>
        </div>
      )}
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

  // Update timer every minute for live tracking
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  if (!shift) return null;

  const clockInTime = new Date(shift.clockInTime);
  const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
  const hours = Math.floor(hoursWorked);
  const minutes = Math.floor((hoursWorked - hours) * 60);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Break timer
  let breakTimer = null;
  if (shift.isOnBreak && shift.currentBreakStart) {
    const breakStart = new Date(shift.currentBreakStart);
    const breakMinutes = Math.floor((now.getTime() - breakStart.getTime()) / (1000 * 60));
    const breakHours = Math.floor(breakMinutes / 60);
    const breakMins = breakMinutes % 60;
    breakTimer = `${String(breakHours).padStart(2, '0')}:${String(breakMins).padStart(2, '0')}`;
  }

  // Time since last break (if not on break)
  const lastBreakTime = shift.breakMinutes > 0 ? `${Math.floor(shift.breakMinutes)}m` : null;

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            shift.isOnBreak
              ? 'bg-gradient-to-br from-amber-400 to-amber-500'
              : 'bg-gradient-to-br from-emerald-400 to-emerald-500'
          }`}>
            {shift.isOnBreak ? (
              <Coffee className="w-5 h-5 text-white" />
            ) : (
              <Briefcase className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white">
              {shift.isOnBreak ? 'On Break' : 'On Shift'}
            </h3>
            <p className="text-xs text-slate-400">
              {shift.isOnBreak
                ? `Started at ${formatTime(clockInTime)}`
                : `Started at ${formatTime(clockInTime)}`
              }
            </p>
          </div>
        </div>
        <StatusBadge status={shift.isOnBreak ? 'on-break' : 'clocked-in'} />
      </div>

      {/* Timer Display */}
      <div className={`text-center py-6 rounded-2xl mb-6 ${
        shift.isOnBreak
          ? 'bg-amber-500/10 border-2 border-amber-500/30'
          : 'bg-slate-900/50'
      }`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          {shift.isOnBreak ? (
            <>
              <Coffee className="w-6 h-6 text-amber-400" />
              <span className="text-amber-400 font-medium">BREAK TIME</span>
            </>
          ) : (
            <Timer className="w-5 h-5 text-orange-400" />
          )}
        </div>
        <p className={`text-5xl font-bold tabular-nums tracking-tight ${
          shift.isOnBreak ? 'text-amber-400' : 'text-white'
        }`}>
          {shift.isOnBreak && breakTimer ? breakTimer : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`}
        </p>
        <p className="text-sm text-slate-400 mt-2">
          {shift.isOnBreak
            ? `Break in progress`
            : `Clocked in at ${formatTime(clockInTime)}`
          }
        </p>
        {shift.position && !shift.isOnBreak && (
          <p className="text-xs text-slate-500 mt-1">Position: {shift.position}</p>
        )}
      </div>

      {/* Break Summary Card */}
      {!shift.isOnBreak && lastBreakTime && (
        <div className="bg-slate-900/50 rounded-xl p-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-400">Total break time today</span>
          </div>
          <span className="text-sm font-medium text-amber-400">{lastBreakTime}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
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
                ? `Take Break (${Math.floor(shift.breakMinutes)}m used today)`
                : 'Start Break'
              }
              icon={Coffee}
              variant="warning"
              onClick={onStartBreak}
              disabled={loading || hoursWorked < 0.5}
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
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 text-center">
      <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/20">
        <LogIn className="w-12 h-12 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Ready to Clock In?</h2>
      <p className="text-slate-400 mb-8">Tap below to start your shift</p>
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
    <div className="fixed top-4 left-4 right-4 z-50">
      <div className="bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <p className="text-red-400 text-sm flex-1">{error}</p>
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-300 p-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Main clock page
export default function StaffClockPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [weeklyBreakMinutes, setWeeklyBreakMinutes] = useState(0);

  // Check for existing session and set up periodic refresh
  useEffect(() => {
    const savedUser = localStorage.getItem('staffUser');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        fetchUserStatus(userData.pin);
      } catch {
        localStorage.removeItem('staffUser');
      }
    }

    // Refresh status every minute for live updates
    const refreshInterval = setInterval(() => {
      if (user) {
        fetchUserStatus(user.pin);
      }
    }, 60000);

    return () => clearInterval(refreshInterval);
  }, []);

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

  const handleLogin = async (pin: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staff/clock/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.data.user);
        setCurrentShift(data.data.currentShift);
        setWeeklyHours(data.data.weeklyHours);
        localStorage.setItem('staffUser', JSON.stringify({
          ...data.data.user,
          pin
        }));
      } else {
        setError(data.error?.message || 'Invalid PIN');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentShift(null);
    setWeeklyHours(0);
    localStorage.removeItem('staffUser');
  };

  const handleClockIn = async () => {
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
      } else {
        setError(data.error?.message || 'Failed to clock in');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
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
        setCurrentShift(null);
        setWeeklyHours(prev => prev + data.data.totalHours);
      } else {
        setError(data.error?.message || 'Failed to clock out');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const response = await fetch('/api/staff/clock/start-break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: user.pin })
      });

      const data = await response.json();

      if (data.success) {
        setCurrentShift((prev: any) => ({
          ...prev,
          isOnBreak: true,
          currentBreakStart: data.data.breakStart
        }));
      } else {
        setError(data.error?.message || 'Failed to start break');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const response = await fetch('/api/staff/clock/end-break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: user.pin })
      });

      const data = await response.json();

      if (data.success) {
        setCurrentShift((prev: any) => ({
          ...prev,
          isOnBreak: false,
          breakMinutes: data.data.totalBreakMinutes
        }));
      } else {
        setError(data.error?.message || 'Failed to end break');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        <PINEntry onLogin={handleLogin} error={error} />
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

      <div className="min-h-screen bg-slate-900">
        {/* Error Banner */}
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/images/servio_icon_tight.png"
                alt="Servio Logo"
                className="h-10 w-auto"
              />
              <div>
                <h1 className="font-semibold text-white">Servio Staff</h1>
                <p className="text-xs text-slate-400">{user.restaurantName}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-3xl p-6 shadow-2xl shadow-orange-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-orange-100 text-sm">Welcome back,</p>
                  <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white tabular-nums">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs text-orange-200">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Weekly Hours */}
          <WeeklyHoursCard
            weeklyHours={weeklyHours}
            breakMinutes={currentShift?.breakMinutes || 0}
          />

          {/* Clock In/Out Section */}
          {currentShift ? (
            <CurrentShiftCard
              shift={currentShift}
              onStartBreak={handleStartBreak}
              onEndBreak={handleEndBreak}
              onClockOut={handleClockOut}
              loading={loading}
            />
          ) : (
            <ClockInCard onClockIn={handleClockIn} loading={loading} />
          )}

          {/* Footer */}
          <div className="text-center py-4">
            <p className="text-xs text-slate-600">
              Powered by Servio Restaurant Platform
            </p>
          </div>
        </main>
      </div>

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
