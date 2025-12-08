import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { getCurrentUser } from "@/lib/auth";

interface UseRealtimeOptions {
  enabled?: boolean;
  queryKeys?: string[];
  onEvent?: (event: string, data: any) => void;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { enabled = true, queryKeys = [], onEvent } = options;
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (!enabled || !currentUser?.id) return;

    // Connect to WebSocket
    const socket = io({
      query: { userId: currentUser.id },
      auth: {
        token: localStorage.getItem("auth_token") || "",
      },
      reconnectionDelay: 1000,
      reconnection: true,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to real-time updates");
      // Subscribe to relevant events
      socket.emit("subscribe:employee-shifts");
      socket.emit("subscribe:shift-trades");
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from real-time updates");
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    // Shift events
    socket.on("shift:created", (data) => {
      console.log("📍 New shift created:", data);
      queryClient.invalidateQueries({ queryKey: ["employee-shifts"] });
      onEvent?.("shift:created", data);
    });

    socket.on("shift:updated", (data) => {
      console.log("🔄 Shift updated:", data);
      queryClient.invalidateQueries({ queryKey: ["employee-shifts"] });
      onEvent?.("shift:updated", data);
    });

    socket.on("shift:deleted", (data) => {
      console.log("🗑️ Shift deleted:", data);
      queryClient.invalidateQueries({ queryKey: ["employee-shifts"] });
      onEvent?.("shift:deleted", data);
    });

    // Trade events
    socket.on("trade:created", (data) => {
      console.log("📨 New trade request:", data);
      queryClient.invalidateQueries({ queryKey: ["shift-trades"] });
      onEvent?.("trade:created", data);
    });

    socket.on("trade:status-changed", (data) => {
      console.log("📝 Trade status changed:", data);
      queryClient.invalidateQueries({ queryKey: ["shift-trades"] });
      onEvent?.("trade:status-changed", data);
    });

    // Availability events
    socket.on("availability:updated", (data) => {
      console.log("👥 Availability updated:", data);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onEvent?.("availability:updated", data);
    });

    // Invalidate custom query keys if provided
    if (queryKeys.length > 0) {
      socket.on("data-refresh-needed", () => {
        queryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      });
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, currentUser?.id, queryClient, onEvent, queryKeys]);

  const emit = useCallback(
    (event: string, data?: any) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(event, data);
      }
    },
    []
  );

  const isConnected = socketRef.current?.connected ?? false;

  return { socket: socketRef.current, isConnected, emit };
}
