"use client";
import { useEffect, useState, useRef } from "react";
import { connectSocket, getSocket } from "@/lib/socket";
import { v4 as uuidv4 } from "uuid";
import { Message } from "@/types";

export default function ChatPage() {
  const [userId] = useState(uuidv4());
  const [partner, setPartner] = useState<{
    id: string;
    name?: string;
    interests?: string[];
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);

  // Initialize WebRTC
  const initWebRTC = async () => {
    try {
      const configuration = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
      };

      const pc = new RTCPeerConnection(configuration);
      pcRef.current = pc;

      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);

      // Add local stream tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // ICE Candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit("ice-candidate", {
            to: partner?.id,
            candidate: event.candidate,
          });
        }
      };

      // Connection state handling
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState) {
          setConnectionStatus(pc.iceConnectionState);
          console.log("ICE connection state:", pc.iceConnectionState);
        }
      };

      setPeerConnection(pc);
      return pc;
    } catch (error) {
      console.error("Error initializing WebRTC:", error);
      return null;
    }
  };

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = connectSocket(userId);

    socketRef.current.on("connect", () => {
      setIsConnected(true);
      const storedInterests = localStorage.getItem("userInterests");
      const interests = storedInterests ? JSON.parse(storedInterests) : [];
      socketRef.current.emit("request-chat", {
        userId,
        interests,
        videoEnabled,
        audioEnabled,
      });
    });

    socketRef.current.on(
      "paired",
      async (data: {
        partnerId: string;
        partnerName?: string;
        partnerInterests?: string[];
      }) => {
        setPartner({
          id: data.partnerId,
          name: data.partnerName,
          interests: data.partnerInterests,
        });

        // Initialize WebRTC after pairing
        const pc = await initWebRTC();
        if (pc) {
          // Create offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current.emit("offer", {
            to: data.partnerId,
            offer,
          });
        }
      }
    );

    socketRef.current.on(
      "offer",
      async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
        const pc = pcRef.current || (await initWebRTC());
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit("answer", {
          to: data.from,
          answer,
        });
      }
    );

    socketRef.current.on(
      "answer",
      async (data: { answer: RTCSessionDescriptionInit }) => {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        }
      }
    );

    socketRef.current.on(
      "ice-candidate",
      async (data: { candidate: RTCIceCandidateInit }) => {
        if (pcRef.current) {
          try {
            await pcRef.current.addIceCandidate(
              new RTCIceCandidate(data.candidate)
            );
          } catch (e) {
            console.error("Error adding ICE candidate:", e);
          }
        }
      }
    );

    socketRef.current.on("message", (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    socketRef.current.on("disconnected", () => {
      handleDisconnect();
    });

    return () => {
      handleDisconnect();
    };
  }, [userId]);

  const handleDisconnect = () => {
    setPartner(null);
    setMessages((prev) => [
      ...prev,
      {
        text: "Partner has disconnected",
        sender: "system",
        timestamp: new Date().toISOString(),
      },
    ]);

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setConnectionStatus("disconnected");

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const reportUser = () => {
    if (!partner) return;
    socketRef.current?.emit("report-user", {
      reportedUserId: partner.id,
      reason: "Inappropriate behavior",
    });
    alert("User reported. Thank you for your feedback.");
  };

  const sendMessage = () => {
    if (input.trim() && partner) {
      const filteredMessage = applyChatFilter(input);
      const message = {
        text: filteredMessage,
        sender: userId,
        timestamp: new Date().toISOString(),
      };

      socketRef.current?.emit("message", {
        recipient: partner.id,
        message,
      });

      setMessages((prev) => [...prev, message]);
      setInput("");
    }
  };

  const applyChatFilter = (text: string): string => {
    const blockedWords = ["badword1", "badword2", "badword3"];
    return text
      .split(" ")
      .map((word) =>
        blockedWords.includes(word.toLowerCase())
          ? "*".repeat(word.length)
          : word
      )
      .join(" ");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">
            {partner
              ? `Chatting with ${partner.name || "Stranger"}`
              : "Looking for a partner..."}
          </h1>
          <p className="text-xs opacity-80">Status: {connectionStatus}</p>
        </div>
        {partner && (
          <button
            onClick={reportUser}
            className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm"
          >
            Report
          </button>
        )}
      </header>

      {/* Video Area */}
      <div className="flex-1 relative bg-black">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
            <p>Waiting for partner's video...</p>
          </div>
        )}

        {/* Local Video */}
        <div className="absolute bottom-4 right-4 w-32 h-48 rounded-lg overflow-hidden z-10">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 flex justify-center space-x-2 bg-black bg-opacity-50 p-1">
            <button
              onClick={toggleVideo}
              className={`p-1 rounded-full ${
                videoEnabled ? "bg-green-500" : "bg-red-500"
              }`}
            >
              {videoEnabled ? "🎥" : "❌"}
            </button>
            <button
              onClick={toggleAudio}
              className={`p-1 rounded-full ${
                audioEnabled ? "bg-green-500" : "bg-red-500"
              }`}
            >
              {audioEnabled ? "🎤" : "❌"}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="h-1/4 md:h-1/3 overflow-y-auto p-4 space-y-2 bg-white">
        {partner?.interests && (
          <div className="mb-2">
            <p className="text-sm text-gray-500">Shared interests:</p>
            <div className="flex flex-wrap gap-1">
              {partner.interests.map((interest, i) => (
                <span
                  key={i}
                  className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.sender === userId ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs md:max-w-md rounded-lg p-3 ${
                msg.sender === userId
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              <p>{msg.text}</p>
              <p className="text-xs opacity-70 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Type a message..."
            disabled={!partner}
          />
          <button
            onClick={sendMessage}
            disabled={!partner || !input.trim()}
            className="bg-indigo-600 text-white rounded-full px-4 py-2 disabled:opacity-50 hover:bg-indigo-700 transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
