import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Store,
  MapPin,
  Utensils,
  Users,
  Sparkles,
  Clock,
  Plus,
  ExternalLink,
  LayoutDashboard,
  Bot,
  ArrowRight,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface DayHours {
  open: boolean;
  openTime: string;
  closeTime: string;
}

type OperatingHours = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

interface TeamMember {
  name: string;
  email: string;
  role: 'manager' | 'staff';
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const DEFAULT_HOURS: OperatingHours = {
  monday:    { open: true, openTime: '09:00', closeTime: '22:00' },
  tuesday:   { open: true, openTime: '09:00', closeTime: '22:00' },
  wednesday: { open: true, openTime: '09:00', closeTime: '22:00' },
  thursday:  { open: true, openTime: '09:00', closeTime: '22:00' },
  friday:    { open: true, openTime: '09:00', closeTime: '22:00' },
  saturday:  { open: true, openTime: '09:00', closeTime: '22:00' },
  sunday:    { open: true, openTime: '09:00', closeTime: '22:00' },
};

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
];

const CUISINE_TYPES = [
  'American','Italian','Mexican','Chinese','Japanese','Indian','Thai',
  'Mediterranean','Caribbean','Soul Food','BBQ','Seafood','Vegan/Vegetarian',
  'Fusion','Other',
];

const STEP_LABELS = [
  'Basics',
  'Location & Hours',
  'Menu',
  'Team',
  'All Set!',
];

// ─────────────────────────────────────────────
// Shared Input Components
// ─────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}
const FormInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, ...rest }, ref) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-400 mb-1.5">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        {...rest}
        className={`w-full bg-gray-800 border rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm
          focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors
          ${error ? 'border-red-500' : 'border-gray-700'}
          ${rest.disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
);
FormInput.displayName = 'FormInput';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: string[];
  placeholder?: string;
  error?: string;
}
const FormSelect = ({ label, id, options, placeholder, error, ...rest }: SelectProps) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-400 mb-1.5">
      {label}
    </label>
    <select
      id={id}
      {...rest}
      className={`w-full bg-gray-800 border rounded-xl px-4 py-3 text-white text-sm
        focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors
        appearance-none cursor-pointer
        ${error ? 'border-red-500' : 'border-gray-700'}
      `}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);

// ─────────────────────────────────────────────
// Toggle Switch
// ─────────────────────────────────────────────

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-900
      ${checked ? 'bg-primary-500' : 'bg-gray-700'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
        ${checked ? 'translate-x-6' : 'translate-x-1'}`}
    />
  </button>
);

// ─────────────────────────────────────────────
// Animated Background Blobs
// ─────────────────────────────────────────────

const BackgroundBlobs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      className="absolute top-1/4 left-1/6 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"
      animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute bottom-1/4 right-1/6 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"
      animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.25, 0.1] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
    />
    <motion.div
      className="absolute top-3/4 left-1/2 w-64 h-64 bg-purple-500/8 rounded-full blur-3xl"
      animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
    />
  </div>
);

// ─────────────────────────────────────────────
// Confetti Particles
// ─────────────────────────────────────────────

const Confetti = () => (
  <>
    {[...Array(18)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-sm"
        style={{
          left: `${5 + i * 5.2}%`,
          top: '-12px',
          width: i % 3 === 0 ? '8px' : '6px',
          height: i % 3 === 0 ? '8px' : '12px',
          backgroundColor:
            i % 4 === 0 ? '#14b8a6' :
            i % 4 === 1 ? '#3b82f6' :
            i % 4 === 2 ? '#a855f7' : '#f59e0b',
        }}
        animate={{
          y: ['0vh', '108vh'],
          x: [0, (i % 2 === 0 ? 1 : -1) * (15 + i * 4)],
          rotate: [0, 720 * (i % 2 === 0 ? 1 : -1)],
          opacity: [1, 0.8, 0],
        }}
        transition={{
          duration: 2.5 + i * 0.2,
          delay: i * 0.1,
          ease: 'easeIn',
          repeat: 2,
          repeatDelay: 3,
        }}
      />
    ))}
  </>
);

