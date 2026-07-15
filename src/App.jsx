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
  const setFolders = useStore((s) => s.setFolders);
  
  const [isLocked, setIsLocked] = useState(() => {
    return sessionStorage.getItem('remuk_lockscreen_unlocked') !== 'true';
  });

  // ─── Cloud settings listener ───
  const { isReady: isFirebaseReady, service: firebaseService } = useService('firebase-firestore');

  useEffect(() => {
    if (isFirebaseReady && firebaseService?.db) {
      let unsub = null;
      
      // Load real-time settings (placements, order, folders) globally
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
              if (data.folders) {
                setFolders(data.folders);
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
  }, [isFirebaseReady, firebaseService, setAppPlacements, setAppOrder, setFolders]);

  // Handle URL shortcut: ?open=tool-id
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toolId = params.get('open');
    if (toolId) {
      const tool = getToolById(toolId);
      if (tool) openApp(tool);
    }
  }, [openApp]);

  // Auto-open system info diagnostics on first unlock
  useEffect(() => {
    if (!isLocked) {
      if (sessionStorage.getItem('remuk_sysinfo_autoopened') !== 'true') {
        sessionStorage.setItem('remuk_sysinfo_autoopened', 'true');
        const sysTool = getToolById('system-info');
        if (sysTool) {
          setTimeout(() => {
            openApp(sysTool);
          }, 800);
        }
      }
    }
  }, [isLocked, openApp]);

  // Real-time network auto-unlock check
  useEffect(() => {
    if (isFirebaseReady && firebaseService?.db && isLocked) {
      const checkAutoUnlock = async () => {
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          const data = await res.json();
          if (data.ip) {
            const utf8 = new TextEncoder().encode(data.ip);
            const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const ipHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
            
            const { doc, getDoc } = await import('firebase/firestore');
            const docRef = doc(firebaseService.db, 'notes', 'lockscreen_unlocked_ips');
            const snap = await getDoc(docRef);
            
            if (snap.exists()) {
              const docData = snap.data();
              if (docData.unlockedHashes && docData.unlockedHashes[ipHash] === true) {
                sessionStorage.setItem('remuk_lockscreen_unlocked', 'true');
                setIsLocked(false);
              }
            }
          }
        } catch (e) {
          console.error('Network auto-unlock check bypassed due to connection or fetch error:', e);
        }
      };
      checkAutoUnlock();
    }
  }, [isFirebaseReady, firebaseService, isLocked]);

  if (isLocked) {
    return <Lockscreen onUnlock={() => setIsLocked(false)} firebaseService={firebaseService} />;
  }

  return <DeviceShell />;
};

export default App;
