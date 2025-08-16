"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim"; // Using slim version which is lighter
import { motion, AnimatePresence } from "framer-motion";
import type { Engine } from "@tsparticles/engine";
import Link from "next/link";

const interestsList = [
  { name: "Music", emoji: "🎵" },
  { name: "Gaming", emoji: "🎮" },
  { name: "Programming", emoji: "💻" },
  { name: "Movies", emoji: "🎬" },
  { name: "Sports", emoji: "⚽" },
  { name: "Travel", emoji: "✈️" },
  { name: "Food", emoji: "🍔" },
  { name: "Art", emoji: "🎨" },
  { name: "Fitness", emoji: "💪" },
  { name: "Books", emoji: "📚" },
  { name: "Photography", emoji: "📷" },
  { name: "Technology", emoji: "🔧" },
];

export default function Home() {
  const router = useRouter();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [init, setInit] = useState(false);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const startChatting = () => {
    setIsLoading(true);
    localStorage.setItem("userInterests", JSON.stringify(selectedInterests));
    localStorage.setItem("userName", name);

    // Add a small delay for better UX
    setTimeout(() => {
      router.push("/chat");
    }, 800);
  };

  useEffect(() => {
    initParticlesEngine(async (engine: Engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900">
      {/* Background Particles */}
      {init && (
        <Particles
          id="tsparticles"
          options={{
            particles: {
              number: { value: 80 },
              move: { enable: true, speed: 1.5 },
              links: { enable: true },
              size: { value: 3 },
            },
            detectRetina: true,
          }}
        />
      )}

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Glassmorphic Card */}
          <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            {/* Gradient Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-center">
              <motion.h1
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-4xl font-bold text-white mb-2"
              >
                MalluMeet
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-white/90 font-medium"
              >
                Connect with like-minded people instantly
              </motion.p>
            </div>

            {/* Card Body */}
            <div className="p-6">
              {/* Name Input */}
              <div className="mb-6">
                <label className="block text-white/90 mb-2 font-medium">
                  Your Name (Optional)
                </label>
                <motion.div whileFocus={{ scale: 1.02 }} className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-white/50"
                    placeholder="What should we call you?"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-white/50"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </motion.div>
              </div>

              {/* Interests */}
              <div className="mb-8">
                <label className="block text-white/90 mb-3 font-medium">
                  Select Your Interests
                </label>
                <div className="flex flex-wrap gap-3">
                  {interestsList.map((interest) => (
                    <motion.button
                      key={interest.name}
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => toggleInterest(interest.name)}
                      className={`flex items-center px-4 py-2 rounded-full text-sm font-medium shadow transition-all ${
                        selectedInterests.includes(interest.name)
                          ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      <span className="mr-2">{interest.emoji}</span>
                      {interest.name}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startChatting}
                disabled={!selectedInterests.length || isLoading}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  selectedInterests.length
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg"
                    : "bg-gray-600 text-gray-300 cursor-not-allowed"
                }`}
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center"
                    >
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Connecting...
                    </motion.div>
                  ) : (
                    <motion.div
                      key="text"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      Start Free Random Chat
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Footer Note */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center text-white/60 text-xs mt-6"
              >
                No sign-up required. Just connect and chat!
              </motion.p>
            </div>
          </div>
        </motion.div>
      </div>

             {/* Footer */}
        <footer className="w-full py-4 backdrop-blur-lg bg-white/5 border-t border-white/10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="text-white/70 text-sm mb-4 md:mb-0">
                © {new Date().getFullYear()} MalluMeet. All rights reserved.
              </div>
              <div className="flex space-x-6">
                <Link href="/about" className="text-white/70 hover:text-white transition-colors text-sm">
                  About Us
                </Link>
                <Link href="/privacy" className="text-white/70 hover:text-white transition-colors text-sm">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-white/70 hover:text-white transition-colors text-sm">
                  Terms of Service
                </Link>
                <Link href="/contact" className="text-white/70 hover:text-white transition-colors text-sm">
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </footer>
    </div>
  );
}
