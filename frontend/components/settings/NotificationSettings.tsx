'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  Clock,
  Settings,
  X,
  Check,
  AlertCircle,
  ShoppingCart,
  Users,
  Package,
  ClipboardList,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import { usePushSubscription, useNotificationPreferences } from '../../lib/hooks';
import { showToast } from '../ui/Toast';

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationSettings({ isOpen, onClose }: NotificationSettingsProps) {
  const push = usePushSubscription();
  const { preferences, isLoading, updatePreferences } = useNotificationPreferences();
  const [saving, setSaving] = useState(false);

  const handleTogglePush = async () => {
    if (push.permission === 'denied') {
      showToast.error('Please enable notifications in your browser settings');
      return;
    }

    if (push.subscription) {
      const success = await push.unsubscribe();
      if (success) {
        showToast.success('Push notifications disabled');
      }
    } else {
      const subscription = await push.subscribe();
      if (subscription) {
        showToast.success('Push notifications enabled');
      } else {
        showToast.error('Failed to enable push notifications');
      }
    }
  };

  const handleTogglePreference = async (key: string, value: boolean) => {
    if (!preferences) return;

    setSaving(true);
    const success = await updatePreferences({ [key]: value });
    setSaving(false);

    if (success) {
      showToast.success('Preferences updated');
    } else {
      showToast.error('Failed to update preferences');
    }
  };

  const handleTimePreferenceChange = async (key: string, value: string) => {
    if (!preferences) return;

    setSaving(true);
    const success = await updatePreferences({ [key]: value });
    setSaving(false);

    if (success) {
      showToast.success('Preferences updated');
    } else {
      showToast.error('Failed to update preferences');
    }
  };

  const handleTestPush = async () => {
    try {
      const response = await fetch('/api/push/test', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        showToast.success('Test notification sent!');
      } else {
        showToast.error(data.error || 'Failed to send test notification');
      }
    } catch (error) {
      showToast.error('Failed to send test notification');
    }
  };

  const getPermissionStatus = () => {
    switch (push.permission) {
      case 'granted':
        return { text: 'Enabled', color: 'text-green-600', icon: Check };
      case 'denied':
        return { text: 'Blocked', color: 'text-red-600', icon: BellOff };
      default:
        return { text: 'Not set', color: 'text-yellow-600', icon: AlertCircle };
    }
  };

  const permStatus = getPermissionStatus();
  const PermIcon = permStatus.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 overflow-hidden"
          >
            <div className="bg-white dark:bg-surface-900 h-full flex flex-col shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-white">
                    Notification Settings
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="btn-icon w-8 h-8"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Push Notifications Status */}
                <div className="card-glass p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                        <Smartphone className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-surface-900 dark:text-white">
                          Push Notifications
                        </h3>
                        <p className={`text-sm ${permStatus.color} flex items-center gap-1`}>
                          <PermIcon className="w-3 h-3" />
                          {permStatus.text}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleTogglePush}
                      disabled={push.permission === 'denied' || push.isLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        push.subscription ? 'bg-primary-600' : 'bg-surface-300 dark:bg-surface-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          push.subscription ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {push.permission === 'denied' && (
                    <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <BellOff className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700 dark:text-red-400">
                        Notifications are blocked. Please enable them in your browser settings.
                      </p>
                    </div>
                  )}

                  {push.permission === 'granted' && !push.subscription && (
                    <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        Push notifications are allowed but not yet subscribed.
                      </p>
                    </div>
                  )}

                  {push.subscription && (
                    <button
                      onClick={handleTestPush}
                      disabled={saving}
                      className="mt-3 w-full btn-secondary flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                      Send Test Notification
                    </button>
                  )}
                </div>

                {/* Notification Types */}
                <div className="card-glass p-4">
                  <h3 className="font-medium text-surface-900 dark:text-white mb-4">
                    Notification Types
                  </h3>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <NotificationToggle
                        icon={ShoppingCart}
                        label="Orders"
                        description="New orders and status updates"
                        enabled={preferences?.orderNotifications ?? true}
                        onChange={(value) => handleTogglePreference('orderNotifications', value)}
                        saving={saving}
                      />

                      <NotificationToggle
                        icon={Users}
                        label="Staff"
                        description="Clock in/out and break alerts"
                        enabled={preferences?.staffNotifications ?? true}
                        onChange={(value) => handleTogglePreference('staffNotifications', value)}
                        saving={saving}
                      />

                      <NotificationToggle
                        icon={Package}
                        label="Inventory"
                        description="Low stock alerts"
                        enabled={preferences?.inventoryNotifications ?? true}
                        onChange={(value) => handleTogglePreference('inventoryNotifications', value)}
                        saving={saving}
                      />

                      <NotificationToggle
                        icon={ClipboardList}
                        label="Tasks"
                        description="Task assignments and updates"
                        enabled={preferences?.taskNotifications ?? true}
                        onChange={(value) => handleTogglePreference('taskNotifications', value)}
                        saving={saving}
                      />
                    </div>
                  )}
                </div>

                {/* Quiet Hours */}
                <div className="card-glass p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-lg">
                        <Clock className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-surface-900 dark:text-white">
                          Quiet Hours
                        </h3>
                        <p className="text-sm text-surface-500">
                          Mute notifications during specific hours
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTogglePreference('quietHoursEnabled', !preferences?.quietHoursEnabled)}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences?.quietHoursEnabled ? 'bg-primary-600' : 'bg-surface-300 dark:bg-surface-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences?.quietHoursEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <AnimatePresence>
                    {preferences?.quietHoursEnabled && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center space-x-4 pt-3 border-t border-surface-200 dark:border-surface-700">
                          <div className="flex-1">
                            <label className="block text-sm text-surface-500 mb-1">
                              Start Time
                            </label>
                            <input
                              type="time"
                              value={preferences?.quietHoursStart || '22:00'}
                              onChange={(e) => handleTimePreferenceChange('quietHoursStart', e.target.value)}
                              className="input-field w-full"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm text-surface-500 mb-1">
                              End Time
                            </label>
                            <input
                              type="time"
                              value={preferences?.quietHoursEnd || '07:00'}
                              onChange={(e) => handleTimePreferenceChange('quietHoursEnd', e.target.value)}
                              className="input-field w-full"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-surface-200 dark:border-surface-700">
                <button
                  onClick={onClose}
                  className="w-full btn-primary"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Notification Toggle Component
interface NotificationToggleProps {
  icon: React.ElementType;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  saving: boolean;
}

function NotificationToggle({
  icon: Icon,
  label,
  description,
  enabled,
  onChange,
  saving
}: NotificationToggleProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${enabled ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-surface-100 dark:bg-surface-800'}`}>
          <Icon className={`w-4 h-4 ${enabled ? 'text-primary-600' : 'text-surface-400'}`} />
        </div>
        <div>
          <p className="font-medium text-surface-900 dark:text-white text-sm">
            {label}
          </p>
          <p className="text-xs text-surface-500">
            {description}
          </p>
        </div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-primary-600' : 'bg-surface-300 dark:bg-surface-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
