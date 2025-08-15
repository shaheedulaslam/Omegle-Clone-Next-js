"use client";
import { useEffect, useState, useRef } from "react";
import { connectSocket } from "@/lib/socket";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";

type Message = {
  sender: string;
  text: string;
  timestamp: string;
};

export default function ChatPage() {
  const [userId] = useState(uuidv4());
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [status, setStatus] = useState<RTCIceConnectionState | "disconnected">(
    "disconnected"
  );
  const [init, setInit] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize particles engine
  useEffect(() => {
    initParticlesEngine(async (engine: Engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const initWebRTC = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    pcRef.current = pc;

    // Local media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Remote media
    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && partnerId && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          to: partnerId,
          candidate: e.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      setStatus(pc.iceConnectionState || "disconnected");
    };

    return pc;
  };

  // Connect socket + handlers
  useEffect(() => {
    if (!userId) return;

    fetch("/api/chat")
      .finally(() => {
        socketRef.current = connectSocket(userId);

        socketRef.current.on("connect", () => {
          const storedInterests = localStorage.getItem("userInterests");
          const interests = storedInterests ? JSON.parse(storedInterests) : [];
          socketRef.current.emit("request-chat", { userId, interests });
        });

        socketRef.current.on("paired", async ({ partnerId: pid }: any) => {
          setPartnerId(pid);
          const pc = await initWebRTC();
          const offer = await pc!.createOffer();
          await pc!.setLocalDescription(offer);
          socketRef.current.emit("offer", { to: pid, offer });
        });

        socketRef.current.on(
          "offer",
          async ({
            from,
            offer,
          }: {
            from: string;
            offer: RTCSessionDescriptionInit;
          }) => {
            setPartnerId(from);
            const pc = pcRef.current || (await initWebRTC());
            await pc!.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc!.createAnswer();
            await pc!.setLocalDescription(answer);
            socketRef.current.emit("answer", { to: from, answer });
          }
        );

        socketRef.current.on(
          "answer",
          async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
            if (pcRef.current) {
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription(answer)
              );
            }
          }
        );

        socketRef.current.on(
          "ice-candidate",
          async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
            try {
              if (pcRef.current)
                await pcRef.current.addIceCandidate(
                  new RTCIceCandidate(candidate)
                );
            } catch (err) {
              console.error("addIceCandidate error:", err);
            }
          }
        );

        socketRef.current.on("message", (message: Message) => {
          setMessages((prev) => [...prev, message]);
        });

        socketRef.current.on("disconnected", () => {
          cleanupCall(true);
          requestNewPartner();
        });
      });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      cleanupPeer();
    };
  }, [userId]);

  const cleanupPeer = () => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setStatus("disconnected");
  };

  const cleanupCall = (partnerLeft = false) => {
    if (partnerLeft) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "system",
          text: "Partner disconnected",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    setPartnerId(null);
    cleanupPeer();
  };

  const sendMessage = () => {
    if (!input.trim() || !partnerId || !socketRef.current) return;
    const message: Message = {
      sender: userId,
      text: input.trim(),
      timestamp: new Date().toISOString(),
    };
    socketRef.current.emit("message", { to: partnerId, message });
    setMessages((prev) => [...prev, message]);
    setInput("");
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
  };

  const toggleAudio = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setAudioEnabled(track.enabled);
  };

  const requestNewPartner = () => {
    const interests = JSON.parse(localStorage.getItem("userInterests") || "[]");
    socketRef.current?.emit("request-chat", { userId, interests });
  };

  const nextStranger = () => {
    if (socketRef.current) socketRef.current.emit("leave");
    cleanupCall();
    requestNewPartner();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

      <div className="flex flex-col h-screen">
        {/* Header */}
        <motion.header 
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5 }}
          className="backdrop-blur-lg bg-white/5 border-b border-white/10 p-4 flex justify-between items-center"
        >
          <div>
            <h1 className="text-xl font-bold text-white">
              {partnerId ? (
                <span className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                  Chatting with Stranger
                </span>
              ) : (
                <span className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse"></span>
                  Looking for a partner...
                </span>
              )}
            </h1>
            <p className="text-xs text-white/60">Status: {status}</p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={nextStranger}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-indigo-700 text-sm shadow-lg"
          >
            Next Stranger
          </motion.button>
        </motion.header>

        {/* Video Area */}
        <div className="flex-1 relative bg-black/70 overflow-hidden">
          <AnimatePresence mode="wait">
            {partnerId ? (
              <motion.div
                key={partnerId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Local Video Preview */}
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="absolute bottom-4 right-4 w-32 h-48 rounded-xl overflow-hidden z-10 shadow-2xl border-2 border-white/20"
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 bg-black/50 p-1">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleVideo}
                      className={`p-1 rounded-full ${videoEnabled ? "bg-green-500" : "bg-red-500"} text-white`}
                    >
                      {videoEnabled ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 5h2v6H4V5zm3 0h2v6H7V5zm3 0h2v6h-2V5zm3 0h3v6h-3V5zm1 8H5v2h10v-2z" clipRule="evenodd" />
                        </svg>
                      )}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleAudio}
                      className={`p-1 rounded-full ${audioEnabled ? "bg-green-500" : "bg-red-500"} text-white`}
                    >
                      {audioEnabled ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-white"
              >
                <motion.div
                  animate={{ 
                    rotate: 360,
                    transition: { 
                      duration: 8, 
                      repeat: Infinity, 
                      ease: "linear" 
                    } 
                  }}
                  className="absolute w-64 h-64 rounded-full border-2 border-purple-500/30"
                ></motion.div>
                <motion.div
                  animate={{ 
                    rotate: -360,
                    transition: { 
                      duration: 12, 
                      repeat: Infinity, 
                      ease: "linear" 
                    } 
                  }}
                  className="absolute w-80 h-80 rounded-full border-2 border-indigo-500/30"
                ></motion.div>
                <div className="relative z-10 text-center p-6 backdrop-blur-sm bg-white/5 rounded-xl border border-white/10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-purple-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <h2 className="text-xl font-semibold mb-2">Looking for a match</h2>
                  <p className="text-white/80">Finding someone who shares your interests...</p>
                  <div className="mt-4 flex justify-center">
                    <div className="h-2 w-2 rounded-full bg-purple-400 animate-pulse mx-1"></div>
                    <div className="h-2 w-2 rounded-full bg-purple-400 animate-pulse mx-1 delay-75"></div>
                    <div className="h-2 w-2 rounded-full bg-purple-400 animate-pulse mx-1 delay-150"></div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat Area */}
        <div className="h-1/3 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 backdrop-blur-sm bg-white/5">
            {messages.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center h-full text-white/60"
              >
                {partnerId ? (
                  <p>Say hello to your new chat partner!</p>
                ) : (
                  <p>Messages will appear here once connected</p>
                )}
              </motion.div>
            ) : (
              messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${
                    m.sender === userId ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs md:max-w-md rounded-2xl px-4 py-3 ${
                      m.sender === userId
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none"
                        : "bg-white/10 text-white rounded-bl-none"
                    }`}
                  >
                    {m.sender === "system" ? (
                      <p className="text-center text-sm text-white/70">{m.text}</p>
                    ) : (
                      <>
                        <p>{m.text}</p>
                        <p className="text-[10px] opacity-70 mt-1 text-right">
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </>
                    )}
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="p-3 backdrop-blur-lg bg-white/5 border-t border-white/10 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message…"
              className="flex-1 backdrop-blur-sm bg-white/10 border border-white/20 text-white rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-white/50"
              disabled={!partnerId}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={sendMessage}
              disabled={!partnerId || !input.trim()}
              className={`rounded-full px-4 py-3 ${
                partnerId && input.trim()
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "bg-white/10 text-white/50 cursor-not-allowed"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}