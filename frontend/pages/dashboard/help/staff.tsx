import React, { useState } from 'react';
import Head from 'next/head';
import HelpPageLayout from '../../../components/ui/HelpPageLayout';
import SectionHeader from '../../../components/ui/SectionHeader';
import FAQAccordion from '../../../components/ui/FAQAccordion';
import HelpCard from '../../../components/ui/HelpCard';
import {
  Clock,
  Calendar,
  ClipboardList,
  LogIn,
  LogOut,
  Coffee,
  Eye,
  RefreshCcw,
  AlertCircle,
  HelpCircle,
  User,
  Settings,
  ChevronRight,
  Play,
  StopCircle,
  History,
  MessageSquare
} from 'lucide-react';

const categories = [
  { id: 'getting-started', name: 'Getting Started', icon: HelpCircle },
  { id: 'clock-in-out', name: 'Clock In/Out', icon: Clock },
  { id: 'schedule', name: 'Your Schedule', icon: Calendar },
  { id: 'orders-tasks', name: 'Orders & Tasks', icon: ClipboardList },
  { id: 'faq', name: 'Common Questions', icon: MessageSquare },
  { id: 'troubleshooting', name: 'Troubleshooting', icon: AlertCircle }
];

export default function StaffHelpPage() {
  const [activeCategory, setActiveCategory] = useState('getting-started');

  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(categoryId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const faqItems = [
    {
      question: 'How do I reset my PIN?',
      answer: (
        <div>
          <p className="mb-3">If you need to reset your PIN, you have a few options:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Contact your manager and they can reset your PIN from the Staff management page</li>
            <li>Ask a manager to use the &quot;Reset PIN&quot; option on your staff profile</li>
            <li>You will receive a temporary PIN that you can change on your next login</li>
          </ul>
          <p className="mt-3 text-sm text-surface-500 dark:text-surface-400">
            For security reasons, you cannot reset your own PIN without manager approval.
          </p>
        </div>
      )
    },
    {
      question: 'What if my clock-in does not record?',
      answer: (
        <div>
          <p className="mb-3">If your clock-in did not record properly, follow these steps:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Check that you entered the correct PIN</li>
            <li>Try clocking in again - your manager can see all clock-in attempts</li>
            <li>If the issue persists, ask your manager to manually add your hours using the Manager Time Clock modal</li>
            <li>The manager can backdate your clock-in to the correct time</li>
          </ol>
          <p className="mt-3">
            All clock-in events are tracked with timestamps. Your manager can verify and correct any discrepancies.
          </p>
        </div>
      )
    },
    {
      question: 'Can I edit my hours?',
      answer: (
        <div>
          <p className="mb-3">Staff members cannot edit their own hours directly. If you need to adjust your recorded hours:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Contact your manager with the correct clock-in/out times</li>
            <li>Your manager can edit your hours from the Staff Analytics page or Staff page</li>
            <li>All changes are logged with who made them and when for transparency</li>
          </ul>
          <p className="mt-3 text-sm text-surface-500 dark:text-surface-400">
            This ensures accurate payroll and prevents unauthorized changes to time records.
          </p>
        </div>
      )
    },
    {
      question: 'How do I request time off?',
      answer: (
        <div>
          <p>Time off requests are handled directly through your manager. To request time off:</p>
          <ol className="list-decimal list-inside space-y-2 mt-3">
            <li>Speak with your manager in person or contact them through the app</li>
            <li>Provide the dates you need off and the reason if applicable</li>
            <li>Your manager will review and approve/reject the request</li>
            <li>Once approved, your schedule will be adjusted accordingly</li>
          </ol>
          <p className="mt-3">
            Your manager can then update the schedule from the Staff management page.
          </p>
        </div>
      )
    },
    {
      question: 'What do the different order statuses mean?',
      answer: (
        <div>
          <div className="grid gap-3 mt-3">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-700">Received</span>
              <span className="text-sm">New order that needs to be acknowledged</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">Preparing</span>
              <span className="text-sm">Order is being prepared in the kitchen</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">Ready</span>
              <span className="text-sm">Order is ready for pickup or delivery</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-servio-green-100 dark:bg-servio-green-900/50 text-servio-green-700 dark:text-servio-green-300">Completed</span>
              <span className="text-sm">Order has been picked up/delivered</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">Cancelled</span>
              <span className="text-sm">Order was cancelled before completion</span>
            </div>
          </div>
        </div>
      )
    },
    {
      question: 'How do I access the staff portal on mobile?',
      answer: (
        <div>
          <p className="mb-3">The staff portal is a responsive web app that works on all devices:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Open your browser (Safari, Chrome, etc.) on your mobile device</li>
            <li>Navigate to the same URL you use on desktop</li>
            <li>The app will automatically adapt to your screen size</li>
            <li>For the best experience, you can add it to your home screen:</li>
          </ul>
          <p className="mt-3 text-sm text-surface-500 dark:text-surface-400">
            iOS: Tap the Share button and select &quot;Add to Home Screen&quot;<br />
            Android: Tap the menu and select &quot;Install app&quot; or &quot;Add to Home Screen&quot;
          </p>
        </div>
      )
    }
  ];

  const troubleshootingItems = [
    {
      question: 'I am not recognized as a staff member',
      answer: (
        <div>
          <p className="mb-3">If you are having trouble being recognized:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Make sure you are logging in with the correct account</li>
            <li>Contact your manager to verify your account exists and is active</li>
            <li>Ask your manager to check that you have the &quot;staff&quot; role assigned</li>
            <li>Ensure your account is not disabled or archived</li>
          </ol>
          <p className="mt-3">
            New staff accounts must be created by a manager before you can log in.
          </p>
        </div>
      )
    },
    {
      question: 'My clock time shows incorrectly',
      answer: (
        <div>
          <p className="mb-3">Time discrepancies can occur due to timezone settings:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Check that your device timezone matches your restaurant&apos;s timezone</li>
            <li>The app uses the timezone set in Settings - General</li>
            <li>If times are still wrong, your manager can manually correct the timestamps</li>
            <li>All manual changes are recorded in the audit log</li>
          </ul>
          <p className="mt-3 text-sm text-surface-500 dark:text-surface-400">
            Contact your manager if you consistently see incorrect times.
          </p>
        </div>
      )
    },
    {
      question: 'My PIN is not working',
      answer: (
        <div>
          <p className="mb-3">If your PIN is not working:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Make sure you are entering the correct PIN (4-6 digits)</li>
            <li>Check that Caps Lock is not on if you accidentally typed letters</li>
            <li>Try again after 30 seconds if you had multiple failed attempts</li>
            <li>Ask your manager to reset your PIN if you forgot it</li>
          </ol>
          <p className="mt-3">
            Multiple failed attempts may temporarily lock your account for security.
          </p>
        </div>
      )
    },
    {
      question: 'The app is not loading or responding',
      answer: (
        <div>
          <p className="mb-3">If the app is not working properly:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Check your internet connection</li>
            <li>Try closing and reopening the browser</li>
            <li>Clear your browser cache and cookies</li>
            <li>Try a different browser (Chrome, Safari, Firefox)</li>
            <li>Check if the servers are down by asking colleagues or manager</li>
          </ol>
          <p className="mt-3">
            If the problem persists, contact your IT administrator or manager.
          </p>
        </div>
      )
    }
  ];

  return (
    <>
      <Head>
        <title>Staff Help - Servio</title>
        <meta name="description" content="Staff help and knowledge base for Servio restaurant management" />
      </Head>

      <HelpPageLayout
        title="Staff Help Center"
        subtitle="Everything you need to know about using Servio"
        categories={categories}
        currentCategory={activeCategory}
        onCategoryChange={scrollToCategory}
      >
        {/* Quick Links */}
        <div className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.slice(0, 6).map((category) => (
              <button
                key={category.id}
                onClick={() => scrollToCategory(category.id)}
                className={`flex flex-col items-center p-4 rounded-xl transition-all duration-200 ${
                  activeCategory === category.id
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400'
                }`}
              >
                <category.icon className="w-5 h-5 mb-2" />
                <span className="text-xs font-medium text-center">{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Getting Started */}
        <section id="getting-started" className="mb-12 scroll-mt-24">
          <SectionHeader
            title="Getting Started"
            description="Welcome to Servio! This guide will help you understand the basics of using the staff portal."
            icon={HelpCircle}
            iconColor="text-primary-500"
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <HelpCard
              icon={LogIn}
              title="Logging In"
              description="Enter your credentials on the login page. Staff members use their email and PIN for authentication."
              variant="highlight"
            />
            <HelpCard
              icon={User}
              title="Your Profile"
              description="View your profile by clicking your account icon in the top right. You can manage your settings here."
            />
            <HelpCard
              icon={Settings}
              title="Settings"
              description="Customize your experience in Settings - change themes, notifications, and display preferences."
            />
          </div>

          <div className="mt-6 p-6 bg-gradient-to-r from-primary-500/10 to-primary-600/10 rounded-2xl border border-primary-500/20">
            <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-3">
              Quick Start Checklist
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                'Log in with your credentials',
                'Complete your profile setup',
                'Review your upcoming schedule',
                'Learn how to clock in/out',
                'Explore available features',
                'Contact manager for questions'
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                    <span className="text-xs text-white font-bold">{index + 1}</span>
                  </div>
                  <span className="text-sm text-surface-700 dark:text-surface-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Clock In/Out */}
        <section id="clock-in-out" className="mb-12 scroll-mt-24">
          <SectionHeader
            title="Clock In/Out"
            description="Learn how to properly clock in and out, manage breaks, and view your hours."
            icon={Clock}
            iconColor="text-servio-green-500"
          />

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="card-glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-servio-green-100 dark:bg-servio-green-900/50">
                  <Play className="w-6 h-6 text-servio-green-600 dark:text-servio-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-100">Clocking In</h3>
                  <p className="text-sm text-surface-500">Starting your shift</p>
                </div>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-surface-600 dark:text-surface-400">
                <li>Navigate to the Timeclock page</li>
                <li>Enter your unique PIN</li>
                <li>Tap &quot;Clock In&quot;</li>
                <li>You will see a confirmation message</li>
                <li>Your shift is now recorded!</li>
              </ol>
            </div>

            <div className="card-glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/50">
                  <StopCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-100">Clocking Out</h3>
                  <p className="text-sm text-surface-500">Ending your shift</p>
                </div>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-surface-600 dark:text-surface-400">
                <li>Make sure you are on break</li>
                <li>Navigate to the Timeclock page</li>
                <li>Enter your PIN</li>
                <li>Tap &quot;Clock Out&quot;</li>
                <li>Your total hours are now recorded</li>
              </ol>
            </div>

            <div className="card-glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/50">
                  <Coffee className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-100">Taking Breaks</h3>
                  <p className="text-sm text-surface-500">Managing break time</p>
                </div>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-surface-600 dark:text-surface-400">
                <li>Click &quot;Start Break&quot; when leaving</li>
                <li>Your break time is tracked separately</li>
                <li>When returning, click &quot;End Break&quot;</li>
                <li>Breaks are not counted as work hours</li>
              </ol>
            </div>

            <div className="card-glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/50">
                  <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-100">Viewing Your Hours</h3>
                  <p className="text-sm text-surface-500">Track your work time</p>
                </div>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-surface-600 dark:text-surface-400">
                <li>Go to the Staff or Timeclock page</li>
                <li>Your hours are shown on your card</li>
                <li>View weekly totals in the charts</li>
                <li>See detailed logs in the table below</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Your Schedule */}
        <section id="schedule" className="mb-12 scroll-mt-24">
          <SectionHeader
            title="Your Schedule"
            description="View and understand your work schedule, assigned shifts, and weekly hours."
            icon={Calendar}
            iconColor="text-purple-500"
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <HelpCard
              icon={Eye}
              title="Viewing Your Schedule"
              description="Your schedule is visible on the Staff page. Filter by date range to see your upcoming shifts."
            />
            <HelpCard
              icon={Clock}
              title="Shift Details"
              description="Each shift shows clock-in/out times, total hours, and any notes from your manager."
            />
            <HelpCard
              icon={Calendar}
              title="Weekly Overview"
              description="The weekly chart shows your scheduled hours at a glance, making it easy to plan ahead."
            />
          </div>

          <div className="mt-6 p-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Important Note</h3>
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              Your schedule is managed by your manager. Contact them if you need changes, time off, or have questions about your shifts.
              All schedule changes must be approved by a manager.
            </p>
          </div>
        </section>

        {/* Orders & Tasks */}
        <section id="orders-tasks" className="mb-12 scroll-mt-24">
          <SectionHeader
            title="Orders & Tasks"
            description="Understand how to view orders, complete tasks, and track your responsibilities."
            icon={ClipboardList}
            iconColor="text-primary-500"
          />

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="card-glass rounded-2xl p-6">
              <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">Viewing Orders</h3>
              <p className="text-surface-600 dark:text-surface-400 mb-4">
                Staff can view all orders on the Orders page. Use filters to find specific orders by status, channel, or search term.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-500" />
                  <span className="text-sm">Filter by status (Preparing, Ready, etc.)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-servio-green-500" />
                  <span className="text-sm">Search by order ID or customer name</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-servio-orange-500" />
                  <span className="text-sm">View channel (In-store, Online, Delivery)</span>
                </div>
              </div>
            </div>

            <div className="card-glass rounded-2xl p-6">
              <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">Managing Tasks</h3>
              <p className="text-surface-600 dark:text-surface-400 mb-4">
                Tasks help you stay organized. Your manager can assign tasks to you or the team.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm">View assigned tasks on the Tasks page</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-sm">Update task status as you work</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm">Filter by priority or assignee</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Pro Tip</h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              Check the Orders and Tasks pages regularly throughout your shift. New orders appear in real-time, and managers may assign urgent tasks during busy periods.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-12 scroll-mt-24">
          <SectionHeader
            title="Common Questions"
            description="Find answers to frequently asked questions about using Servio as a staff member."
            icon={MessageSquare}
            iconColor="text-servio-blue-500"
          />

          <FAQAccordion items={faqItems} allowMultiple={true} className="mt-6" />
        </section>

        {/* Troubleshooting */}
        <section id="troubleshooting" className="mb-12 scroll-mt-24">
          <SectionHeader
            title="Troubleshooting"
            description="Solutions to common issues you might encounter while using the staff portal."
            icon={AlertCircle}
            iconColor="text-red-500"
          />

          <FAQAccordion items={troubleshootingItems} allowMultiple={true} className="mt-6" />

          <div className="mt-8 p-6 bg-surface-100 dark:bg-surface-800 rounded-2xl">
            <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-3">
              Still Need Help?
            </h3>
            <p className="text-surface-600 dark:text-surface-400 mb-4">
              If you could not find the answer you were looking for, please contact your manager or IT administrator.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-2 bg-white dark:bg-surface-700 rounded-xl text-sm">
                <span className="font-medium">Manager:</span> Contact your direct manager
              </div>
              <div className="px-4 py-2 bg-white dark:bg-surface-700 rounded-xl text-sm">
                <span className="font-medium">IT Support:</span> See your IT department
              </div>
            </div>
          </div>
        </section>

        {/* Footer Navigation */}
        <div className="mt-12 pt-8 border-t border-surface-200 dark:border-surface-700">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              onClick={() => scrollToCategory('getting-started')}
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              <span>Back to top</span>
            </button>
            <p className="text-sm text-surface-500">
              Staff Help Center v1.0 | Last updated 2026
            </p>
          </div>
        </div>
      </HelpPageLayout>
    </>
  );
}
