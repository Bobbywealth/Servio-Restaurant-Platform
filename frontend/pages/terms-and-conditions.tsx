import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsAndConditions() {
  return (
    <>
      <Head>
        <title>Terms and Conditions - Servio</title>
        <meta name="description" content="Servio Terms and Conditions - Terms governing your use of the Servio platform." />
      </Head>

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Link 
                href="/" 
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Back</span>
              </Link>
              <h1 className="text-xl font-bold text-slate-900">Terms and Conditions</h1>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <p className="text-sm text-slate-500 mb-8">
              Last Updated: February 2026
            </p>

            <div className="prose prose-slate max-w-none">
              <p className="text-lg text-slate-700 mb-8">
                Welcome to Servio ("Servio," "we," "our," or "us"). These Terms and Conditions ("Terms") govern your access to and use of the Servio platform, including our website, applications, software, tools, communication features, and related services (collectively, the "Services").
              </p>

              <p className="mb-8">
                By accessing or using Servio, you agree to be bound by these Terms. If you do not agree, you may not use the Services.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">1. Description of Services</h2>
              <p className="mb-4">
                Servio is a technology platform designed to assist businesses with operational management, communication, automation, ordering, analytics, and related tools. Features may include, but are not limited to:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Digital menus and ordering tools</li>
                <li>AI-assisted phone and messaging interactions</li>
                <li>Operational dashboards and reporting</li>
                <li>Customer communication tools (including SMS and voice)</li>
                <li>Integrations with third-party platforms</li>
              </ul>
              <p>Servio may modify, add, or remove features at any time.</p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">2. Eligibility</h2>
              <p>
                You must be at least 18 years old and have the legal authority to enter into this agreement on behalf of yourself or a business entity to use Servio.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">3. Account Registration & Responsibilities</h2>
              <p className="mb-4">You agree to:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your login credentials</li>
                <li>Accept responsibility for all activity under your account</li>
                <li>Use the Services only for lawful business purposes</li>
              </ul>
              <p>You may not share, resell, or sublicense your account without written permission from Servio.</p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">4. Acceptable Use Policy</h2>
              <p className="mb-4">You agree not to use Servio to:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Violate any applicable laws or regulations</li>
                <li>Transmit spam, scams, or deceptive communications</li>
                <li>Harass, abuse, or harm individuals or businesses</li>
                <li>Transmit malware or malicious code</li>
                <li>Engage in fraudulent, misleading, or illegal activity</li>
              </ul>
              <p>Servio reserves the right to suspend or terminate accounts that violate these Terms.</p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">5. SMS & Messaging Communications</h2>
              <p className="mb-6">
                By using Servio's messaging features, you acknowledge and agree to the following:
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">5.1 Consent & Opt-In</h3>
              <p className="mb-6">
                You represent and warrant that you have obtained proper consent from recipients before sending any SMS or messaging communications through the Servio platform. This includes compliance with all applicable messaging, consumer protection, and privacy laws.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">5.2 Message Purpose</h3>
              <p className="mb-4">Messages sent through Servio must be related to legitimate business purposes such as:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Order confirmations or updates</li>
                <li>Customer service responses</li>
                <li>Appointment or reservation notifications</li>
                <li>Business-related alerts or transactional communications</li>
              </ul>
              <p className="mb-6">
                Marketing or promotional messages may only be sent where explicit consent has been obtained.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">5.3 Opt-Out Requirements</h3>
              <p className="mb-6">
                All messaging communications must allow recipients to opt out. Recipients may opt out at any time by replying with commonly recognized commands such as STOP, END, or UNSUBSCRIBE. You agree to honor opt-out requests promptly.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">5.4 Message Frequency</h3>
              <p className="mb-6">
                You agree to send messages in a reasonable manner and not engage in excessive or abusive messaging practices.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">5.5 Compliance Responsibility</h3>
              <p className="mb-6">
                You are solely responsible for ensuring that your messaging practices comply with:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Applicable local, state, federal, and international laws</li>
                <li>Industry standards and carrier requirements</li>
                <li>Consent, opt-in, and opt-out regulations</li>
              </ul>
              <p>Servio is not responsible for violations caused by your misuse of messaging features.</p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">6. Third-Party Services</h2>
              <p>
                Servio may integrate with or rely on third-party services. Servio does not control and is not responsible for third-party platforms, tools, or services. Your use of those services may be subject to additional terms.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">7. Fees & Payments</h2>
              <p>
                Certain features of Servio may require payment. You agree to pay all applicable fees as described at the time of purchase. Fees are non-refundable unless otherwise stated in writing. Servio reserves the right to change pricing with reasonable notice.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">8. Intellectual Property</h2>
              <p>
                All Servio content, software, trademarks, logos, and intellectual property are owned by or licensed to Servio. You are granted a limited, non-exclusive, non-transferable right to use the Services during your subscription. You may not copy, modify, reverse engineer, or distribute Servio's proprietary materials without permission.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">9. Data & Privacy</h2>
              <p>
                Your use of Servio is subject to our Privacy Policy. You retain ownership of your business data, but you grant Servio the right to process and store data as necessary to provide the Services.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">10. Service Availability & Disclaimers</h2>
              <p>
                Servio is provided on an "as is" and "as available" basis. We do not guarantee uninterrupted or error-free operation. To the fullest extent permitted by law, Servio disclaims all warranties, express or implied, including merchantability and fitness for a particular purpose.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">11. Limitation of Liability</h2>
              <p className="mb-4">To the maximum extent permitted by law, Servio shall not be liable for:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Indirect, incidental, or consequential damages</li>
                <li>Loss of profits, data, or business opportunities</li>
                <li>Messaging delivery failures or carrier filtering</li>
                <li>Issues arising from user misuse of the Services</li>
              </ul>
              <p>Servio's total liability shall not exceed the amount paid by you to Servio in the preceding 12 months.</p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">12. Indemnification</h2>
              <p className="mb-4">You agree to indemnify and hold harmless Servio, its officers, employees, and partners from any claims, damages, or liabilities arising from:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Your use of the Services</li>
                <li>Your messaging practices</li>
                <li>Violations of law or third-party rights</li>
              </ul>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">13. Termination</h2>
              <p>
                Servio may suspend or terminate your access at any time for violations of these Terms or misuse of the platform. You may terminate your account at any time by discontinuing use.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">14. Governing Law</h2>
              <p>
                These Terms shall be governed by and interpreted under the laws of the State of New Jersey, without regard to conflict of law principles.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">15. Changes to Terms</h2>
              <p>
                Servio may update these Terms from time to time. Continued use of the Services after changes are posted constitutes acceptance of the revised Terms.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">16. Contact Information</h2>
              <p>
                For questions regarding these Terms, please contact: <a href="mailto:hello@servio.solutions" className="text-blue-600 hover:underline">hello@servio.solutions</a>
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 mt-12">
          <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-slate-500">
            © 2026 Servio. All rights reserved.
          </div>
        </footer>
      </div>
    </>
  );
}
