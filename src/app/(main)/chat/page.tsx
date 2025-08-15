"use client";
import { useEffect, useState, useRef } from "react";
import { connectSocket } from "@/lib/socket";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";

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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initWebRTC = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // For NATs/Carrier-grade NAT between strangers, consider TURN later.
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

    fetch("/api/chat") // optional wake-up
      .finally(() => {
        socketRef.current = connectSocket(userId);

        socketRef.current.on("connect", () => {
          // ask for a partner
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
          requestNewPartner(); // auto start again
        });
      });

    return () => {
      // full cleanup on page leave
      if (socketRef.current) socketRef.current.disconnect();
      cleanupPeer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (socketRef.current) {
      requestNewPartner();
    }
  }, []);

  const nextStranger = () => {
    // tell server we’re leaving current partner
    if (socketRef.current) socketRef.current.emit("leave");
    cleanupCall();
    requestNewPartner();

    // request a new one
    const interests = JSON.parse(localStorage.getItem("userInterests") || "[]");
    socketRef.current?.emit("request-chat", { userId, interests });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-indigo-600 text-white p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">
            {partnerId ? "Chatting with Stranger" : "Looking for a partner..."}
          </h1>
          <p className="text-xs opacity-80">Status: {status}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={nextStranger}
            className="bg-white text-indigo-700 px-3 py-1 rounded hover:bg-indigo-50 text-sm"
          >
            Next
          </button>
        </div>
      </header>

      <div className="flex-1 relative bg-black">
        {/* Remote */}
        <AnimatePresence mode="wait">
          {partnerId ? (
            <motion.div
              key={partnerId}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 bg-black"
            >
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute bottom-4 right-4 w-32 h-48 rounded-lg overflow-hidden z-10 shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 bg-black/50 p-1">
                  <button
                    onClick={toggleVideo}
                    className={`px-2 py-1 rounded ${videoEnabled ? "bg-green-500" : "bg-red-500"} text-white text-xs`}
                  >
                    {videoEnabled ? "Cam On" : "Cam Off"}
                  </button>
                  <button
                    onClick={toggleAudio}
                    className={`px-2 py-1 rounded ${audioEnabled ? "bg-green-500" : "bg-red-500"} text-white text-xs`}
                  >
                    {audioEnabled ? "Mic On" : "Mic Off"}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black text-white"
            >
              Waiting for stranger…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat */}
      <div className="h-1/3 overflow-y-auto p-4 space-y-2 bg-white border-t">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.sender === userId ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs md:max-w-md rounded-lg px-3 py-2 ${
                m.sender === userId
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              <p>{m.text}</p>
              <p className="text-[10px] opacity-70 mt-1">
                {new Date(m.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message…"
          className="flex-1 border rounded-full px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={!partnerId}
        />
        <button
          onClick={sendMessage}
          disabled={!partnerId || !input.trim()}
          className="bg-indigo-600 text-white rounded-full px-4 py-2 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
