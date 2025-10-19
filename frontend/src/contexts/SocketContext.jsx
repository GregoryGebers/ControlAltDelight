// src/contexts/SocketContext.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import SocketContext from './SocketContextContext.js'; // keep using the SAME context everywhere
import { io } from 'socket.io-client';
import { API } from '../lib/apiBase';
let socketSingleton = null;

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersAttached = useRef(false);

  // Build API base:
  // - In Render: set VITE_API_URL=https://your-backend.onrender.com  (frontend env var)
  // - In local dev: leave it empty so Vite proxy ('/') is used
  // Optional user info you might show in the UI; not used for socket auth (cookies handle that)
  const currentUser = useMemo(() => {
    return {
      userId: localStorage.getItem('user_id') || null,
      username: localStorage.getItem('username') || null,
    };
  }, []);

  // Create (or reuse) the singleton socket
  if (!socketSingleton) {
    // If API is set, connect directly to backend (Render/prod).
    // Else use relative '/' so Vite proxy forwards to backend in dev/LAN.
    const url = API || '/';
    socketSingleton = io(url, {
      withCredentials: true,                 // send cookies on handshake
      transports: ['websocket', 'polling'],
      autoConnect: false,                    // connect after we attach listeners
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }

  // Attach listeners once
  useEffect(() => {
    if (listenersAttached.current) {
      setSocket(socketSingleton);
      return;
    }
    listenersAttached.current = true;

    const onConnect = () => {
      console.log('[ws] connected', socketSingleton.id);
      setIsConnected(true);
    };
    const onDisconnect = (reason) => {
      console.log('[ws] disconnected', reason);
      setIsConnected(false);
    };
    const onError = (err) => {
      console.error('[ws] connect_error:', err?.message || err);
    };

    socketSingleton.on('connect', onConnect);
    socketSingleton.on('disconnect', onDisconnect);
    socketSingleton.on('connect_error', onError);

    // Now that handlers are on, connect
    if (!socketSingleton.connected) socketSingleton.connect();

    setSocket(socketSingleton);

    return () => {
      // keep the singleton for HMR/navigation, just remove handlers on full unmount if needed
      socketSingleton.off('connect', onConnect);
      socketSingleton.off('disconnect', onDisconnect);
      socketSingleton.off('connect_error', onError);
    };
  }, []);

  // Expose a helper to refresh the auth on the socket (use after login/logout)
  const refreshAuth = () => {
    // Reconnect so the next handshake carries *current* cookies
    try {
      if (socketSingleton.connected) socketSingleton.disconnect();
    } finally {
      socketSingleton.connect();
    }
  };

  const value = useMemo(
    () => ({ socket, isConnected, currentUser, refreshAuth }),
    [socket, isConnected, currentUser]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketProvider;