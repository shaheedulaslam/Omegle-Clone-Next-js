"use client";
import { useEffect, useState, useRef } from "react";
import { connectSocket } from "@/lib/socket";
import { v4 as uuidv4 } from "uuid";

type Message = {
  sender: string;
  text: string;
  timestamp: string;
};

export default function ChatPage() {
  const [userId] = useState(uuidv4());
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize WebRTC
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
    setLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Remote stream
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      setRemoteStream(event.streams[0]);
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && partnerId) {
        socketRef.current.emit("ice-candidate", { to: partnerId, candidate: event.candidate });
      }
    };

    // Connection state
    pc.oniceconnectionstatechange = () => {
      setConnectionStatus(pc.iceConnectionState);
    };

    return pc;
  };

  // Connect to Socket server
  useEffect(() => {
    socketRef.current = connectSocket(userId);

    socketRef.current.on("connect", () => {
      console.log("Connected to signaling server");
      socketRef.current.emit("request-chat", { userId });
    });

    // Paired with a stranger
    socketRef.current.on("paired", async (data: { partnerId: string }) => {
      setPartnerId(data.partnerId);
      const pc = await initWebRTC();
      const offer = await pc!.createOffer();
      await pc!.setLocalDescription(offer);
      socketRef.current.emit("offer", { to: data.partnerId, offer });
    });

    // Receive offer
    socketRef.current.on("offer", async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      setPartnerId(data.from);
      const pc = pcRef.current || (await initWebRTC());
      await pc!.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc!.createAnswer();
      await pc!.setLocalDescription(answer);
      socketRef.current.emit("answer", { to: data.from, answer });
    });

    // Receive answer
    socketRef.current.on("answer", async (data: { answer: RTCSessionDescriptionInit }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    // ICE candidate
    socketRef.current.on("ice-candidate", async (data: { candidate: RTCIceCandidateInit }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error(err);
        }
      }
    });

    // Text message
    socketRef.current.on("message", (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Partner disconnected
    socketRef.current.on("disconnected", () => {
      setPartnerId(null);
      if (pcRef.current) pcRef.current.close();
      setRemoteStream(null);
      setMessages((prev) => [
        ...prev,
        { sender: "system", text: "Partner disconnected", timestamp: new Date().toISOString() },
      ]);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (pcRef.current) pcRef.current.close();
    };
  }, [userId]);

  const sendMessage = () => {
    if (!input.trim() || !partnerId) return;

    const message: Message = { sender: userId, text: input, timestamp: new Date().toISOString() };
    socketRef.current.emit("message", { to: partnerId, message });
    setMessages((prev) => [...prev, message]);
    setInput("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleVideo = () => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setVideoEnabled(track.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setAudioEnabled(track.enabled);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-indigo-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">
          {partnerId ? "Chatting with Stranger" : "Looking for a partner..."}
        </h1>
        <p className="text-xs opacity-80">Status: {connectionStatus}</p>
      </header>

      <div className="flex-1 relative bg-black">
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        {!remoteStream && <div className="absolute inset-0 flex items-center justify-center text-white">Waiting for partner...</div>}

        <div className="absolute bottom-4 right-4 w-32 h-48 rounded-lg overflow-hidden z-10">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 flex justify-center space-x-2 bg-black bg-opacity-50 p-1">
            <button onClick={toggleVideo} className={`p-1 rounded-full ${videoEnabled ? "bg-green-500" : "bg-red-500"}`}>
              {videoEnabled ? "🎥" : "❌"}
            </button>
            <button onClick={toggleAudio} className={`p-1 rounded-full ${audioEnabled ? "bg-green-500" : "bg-red-500"}`}>
              {audioEnabled ? "🎤" : "❌"}
            </button>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="h-1/4 md:h-1/3 overflow-y-auto p-4 space-y-2 bg-white">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.sender === userId ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-xs md:max-w-md rounded-lg p-2 ${msg.sender === userId ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-800"}`}>
              <p>{msg.text}</p>
              <p className="text-xs opacity-70 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={!partnerId}
        />
        <button onClick={sendMessage} disabled={!partnerId || !input.trim()} className="bg-indigo-600 text-white rounded-full px-4 py-2 hover:bg-indigo-700 transition disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  );
}
