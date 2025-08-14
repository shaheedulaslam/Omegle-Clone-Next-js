// import { io, Socket } from "socket.io-client";

// let socket: Socket;

// export const connectSocket = (userId: string) => {
//   socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "", {
//     path: "/api/chat/socket.io",
//     query: { userId },
//     transports: ["websocket"],
//   });
//   console.log(socket , "sockk");
  
//   return socket;
// };

// export const getSocket = () => {
//   if (!socket) throw new Error("Socket not initialized");
//   return socket;
// };

// export const initializePeerConnection = async (
//   userId: string,
//   onTrack: (stream: MediaStream) => void
// ) => {
//   const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
//   const peerConnection = new RTCPeerConnection(configuration);

//   // Add local stream
//   const localStream = await navigator.mediaDevices.getUserMedia({
//     video: true,
//     audio: true,
//   });
//   localStream.getTracks().forEach(track => {
//     peerConnection.addTrack(track, localStream);
//   });

//   // Handle incoming tracks
//   peerConnection.ontrack = (event) => {
//     onTrack(event.streams[0]);
//   };

//   // ICE Candidate handling
//   peerConnection.onicecandidate = (event) => {
//     if (event.candidate) {
//       getSocket().emit('ice-candidate', {
//         userId,
//         candidate: event.candidate,
//       });
//     }
//   };

//   return { peerConnection, localStream };
// };





import { io, Socket } from "socket.io-client";

let socket: Socket;

export const connectSocket = (userId: string) => {
  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "https://mallumeet-backend-js.onrender.com", {
    query: { userId },
    transports: ["websocket"],
  });
  return socket;
};

export const getSocket = () => socket;

