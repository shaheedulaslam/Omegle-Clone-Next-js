import { Socket as ServerSocket } from 'socket.io';

// User data types
export interface UserData {
  socket: ServerSocket<ClientToServerEvents, ServerToClientEvents>;
  interests: string[];
  videoEnabled: boolean;
  audioEnabled: boolean;
}

// Socket.IO types
export interface ServerToClientEvents {
  paired: (data: { partnerId: string; partnerInterests?: string[] }) => void;
  offer: (data: { from: string; offer: RTCSessionDescriptionInit }) => void;
  answer: (data: { answer: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (data: { candidate: RTCIceCandidateInit }) => void;
  message: (message: Message) => void;
  disconnected: () => void;
  banned: (data: { reason: string }) => void;
}

export interface ClientToServerEvents {
  'request-chat': (data: {
    userId: string;
    interests?: string[];
    videoEnabled: boolean;
    audioEnabled: boolean;
  }) => void;
  offer: (data: { to: string; offer: RTCSessionDescriptionInit }) => void;
  answer: (data: { to: string; answer: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (data: { to: string; candidate: RTCIceCandidateInit }) => void;
  message: (data: { recipient: string; message: Message }) => void;
  'report-user': (data: { reportedUserId: string; reason: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
}

// Message type
export interface Message {
  text: string;
  sender: string;
  timestamp: string;
}

// Utility types
export type WaitingUsers = Record<string, UserData>;
export type ActivePairs = Record<string, string>;
export type ReportedUsers = Record<string, number>;