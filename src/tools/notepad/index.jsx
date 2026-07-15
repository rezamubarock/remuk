import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useService } from '@core/hooks/useService';
import './notepad.css';

// SHA-256 of "rausyani"
const CREATION_HASH_TARGET = '1800cee37bd1f9d84755f2c0ffa7c75a4b5a12279687d88b0b33330e0a8976d8';

const sha256 = async (string) => {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const Notepad = () => {
  // ─── Firebase hook ───
  const { isReady: isFirebaseReady, service: firebaseService } = useService('firebase-firestore');

  // ─── Component states ───
  const [syncKey, setSyncKey] = useState(() => localStorage.getItem('remuk_notepad_key') || '');
  const [isConnected, setIsConnected] = useState(false);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Settings & forms
  const [inputKey, setInputKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState('local'); // 'local' | 'synced' | 'saving' | 'error'
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [creationPassword, setCreationPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [pendingKey, setPendingKey] = useState('');

  // Local IP-based network sync key
  const [localNetKey, setLocalNetKey] = useState('');

  // Refs for tracking active listeners and debounce timers
  const unsubscribeRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const notesStateRef = useRef([]);
  const lineNumbersRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync references reference state
  useEffect(() => {
    notesStateRef.current = notes;
  }, [notes]);

  // ─── Load Local Notes initially ───
  useEffect(() => {
    const local = localStorage.getItem('remuk_notepad_local_notes');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        setNotes(parsed);
        if (parsed.length > 0) {
          setActiveNoteId(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to parse local notes', e);
      }
    }
  }, []);

  // ─── Firestore Import Helpers ───
  const getFirestoreHelpers = async () => {
    const { doc, getDoc, setDoc, onSnapshot } = await import('firebase/firestore');
    return { doc, getDoc, setDoc, onSnapshot };
  };

  // Fetch Public IP to identify local network
  const getLocalNetworkKey = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      if (data.ip) {
        const ipHash = await sha256(data.ip);
        return `local_${ipHash.substring(0, 16)}`;
      }
    } catch (e) {
      // fallback to ipify
    }
    try {
      const res = await fetch('https://api64.ipify.org?format=json');
      const data = await res.json();
      if (data.ip) {
        const ipHash = await sha256(data.ip);
        return `local_${ipHash.substring(0, 16)}`;
      }
    } catch (e) {
      // fallback
    }
    return 'local_network_fallback';
  };

  // ─── Firestore listener setup ───
  const connectToKey = useCallback(async (key, isAutoLocal = false) => {
    if (!firebaseService?.db) return;
    setSyncStatus('saving');

    try {
      const { doc, getDoc, setDoc, onSnapshot } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', key);
      const docSnap = await getDoc(docRef);

      // If document doesn't exist, we auto-create for local sync, or prompt password for custom key
      if (!docSnap.exists()) {
        if (isAutoLocal || key.startsWith('local_')) {
          const initialNotes = notesStateRef.current.length > 0 ? notesStateRef.current : [];
          await setDoc(docRef, { notes: initialNotes });
        } else {
          setPendingKey(key);
          setShowPasswordPrompt(true);
          setSyncStatus('local');
          return;
        }
      } else {
        // Document exists: if local network key is empty/new and we have local notes, let's merge
        const data = docSnap.data();
        const remoteNotes = data.notes || [];
        if (remoteNotes.length === 0 && notesStateRef.current.length > 0 && (isAutoLocal || key.startsWith('local_'))) {
          await setDoc(docRef, { notes: notesStateRef.current });
        }
      }

      // Subscribe to updates
      if (unsubscribeRef.current) unsubscribeRef.current();

      unsubscribeRef.current = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const remoteNotes = data.notes || [];
          setNotes(remoteNotes);
          setSyncStatus('synced');
          setIsConnected(true);

          if (!isAutoLocal) {
            localStorage.setItem('remuk_notepad_key', key);
            setSyncKey(key);
          } else {
            setLocalNetKey(key);
          }

          if (remoteNotes.length > 0) {
            setActiveNoteId((prevId) => 
              remoteNotes.some((n) => n.id === prevId) ? prevId : remoteNotes[0].id
            );
          } else {
            setActiveNoteId(null);
          }
        }
      }, (err) => {
        console.error('Snapshot error:', err);
        setSyncStatus('error');
      });

    } catch (err) {
      console.error('Connection failed:', err);
      setSyncStatus('error');
    }
  }, [firebaseService]);

  // ─── Auto connect / local sync key setup ───
  useEffect(() => {
    if (isFirebaseReady && firebaseService?.db) {
      (async () => {
        if (syncKey) {
          // Connect to custom sync key
          connectToKey(syncKey);
        } else {
          // Connect to local network sync automatically
          const localKey = await getLocalNetworkKey();
          connectToKey(localKey, true);
        }
      })();
    }
  }, [isFirebaseReady, firebaseService, syncKey, connectToKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ─── Password verification for custom database ───
  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setPasswordError(false);

    try {
      const hashed = await sha256(creationPassword);
      if (hashed === CREATION_HASH_TARGET) {
        const { doc, setDoc } = await getFirestoreHelpers();
        const docRef = doc(firebaseService.db, 'notes', pendingKey);
        
        const initialNotes = notesStateRef.current.length > 0 
          ? notesStateRef.current 
          : [{ id: `note-${Date.now()}`, title: 'Catatan Baru', content: '', updatedAt: Date.now() }];

        await setDoc(docRef, { notes: initialNotes });

        setShowPasswordPrompt(false);
        setCreationPassword('');
        connectToKey(pendingKey);
      } else {
        setPasswordError(true);
      }
    } catch (err) {
      console.error('Failed to create new sync doc:', err);
    }
  };

  // Disconnect from custom key, falling back to local network sync
  const handleDisconnect = async () => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    localStorage.removeItem('remuk_notepad_key');
    setSyncKey('');
    setIsConnected(false);
    
    // Automatically reconnect to local network room
    const localKey = await getLocalNetworkKey();
    connectToKey(localKey, true);
    setShowSettings(false);
  };

  // ─── Save logic (Local vs Cloud with 3s Debounce) ───
  const triggerSave = useCallback((updatedNotes) => {
    setNotes(updatedNotes);
    
    // Save to localStorage cache for instant launch
    localStorage.setItem('remuk_notepad_local_notes', JSON.stringify(updatedNotes));

    const targetKey = syncKey || localNetKey;

    if (isConnected && targetKey && firebaseService?.db) {
      setSyncStatus('saving');
      
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const { doc, setDoc } = await getFirestoreHelpers();
          const docRef = doc(firebaseService.db, 'notes', targetKey);
          await setDoc(docRef, { notes: updatedNotes });
          setSyncStatus('synced');
        } catch (e) {
          console.error('Failed to autosave to Firestore:', e);
          setSyncStatus('error');
        }
      }, 3000); 
    } else {
      setSyncStatus('local');
    }
  }, [isConnected, syncKey, localNetKey, firebaseService]);

  // ─── Note Actions ───
  const handleAddNote = () => {
    const newNote = {
      id: `note-${Date.now()}`,
      title: 'Catatan Baru',
      content: '',
      updatedAt: Date.now(),
    };
    const updated = [newNote, ...notes];
    setActiveNoteId(newNote.id);
    triggerSave(updated);
  };

  const handleDeleteNote = (id) => {
    const updated = notes.filter((n) => n.id !== id);
    triggerSave(updated);
    if (activeNoteId === id) {
      setActiveNoteId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleUpdateActiveNote = (field, val) => {
    const updated = notes.map((n) => {
      if (n.id === activeNoteId) {
        const title = field === 'title' ? val : n.title;
        const content = field === 'content' ? val : n.content;
        return {
          ...n,
          title: title || 'Tanpa Judul',
          content,
          updatedAt: Date.now(),
        };
      }
      return n;
    });

    const activeIdx = updated.findIndex((n) => n.id === activeNoteId);
    if (activeIdx > 0) {
      const activeObj = updated[activeIdx];
      updated.splice(activeIdx, 1);
      updated.unshift(activeObj);
    }

    triggerSave(updated);
  };

  // Scroll sync line numbers gutter
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const activeNote = notes.find((n) => n.id === activeNoteId);
  const lines = activeNote ? activeNote.content.split('\n') : [];
  const lineNumbers = Array.from({ length: Math.max(1, lines.length) }, (_, i) => i + 1);

  return (
    <div className="np">
      {/* Settings Modal (Cloud Sync Config) */}
      {showSettings && (
        <div className="np-settings-panel" onClick={() => setShowSettings(false)}>
          <div className="np-settings-card glass" onClick={(e) => e.stopPropagation()}>
            <h3>Sinkronisasi Cloud & Jaringan</h3>
            
            {syncKey ? (
              <div className="np-settings-connected">
                <p>Status: <strong>Terhubung ke Database Kustom</strong></p>
                <p>Sync Key: <code className="np-code">{syncKey}</code></p>
                <p className="np-settings-desc">Catatan tersinkronisasi di semua browser menggunakan Sync Key ini.</p>
                <button onClick={handleDisconnect} className="np-btn np-btn--danger">
                  Putuskan Sinkronisasi
                </button>
              </div>
            ) : (
              <div className="np-settings-connected">
                <p>Status: <strong>🟢 Sinkronisasi Jaringan Lokal (Otomatis)</strong></p>
                <p>Room ID: <code className="np-code">{localNetKey || 'Mencari...'}</code></p>
                <p className="np-settings-desc">
                  Catatanmu otomatis tersinkronisasi di semua perangkat pada Wi-Fi/jaringan yang sama tanpa perlu login.
                </p>
              </div>
            )}

            <hr className="np-divider" />

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (inputKey) {
                  connectToKey(inputKey);
                  setInputKey('');
                  setShowSettings(false);
                }
              }}
              className="np-settings-form"
            >
              <label>Gunakan Sync Key Kustom (Beda Jaringan):</label>
              <input
                type="text"
                placeholder="Masukkan Sync Key (misal: rausyani)"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="np-settings-input"
              />
              <div className="np-btn-row">
                <button type="submit" className="np-btn np-btn--accent" disabled={!inputKey}>Hubungkan</button>
                <button type="button" onClick={() => setShowSettings(false)} className="np-btn np-btn--ghost">Tutup</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password prompt for new document creation */}
      {showPasswordPrompt && (
        <div className="np-settings-panel">
          <div className="np-settings-card glass">
            <h3>Database Baru Terdeteksi</h3>
            <p>Sync Key <strong>"{pendingKey}"</strong> belum terdaftar. Masukkan password admin untuk membuat database baru ini.</p>
            
            <form onSubmit={handleVerifyPassword} className="np-settings-form">
              <input
                type="password"
                placeholder="Password Pembuat"
                value={creationPassword}
                onChange={(e) => setCreationPassword(e.target.value)}
                className={`np-settings-input ${passwordError ? 'np-settings-input--error' : ''}`}
                autoFocus
              />
              {passwordError && <p className="np-error-text">Password salah!</p>}
              <div className="np-btn-row">
                <button type="submit" className="np-btn np-btn--accent">Buat</button>
                <button type="button" onClick={() => setShowPasswordPrompt(false)} className="np-btn np-btn--ghost">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar List */}
      <div className={`np-sidebar ${isSidebarOpen ? 'np-sidebar--open' : ''}`}>
        <div className="np-sidebar__header">
          <button className="np-btn np-btn--ghost" onClick={() => setShowSettings(true)} title="Sinkronisasi Cloud">
            {syncKey ? (
              <span className="np-status-icon">🟢 Terhubung</span>
            ) : (
              <span className="np-status-icon">📶 Jaringan Lokal</span>
            )}
          </button>
          <button className="np-btn np-btn--accent" onClick={handleAddNote}>
            + Catatan
          </button>
        </div>

        <div className="np-notes-list">
          {notes.map((n) => (
            <div
              key={n.id}
              className={`np-note-item ${activeNoteId === n.id ? 'np-note-item--active' : ''}`}
              onClick={() => {
                setActiveNoteId(n.id);
                setIsSidebarOpen(false); // Close sidebar on mobile
              }}
            >
              <div className="np-note-item__header">
                <h4 className="np-note-item__title">{n.title || 'Tanpa Judul'}</h4>
                <button 
                  className="np-note-item__delete" 
                  onClick={(e) => { e.stopPropagation(); handleDeleteNote(n.id); }}
                  title="Hapus"
                >
                  ×
                </button>
              </div>
              <p className="np-note-item__snippet">
                {n.content ? n.content.slice(0, 30) + (n.content.length > 30 ? '...' : '') : 'Tidak ada konten'}
              </p>
              <span className="np-note-item__date">
                {new Date(n.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {notes.length === 0 && (
            <div className="np-empty-state">
              <span>📒</span>
              <p>Belum ada catatan</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor Panel (Notepad++ styled editor layout) */}
      <div className="np-editor np-editor--npp">
        {activeNote ? (
          <>
            {/* Notepad++ Document Tab bar */}
            <div className="npp-tabs">
              <button 
                className="npp-sidebar-toggle"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title="Daftar Catatan"
              >
                ☰
              </button>
              <div className="npp-tab npp-tab--active">
                <span className="npp-tab__icon">📝</span>
                <input
                  type="text"
                  value={activeNote.title === 'Tanpa Judul' ? '' : activeNote.title}
                  onChange={(e) => handleUpdateActiveNote('title', e.target.value)}
                  placeholder="new 1"
                  className="npp-tab__input"
                />
              </div>
              
              {/* Quick actions for mobile */}
              <div className="npp-quick-actions">
                <button className="npp-quick-btn" onClick={handleAddNote} title="Buat Catatan Baru">
                  ➕
                </button>
                <button className="npp-quick-btn" onClick={() => setShowSettings(true)} title="Sinkronisasi Cloud">
                  {syncKey ? '🟢' : '📶'}
                </button>
              </div>
            </div>

            {/* Notepad++ Text Editor Gutter and Area Container */}
            <div className="npp-container">
              {/* Line Numbers Gutter */}
              <div ref={lineNumbersRef} className="npp-gutter">
                {lineNumbers.map((num) => (
                  <div key={num} className="npp-line-num">
                    {num}
                  </div>
                ))}
              </div>

              {/* Textarea Code area */}
              <textarea
                ref={textareaRef}
                value={activeNote.content}
                onChange={(e) => handleUpdateActiveNote('content', e.target.value)}
                onScroll={handleScroll}
                placeholder="Mulai menulis..."
                className="npp-textarea"
                spellCheck={false}
              />
            </div>

            {/* Notepad++ status bar at bottom */}
            <div className="npp-statusbar">
              <span>Length: {activeNote.content.length} | Lines: {lines.length}</span>
              <span>Ln: {lines.length} | Col: {activeNote.content.length + 1}</span>
              <span>UTF-8</span>
              <span>Windows (CRLF)</span>
            </div>
          </>
        ) : (
          <div className="np-editor-empty">
            <span>📝</span>
            <p>Pilih catatan di panel samping atau buat catatan baru</p>
            
            <div className="np-empty-actions">
              <button className="np-btn np-btn--accent" onClick={handleAddNote}>
                + Catatan Baru
              </button>
              <button className="np-btn np-btn--ghost" onClick={() => setShowSettings(true)}>
                ⚙️ Pengaturan Sync
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notepad;
