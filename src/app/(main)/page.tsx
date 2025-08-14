'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const interestsList = [
  'Music', 'Gaming', 'Sports', 'Movies', 'Technology',
  'Art', 'Travel', 'Food', 'Fitness', 'Books'
];

export default function HomePage() {
  const router = useRouter();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [name, setName] = useState('');

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const startChatting = () => {
    // In a real app, you might save these preferences
    router.push('/chat');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden p-6">
        <h1 className="text-2xl font-bold text-center text-indigo-600 mb-6">
          Omegle Clone
        </h1>
        
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Your Name (Optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter your name"
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Select Your Interests</label>
          <div className="flex flex-wrap gap-2">
            {interestsList.map((interest) => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedInterests.includes(interest)
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>
        
        <button
          onClick={startChatting}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
        >
          Start Random Chat
        </button>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>By starting a chat, you agree to our community guidelines.</p>
          <p>Be respectful and enjoy your conversations!</p>
        </div>
      </div>
    </div>
  );
}