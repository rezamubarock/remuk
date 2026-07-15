import React, { useState, useEffect, useRef } from 'react';
import Wallpaper from './Wallpaper';
import '@styles/shell.css';

const HASH_TARGET = '8db09d4e9412d0ed0ce5896a96140f8f2586befcad05a58724e33f63f32b9d69'; // SHA-256 of "annelies"

const sha256 = async (string) => {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const getFingerprint = async () => {
  const parts = [
    navigator.userAgent,
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.language,
    navigator.hardwareConcurrency || 4,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform
  ];
  const fpString = parts.join('|');
  const utf8 = new TextEncoder().encode(fpString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 'fp-' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 24);
};

const Lockscreen = ({ onUnlock, firebaseService }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const time = useRef('');
  const date = useRef('');
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus input on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      setDateStr(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError(false);

    try {
      const inputHash = await sha256(password);
      if (inputHash === HASH_TARGET) {
        sessionStorage.setItem('remuk_lockscreen_unlocked', 'true');
        
        // Save unique device ID & fingerprint to Firestore to bypass on future entries
        if (firebaseService?.db) {
          try {
            let deviceId = '';
            try {
              deviceId = localStorage.getItem('remuk_device_id');
              if (!deviceId) {
                deviceId = `dev-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
                localStorage.setItem('remuk_device_id', deviceId);
              }
            } catch (storageErr) {
              console.warn('localStorage not accessible on submit:', storageErr);
            }

            let fingerprint = '';
            try {
              fingerprint = await getFingerprint();
            } catch (fpErr) {
              console.error('Failed to generate fingerprint on submit:', fpErr);
            }

            const { doc, setDoc } = await import('firebase/firestore');
            const docRef = doc(firebaseService.db, 'notes', 'lockscreen_unlocked_devices');
            
            const updates = {};
            if (deviceId) updates[deviceId] = true;
            if (fingerprint) updates[fingerprint] = true;

            await setDoc(docRef, {
              unlockedDevices: updates
            }, { merge: mergeObject => mergeObject || {} }); // custom merge or standard merge: true
            
            // Standard setDoc with merge: true is safest:
            await setDoc(docRef, {
              unlockedDevices: updates
            }, { merge: true });
          } catch (devErr) {
            console.error('Failed to log device ID for auto-unlock:', devErr);
          }
        }
        
        onUnlock();
      } else {
        setError(true);
        setPassword('');
        // Shake animation reset
        setTimeout(() => setError(false), 500);
      }
    } catch (err) {
      console.error('[Lockscreen] Hashing error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lockscreen">
      {/* Background wallpaper (static but randomized) */}
      <Wallpaper />

      {/* Lockscreen content layer */}
      <div className="lockscreen__content">
        {/* Floating Clock */}
        <div className="lockscreen__clock-container">
          <h1 className="lockscreen__time">{timeStr}</h1>
          <p className="lockscreen__date">{dateStr}</p>
        </div>

        {/* User login card */}
        <div className="lockscreen__card">
          <div className="lockscreen__avatar">
            <span className="lockscreen__avatar-emoji">🛡️</span>
          </div>
          <h2 className="lockscreen__username">Remuk Tools</h2>

          <form onSubmit={handleSubmit} className={`lockscreen__form ${error ? 'lockscreen__form--shake' : ''}`}>
            <div className="lockscreen__input-wrapper">
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="lockscreen__input"
                disabled={loading}
                autoFocus
              />
              <button 
                type="submit" 
                className="lockscreen__submit-btn" 
                disabled={loading || !password}
                aria-label="Unlock"
              >
                {loading ? (
                  <div className="lockscreen__spinner" />
                ) : (
                  <span>➔</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Lockscreen;
