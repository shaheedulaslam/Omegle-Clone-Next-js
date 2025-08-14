// import { Server } from "socket.io";
// import type {
//   ServerToClientEvents,
//   ClientToServerEvents,
//   InterServerEvents,
//   SocketData,
//   WaitingUsers,
//   ActivePairs,
//   ReportedUsers,
// } from "@/types";

// // Initialize Socket.io only once
// let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | undefined;

// const waitingUsers: WaitingUsers = {};
// const activePairs: ActivePairs = {};
// const reportedUsers: ReportedUsers = {};


// export function initSocket(server: any) {
//   if (!io) {
//     io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
//       path: "/api/chat/socket.io",
//       addTrailingSlash: false,
//     cors: { origin: "*" }
//     });

//     const blockedWords = ["badword1", "badword2", "badword3"];

//     io.on("connection", (socket) => {
//       const userId = socket.handshake.query.userId as string;
//       console.log("User connected:", userId);

//       socket.on("request-chat", (data) => {
//         waitingUsers[userId] = {
//           socket,
//           interests: data.interests || [],
//           videoEnabled: data.videoEnabled,
//           audioEnabled: data.audioEnabled,
//         };

//         // Find best match based on interests
//         const potentialPartners = Object.entries(waitingUsers)
//           .filter(
//             ([id, userData]) =>
//               id !== userId &&
//               !reportedUsers[id] &&
//               (userData.interests.length === 0 ||
//                 data.interests?.length === 0 ||
//                 userData.interests.some((interest) =>
//                   data.interests?.includes(interest)
//                 ))
//           )
//           .sort((a, b) => {
//             const aMatches = a[1].interests.filter((i) =>
//               data.interests?.includes(i)
//             ).length;
//             const bMatches = b[1].interests.filter((i) =>
//               data.interests?.includes(i)
//             ).length;
//             return bMatches - aMatches;
//           });

//         if (potentialPartners.length > 0) {
//           const [partnerId, partnerData] = potentialPartners[0];
//           delete waitingUsers[userId];
//           delete waitingUsers[partnerId];

//           activePairs[userId] = partnerId;
//           activePairs[partnerId] = userId;

//           socket.emit("paired", {
//             partnerId,
//             partnerInterests: partnerData.interests,
//           });
//           partnerData.socket.emit("paired", {
//             partnerId: userId,
//             partnerInterests: data.interests,
//           });
//         }
//       });

//       socket.on(
//         "offer",
//         (data: { to: string; offer: RTCSessionDescriptionInit }) => {
//           if (waitingUsers[data.to]?.socket) {
//             waitingUsers[data.to].socket.emit("offer", {
//               from: userId,
//               offer: data.offer,
//             });
//           }
//         }
//       );

//       socket.on(
//         "answer",
//         (data: { to: string; answer: RTCSessionDescriptionInit }) => {
//           if (waitingUsers[data.to]?.socket) {
//             waitingUsers[data.to].socket.emit("answer", {
//               answer: data.answer,
//             });
//           }
//         }
//       );

//       socket.on(
//         "ice-candidate",
//         (data: { to: string; candidate: RTCIceCandidateInit }) => {
//           if (waitingUsers[data.to]?.socket) {
//             waitingUsers[data.to].socket.emit("ice-candidate", {
//               candidate: data.candidate,
//             });
//           }
//         }
//       );

//       socket.on("message", (data: { recipient: string; message: any }) => {
//         // Apply chat filter to messages
//         const filteredMessage = {
//           ...data.message,
//           text: data.message.text
//             .split(" ")
//             .map((word: string) =>
//               blockedWords.includes(word.toLowerCase())
//                 ? "*".repeat(word.length)
//                 : word
//             )
//             .join(" "),
//         };

//         if (waitingUsers[data.recipient]?.socket) {
//           waitingUsers[data.recipient].socket.emit("message", filteredMessage);
//         }
//       });

//       socket.on(
//         "report-user",
//         (data: { reportedUserId: string; reason: string }) => {
//           reportedUsers[data.reportedUserId] =
//             (reportedUsers[data.reportedUserId] || 0) + 1;
//           console.log(
//             `User ${data.reportedUserId} reported for: ${data.reason}`
//           );

//           // If user is reported multiple times, disconnect them
//           if (reportedUsers[data.reportedUserId] >= 3) {
//             const reportedSocket = waitingUsers[data.reportedUserId]?.socket;
//             if (reportedSocket) {
//               reportedSocket.emit("banned", { reason: "Multiple reports" });
//               reportedSocket.disconnect();
//             }
//           }
//         }
//       );

//       socket.on("disconnect", () => {
//         console.log("User disconnected:", userId);
//         const partnerId = activePairs[userId];
//         if (partnerId && waitingUsers[partnerId]?.socket) {
//           waitingUsers[partnerId].socket.emit("disconnected");
//           delete activePairs[partnerId];
//         }
//         delete activePairs[userId];
//         delete waitingUsers[userId];
//       });
//     });

//   }
//     return io;
// }
