import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - Servio</title>
        <meta name="description" content="Servio Privacy Policy - How we collect, use, and protect your information." />
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
              <h1 className="text-xl font-bold text-slate-900">Privacy Policy</h1>
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
              <p className="text-lg text-slate-700 mb-6">
                Servio ("Servio," "we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect information when you access or use our website, applications, software, and related services (collectively, the "Services").
              </p>

              <p className="mb-8">
                By using Servio, you consent to the practices described in this Privacy Policy.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">1. Information We Collect</h2>
              <p className="mb-4">We may collect the following categories of information:</p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">1.1 Personal Information</h3>
              <p className="mb-4">Information that can identify you or your business, such as:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Business name</li>
                <li>Account credentials</li>
                <li>Billing and payment information</li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">1.2 Business & Operational Data</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Menu data</li>
                <li>Orders and transaction data</li>
                <li>Customer communication records</li>
                <li>Analytics, reports, and usage data</li>
                <li>Configuration and system preferences</li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">1.3 Messaging & Communication Data</h3>
              <p className="mb-4">If you use Servio's messaging or communication features, we may collect:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Phone numbers provided by you or your customers</li>
                <li>Message content sent or received through the platform</li>
                <li>Message timestamps and delivery status</li>
                <li>Opt-in and opt-out indicators</li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">1.4 Automatically Collected Information</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>IP address</li>
                <li>Device and browser information</li>
                <li>Log files</li>
                <li>Usage activity and interaction data</li>
              </ul>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">2. How We Use Information</h2>
              <p className="mb-4">We use collected information to:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Provide, operate, and improve Servio's Services</li>
                <li>Facilitate communication and messaging features</li>
                <li>Process transactions and billing</li>
                <li>Provide customer support</li>
                <li>Monitor platform performance and security</li>
                <li>Comply with legal and regulatory requirements</li>
                <li>Prevent fraud, abuse, or unauthorized use</li>
              </ul>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">3. SMS & Messaging Privacy</h2>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">3.1 Consent-Based Messaging</h3>
              <p className="mb-6">
                Servio messaging features are designed for consent-based communications only. Users are responsible for ensuring recipients have opted in before messages are sent.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">3.2 Message Purpose</h3>
              <p className="mb-4">Messages may include transactional, informational, or service-related communications. Promotional or marketing messages may only be sent where proper consent has been obtained.</p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">3.3 Opt-Out Handling</h3>
              <p className="mb-6">
                Recipients may opt out of receiving messages at any time by replying with recognized opt-out keywords (e.g., STOP). Opt-out requests are honored automatically or promptly.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">3.4 No Sale of Messaging Data</h3>
              <p className="mb-6">
                Servio does not sell, rent, or trade phone numbers or messaging data.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">4. How We Share Information</h2>
              <p className="mb-4">We may share information only as necessary to:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Provide the Services</li>
                <li>Work with trusted service providers and infrastructure partners</li>
                <li>Comply with legal obligations or lawful requests</li>
                <li>Protect the rights, safety, and integrity of Servio, its users, or the public</li>
              </ul>
              <p className="mb-6">We do not sell personal data.</p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">5. Data Retention</h2>
              <p className="mb-4">We retain information only for as long as necessary to:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Provide the Services</li>
                <li>Fulfill legal, accounting, or reporting obligations</li>
                <li>Resolve disputes and enforce agreements</li>
              </ul>
              <p className="mb-6">You may request deletion of your account data, subject to legal or operational requirements.</p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">6. Data Security</h2>
              <p className="mb-4">Servio implements reasonable administrative, technical, and organizational safeguards to protect data, including:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Secure servers and encrypted connections</li>
                <li>Access controls and authentication</li>
                <li>Monitoring for unauthorized activity</li>
              </ul>
              <p className="mb-6">No system is 100% secure, but we take data protection seriously.</p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">7. Your Rights & Choices</h2>
              <p className="mb-4">Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Access your personal data</li>
                <li>Request corrections or updates</li>
                <li>Request deletion of your data</li>
                <li>Withdraw consent for communications</li>
                <li>Opt out of messaging communications</li>
              </ul>
              <p className="mb-6">Requests may be submitted using the contact information below.</p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">8. Cookies & Tracking Technologies</h2>
              <p className="mb-4">Servio may use cookies or similar technologies to:</p>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Improve user experience</li>
                <li>Analyze platform usage</li>
                <li>Maintain session integrity</li>
              </ul>
              <p className="mb-6">You may adjust cookie preferences through your browser settings.</p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">9. Third-Party Links & Services</h2>
              <p className="mb-6">
                Servio may contain links to third-party services. We are not responsible for the privacy practices of external sites or platforms.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">10. Children's Privacy</h2>
              <p className="mb-6">
                Servio is not intended for individuals under the age of 18, and we do not knowingly collect personal information from minors.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">11. Changes to This Policy</h2>
              <p className="mb-6">
                We may update this Privacy Policy periodically. Updates will be posted on this page with a revised "Last Updated" date. Continued use of the Services constitutes acceptance of the updated policy.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">12. Contact Us</h2>
              <p className="mb-4">If you have questions or concerns about this Privacy Policy or our data practices, contact us at:</p>
              
              <div className="bg-slate-50 rounded-xl p-6 mb-8">
                <p className="font-bold text-slate-900 mb-2">Servio</p>
                <p className="mb-2">
                  <a href="mailto:hello@servio.solutions" className="text-blue-600 hover:underline">hello@servio.solutions</a>
                </p>
                <p>
                  <a href="https://servio.solutions" className="text-blue-600 hover:underline">https://servio.solutions</a>
                </p>
              </div>
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
