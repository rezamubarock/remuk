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
  const { isReady: isFirebaseReady, service: firebaseService, error: firebaseError } = useService('firebase-firestore');

  // ─── Component states ───
  const [syncKey, setSyncKey] = useState(() => localStorage.getItem('remuk_notepad_key') || '');
  const [isConnected, setIsConnected] = useState(false);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  
  // Settings & forms
  const [inputKey, setInputKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState('local'); // 'local' | 'synced' | 'saving' | 'error'
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [creationPassword, setCreationPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [pendingKey, setPendingKey] = useState('');

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

  // ─── Firestore listener setup ───
  const connectToKey = useCallback(async (key) => {
    if (!firebaseService?.db) {
      alert("Firebase belum terinisialisasi. Pastikan kamu sudah merestart server Vite setelah membuat file .env.local agar kredensial baru terbaca!");
      return;
    }
    setSyncStatus('saving');

    try {
      const { doc, getDoc, onSnapshot } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', key);
      const docSnap = await getDoc(docRef);

      // If document doesn't exist, we must prompt for creation password
      if (!docSnap.exists()) {
        setPendingKey(key);
        setShowPasswordPrompt(true);
        setSyncStatus('local');
        return;
      }

      // Document exists: set active key and subscribe
      if (unsubscribeRef.current) unsubscribeRef.current();

      unsubscribeRef.current = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const remoteNotes = data.notes || [];
          setNotes(remoteNotes);
          setSyncStatus('synced');
          setIsConnected(true);
          localStorage.setItem('remuk_notepad_key', key);
          setSyncKey(key);

          // Update active note id if needed
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

  // ─── Auto connect on mount ───
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const syncParam = params.get('sync');
    const targetKey = syncParam || syncKey;

    if (targetKey && isFirebaseReady && firebaseService?.db) {
      connectToKey(targetKey);
      if (syncParam) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [isFirebaseReady, firebaseService, syncKey, connectToKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ─── Password verification for new database ───
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

  // ─── Save logic (Local vs Cloud with 3s Debounce) ───
  const triggerSave = useCallback((updatedNotes) => {
    setNotes(updatedNotes);

    if (isConnected && syncKey && firebaseService?.db) {
      setSyncStatus('saving');
      
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const { doc, setDoc } = await getFirestoreHelpers();
          const docRef = doc(firebaseService.db, 'notes', syncKey);
          await setDoc(docRef, { notes: updatedNotes });
          setSyncStatus('synced');
        } catch (e) {
          console.error('Failed to autosave to Firestore:', e);
          setSyncStatus('error');
        }
      }, 3000); 
    } else {
      localStorage.setItem('remuk_notepad_local_notes', JSON.stringify(updatedNotes));
      setSyncStatus('local');
    }
  }, [isConnected, syncKey, firebaseService]);

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

  const disconnect = () => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    setIsConnected(false);
    setSyncKey('');
    localStorage.removeItem('remuk_notepad_key');
    setSyncStatus('local');
    const local = localStorage.getItem('remuk_notepad_local_notes');
    if (local) {
      setNotes(JSON.parse(local));
    }
  };

  const getSyncLink = () => {
    return `${window.location.origin}/?open=notepad&sync=${syncKey}`;
  };

  const activeNote = notes.find((n) => n.id === activeNoteId);

  // Scroll synchronization between line numbers gutter and textarea
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Generate line numbers matching textarea line counts
  const lines = activeNote?.content ? activeNote.content.split('\n') : [''];
  const lineNumbers = Array.from({ length: Math.max(lines.length, 1) }, (_, i) => i + 1);

  return (
    <div className="np">
      {/* Settings / Sync Panel Overlay */}
      {showSettings && (
        <div className="np-settings-panel">
          <div className="np-settings-card glass">
            <h3>Pengaturan Sinkronisasi</h3>
            
            {firebaseError && (
              <div className="np-error-box">
                <strong>Error Firebase:</strong> {firebaseError.message || "Gagal memuat provider database. Restart dev server."}
              </div>
            )}

            {isConnected ? (
              <div className="np-settings-connected">
                <p>Terkoneksi dengan Sync Key:</p>
                <div className="np-settings-key-badge">{syncKey}</div>
                <div className="np-settings-link-wrapper">
                  <input type="text" readOnly value={getSyncLink()} className="np-settings-link" />
                  <button 
                    onClick={() => navigator.clipboard.writeText(getSyncLink())}
                    className="np-btn np-btn--accent"
                  >
                    Salin Link
                  </button>
                </div>
                <button onClick={disconnect} className="np-btn np-btn--danger">Putuskan Koneksi</button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); connectToKey(inputKey); }} className="np-settings-form">
                <p>Masukkan Sync Key untuk menyelaraskan catatan:</p>
                <input
                  type="text"
                  placeholder="Contoh: catatan-reza"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="np-settings-input"
                />
                <button type="submit" className="np-btn np-btn--accent" disabled={!inputKey}>
                  Hubungkan
                </button>
              </form>
            )}

            <button onClick={() => setShowSettings(false)} className="np-settings-close-btn">Tutup</button>
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
      <div className="np-sidebar">
        <div className="np-sidebar__header">
          <button className="np-btn np-btn--ghost" onClick={() => setShowSettings(true)} title="Sinkronisasi Cloud">
            {syncStatus === 'local' && <span className="np-status-icon">☁️ Offline</span>}
            {syncStatus === 'synced' && <span className="np-status-icon">🟢 Terhubung</span>}
            {syncStatus === 'saving' && <span className="np-status-icon np-status-icon--spin">🔄 Menyimpan</span>}
            {syncStatus === 'error' && <span className="np-status-icon">🔴 Error</span>}
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
              onClick={() => setActiveNoteId(n.id)}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default Notepad;
