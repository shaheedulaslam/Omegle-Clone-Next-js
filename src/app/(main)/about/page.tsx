import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto backdrop-blur-lg bg-white/5 border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8">
          <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            About MalluMeet
          </h1>
          <div className="space-y-6 text-white/80">
            <p>
              MalluMeet is a platform designed to connect like-minded individuals
              through instant random chats based on shared interests. Our mission
              is to create meaningful connections in a safe and enjoyable
              environment.
            </p>
            <p>
              Founded in 2023, MalluMeet started as a small project to help
              people make new friends online. Today, we've grown into a vibrant
              community where thousands of connections are made every day.
            </p>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
              Our Values
            </h2>
            <ul className="space-y-3 list-disc pl-5">
              <li>
                <strong>Privacy First:</strong> We prioritize your privacy and
                security above all else.
              </li>
              <li>
                <strong>Authentic Connections:</strong> We believe in fostering
                genuine interactions.
              </li>
              <li>
                <strong>Community:</strong> We're building a positive space for
                everyone.
              </li>
              <li>
                <strong>Innovation:</strong> We continuously improve to provide
                the best experience.
              </li>
            </ul>
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