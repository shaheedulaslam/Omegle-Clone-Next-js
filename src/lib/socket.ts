// lib/socket.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const connectSocket = (userId: string, name: any, interests: any) => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "wss://mallumeet-backend-js.onrender.com", {
      query: { userId },
      transports: ["websocket"],
    });

    // Connection events
    socket.on("connect", () => {
      console.log("Connected to signaling server:", socket?.id , name , interests);
      // Join matchmaking queue
      socket?.emit("request-chat", { name, interests });
    });

    socket.on("queue-position", ({ position }) => {
      console.log("Queue position:", position);
    });

    socket.on("queue-timeout", () => {
      console.log("Timed out waiting for a partner.");
    });

    socket.on("paired", (data) => {
      console.log("Paired with:", data);
    });

    socket.on("offer", ({ from, offer }) => {
      console.log("Received offer from", from);
      // Pass to your RTCPeerConnection
    });

    socket.on("answer", ({ from, answer }) => {
      console.log("Received answer from", from);
    });

    socket.on("ice-candidate", ({ from, candidate }) => {
      console.log("Received ICE candidate from", from);
    });

    socket.on("message", (msg) => {
      console.log("New message:", msg);
    });

    socket.on("disconnected", () => {
      console.log("Your partner disconnected.");
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
