import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinProject: (projectId: number) => void;
  leaveProject: (projectId: number) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  joinProject: () => {},
  leaveProject: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Get the API URL from environment or default
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('access_token');

    if (!token) {
      return;
    }

    // Create socket connection
    const newSocket = io(apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });

    newSocket.on('connected', () => {
      // Connection acknowledged
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  const joinProject = useCallback((projectId: number) => {
    if (socket && isConnected) {
      const token = localStorage.getItem('access_token');
      socket.emit('join_project', { token, project_id: projectId });
    }
  }, [socket, isConnected]);

  const leaveProject = useCallback((projectId: number) => {
    if (socket && isConnected) {
      socket.emit('leave_project', { project_id: projectId });
    }
  }, [socket, isConnected]);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, joinProject, leaveProject }}>
      {children}
    </WebSocketContext.Provider>
  );
};
