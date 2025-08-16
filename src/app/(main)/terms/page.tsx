import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto backdrop-blur-lg bg-white/5 border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8">
          <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Terms of Service
          </h1>
          <div className="space-y-6 text-white/80">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using MalluMeet, you agree to be bound by these Terms
              of Service. If you disagree with any part, you may not use our service.
            </p>

            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
              2. User Responsibilities
            </h2>
            <p>
              You agree to:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use the service only for lawful purposes</li>
              <li>Not harass, threaten, or harm other users</li>
              <li>Not share inappropriate or offensive content</li>
              <li>Not impersonate others or provide false information</li>
              <li>Not attempt to disrupt the service</li>
            </ul>

            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
              3. Age Requirement
            </h2>
            <p>
              You must be at least 18 years old to use MalluMeet. By using our
              service, you represent that you meet this requirement.
            </p>

            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
              4. Service Modifications
            </h2>
            <p>
              We reserve the right to modify or discontinue the service at any
              time without notice. We shall not be liable for any modification,
              suspension, or discontinuance.
            </p>

            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
              5. Limitation of Liability
            </h2>
            <p>
              MalluMeet shall not be liable for any direct, indirect, incidental,
              or consequential damages resulting from the use or inability to use
              the service.
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