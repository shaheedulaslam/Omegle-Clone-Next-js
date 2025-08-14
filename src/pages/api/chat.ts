import type { NextApiRequest, NextApiResponse } from "next";
import { Server, ServerOptions } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  WaitingUsers,
  ActivePairs,
  ReportedUsers,
} from "@/types";
import type { Server as HTTPServer } from "http";
import type { Socket as NetSocket } from "net";

interface HttpServerWithIO extends ServerOptions {
  io?: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
}

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

// Extend the socket to include the server with .io
interface SocketServer extends HTTPServer {
  io?: Server;
}

interface SocketWithServer extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithServer;
}

const waitingUsers: WaitingUsers = {};
const activePairs: ActivePairs = {};
const reportedUsers: ReportedUsers = {};

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!io) {
    console.log("Initializing Socket.io...");

    const httpServer = res.socket.server;

    io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
      path: "/api/chat/socket.io",
      addTrailingSlash: false,
    });

    const blockedWords = ["badword1", "badword2", "badword3"];

    io.on("connection", (socket) => {
      const userId = socket.handshake.query.userId as string;
      console.log("User connected:", userId);

      socket.on("request-chat", (data) => {
        waitingUsers[userId] = {
          socket,
          interests: data.interests || [],
          videoEnabled: data.videoEnabled,
          audioEnabled: data.audioEnabled,
        };

        const potentialPartners = Object.entries(waitingUsers)
          .filter(
            ([id, userData]) =>
              id !== userId &&
              !reportedUsers[id] &&
              (userData.interests.length === 0 ||
                data.interests?.length === 0 ||
                userData.interests.some((interest) =>
                  data.interests?.includes(interest)
                ))
          )
          .sort((a, b) => {
            const aMatches = a[1].interests.filter((i) =>
              data.interests?.includes(i)
            ).length;
            const bMatches = b[1].interests.filter((i) =>
              data.interests?.includes(i)
            ).length;
            return bMatches - aMatches;
          });

        if (potentialPartners.length > 0) {
          const [partnerId, partnerData] = potentialPartners[0];
          delete waitingUsers[userId];
          delete waitingUsers[partnerId];

          activePairs[userId] = partnerId;
          activePairs[partnerId] = userId;

          socket.emit("paired", {
            partnerId,
            partnerInterests: partnerData.interests,
          });
          partnerData.socket.emit("paired", {
            partnerId: userId,
            partnerInterests: data.interests,
          });
        }
      });

      socket.on(
        "offer",
        (data: { to: string; offer: RTCSessionDescriptionInit }) => {
          if (waitingUsers[data.to]?.socket) {
            waitingUsers[data.to].socket.emit("offer", {
              from: userId,
              offer: data.offer,
            });
          }
        }
      );

      socket.on(
        "answer",
        (data: { to: string; answer: RTCSessionDescriptionInit }) => {
          if (waitingUsers[data.to]?.socket) {
            waitingUsers[data.to].socket.emit("answer", {
              answer: data.answer,
            });
          }
        }
      );

      socket.on(
        "ice-candidate",
        (data: { to: string; candidate: RTCIceCandidateInit }) => {
          if (waitingUsers[data.to]?.socket) {
            waitingUsers[data.to].socket.emit("ice-candidate", {
              candidate: data.candidate,
            });
          }
        }
      );

      socket.on("message", (data: { recipient: string; message: any }) => {
        const filteredMessage = {
          ...data.message,
          text: data.message.text
            .split(" ")
            .map((word: string) =>
              blockedWords.includes(word.toLowerCase())
                ? "*".repeat(word.length)
                : word
            )
            .join(" "),
        };

        if (waitingUsers[data.recipient]?.socket) {
          waitingUsers[data.recipient].socket.emit("message", filteredMessage);
        }
      });

      socket.on(
        "report-user",
        (data: { reportedUserId: string; reason: string }) => {
          reportedUsers[data.reportedUserId] =
            (reportedUsers[data.reportedUserId] || 0) + 1;
          console.log(
            `User ${data.reportedUserId} reported for: ${data.reason}`
          );

          if (reportedUsers[data.reportedUserId] >= 3) {
            const reportedSocket = waitingUsers[data.reportedUserId]?.socket;
            if (reportedSocket) {
              reportedSocket.emit("banned", { reason: "Multiple reports" });
              reportedSocket.disconnect();
            }
          }
        }
      );

      socket.on("disconnect", () => {
        console.log("User disconnected:", userId);
        const partnerId = activePairs[userId];
        if (partnerId && waitingUsers[partnerId]?.socket) {
          waitingUsers[partnerId].socket.emit("disconnected");
          delete activePairs[partnerId];
        }
        delete activePairs[userId];
        delete waitingUsers[userId];
      });
    });

    (res.socket as any).server.io = io;
  }
  res.end();
}
