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

const Lockscreen = ({ onUnlock, firebaseService }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus input on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }));
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
        
        // Save unique device ID to Firestore to bypass on future entries
        if (firebaseService?.db) {
          try {
            let deviceId = localStorage.getItem('remuk_device_id');
            if (!deviceId) {
              deviceId = `dev-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
              localStorage.setItem('remuk_device_id', deviceId);
            }

            const { doc, setDoc } = await import('firebase/firestore');
            const docRef = doc(firebaseService.db, 'notes', 'lockscreen_unlocked_devices');
            await setDoc(docRef, {
              unlockedDevices: {
                [deviceId]: true
              }
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
          <h1 className="lockscreen__time">{time}</h1>
          <p className="lockscreen__date">{date}</p>
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
