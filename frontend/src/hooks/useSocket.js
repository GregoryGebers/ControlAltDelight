import { useContext } from 'react';
import SocketContext from '../contexts/SocketContextContext.js';

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
