import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const connectSocket = (userId: string) => {
  if (socket?.connected) return socket;

  const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
  socket = io(url, {
    query: { userId },
    transports: ["websocket"], // websocket first; polling fallback handled by server if needed
    withCredentials: false
  });

  return socket;
};

export const getSocket = () => socket;
