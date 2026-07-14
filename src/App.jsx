import React, { useState, useEffect } from 'react';
import DeviceShell from './shell/DeviceShell';
import Lockscreen from './shell/Lockscreen';
import { useStore } from './core/store';
import { useService } from './core/hooks/useService';
import { getToolById } from './core/registry';

const App = () => {
  const openApp = useStore((s) => s.openApp);
  const setAppPlacements = useStore((s) => s.setAppPlacements);
  const setAppOrder = useStore((s) => s.setAppOrder);
  const [isLocked, setIsLocked] = useState(true);

  // ─── Cloud settings listener ───
  const { isReady: isFirebaseReady, service: firebaseService } = useService('firebase-firestore');

  useEffect(() => {
    if (isFirebaseReady && firebaseService?.db) {
      let unsub = null;
      
      // Load real-time placements globally
      (async () => {
        try {
          const { doc, onSnapshot } = await import('firebase/firestore');
          const docRef = doc(firebaseService.db, 'notes', 'settings_placements');
          
          unsub = onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              if (data.placements) {
                setAppPlacements(data.placements);
              }
              if (data.order) {
                setAppOrder(data.order);
              }
            }
          });
        } catch (err) {
          console.error('Failed to listen to global placements:', err);
        }
      })();

      return () => {
        if (unsub) unsub();
      };
    }
  }, [isFirebaseReady, firebaseService, setAppPlacements, setAppOrder]);

  // Handle URL shortcut: ?open=tool-id
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toolId = params.get('open');
    if (toolId) {
      const tool = getToolById(toolId);
      if (tool) openApp(tool);
    }
  }, [openApp]);

  if (isLocked) {
    return <Lockscreen onUnlock={() => setIsLocked(false)} />;
  }

  return <DeviceShell />;
};

export default App;
