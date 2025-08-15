import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const connectSocket = (userId: string): Socket => {
  // Reuse existing connection if available
  if (socket?.connected) {
    return socket;
  }

  const url = process.env.NEXT_PUBLIC_SOCKET_URL || "wss://mallumeet-backend-js.onrender.com";
  
  console.log("Connecting to Socket.IO server at:", url);

  socket = io(url, {
    query: { userId },
    transports: ["websocket" , "polling"],
  });

  // Error handling
  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err.message);
  });

  socket.on("reconnect_attempt", (attempt) => {
    console.log(`Reconnection attempt ${attempt}`);
  });

  socket.on("reconnect_failed", () => {
    console.error("Socket reconnection failed");
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};