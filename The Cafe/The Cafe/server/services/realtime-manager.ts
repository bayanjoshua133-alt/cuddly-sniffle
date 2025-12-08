import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

export interface RealTimeEvents {
  "shift:created": { shift: any };
  "shift:updated": { shift: any };
  "shift:deleted": { shiftId: string };
  "trade:created": { trade: any };
  "trade:updated": { trade: any };
  "trade:status-changed": { tradeId: string; status: string };
  "availability:updated": { employeeId: string; availability: any };
}

class RealTimeManager {
  private io: SocketIOServer;
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.VITE_API_URL || "http://localhost:5173",
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingInterval: 25000,
      pingTimeout: 60000,
    });

    this.setupMiddleware();
    this.setupConnections();
  }

  private setupMiddleware() {
    this.io.use((socket, next) => {
      // Extract userId from query or auth token
      const userId = socket.handshake.query.userId as string;
      const authToken = socket.handshake.auth.token as string;

      if (!userId && !authToken) {
        return next(new Error("Authentication required"));
      }

      // Store userId on socket
      socket.data.userId = userId;
      next();
    });
  }

  private setupConnections() {
    this.io.on("connection", (socket: Socket) => {
      const userId = socket.data.userId;

      // Track user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(socket.id);

      console.log(`User ${userId} connected (socket: ${socket.id})`);

      // Join user's personal room
      socket.join(`user:${userId}`);
      socket.join(`shifts`); // Subscribe to all shifts for real-time updates

      // Handle custom events
      socket.on("subscribe:employee-shifts", () => {
        socket.join(`employee:${userId}:shifts`);
      });

      socket.on("subscribe:shift-trades", () => {
        socket.join(`user:${userId}:trades`);
      });

      socket.on("disconnect", () => {
        const connections = this.userConnections.get(userId);
        if (connections) {
          connections.delete(socket.id);
          if (connections.size === 0) {
            this.userConnections.delete(userId);
          }
        }
        console.log(`User ${userId} disconnected (socket: ${socket.id})`);
      });

      // Error handling
      socket.on("error", (error) => {
        console.error(`Socket error for user ${userId}:`, error);
      });
    });
  }

  // Public methods for broadcasting events
  public broadcastShiftCreated(shift: any) {
    this.io.to("shifts").emit("shift:created", { shift });
  }

  public broadcastShiftUpdated(shift: any) {
    this.io.to("shifts").emit("shift:updated", { shift });
  }

  public broadcastShiftDeleted(shiftId: string) {
    this.io.to("shifts").emit("shift:deleted", { shiftId });
  }

  public broadcastTradeCreated(trade: any) {
    // Notify the trade requester and target employee
    if (trade.fromUserId) {
      this.io.to(`user:${trade.fromUserId}:trades`).emit("trade:created", { trade });
    }
    if (trade.toUserId) {
      this.io.to(`user:${trade.toUserId}:trades`).emit("trade:created", { trade });
    }
    // Notify all managers
    this.io.to("managers").emit("trade:created", { trade });
  }

  public broadcastTradeStatusChanged(tradeId: string, status: string, trade: any) {
    // Notify relevant parties
    if (trade.fromUserId) {
      this.io.to(`user:${trade.fromUserId}:trades`).emit("trade:status-changed", { tradeId, status });
    }
    if (trade.toUserId) {
      this.io.to(`user:${trade.toUserId}:trades`).emit("trade:status-changed", { tradeId, status });
    }
  }

  public notifyAvailabilityUpdate(employeeId: string, availability: any) {
    this.io.to("shifts").emit("availability:updated", { employeeId, availability });
  }

  public isUserOnline(userId: string): boolean {
    return this.userConnections.has(userId) && (this.userConnections.get(userId)?.size ?? 0) > 0;
  }

  public getUserConnections(userId: string): number {
    return this.userConnections.get(userId)?.size ?? 0;
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

export default RealTimeManager;
