import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';
import { api } from '../../lib/api';

// Define operating hours type with all possible properties
type DayHours = {
  open: string;
  close: string;
  closed: boolean;
  schedule?: boolean;
  day?: string;
  isOpen?: boolean;
};

// Define holiday schedule type with all possible properties
type HolidaySchedule = {
  date: string;
  name: string;
  closed: boolean;
  open?: string;
  close?: string;
  schedule?: boolean;
  day?: string;
  isOpen?: boolean;
};

type RestaurantSettings = {
  holiday_schedule?: HolidaySchedule[];
  pickup_instructions?: string;
  [key: string]: any;
};

type RestaurantProfileResponse = {
  success: boolean;
  data?: {
    operating_hours?: Record<string, Partial<DayHours>>;
    settings?: RestaurantSettings;
  };
  error?: { message?: string };
};

const DAYS: Array<{ key: string; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

const DEFAULT_HOURS: Record<string, DayHours> = DAYS.reduce((acc, day) => {
  acc[day.key] = { open: '09:00', close: '17:00', closed: false };
  return acc;
}, {} as Record<string, DayHours>);

function normalizeHours(value?: Record<string, Partial<DayHours>>): Record<string, DayHours> {
  const next = { ...DEFAULT_HOURS };
  if (!value) return next;
  DAYS.forEach(({ key }) => {
    const existing = value[key] || {};
    next[key] = {
      open: existing.open || DEFAULT_HOURS[key].open,
      close: existing.close || DEFAULT_HOURS[key].close,
      closed: Boolean(existing.closed)
    };
  });
  return next;
}

export default function TabletInfoPage() {
  const [operatingHours, setOperatingHours] = useState<Record<string, DayHours>>(DEFAULT_HOURS);
  const [holidaySchedule, setHolidaySchedule] = useState<HolidaySchedule[]>([]);
  const [pickupInstructions, setPickupInstructions] = useState('');
  const [profileSettings, setProfileSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<RestaurantProfileResponse>('/api/restaurant/profile');
      const payload = response.data;
      if (!payload.success) {
        throw new Error(payload.error?.message || 'Failed to load restaurant info');
      }
      const settings = payload.data?.settings || {};
      setOperatingHours(normalizeHours(payload.data?.operating_hours));
      setProfileSettings(settings);
      setPickupInstructions(settings.pickup_instructions || '');
      // Ensure holiday_schedule is an array of HolidaySchedule objects
      const holidayData = settings.holiday_schedule;
      const normalizedHolidays: HolidaySchedule[] = Array.isArray(holidayData)
        ? holidayData.map((h: any) => ({
            date: h.date || '',
            name: h.name || '',
            closed: h.closed ?? true,
            open: h.open || '09:00',
            close: h.close || '17:00',
            schedule: h.schedule,
            day: h.day,
            isOpen: h.isOpen
          }))
        : [];
      setHolidaySchedule(normalizedHolidays);
    } catch (err: any) {
      setError(err?.message || 'Failed to load restaurant info.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateDay = (key: string, updates: Partial<DayHours>) => {
    setOperatingHours((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...updates
      }
    }));
  };

  const updateHoliday = (index: number, updates: Partial<HolidaySchedule>) => {
    setHolidaySchedule((prev) =>
      prev.map((holiday, idx) => (idx === index ? { ...holiday, ...updates } : holiday))
    );
  };

  const addHoliday = () => {
    setHolidaySchedule((prev) => [
      ...prev,
      { date: '', name: '', closed: true, open: '09:00', close: '17:00' }
    ]);
  };

  const removeHoliday = (index: number) => {
    setHolidaySchedule((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const nextSettings = {
        ...profileSettings,
        pickup_instructions: pickupInstructions,
        holiday_schedule: holidaySchedule
      };

      const response = await api.put<RestaurantProfileResponse>('/api/restaurant/profile', {
        operatingHours: operatingHours,
        settings: nextSettings
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Failed to save restaurant info');
      }

      setProfileSettings(nextSettings);
      setSuccess('Restaurant info updated.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save restaurant info.');
    } finally {
      setSaving(false);
    }
  };

  const holidayCount = useMemo(() => holidaySchedule.length, [holidaySchedule]);

  return (
    <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>Info • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      <div className="no-print flex min-h-screen flex-col lg:flex-row">
        <TabletSidebar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">Restaurant Info</h1>
                <p className="text-[var(--tablet-muted)] mt-2">
                  Update store hours, holiday overrides, and pickup instructions.
                </p>
              </div>
              <button
                onClick={saveProfile}
                className="rounded-xl bg-[var(--tablet-accent)] px-4 py-2 text-sm font-semibold text-[var(--tablet-accent-contrast)] hover:opacity-90"
                disabled={saving || loading}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>

            {(error || success) && (
              <div className="mt-4 space-y-2">
                {error && (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    {success}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 space-y-6">
              <section className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                <h2 className="text-lg font-semibold">Store hours</h2>
                <p className="text-sm text-[var(--tablet-muted)] mt-1">
                  Set weekly hours for each day. Mark closed days if needed.
                </p>
                <div className="mt-4 space-y-3">
                  {DAYS.map((day) => {
                    const values = operatingHours[day.key];
                    return (
                      <div
                        key={day.key}
                        className="flex flex-col gap-3 rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-bg)]/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="text-sm font-semibold">{day.label}</div>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-xs text-[var(--tablet-muted)]">
                            <input
                              type="checkbox"
                              checked={values.closed}
                              onChange={(event) => updateDay(day.key, { closed: event.target.checked })}
                              className="h-4 w-4"
                            />
                            Closed
                          </label>
                          <input
                            type="time"
                            value={values.open}
                            onChange={(event) => updateDay(day.key, { open: event.target.value })}
                            className="rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface)] px-2 py-1 text-xs text-[var(--tablet-text)]"
                            disabled={values.closed}
                          />
                          <span className="text-xs text-[var(--tablet-muted)]">to</span>
                          <input
                            type="time"
                            value={values.close}
                            onChange={(event) => updateDay(day.key, { close: event.target.value })}
                            className="rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface)] px-2 py-1 text-xs text-[var(--tablet-text)]"
                            disabled={values.closed}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Holiday schedule</h2>
                    <p className="text-sm text-[var(--tablet-muted)] mt-1">
                      Add date-specific overrides for special hours.
                    </p>
                  </div>
                  <button
                    onClick={addHoliday}
                    className="rounded-xl border border-[var(--tablet-border)] px-3 py-2 text-xs font-semibold text-[var(--tablet-text)] hover:bg-[var(--tablet-bg)]"
                  >
                    Add holiday
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {holidayCount === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--tablet-border)] p-4 text-center text-sm text-[var(--tablet-muted)]">
                      No holiday overrides added yet.
                    </div>
                  ) : (
                    holidaySchedule.map((holiday, index) => (
                      <div
                        key={`${holiday.date}-${index}`}
                        className="flex flex-col gap-3 rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-bg)]/60 p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <input
                            type="date"
                            value={holiday.date}
                            onChange={(event) => updateHoliday(index, { date: event.target.value })}
                            className="rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface)] px-2 py-1 text-xs text-[var(--tablet-text)]"
                          />
                          <input
                            type="text"
                            value={holiday.name}
                            onChange={(event) => updateHoliday(index, { name: event.target.value })}
                            placeholder="Holiday name"
                            className="flex-1 rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface)] px-2 py-1 text-xs text-[var(--tablet-text)]"
                          />
                          <button
                            onClick={() => removeHoliday(index)}
                            className="rounded-lg border border-[var(--tablet-border)] px-2 py-1 text-xs text-[var(--tablet-muted)] hover:bg-[var(--tablet-bg)]"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--tablet-muted)]">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={holiday.closed}
                              onChange={(event) => updateHoliday(index, { closed: event.target.checked })}
                              className="h-4 w-4"
                            />
                            Closed all day
                          </label>
                          {!holiday.closed && (
                            <>
                              <input
                                type="time"
                                value={holiday.open || ''}
                                onChange={(event) => updateHoliday(index, { open: event.target.value })}
                                className="rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface)] px-2 py-1 text-xs text-[var(--tablet-text)]"
                              />
                              <span>to</span>
                              <input
                                type="time"
                                value={holiday.close || ''}
                                onChange={(event) => updateHoliday(index, { close: event.target.value })}
                                className="rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface)] px-2 py-1 text-xs text-[var(--tablet-text)]"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                <h2 className="text-lg font-semibold">Pickup instructions</h2>
                <p className="text-sm text-[var(--tablet-muted)] mt-1">
                  Add pickup directions shown to guests.
                </p>
                <textarea
                  value={pickupInstructions}
                  onChange={(event) => setPickupInstructions(event.target.value)}
                  rows={4}
                  className="mt-3 w-full rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-bg)]/60 px-3 py-2 text-sm text-[var(--tablet-text)]"
                  placeholder="Example: Pick up at the side door, call when you arrive."
                />
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
