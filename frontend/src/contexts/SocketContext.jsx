import { useEffect, useMemo, useState } from 'react';
import SocketContext from './SocketContextContext.js';
import { io } from 'socket.io-client';

let socketSingleton = null;
let listenersAttached = false;

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const auth = useMemo(() => {
        const token = localStorage.getItem('token');
        const id = localStorage.getItem('user_id');
        const username = localStorage.getItem('username');
        return { token, userId: id, username };
    }, []);

    useEffect(() => {
        // Initialize or reuse singleton socket connection
        if (!socketSingleton) {
            socketSingleton = io('/', {
                withCredentials: true,
                transports: ['websocket', 'polling'],
                autoConnect: true,
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
            });
        }

        // Attach listeners once
        if (!listenersAttached && socketSingleton) {
            listenersAttached = true;
            socketSingleton.on('connect', () => {
                console.log('Socket connected:', socketSingleton.id);
                setIsConnected(true);
            });
            socketSingleton.on('disconnect', () => {
                console.log('Socket disconnected');
                setIsConnected(false);
            });
            socketSingleton.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });
        }

        setSocket(socketSingleton);

        return () => {
            // Do nothing
        };
    }, [auth]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, currentUser: auth }}>
            {children}
        </SocketContext.Provider>
    );
};

export default SocketProvider;
