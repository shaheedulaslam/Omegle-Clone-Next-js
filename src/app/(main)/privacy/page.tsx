import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto backdrop-blur-lg bg-white/5 border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8">
          <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <div className="space-y-6 text-white/80">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
              1. Information We Collect
            </h2>
            <p>
              When you use MalluMeet, we may collect certain information including:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Your selected interests for matching purposes</li>
              <li>Optional name you provide</li>
              <li>Technical data like IP address, device information</li>
              <li>Usage data including chat duration and interactions</li>
            </ul>

            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
              2. How We Use Your Information
            </h2>
            <p>
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Provide and improve our services</li>
              <li>Match you with compatible chat partners</li>
              <li>Ensure platform security and prevent abuse</li>
              <li>Analyze usage patterns for service improvement</li>
            </ul>

            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
              3. Data Security
            </h2>
            <p>
              We implement appropriate security measures to protect your personal
              information. However, no internet transmission is 100% secure, and
              we cannot guarantee absolute security.
            </p>

            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
              4. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you
              of any changes by posting the new policy on this page.
            </p>
          </div>
          <div className="mt-12 pt-6 border-t border-white/10">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}