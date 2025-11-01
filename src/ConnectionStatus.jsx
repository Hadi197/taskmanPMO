import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { getConnectionStatus } from './supabaseClient';

export default function ConnectionStatus() {
  const [status, setStatus] = useState(getConnectionStatus());
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      const newStatus = getConnectionStatus();
      setStatus(newStatus);

      // Show notification when connection is restored
      if (!status.isOnline && newStatus.isOnline) {
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
      }
    };

    // Check status periodically
    const interval = setInterval(updateStatus, 5000);

    // Listen for online/offline events
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, [status.isOnline]);

  if (status.isOnline && !showNotification) {
    return null; // Don't show anything when connected
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      {showNotification && (
        <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg mb-2 flex items-center space-x-2 animate-fade-in">
          <Wifi className="w-4 h-4" />
          <span className="text-sm font-medium">Connection restored</span>
        </div>
      )}

      {!status.isOnline && (
        <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <WifiOff className="w-4 h-4" />
          <div>
            <div className="text-sm font-medium">No internet connection</div>
            <div className="text-xs opacity-90">Some features may not work</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for components that need to know connection status
export function useConnectionStatus() {
  const [status, setStatus] = useState(getConnectionStatus());

  useEffect(() => {
    const updateStatus = () => setStatus(getConnectionStatus());

    const interval = setInterval(updateStatus, 2000);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return status;
}