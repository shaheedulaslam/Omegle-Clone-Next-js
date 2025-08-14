'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const interestsList = [
  'Music', 'Gaming', 'Programming', 'Movies', 
  'Sports', 'Travel', 'Food', 'Art', 'Fitness'
]

export default function Home() {
  const router = useRouter()
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [name, setName] = useState('')

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    )
  }

  const startChatting = () => {
    localStorage.setItem('userInterests', JSON.stringify(selectedInterests))
    localStorage.setItem('userName', name)
    router.push('/chat')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-center text-indigo-600 mb-4">
            MalluMeet – Talk to Strangers Online
          </h1>
          <p className="text-gray-700 text-center mb-6">
            Meet new people instantly! MalluMeet is a free online chat platform 
            where you can <strong>talk with strangers</strong> from around the world 
            based on shared interests. No sign-up required — just choose your interests 
            and start chatting.
          </p>
          
          <div className="mb-6">
            <label className="block text-gray-700 mb-2 font-medium">
              Your Name (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your name"
            />
          </div>
          
          <div className="mb-8">
            <label className="block text-gray-700 mb-2 font-medium">
              Select Your Interests
            </label>
            <p className="text-sm text-gray-500 mb-3">
              We’ll connect you with strangers who like the same topics. 
              The more you select, the better your matches!
            </p>
            <div className="flex flex-wrap gap-2">
              {interestsList.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-4 py-2 rounded-full transition-all ${
                    selectedInterests.includes(interest)
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={startChatting}
            disabled={!selectedInterests.length}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Free Random Chat
          </button>
        </div>
        
        <div className="bg-gray-50 px-8 py-4 text-center">
          <p className="text-sm text-gray-600">
            By starting a chat, you agree to our community guidelines.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Keywords: talk to strangers online, random video chat, chat app, meet new people
          </p>
        </div>
      </div>
    </div>
  )
}