// ─────────────────────────────────────────────
// Step Indicator
// ─────────────────────────────────────────────

const StepIndicator = ({ current, total }: { current: number; total: number }) => (
  <div className="flex items-center gap-2 justify-center">
    {Array.from({ length: total }).map((_, i) => (
      <React.Fragment key={i}>
        <motion.div
          className={`rounded-full transition-colors ${
            i < current
              ? 'bg-primary-500 w-6 h-6 flex items-center justify-center'
              : i === current
              ? 'bg-primary-500/20 border-2 border-primary-500 w-6 h-6'
              : 'bg-gray-700 w-2 h-2'
          }`}
          layout
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {i < current && (
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          )}
        </motion.div>
        {i < total - 1 && (
          <div className={`h-px transition-colors ${i < current ? 'bg-primary-500/60 w-8' : 'bg-gray-700 w-8'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ─────────────────────────────────────────────
// Slide animation variants
// ─────────────────────────────────────────────

const slideVariants = {
  enterFromRight: { x: 60, opacity: 0 },
  enterFromLeft:  { x: -60, opacity: 0 },
  center:         { x: 0, opacity: 1 },
  exitToLeft:     { x: -60, opacity: 0 },
  exitToRight:    { x: 60, opacity: 0 },
};

// ─────────────────────────────────────────────
// STEP 1 — Restaurant Basics
// ─────────────────────────────────────────────

interface Step1Props {
  restaurantName: string;
  setRestaurantName: (v: string) => void;
  cuisineType: string;
  setCuisineType: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  onNext: () => void;
  loading: boolean;
}

const Step1Basics = ({
  restaurantName, setRestaurantName,
  cuisineType, setCuisineType,
  phone, setPhone,
  email, setEmail,
  onNext, loading,
}: Step1Props) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!restaurantName.trim()) errs.restaurantName = 'Restaurant name is required';
    if (!cuisineType) errs.cuisineType = 'Please select a cuisine type';
    if (!phone.trim()) errs.phone = 'Phone number is required';
    if (!email.trim()) errs.email = 'Email is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Welcome header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-16 h-16 bg-primary-500/15 rounded-2xl flex items-center justify-center mx-auto mb-5"
        >
          <Store className="w-8 h-8 text-primary-400" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl sm:text-3xl font-bold text-white mb-2"
        >
          Let&apos;s get{' '}
          <span className="text-primary-400">{restaurantName || 'your restaurant'}</span>{' '}
          up and running
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-400 text-sm"
        >
          We&apos;ll walk you through everything in about 3 minutes.
        </motion.p>
      </div>

      {/* What you'll set up */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-4 mb-6"
      >
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">What we&apos;ll cover</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Store, label: 'Restaurant basics' },
            { icon: MapPin, label: 'Address & hours' },
            { icon: Utensils, label: 'Menu quick-start' },
            { icon: Users, label: 'Invite your team' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-5 h-5 bg-primary-500/15 rounded-md flex items-center justify-center flex-shrink-0">
                <Icon className="w-3 h-3 text-primary-400" />
              </div>
              {label}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Form fields */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-4"
      >
        <FormInput
          id="restaurantName"
          label="Restaurant Name"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          placeholder="e.g. The Golden Fork"
          error={errors.restaurantName}
        />

        <FormSelect
          id="cuisineType"
          label="Cuisine Type"
          value={cuisineType}
          onChange={(e) => setCuisineType(e.target.value)}
          options={CUISINE_TYPES}
          placeholder="Select cuisine type…"
          error={errors.cuisineType}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            id="phone"
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 000-0000"
            error={errors.phone}
          />
          <FormInput
            id="email"
            label="Contact Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hello@restaurant.com"
            error={errors.email}
          />
        </div>
      </motion.div>

      <motion.button
        type="submit"
        disabled={loading}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full mt-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700
          text-white font-semibold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2
          transition-all shadow-lg shadow-primary-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving…
          </>
        ) : (
          <>
            Let&apos;s Go
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </motion.button>
    </form>
  );
};

// ─────────────────────────────────────────────
// STEP 2 — Address & Hours
// ─────────────────────────────────────────────

interface Step2Props {
  street: string; setStreet: (v: string) => void;
  city: string; setCity: (v: string) => void;
  state: string; setState: (v: string) => void;
  zip: string; setZip: (v: string) => void;
  hours: OperatingHours; setHours: (h: OperatingHours) => void;
  onNext: () => void;
  onSkip: () => void;
  loading: boolean;
}

const Step2Address = ({
  street, setStreet, city, setCity, state, setState, zip, setZip,
  hours, setHours, onNext, onSkip, loading,
}: Step2Props) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!street.trim()) errs.street = 'Street address is required';
    if (!city.trim()) errs.city = 'City is required';
    if (!state) errs.state = 'State is required';
    if (!zip.trim()) errs.zip = 'ZIP code is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext();
  };

  const updateDay = (day: keyof OperatingHours, field: keyof DayHours, value: boolean | string) => {
    setHours({ ...hours, [day]: { ...hours[day], [field]: value } });
  };

  const applyWeekdayHours = () => {
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
    const reference = hours.monday;
    const updated = { ...hours };
    weekdays.forEach((d) => { updated[d] = { ...reference }; });
    setHours(updated);
    toast.success('Weekday hours updated');
  };

  const closeWeekends = () => {
    setHours({
      ...hours,
      saturday: { ...hours.saturday, open: false },
      sunday: { ...hours.sunday, open: false },
    });
    toast.success('Weekends set to closed');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Address */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-primary-500/15 rounded-lg flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary-400" />
          </div>
          <h3 className="text-white font-semibold">Restaurant Address</h3>
        </div>
        <div className="space-y-3">
          <FormInput
            id="street"
            label="Street Address"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="123 Main Street"
            error={errors.street}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormInput
              id="city"
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="New York"
              error={errors.city}
            />
            <FormSelect
              id="state"
              label="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
              options={US_STATES}
              placeholder="Select state…"
              error={errors.state}
            />
          </div>
          <FormInput
            id="zip"
            label="ZIP Code"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="10001"
            error={errors.zip}
          />
        </div>
      </div>

      {/* Operating Hours */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500/15 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary-400" />
            </div>
            <h3 className="text-white font-semibold">Operating Hours</h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyWeekdayHours}
              className="text-xs text-primary-400 hover:text-primary-300 bg-primary-500/10 hover:bg-primary-500/20
                px-2.5 py-1.5 rounded-lg border border-primary-500/20 transition-colors"
            >
              Same weekdays
            </button>
            <button
              type="button"
              onClick={closeWeekends}
              className="text-xs text-gray-400 hover:text-gray-300 bg-gray-800 hover:bg-gray-700
                px-2.5 py-1.5 rounded-lg border border-gray-700 transition-colors"
            >
              Close weekends
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {DAYS.map((day) => {
            const d = hours[day];
            return (
              <div key={day} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-4 py-3 border border-gray-700/60">
                <span className="text-sm font-medium text-gray-300 w-24 flex-shrink-0">{DAY_LABELS[day]}</span>
                <Toggle checked={d.open} onChange={() => updateDay(day, 'open', !d.open)} />
                {d.open ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="time"
                      value={d.openTime}
                      onChange={(e) => updateDay(day, 'openTime', e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white
                        focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 flex-1 min-w-0"
                    />
                    <span className="text-gray-500 text-xs flex-shrink-0">to</span>
                    <input
                      type="time"
                      value={d.closeTime}
                      onChange={(e) => updateDay(day, 'closeTime', e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white
                        focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 flex-1 min-w-0"
                    />
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm italic flex-1">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
        >
          Skip for now
        </button>
        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700
            text-white font-semibold py-3 px-8 rounded-xl flex items-center gap-2
            transition-all shadow-lg shadow-primary-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>Save & Continue <ChevronRight className="w-4 h-4" /></>
          )}
        </motion.button>
      </div>
    </form>
  );
};

// ─────────────────────────────────────────────
// STEP 3 — Menu Quick-Start
// ─────────────────────────────────────────────

interface Step3Props {
  onSkip: () => void;
}

const Step3Menu = ({ onSkip }: Step3Props) => (
  <div className="space-y-6">
    <div className="text-center mb-2">
      <div className="w-16 h-16 bg-primary-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Utensils className="w-8 h-8 text-primary-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Set up your menu</h3>
      <p className="text-gray-400 text-sm">
        You can always add and edit your menu from the dashboard at any time.
      </p>
    </div>

    {/* Two option cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Start from scratch */}
      <Link href="/dashboard/menu-management" target="_blank" rel="noopener noreferrer">
        <motion.div
          whileHover={{ scale: 1.02, borderColor: '#14b8a6' }}
          className="group bg-gray-800/60 border-2 border-gray-700 rounded-2xl p-6 cursor-pointer
            hover:bg-gray-800 transition-all h-full"
        >
          <div className="w-12 h-12 bg-primary-500/15 rounded-xl flex items-center justify-center mb-4 
            group-hover:bg-primary-500/25 transition-colors">
            <Utensils className="w-6 h-6 text-primary-400" />
          </div>
          <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
            Start from scratch
            <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
          </h4>
          <p className="text-gray-400 text-sm leading-relaxed">
            Build your full menu with categories, items, pricing, and modifiers.
          </p>
          <div className="mt-4 text-primary-400 text-sm font-medium flex items-center gap-1.5">
            Open menu editor <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </motion.div>
      </Link>

      {/* Skip */}
      <motion.div
        onClick={onSkip}
        whileHover={{ scale: 1.02 }}
        className="group bg-gray-800/40 border-2 border-gray-700 rounded-2xl p-6 cursor-pointer
          hover:bg-gray-800/60 hover:border-gray-600 transition-all"
      >
        <div className="w-12 h-12 bg-gray-700/60 rounded-xl flex items-center justify-center mb-4 
          group-hover:bg-gray-700 transition-colors">
          <Clock className="w-6 h-6 text-gray-400" />
        </div>
        <h4 className="text-white font-semibold mb-2">I&apos;ll add my menu later</h4>
        <p className="text-gray-400 text-sm leading-relaxed">
          Skip for now and come back to add your menu whenever you&apos;re ready.
        </p>
        <div className="mt-4 text-gray-500 text-sm font-medium flex items-center gap-1.5">
          Continue setup <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </motion.div>
    </div>

    {/* Menu preview mockup */}
    <div className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-5 overflow-hidden">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Menu Manager Preview</p>
      <div className="space-y-2">
        {/* Mock categories */}
        {['Starters', 'Main Course', 'Desserts', 'Drinks'].map((cat, i) => (
          <div key={cat} className="flex items-center gap-3 bg-gray-900/60 rounded-xl px-4 py-3">
            <div className="w-8 h-8 bg-primary-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Utensils className="w-3.5 h-3.5 text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-300">{cat}</div>
              <div className="text-xs text-gray-500">{[4,8,5,6][i]} items</div>
            </div>
            <div className="text-xs text-gray-600">›</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// STEP 4 — Invite Team
// ─────────────────────────────────────────────

interface Step4Props {
  members: TeamMember[];
  setMembers: (m: TeamMember[]) => void;
  onNext: () => void;
  onSkip: () => void;
  loading: boolean;
}

const emptyMember = (): TeamMember => ({ name: '', email: '', role: 'staff' });

const Step4Team = ({ members, setMembers, onNext, onSkip, loading }: Step4Props) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMember = (index: number, field: keyof TeamMember, value: string) => {
    const updated = members.map((m, i) => i === index ? { ...m, [field]: value } : m);
    setMembers(updated);
  };

  const addMember = () => {
    if (members.length < 3) setMembers([...members, emptyMember()]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    members.forEach((m, i) => {
      if (m.name.trim() || m.email.trim()) {
        if (!m.name.trim()) errs[`name_${i}`] = 'Name required';
        if (!m.email.trim()) errs[`email_${i}`] = 'Email required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) errs[`email_${i}`] = 'Invalid email';
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-2">
        <div className="w-16 h-16 bg-primary-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-primary-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Invite your team</h3>
        <p className="text-gray-400 text-sm">
          Add staff members so they can clock in, take orders, and manage the floor.
        </p>
      </div>

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {members.map((member, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-400">Team Member {i + 1}</span>
                {members.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormInput
                  id={`member_name_${i}`}
                  label="Full Name"
                  value={member.name}
                  onChange={(e) => updateMember(i, 'name', e.target.value)}
                  placeholder="Jane Smith"
                  error={errors[`name_${i}`]}
                />
                <FormInput
                  id={`member_email_${i}`}
                  label="Email"
                  type="email"
                  value={member.email}
                  onChange={(e) => updateMember(i, 'email', e.target.value)}
                  placeholder="jane@restaurant.com"
                  error={errors[`email_${i}`]}
                />
                <FormSelect
                  id={`member_role_${i}`}
                  label="Role"
                  value={member.role}
                  onChange={(e) => updateMember(i, 'role', e.target.value as 'manager' | 'staff')}
                  options={['staff', 'manager']}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {members.length < 3 && (
          <button
            type="button"
            onClick={addMember}
            className="w-full py-3 border-2 border-dashed border-gray-700 hover:border-gray-600
              rounded-2xl text-sm text-gray-500 hover:text-gray-400 flex items-center justify-center gap-2
              transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add another team member
          </button>
        )}
      </div>

      <p className="text-center text-xs text-gray-500">
        You can always add more staff from the Staff page in your dashboard.
      </p>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
        >
          Skip for now
        </button>
        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700
            text-white font-semibold py-3 px-8 rounded-xl flex items-center gap-2
            transition-all shadow-lg shadow-primary-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>Save & Continue <ChevronRight className="w-4 h-4" /></>
          )}
        </motion.button>
      </div>
    </form>
  );
};

// ─────────────────────────────────────────────
// STEP 5 — Completion
// ─────────────────────────────────────────────

interface Step5Props {
  restaurantName: string;
  completedSteps: number[];
}

const STEP_RECAP = [
  { label: 'Restaurant basics configured' },
  { label: 'Address & hours saved' },
  { label: 'Menu quick-start complete' },
  { label: 'Team invites sent' },
];

const Step5Complete = ({ restaurantName, completedSteps }: Step5Props) => (
  <div className="text-center space-y-8">
    {/* Animated checkmark */}
    <div className="flex justify-center">
      <div className="relative">
        <motion.div
          className="w-24 h-24 rounded-full bg-primary-500/15 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.35 }}
          >
            <CheckCircle2 className="w-12 h-12 text-primary-400" />
          </motion.div>
        </motion.div>
        {/* Ping rings */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary-400/40"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 1.4, delay: 0.5, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary-400/20"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 1.8, delay: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>

    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <div className="inline-flex items-center gap-2 bg-primary-500/15 border border-primary-500/25 text-primary-300 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
        <Sparkles className="w-3.5 h-3.5" />
        Setup Complete
      </div>
      <h2 className="text-3xl font-bold text-white mb-2">Your restaurant is ready to go!</h2>
      <p className="text-gray-400">
        <span className="text-white font-medium">{restaurantName || 'Your restaurant'}</span> is all set up on Servio.
      </p>
    </motion.div>

    {/* Recap checklist */}
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65 }}
      className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-5 text-left"
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">What you set up</p>
      <div className="space-y-3">
        {STEP_RECAP.map((item, i) => {
          const done = completedSteps.includes(i);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.08 }}
              className="flex items-center gap-3"
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                done ? 'bg-primary-500/20' : 'bg-gray-700/60'
              }`}>
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary-400" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-600" />
                )}
              </div>
              <span className={`text-sm ${done ? 'text-gray-300' : 'text-gray-500 line-through'}`}>
                {item.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>

    {/* Quick-start cards */}
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.85 }}
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
    >
      <Link href="/dashboard">
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="bg-gradient-to-br from-primary-500/20 to-primary-600/10 border-2 border-primary-500/30
            hover:border-primary-500/60 rounded-2xl p-5 cursor-pointer transition-all text-center group"
        >
          <LayoutDashboard className="w-7 h-7 text-primary-400 mx-auto mb-3" />
          <p className="text-white font-semibold text-sm mb-1">View Dashboard</p>
          <p className="text-gray-500 text-xs">Your command center</p>
        </motion.div>
      </Link>

      <Link href="/dashboard/menu-management">
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="bg-gray-800/60 border border-gray-700 hover:border-gray-600
            rounded-2xl p-5 cursor-pointer transition-all text-center"
        >
          <Utensils className="w-7 h-7 text-gray-400 mx-auto mb-3" />
          <p className="text-white font-semibold text-sm mb-1">Set Up Menu</p>
          <p className="text-gray-500 text-xs">Add items & categories</p>
        </motion.div>
      </Link>

      <Link href="/dashboard/assistant">
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="bg-gray-800/60 border border-gray-700 hover:border-gray-600
            rounded-2xl p-5 cursor-pointer transition-all text-center"
        >
          <Bot className="w-7 h-7 text-gray-400 mx-auto mb-3" />
          <p className="text-white font-semibold text-sm mb-1">AI Assistant</p>
          <p className="text-gray-500 text-xs">Voice-first operations</p>
        </motion.div>
      </Link>
    </motion.div>
  </div>
);

// ─────────────────────────────────────────────
// MAIN ONBOARDING PAGE
// ─────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();

  // Navigation state
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [stepLoading, setStepLoading] = useState(false);

  // Step 1 — Basics
  const [restaurantName, setRestaurantName] = useState('');
  const [cuisineType, setCuisineType] = useState('');
  const [phone, setPhone] = useState('');
  const [basicEmail, setBasicEmail] = useState('');

  // Step 2 — Address & Hours
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [zip, setZip] = useState('');
  const [hours, setHours] = useState<OperatingHours>(DEFAULT_HOURS);

  // Step 4 — Team
  const [members, setMembers] = useState<TeamMember[]>([emptyMember()]);

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  // Pre-fill from API on mount
  useEffect(() => {
    if (!user) return;
    const prefill = async () => {
      try {
        const res = await api.get('/api/restaurant/profile');
        const data = res.data?.data || res.data;
        if (data) {
          if (data.name) setRestaurantName(data.name);
          if (data.cuisineType) setCuisineType(data.cuisineType);
          if (data.phone) setPhone(data.phone);
          if (data.email) setBasicEmail(data.email);
          else if (user.email) setBasicEmail(user.email);
          if (data.address) {
            try {
              const addr = typeof data.address === 'string' ? JSON.parse(data.address) : data.address;
              if (addr.street) setStreet(addr.street);
              if (addr.city) setCity(addr.city);
              if (addr.state) setAddressState(addr.state);
              if (addr.zip) setZip(addr.zip);
            } catch { /* ignore */ }
          }
          if (data.operatingHours) {
            try {
              const h = typeof data.operatingHours === 'string'
                ? JSON.parse(data.operatingHours)
                : data.operatingHours;
              setHours({ ...DEFAULT_HOURS, ...h });
            } catch { /* ignore */ }
          }
        }
      } catch {
        // Pre-fill email from user context as fallback
        if (user.email) setBasicEmail(user.email);
      }
    };
    prefill();
  }, [user]);

  const goToStep = (step: number) => {
    setDirection(step > currentStep ? 'forward' : 'backward');
    setCurrentStep(step);
  };

  const markStepComplete = (stepIndex: number) => {
    setCompletedSteps((prev) => prev.includes(stepIndex) ? prev : [...prev, stepIndex]);
  };

  // ── Step 1 submit
  const handleStep1Next = async () => {
    setStepLoading(true);
    try {
      await api.put('/api/restaurant/profile', {
        name: restaurantName,
        cuisineType,
        phone,
        email: basicEmail,
      });
    } catch {
      toast.error('Could not save restaurant info — you can update it later.');
    } finally {
      setStepLoading(false);
      markStepComplete(0);
      goToStep(1);
    }
  };

  // ── Step 2 submit
  const handleStep2Next = async () => {
    setStepLoading(true);
    try {
      await api.put('/api/restaurant/profile', {
        address: JSON.stringify({ street, city, state: addressState, zip }),
        operatingHours: JSON.stringify(hours),
      });
    } catch {
      toast.error('Could not save address & hours — you can update them later.');
    } finally {
      setStepLoading(false);
      markStepComplete(1);
      goToStep(2);
    }
  };

  const handleStep2Skip = () => {
    markStepComplete(1);
    goToStep(2);
  };

  // ── Step 3 skip / continue
  const handleStep3Skip = () => {
    markStepComplete(2);
    goToStep(3);
  };

  // ── Step 4 submit
  const handleStep4Next = async () => {
    const validMembers = members.filter((m) => m.name.trim() && m.email.trim());
    if (validMembers.length === 0) {
      markStepComplete(3);
      goToStep(4);
      await markOnboardingComplete();
      return;
    }
    setStepLoading(true);
    let anyFailed = false;
    for (const m of validMembers) {
      try {
        await api.post('/api/staff', { name: m.name, email: m.email, role: m.role, permissions: ['*'] });
      } catch {
        anyFailed = true;
      }
    }
    if (anyFailed) toast.error('Some invites could not be sent — you can add staff from the Staff page.');
    else if (validMembers.length > 0) toast.success(`${validMembers.length} team member${validMembers.length > 1 ? 's' : ''} invited!`);
    setStepLoading(false);
    markStepComplete(3);
    goToStep(4);
    await markOnboardingComplete();
  };

  const handleStep4Skip = async () => {
    markStepComplete(3);
    goToStep(4);
    await markOnboardingComplete();
  };

  const markOnboardingComplete = async () => {
    try {
      await api.post('/api/restaurant/onboarding-complete');
    } catch {
      // Silently fail — non-blocking
    }
  };

  const progressPercent = (currentStep / 4) * 100;

  const getAnimationVariant = (state: 'initial' | 'animate' | 'exit') => {
    if (state === 'initial') {
      return direction === 'forward'
        ? slideVariants.enterFromRight
        : slideVariants.enterFromLeft;
    }
    if (state === 'animate') return slideVariants.center;
    if (state === 'exit') {
      return direction === 'forward'
        ? slideVariants.exitToLeft
        : slideVariants.exitToRight;
    }
    return slideVariants.center;
  };

  // ── Loading state
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const TOTAL_STEPS = 5;
  const stepMaxWidth = currentStep === 1 ? 'max-w-3xl' : 'max-w-2xl';

  return (
    <>
      <Head>
        <title>Set Up Your Restaurant — Servio</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
        <BackgroundBlobs />

        {/* Confetti on completion */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {currentStep === 4 && <Confetti />}
        </div>

        {/* Progress bar (very top) */}
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-800">
          <motion.div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-400"
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Header bar */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 max-w-screen-xl mx-auto">
          {/* SERVIO logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xs">S</span>
            </div>
            <span className="text-white font-bold text-lg tracking-wide">SERVIO</span>
          </div>

          {/* Step counter + skip */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">
              Step {currentStep + 1} of {TOTAL_STEPS}
            </span>
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
            >
              Skip onboarding →
            </Link>
          </div>
        </div>

        {/* Step dots */}
        <div className="relative z-10 flex justify-center mt-2 mb-8">
          <div className="flex flex-col items-center gap-3">
            <StepIndicator current={currentStep} total={TOTAL_STEPS} />
            <div className="flex gap-6">
              {STEP_LABELS.map((label, i) => (
                <span
                  key={i}
                  className={`text-xs hidden sm:block transition-colors ${
                    i === currentStep ? 'text-primary-400 font-medium' :
                    i < currentStep ? 'text-gray-500' : 'text-gray-700'
                  }`}
                  style={{ width: '80px', textAlign: 'center' }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 px-4 pb-16">
          <div className={`${stepMaxWidth} mx-auto`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStep}
                initial={getAnimationVariant('initial')}
                animate={getAnimationVariant('animate')}
                exit={getAnimationVariant('exit')}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="bg-gray-800/70 border border-gray-700/60 rounded-3xl p-6 sm:p-8 backdrop-blur-sm shadow-2xl shadow-black/30"
              >
                {/* Step 1 */}
                {currentStep === 0 && (
                  <Step1Basics
                    restaurantName={restaurantName}
                    setRestaurantName={setRestaurantName}
                    cuisineType={cuisineType}
                    setCuisineType={setCuisineType}
                    phone={phone}
                    setPhone={setPhone}
                    email={basicEmail}
                    setEmail={setBasicEmail}
                    onNext={handleStep1Next}
                    loading={stepLoading}
                  />
                )}

                {/* Step 2 */}
                {currentStep === 1 && (
                  <>
                    {/* Back button inside card */}
                    <div className="flex items-center justify-between mb-6">
                      <button
                        onClick={() => goToStep(0)}
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                      <span className="text-xs text-gray-600">Step 2 of 5</span>
                    </div>
                    <Step2Address
                      street={street} setStreet={setStreet}
                      city={city} setCity={setCity}
                      state={addressState} setState={setAddressState}
                      zip={zip} setZip={setZip}
                      hours={hours} setHours={setHours}
                      onNext={handleStep2Next}
                      onSkip={handleStep2Skip}
                      loading={stepLoading}
                    />
                  </>
                )}

                {/* Step 3 */}
                {currentStep === 2 && (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <button
                        onClick={() => goToStep(1)}
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                      <span className="text-xs text-gray-600">Step 3 of 5</span>
                    </div>
                    <Step3Menu onSkip={handleStep3Skip} />
                    {/* Explicit continue button for opening in new tab case */}
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-xs text-gray-600" />
                      <motion.button
                        onClick={handleStep3Skip}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700
                          text-white font-semibold py-3 px-8 rounded-xl flex items-center gap-2
                          transition-all shadow-lg shadow-primary-500/20"
                      >
                        Continue <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </>
                )}

                {/* Step 4 */}
                {currentStep === 3 && (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <button
                        onClick={() => goToStep(2)}
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                      <span className="text-xs text-gray-600">Step 4 of 5</span>
                    </div>
                    <Step4Team
                      members={members}
                      setMembers={setMembers}
                      onNext={handleStep4Next}
                      onSkip={handleStep4Skip}
                      loading={stepLoading}
                    />
                  </>
                )}

                {/* Step 5 */}
                {currentStep === 4 && (
                  <Step5Complete
                    restaurantName={restaurantName}
                    completedSteps={completedSteps}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Footer hint */}
            {currentStep < 4 && (
              <motion.p
                key={currentStep}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center text-gray-600 text-xs mt-6"
              >
                Your progress is saved automatically.{' '}
                <Link href="/dashboard" className="text-gray-500 hover:text-gray-400 underline underline-offset-2 transition-colors">
                  Return to dashboard
                </Link>
              </motion.p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
