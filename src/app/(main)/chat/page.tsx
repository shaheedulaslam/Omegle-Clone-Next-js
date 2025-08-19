"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";
import { connectSocket } from "@/lib/socket";

type Message = {
  sender: string;
  text: string;
  timestamp: string;
};

type PartnerInfo = {
  partnerId: string;
  partnerName: string;
  partnerInterests: string[];
};

type SigOffer = { sdp: string; type: "offer" };
type SigAnswer = { sdp: string; type: "answer" };
type SigDesc = SigOffer | SigAnswer;

export default function ChatPage() {
  // ---- State
  const [userId] = useState(uuidv4());
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>("Stranger");
  const [partnerInterests, setPartnerInterests] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [status, setStatus] = useState<
    RTCIceConnectionState | "disconnected" | "connecting"
  >("disconnected");
  const [init, setInit] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(true);

  // ---- Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queueTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Perfect negotiation helpers
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const isSettingRemoteAnswerPendingRef = useRef(false);
  const politeRef = useRef<boolean>(false); // we’ll set this when paired

  // ICE candidate queue until remoteDescription is set
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // ---- Particles
  useEffect(() => {
    initParticlesEngine(async (engine: Engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  // ---- Create / Init PC
  const createPeerConnection = async () => {
    setStatus("connecting");
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // Added TURN server fallback for better connectivity
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
      iceTransportPolicy: "all", // Try both relay and host candidates
    });

    pcRef.current = pc;
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
    isSettingRemoteAnswerPendingRef.current = false;
    pendingCandidatesRef.current = [];

    // Local media
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    } catch (err) {
      console.error("Failed to get media devices", err);
      setStatus("disconnected");
      return pc;
    }

    // Remote tracks
    pc.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      const remoteStream = event.streams[0];
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        // Ensure video element plays
        remoteVideoRef.current.play().catch(e => console.warn("Remote video play warning:", e));
      }
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && partnerId && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          to: partnerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const cs = pc.iceConnectionState;
      setStatus(cs || "disconnected");
      console.log("[ICE] state:", cs);
      
      if (cs === "failed" || cs === "disconnected") {
        console.log("[ICE] restarting ICE");
        // Try to restart ICE
        setTimeout(() => {
          if (pcRef.current && (pcRef.current.iceConnectionState === "failed" || 
              pcRef.current.iceConnectionState === "disconnected")) {
            pcRef.current.restartIce?.();
          }
        }, 1000);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[PC] connection state:", pc.connectionState);
    };

    // Key: Perfect Negotiation—when tracks/transceivers change
    pc.onnegotiationneeded = async () => {
      await negotiate("onnegotiationneeded");
    };

    return pc;
  };

  // ---- Negotiation helper (Perfect Negotiation)
  const negotiate = async (reason = "manual") => {
    const pc = pcRef.current;
    if (!pc || !partnerId || !socketRef.current) {
      console.log("Cannot negotiate: missing pc, partnerId, or socket");
      return;
    }
    
    try {
      makingOfferRef.current = true;
      console.log(`[NEGOTIATE] (${reason}) creating offer`);
      
      // Add this to ensure we have transceivers for all media types
      if (pc.getTransceivers().length === 0) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            pc.addTransceiver(track, { direction: 'sendrecv' });
          });
        } else {
          // Add transceivers even if we don't have local media
          pc.addTransceiver('video', { direction: 'recvonly' });
          pc.addTransceiver('audio', { direction: 'recvonly' });
        }
      }
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("[NEGOTIATE] sending offer to", partnerId);
      socketRef.current.emit("offer", { to: partnerId, offer });
    } catch (e) {
      console.error("[NEGOTIATE] error", e);
    } finally {
      makingOfferRef.current = false;
    }
  };

  // ---- Cleanup helpers
  const cleanupPeer = () => {
    const pc = pcRef.current;
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.onnegotiationneeded = null;
      try {
        pc.getSenders().forEach((s) => s.track && s.track.stop());
      } catch {}
      pc.close();
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

  // ---- Socket + signaling
  useEffect(() => {
    if (!userId) return;

    // Prime the serverless/edge function (optional for cold starts)
    fetch("/api/chat").finally(async () => {
      const storedInterests = localStorage.getItem("userInterests");
      const interests = storedInterests ? JSON.parse(storedInterests) : [];
      const userName = localStorage.getItem("userName");

      const socket = connectSocket(userId, userName, storedInterests);
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("[SOCKET] connected", socket.id);
        socket.emit("request-chat", { userId, interests });
        setIsSearching(true);
      });

      socket.on("queue-position", ({ position }: { position: number }) => {
        setQueuePosition(position);
      });

      socket.on("queue-timeout", () => {
        setIsSearching(false);
        setMessages((prev) => [
          ...prev,
          {
            sender: "system",
            text: "Couldn't find a partner. Please try again.",
            timestamp: new Date().toISOString(),
          },
        ]);
      });

      // When matched, server should decide who is "polite"
      // Here we make the rule: the one whose id is lexicographically higher is polite (deterministic)
      socket.on(
        "paired",
        async ({
          partnerId: pid,
          partnerName,
          partnerInterests,
        }: PartnerInfo) => {
          setIsSearching(false);
          setPartnerId(pid);
          setPartnerName(partnerName);
          setPartnerInterests(partnerInterests);

          // set polite role deterministically
          politeRef.current = userId > pid;
          console.log(
            "[PAIR] polite:",
            politeRef.current,
            "you:",
            userId,
            "peer:",
            pid
          );

          // Create PC and start offer from *one* side (you already do this)
          if (!pcRef.current) {
            await createPeerConnection();
          }
          // Only the non-polite side initiates initial offer to avoid glare (or keep your current approach).
          // We'll preserve your behavior: the side that receives 'paired' makes the first offer.
          await negotiate("paired-initial");
        }
      );

      // --- Offer handler (Perfect Negotiation)
      socket.on(
        "offer",
        async ({ from, offer }: { from: string; offer: SigOffer }) => {
          console.log("[SIGNAL] received offer from", from);

          // Ensure PC exists
          if (!pcRef.current) await createPeerConnection();

          const pc = pcRef.current!;
          const offerDesc = new RTCSessionDescription(offer);

          const readyForOffer =
            !makingOfferRef.current &&
            (pc.signalingState === "stable" ||
              isSettingRemoteAnswerPendingRef.current);

          const offerCollision = !readyForOffer;

          ignoreOfferRef.current = !politeRef.current && offerCollision;
          if (ignoreOfferRef.current) {
            console.warn(
              "[NEGOTIATE] glare detected, ignoring offer (impolite)"
            );
            return;
          }

          isSettingRemoteAnswerPendingRef.current =
            (offer as RTCSessionDescriptionInit).type === "answer";
          try {
            await pc.setRemoteDescription(offerDesc);
            console.log("[SIGNAL] setRemoteDescription(offer)");

            // Flush queued ICE candidates now that remoteDescription is ready
            if (pendingCandidatesRef.current.length) {
              for (const c of pendingCandidatesRef.current) {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              }
              pendingCandidatesRef.current = [];
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("answer", { to: from, answer });
            console.log("[SIGNAL] sent answer");
          } catch (e) {
            console.error("[SIGNAL] error handling offer", e);
          } finally {
            isSettingRemoteAnswerPendingRef.current = false;
          }
        }
      );

      // --- Answer handler
      socket.on("answer", async ({ answer }: { answer: SigAnswer }) => {
        if (!pcRef.current) return;
        try {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          console.log("[SIGNAL] setRemoteDescription(answer)");
          // Flush queued ICE candidates after answer too
          if (pendingCandidatesRef.current.length) {
            for (const c of pendingCandidatesRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidatesRef.current = [];
          }
        } catch (e) {
          console.error("[SIGNAL] error setting remote answer", e);
        }
      });

      // --- ICE candidate handler
      socket.on(
        "ice-candidate",
        async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
          try {
            const pc = pcRef.current;
            if (!pc || !candidate) return;
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              pendingCandidatesRef.current.push(candidate);
            }
          } catch (err) {
            console.error("[ICE] addIceCandidate error:", err);
          }
        }
      );

      socket.on("message", (message: Message) => {
        setMessages((prev) => [...prev, message]);
      });

      socket.on("disconnected", () => {
        cleanupCall(true);
        requestNewPartner();
      });

      socket.on("connect_error", (err: any) => {
        console.error("[SOCKET] connect_error:", err?.message || err);
      });
    });

    return () => {
      if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
      socketRef.current?.disconnect();
      cleanupPeer();
    };
  }, [userId]);

  // ---- Helpers
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

  const replaceSenderTrack = (
    kind: "audio" | "video",
    withTrack: MediaStreamTrack | null
  ) => {
    const pc = pcRef.current;
    if (!pc) return false;
    const sender = pc.getSenders().find((s) => s.track?.kind === kind);
    if (!sender) return false;
    // replaceTrack can be null to mute that sender
    return sender
      .replaceTrack(withTrack)
      .then(() => true)
      .catch((e) => {
        console.error(`[PC] replaceTrack(${kind}) error`, e);
        return false;
      });
  };

  const toggleVideo = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const enable = !videoEnabled;

    if (enable) {
      // If track was stopped/removed, reacquire if needed
      if (videoTrack.readyState === "ended" || !videoTrack.enabled) {
        videoTrack.enabled = true;
      }
      await replaceSenderTrack("video", videoTrack);
    } else {
      // Replacing with null guarantees remote side stops receiving
      await replaceSenderTrack("video", null);
      videoTrack.enabled = false;
    }
    setVideoEnabled(enable);
  };

  const toggleAudio = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const enable = !audioEnabled;

    if (enable) {
      if (audioTrack.readyState === "ended" || !audioTrack.enabled) {
        audioTrack.enabled = true;
      }
      await replaceSenderTrack("audio", audioTrack);
    } else {
      await replaceSenderTrack("audio", null);
      audioTrack.enabled = false;
    }
    setAudioEnabled(enable);
  };

  const requestNewPartner = () => {
    setIsSearching(true);
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

  // ---- UI (unchanged except small logs)
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900">
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
                  <span
                    className={`w-2 h-2 rounded-full mr-2 ${
                      status === "connected"
                        ? "bg-green-500"
                        : status === "connecting"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    } animate-pulse`}
                  ></span>
                  Chatting with {partnerName}
                </span>
              ) : (
                <span className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse"></span>
                  {isSearching
                    ? `Searching... ${
                        queuePosition ? `(#${queuePosition} in queue)` : ""
                      }`
                    : "Looking for a partner"}
                </span>
              )}
            </h1>
            <p className="text-xs text-white/60">Status: {status}</p>
            {partnerInterests.length > 0 && (
              <p className="text-xs text-white/60">
                Shared interests: {partnerInterests.slice(0, 3).join(", ")}
                {partnerInterests.length > 3 ? "..." : ""}
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={nextStranger}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-indigo-700 text-sm shadow-lg"
            disabled={isSearching}
          >
            {isSearching ? "Cancel" : "Next Stranger"}
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
                  // Don't mute remote
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
                      className={`p-1 rounded-full ${
                        videoEnabled ? "bg-green-500" : "bg-red-500"
                      } text-white`}
                    >
                      {/* camera icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleAudio}
                      className={`p-1 rounded-full ${
                        audioEnabled ? "bg-green-500" : "bg-red-500"
                      } text-white`}
                    >
                      {/* mic icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                          clipRule="evenodd"
                        />
                      </svg>
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
                      ease: "linear",
                    },
                  }}
                  className="absolute w-64 h-64 rounded-full border-2 border-purple-500/30"
                ></motion.div>
                <motion.div
                  animate={{
                    rotate: -360,
                    transition: {
                      duration: 12,
                      repeat: Infinity,
                      ease: "linear",
                    },
                  }}
                  className="absolute w-80 h-80 rounded-full border-2 border-indigo-500/30"
                ></motion.div>
                <div className="relative z-10 text-center p-6 backdrop-blur-sm bg-white/5 rounded-xl border border-white/10">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto mb-4 text-purple-400 animate-pulse"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <h2 className="text-xl font-semibold mb-2">
                    {isSearching ? "Looking for a match" : "Ready to connect"}
                  </h2>
                  <p className="text-white/80">
                    {isSearching
                      ? queuePosition
                        ? `Position in queue: ${queuePosition}`
                        : "Finding someone who shares your interests..."
                      : "Press the button to start searching"}
                  </p>
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
                        : m.sender === "system"
                        ? "bg-yellow-500/20 text-yellow-200 rounded-xl"
                        : "bg-white/10 text-white rounded-bl-none"
                    }`}
                  >
                    {m.sender === "system" ? (
                      <p className="text-center text-sm">{m.text}</p>
                    ) : (
                      <>
                        <p>{m.text}</p>
                        <p className="text-[10px] opacity-70 mt-1 text-right">
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
