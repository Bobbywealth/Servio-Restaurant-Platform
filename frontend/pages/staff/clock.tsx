import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Clock,
  Coffee,
  LogOut,
  LogIn,
  Calendar,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Timer
} from 'lucide-react';

// PIN entry component
interface PINEntryProps {
  onLogin: (pin: string) => void;
  error?: string | null;
}

function PINEntry({ onLogin, error }: PINEntryProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const inputRefs = [React.useRef<HTMLInputElement>(null), React.useRef<HTMLInputElement>(null), React.useRef<HTMLInputElement>(null), React.useRef<HTMLInputElement>(null)];

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key >= '0' && e.key <= '9') {
      const newPin = [...pin];
      newPin[index] = e.key;
      setPin(newPin);
      if (index < 3) {
        inputRefs[index + 1].current?.focus();
      } else {
        // Auto-submit on last digit
        onLogin(newPin.join(''));
      }
    }
  };

  const handleChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newPin = [...pin];
      newPin[index] = value;
      setPin(newPin);
      if (value && index < 3) {
        inputRefs[index + 1].current?.focus();
      } else if (!value && index > 0) {
        inputRefs[index - 1].current?.focus();
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
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Clock className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Servio Staff</h1>
          <p className="text-orange-100">Enter your PIN to clock in</p>
        </div>

        {/* PIN Input */}
        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <div className="flex justify-center gap-3 mb-6">
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-16 h-16 text-center text-3xl font-bold border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition-colors"
                disabled={!!error}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center justify-center text-red-500 mb-4">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-center text-sm text-gray-500">
            Ask your manager if you don&apos;t have a PIN
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-orange-100 text-sm">
          <p>Tap each box and enter your 4-digit code</p>
        </div>
      </div>
    </div>
  );
}

// Clock action button
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
    primary: 'bg-orange-500 hover:bg-orange-600 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        w-full py-4 px-6 rounded-xl font-semibold text-lg
        flex items-center justify-center gap-3
        transition-all duration-200 transform active:scale-95
        ${variants[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        shadow-md hover:shadow-lg
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

// Status badge
interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<string, { color: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
    'clocked-in': { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'On Shift' },
    'on-break': { color: 'bg-yellow-100 text-yellow-700', icon: Coffee, label: 'On Break' },
    'clocked-out': { color: 'bg-gray-100 text-gray-700', icon: Clock, label: 'Off Shift' }
  };

  const { color, icon: Icon, label } = config[status] || config['clocked-out'];

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${color}`}>
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

// Weekly hours card
interface WeeklyHoursCardProps {
  weeklyHours: number;
}

function WeeklyHoursCard({ weeklyHours }: WeeklyHoursCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">This Week</h2>
        <Calendar className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold text-orange-500">{weeklyHours.toFixed(1)}</span>
        <span className="text-gray-500 mb-1">hours</span>
      </div>
      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min((weeklyHours / 40) * 100, 100)}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 mt-2">
        {weeklyHours >= 40 ? 'Full week completed!' : `${(40 - weeklyHours).toFixed(1)} hours to reach 40`}
      </p>
    </div>
  );
}

// Current shift card
interface CurrentShiftCardProps {
  shift: {
    clockInTime: string;
    breakMinutes: number;
    position?: string | null;
    isOnBreak: boolean;
  } | null;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onClockOut: () => void;
  loading: boolean;
}

function CurrentShiftCard({ shift, onStartBreak, onEndBreak, onClockOut, loading }: CurrentShiftCardProps) {
  if (!shift) return null;

  const clockInTime = new Date(shift.clockInTime);
  const now = new Date();
  const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
  const hours = Math.floor(hoursWorked);
  const minutes = Math.floor((hoursWorked - hours) * 60);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Current Shift</h2>
        <StatusBadge status={shift.isOnBreak ? 'on-break' : 'clocked-in'} />
      </div>

      <div className="text-center py-4">
        <div className="text-3xl font-bold text-gray-900">
          {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
        </div>
        <p className="text-gray-500 text-sm mt-1">
          Clocked in at {clockInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {shift.position && (
          <p className="text-gray-400 text-sm">Position: {shift.position}</p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {shift.isOnBreak ? (
          <ActionButton
            label="End Break"
            icon={Coffee}
            variant="success"
            onClick={onEndBreak}
            disabled={loading}
            loading={loading}
          />
        ) : (
          <>
            <ActionButton
              label={shift.breakMinutes > 0 ? `Take Break (${Math.floor(shift.breakMinutes)}m used)` : 'Take Break'}
              icon={Coffee}
              variant="secondary"
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

// Clock in card
interface ClockInCardProps {
  onClockIn: () => void;
  loading: boolean;
}

function ClockInCard({ onClockIn, loading }: ClockInCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-md">
      <div className="text-center py-6">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <LogIn className="w-10 h-10 text-orange-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Ready to Clock In?</h2>
        <p className="text-gray-500 mb-6">Tap below to start your shift</p>
        <ActionButton
          label="Clock In"
          icon={LogIn}
          variant="success"
          onClick={onClockIn}
          disabled={loading}
          loading={loading}
        />
      </div>
    </div>
  );
}

// Main clock page
interface ShiftState {
  clockInTime?: string;
  timeEntryId?: string;
  breakMinutes: number;
  position?: string;
  isOnBreak: boolean;
  currentBreakStart?: string;
}

export default function StaffClockPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [weeklyHours, setWeeklyHours] = useState(0);

  // Check for existing session
  useEffect(() => {
    const savedUser = localStorage.getItem('staffUser');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        fetchUserStatus(userData.id, userData.pin);
      } catch {
        localStorage.removeItem('staffUser');
      }
    }
  }, []);

  const fetchUserStatus = async (userId: string, pin: string) => {
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
        // PIN will remain entered so user can retry
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
        setCurrentShift((prev: ShiftState) => ({
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
          <meta name="theme-color" content="#ff6b35" />
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
        <meta name="theme-color" content="#ff6b35" />
        <link rel="manifest" href="/manifest-staff.json" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">Servio Staff</h1>
                <p className="text-xs text-gray-500">{user.restaurantName}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Welcome Card */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Welcome back,</p>
                <h2 className="text-2xl font-bold">{user.name}</h2>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Timer className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}

          {/* Weekly Hours */}
          <WeeklyHoursCard weeklyHours={weeklyHours} />

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
          <div className="text-center text-sm text-gray-400 pt-4">
            <p>Need help? Contact your manager</p>
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
