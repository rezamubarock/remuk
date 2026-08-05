import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useService } from '@core/hooks/useService';
import './table-notepad.css';

// SHA-256 of "rausyani"
const CREATION_HASH_TARGET = '1800cee37bd1f9d84755f2c0ffa7c75a4b5a12279687d88b0b33330e0a8976d8';

const sha256 = async (string) => {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

// Helper function to generate default table structure (cells array inside row object)
const createDefaultTable = () => ({
  id: `tbl-${Date.now()}`,
  title: 'Tabel 1',
  columns: ['Kolom A', 'Kolom B', 'Kolom C'],
  rows: [
    { id: `r-${Date.now()}-1`, cells: ['', '', ''] },
    { id: `r-${Date.now()}-2`, cells: ['', '', ''] },
    { id: `r-${Date.now()}-3`, cells: ['', '', ''] },
  ],
  updatedAt: Date.now(),
});

// Helper to normalize table data to avoid Firestore 2D nested array error
const normalizeTables = (rawTables) => {
  if (!Array.isArray(rawTables) || rawTables.length === 0) {
    return [createDefaultTable()];
  }
  return rawTables.map((t, tIdx) => {
    const cols = Array.isArray(t.columns) && t.columns.length > 0 ? t.columns : ['Kolom A', 'Kolom B', 'Kolom C'];
    const rawRows = Array.isArray(t.rows) ? t.rows : [];
    const normalizedRows = rawRows.map((r, rIdx) => {
      if (Array.isArray(r)) {
        // Convert legacy 2D array element to row object
        return {
          id: `r-${rIdx}-${Date.now()}`,
          cells: cols.map((_, cIdx) => (r[cIdx] == null ? '' : String(r[cIdx]))),
        };
      }
      if (r && typeof r === 'object' && Array.isArray(r.cells)) {
        return {
          id: r.id || `r-${rIdx}-${Date.now()}`,
          cells: cols.map((_, cIdx) => (r.cells[cIdx] == null ? '' : String(r.cells[cIdx]))),
        };
      }
      return {
        id: `r-${rIdx}-${Date.now()}`,
        cells: new Array(cols.length).fill(''),
      };
    });

    return {
      id: t.id || `tbl-${tIdx}-${Date.now()}`,
      title: t.title || `Tabel ${tIdx + 1}`,
      columns: cols,
      rows: normalizedRows.length > 0 ? normalizedRows : [{ id: `r-0-${Date.now()}`, cells: new Array(cols.length).fill('') }],
      updatedAt: t.updatedAt || Date.now(),
    };
  });
};

const TableNotepad = () => {
  // ─── Firebase hook ───
  const { isReady: isFirebaseReady, service: firebaseService } = useService('firebase-firestore');

  // ─── Component states ───
  const [syncKey, setSyncKey] = useState(() => localStorage.getItem('remuk_table_notepad_key') || '');
  const [isConnected, setIsConnected] = useState(false);
  const [tables, setTables] = useState([]);
  const [activeTableId, setActiveTableId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Settings & forms
  const [inputKey, setInputKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState('local'); // 'local' | 'synced' | 'saving' | 'error'
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [creationPassword, setCreationPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingKey, setPendingKey] = useState('');

  // Local IP-based network sync key
  const [localNetKey, setLocalNetKey] = useState('');

  // File import ref
  const fileInputRef = useRef(null);

  // Refs for tracking active listeners and debounce timers
  const unsubscribeRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const tablesStateRef = useRef([]);

  useEffect(() => {
    tablesStateRef.current = tables;
  }, [tables]);

  // ─── Load Local Tables initially ───
  useEffect(() => {
    const local = localStorage.getItem('remuk_table_notepad_local_tables');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        const normalized = normalizeTables(parsed);
        setTables(normalized);
        if (normalized.length > 0) {
          setActiveTableId(normalized[0].id);
        }
      } catch (e) {
        console.error('Failed to parse local table notes', e);
        const initial = [createDefaultTable()];
        setTables(initial);
        setActiveTableId(initial[0].id);
      }
    } else {
      const initial = [createDefaultTable()];
      setTables(initial);
      setActiveTableId(initial[0].id);
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
        return `tbl_local_${ipHash.substring(0, 16)}`;
      }
    } catch (e) {
      // fallback
    }
    try {
      const res = await fetch('https://api64.ipify.org?format=json');
      const data = await res.json();
      if (data.ip) {
        const ipHash = await sha256(data.ip);
        return `tbl_local_${ipHash.substring(0, 16)}`;
      }
    } catch (e) {
      // fallback
    }
    return 'tbl_local_network_fallback';
  };

  // Helper to ensure target collection is always 'notes'
  const getDocRef = useCallback((db, doc, key) => {
    const docKey = key.startsWith('tbl_') ? key : `tbl_${key}`;
    return doc(db, 'notes', docKey);
  }, []);

  // ─── Firestore listener setup ───
  const connectToKey = useCallback(async (key, isAutoLocal = false) => {
    if (!firebaseService?.db) return;
    setSyncStatus('saving');

    try {
      const { doc, getDoc, setDoc, onSnapshot } = await getFirestoreHelpers();
      const docRef = getDocRef(firebaseService.db, doc, key);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        if (isAutoLocal || key.startsWith('tbl_local_') || key.startsWith('local_')) {
          const initialTables = normalizeTables(tablesStateRef.current);
          await setDoc(docRef, { tables: initialTables });
        } else {
          setPendingKey(key);
          setShowPasswordPrompt(true);
          setSyncStatus('local');
          return;
        }
      } else {
        const data = docSnap.data();
        const remoteTables = normalizeTables(data.tables);
        if (remoteTables.length === 0 && tablesStateRef.current.length > 0 && (isAutoLocal || key.startsWith('tbl_local_') || key.startsWith('local_'))) {
          await setDoc(docRef, { tables: normalizeTables(tablesStateRef.current) });
        }
      }

      if (unsubscribeRef.current) unsubscribeRef.current();

      unsubscribeRef.current = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const remoteTables = normalizeTables(data.tables);
          setTables(remoteTables);
          setSyncStatus('synced');
          setIsConnected(true);

          if (!isAutoLocal) {
            localStorage.setItem('remuk_table_notepad_key', key);
            setSyncKey(key);
          } else {
            setLocalNetKey(key);
          }

          if (remoteTables.length > 0) {
            setActiveTableId((prevId) =>
              remoteTables.some((t) => t.id === prevId) ? prevId : remoteTables[0].id
            );
          } else {
            setActiveTableId(null);
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
  }, [firebaseService, getDocRef]);

  // ─── Auto connect / local sync key setup ───
  useEffect(() => {
    if (isFirebaseReady && firebaseService?.db) {
      (async () => {
        if (syncKey) {
          connectToKey(syncKey);
        } else {
          const localKey = await getLocalNetworkKey();
          connectToKey(localKey, true);
        }
      })();
    }
  }, [isFirebaseReady, firebaseService, syncKey, connectToKey]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ─── Password verification for custom database ───
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (!creationPassword || isVerifying) return;
    setIsVerifying(true);
    setPasswordError('');

    try {
      const trimmed = creationPassword.trim().toLowerCase();
      const hashed = await sha256(trimmed);
      if (hashed === CREATION_HASH_TARGET) {
        if (!firebaseService?.db) {
          setPasswordError('Layanan database belum terhubung. Periksa koneksi internet.');
          return;
        }

        const { doc, setDoc } = await getFirestoreHelpers();
        const docRef = getDocRef(firebaseService.db, doc, pendingKey);

        const initialTables = normalizeTables(tablesStateRef.current);

        await setDoc(docRef, { tables: initialTables });

        setShowPasswordPrompt(false);
        setCreationPassword('');
        connectToKey(pendingKey);
      } else {
        setPasswordError('Password salah!');
      }
    } catch (err) {
      console.error('Failed to create new sync doc:', err);
      setPasswordError(err.message || 'Gagal membuat database baru.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    localStorage.removeItem('remuk_table_notepad_key');
    setSyncKey('');
    setIsConnected(false);

    const localKey = await getLocalNetworkKey();
    connectToKey(localKey, true);
    setShowSettings(false);
  };

  // ─── Save logic (Local vs Cloud with 3s Debounce) ───
  const triggerSave = useCallback((updatedTables) => {
    const normalized = normalizeTables(updatedTables);
    setTables(normalized);
    localStorage.setItem('remuk_table_notepad_local_tables', JSON.stringify(normalized));

    const targetKey = syncKey || localNetKey;

    if (isConnected && targetKey && firebaseService?.db) {
      setSyncStatus('saving');

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const { doc, setDoc } = await getFirestoreHelpers();
          const docRef = getDocRef(firebaseService.db, doc, targetKey);
          await setDoc(docRef, { tables: normalized });
          setSyncStatus('synced');
        } catch (e) {
          console.error('Failed to autosave to Firestore:', e);
          setSyncStatus('error');
        }
      }, 3000);
    } else {
      setSyncStatus('local');
    }
  }, [isConnected, syncKey, localNetKey, firebaseService, getDocRef]);

  // ─── Table Actions ───
  const handleAddTable = () => {
    const newTable = {
      id: `tbl-${Date.now()}`,
      title: `Tabel ${tables.length + 1}`,
      columns: ['Kolom A', 'Kolom B', 'Kolom C'],
      rows: [
        { id: `r-${Date.now()}-1`, cells: ['', '', ''] },
        { id: `r-${Date.now()}-2`, cells: ['', '', ''] },
      ],
      updatedAt: Date.now(),
    };
    const updated = [newTable, ...tables];
    setActiveTableId(newTable.id);
    triggerSave(updated);
  };

  const handleDeleteTable = (id) => {
    const updated = tables.filter((t) => t.id !== id);
    triggerSave(updated);
    if (activeTableId === id) {
      setActiveTableId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const activeTable = tables.find((t) => t.id === activeTableId);

  // ─── Grid Manipulations ───
  const updateActiveTable = (updater) => {
    if (!activeTable) return;
    const updatedTables = tables.map((t) => {
      if (t.id === activeTableId) {
        return updater(t);
      }
      return t;
    });
    triggerSave(updatedTables);
  };

  const handleUpdateTitle = (newTitle) => {
    updateActiveTable((t) => ({ ...t, title: newTitle || 'Tanpa Judul', updatedAt: Date.now() }));
  };

  const handleAddRow = () => {
    updateActiveTable((t) => {
      const newRow = { id: `r-${Date.now()}-${Math.random()}`, cells: new Array(t.columns.length).fill('') };
      return { ...t, rows: [...t.rows, newRow], updatedAt: Date.now() };
    });
  };

  const handleDeleteRow = (rowIndex) => {
    updateActiveTable((t) => {
      const newRows = t.rows.filter((_, idx) => idx !== rowIndex);
      return { ...t, rows: newRows, updatedAt: Date.now() };
    });
  };

  const handleAddColumn = () => {
    updateActiveTable((t) => {
      const colLetter = String.fromCharCode(65 + (t.columns.length % 26));
      const colName = `Kolom ${colLetter}`;
      const newCols = [...t.columns, colName];
      const newRows = t.rows.map((row) => ({ ...row, cells: [...row.cells, ''] }));
      return { ...t, columns: newCols, rows: newRows, updatedAt: Date.now() };
    });
  };

  const handleDeleteColumn = (colIndex) => {
    updateActiveTable((t) => {
      if (t.columns.length <= 1) return t; // prevent deleting last column
      const newCols = t.columns.filter((_, idx) => idx !== colIndex);
      const newRows = t.rows.map((row) => ({
        ...row,
        cells: row.cells.filter((_, idx) => idx !== colIndex),
      }));
      return { ...t, columns: newCols, rows: newRows, updatedAt: Date.now() };
    });
  };

  const handleUpdateColumnHeader = (colIndex, val) => {
    updateActiveTable((t) => {
      const newCols = [...t.columns];
      newCols[colIndex] = val;
      return { ...t, columns: newCols, updatedAt: Date.now() };
    });
  };

  const handleUpdateCell = (rowIndex, colIndex, val) => {
    updateActiveTable((t) => {
      const newRows = t.rows.map((row, rIdx) => {
        if (rIdx === rowIndex) {
          const updatedCells = [...row.cells];
          updatedCells[colIndex] = val;
          return { ...row, cells: updatedCells };
        }
        return row;
      });
      return { ...t, rows: newRows, updatedAt: Date.now() };
    });
  };

  // Keyboard navigation between cells
  const handleKeyDown = (e, rIdx, cIdx) => {
    if (!activeTable) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.querySelector(`input[data-cell="${rIdx + 1}-${cIdx}"]`);
      if (nextInput) {
        nextInput.focus();
      } else {
        handleAddRow();
        setTimeout(() => {
          const newlyCreatedInput = document.querySelector(`input[data-cell="${rIdx + 1}-${cIdx}"]`);
          if (newlyCreatedInput) newlyCreatedInput.focus();
        }, 50);
      }
    } else if (e.key === 'Tab') {
      if (!e.shiftKey && cIdx === activeTable.columns.length - 1) {
        e.preventDefault();
        const nextRowInput = document.querySelector(`input[data-cell="${rIdx + 1}-0"]`);
        if (nextRowInput) nextRowInput.focus();
      }
    }
  };

  // ─── Import / Export CSV ───
  const handleExportCSV = () => {
    if (!activeTable) return;
    const headerRow = activeTable.columns.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(',');
    const bodyRows = activeTable.rows.map((r) =>
      (r.cells || []).map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headerRow, ...bodyRows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeTable.title || 'tabel'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r\n|\n/).filter((l) => l.trim() !== '');

      if (lines.length > 0) {
        const parseLine = (line) => {
          return line.split(',').map((item) => item.replace(/^"(.*)"$/, '$1').trim());
        };

        const columns = parseLine(lines[0]);
        const rows = lines.slice(1).map((line, rIdx) => {
          const parsed = parseLine(line);
          while (parsed.length < columns.length) parsed.push('');
          return {
            id: `r-${Date.now()}-${rIdx}`,
            cells: parsed.slice(0, columns.length),
          };
        });

        const newTable = {
          id: `tbl-${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          columns: columns.length > 0 ? columns : ['Kolom A'],
          rows: rows.length > 0 ? rows : [{ id: `r-0-${Date.now()}`, cells: new Array(columns.length || 1).fill('') }],
          updatedAt: Date.now(),
        };

        const updated = [newTable, ...tables];
        setActiveTableId(newTable.id);
        triggerSave(updated);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="tnp">
      {/* Settings Modal (Cloud Sync Config) */}
      {showSettings && (
        <div className="tnp-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="tnp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Sinkronisasi Cloud & Jaringan (Tabel)</h3>

            {syncKey ? (
              <div>
                <p>Status: <strong>🟢 Terhubung ke Database Kustom</strong></p>
                <p>Sync Key: <code className="tnp-code">{syncKey}</code></p>
                <p className="tnp-settings-desc">Tabel tersinkronisasi di semua browser menggunakan Sync Key ini.</p>
                <button onClick={handleDisconnect} className="tnp-btn tnp-btn--danger" style={{ marginTop: 10 }}>
                  Putuskan Sinkronisasi
                </button>
              </div>
            ) : (
              <div>
                <p>Status: <strong>📶 Sinkronisasi Jaringan Lokal (Otomatis)</strong></p>
                <p>Room ID: <code className="tnp-code">{localNetKey || 'Mencari...'}</code></p>
                <p className="tnp-settings-desc">
                  Tabel otomatis tersinkron di semua perangkat pada Wi-Fi/jaringan yang sama secara otomatis.
                </p>
              </div>
            )}

            <hr style={{ borderColor: 'var(--border-subtle, rgba(255,255,255,0.1))', margin: '4px 0' }} />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputKey) {
                  connectToKey(inputKey);
                  setInputKey('');
                  setShowSettings(false);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                Gunakan Sync Key Kustom (Beda Jaringan):
              </label>
              <input
                type="text"
                placeholder="Masukkan Sync Key (misal: data-proyek)"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="tnp-modal-input"
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="submit" className="tnp-btn tnp-btn--accent" disabled={!inputKey}>Hubungkan</button>
                <button type="button" onClick={() => setShowSettings(false)} className="tnp-btn tnp-btn--ghost">Tutup</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password prompt for new document creation */}
      {showPasswordPrompt && (
        <div className="tnp-modal-overlay">
          <div className="tnp-modal-card">
            <h3>Database Baru Terdeteksi</h3>
            <p>Sync Key <strong>"{pendingKey}"</strong> belum terdaftar. Masukkan password admin untuk membuat room baru.</p>

            <form onSubmit={handleVerifyPassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="password"
                placeholder="Password Pembuat"
                value={creationPassword}
                onChange={(e) => setCreationPassword(e.target.value)}
                className={`tnp-modal-input ${passwordError ? 'tnp-modal-input--error' : ''}`}
                autoFocus
              />
              {passwordError && <p className="tnp-error-text">{passwordError}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="submit" className="tnp-btn tnp-btn--accent" disabled={isVerifying || !creationPassword}>
                  {isVerifying ? '⏳ Memproses...' : 'Buat'}
                </button>
                <button type="button" onClick={() => setShowPasswordPrompt(false)} className="tnp-btn tnp-btn--ghost">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar List */}
      <div className={`tnp-sidebar ${isSidebarOpen ? 'tnp-sidebar--open' : ''}`}>
        <div className="tnp-sidebar__header">
          <div className="tnp-sidebar__actions">
            <button className="tnp-btn tnp-btn--ghost tnp-btn--sm" onClick={() => setShowSettings(true)} title="Pengaturan Sync Database">
              {syncKey ? '🟢 Sync' : '📶 Lokal'}
            </button>
            <button className="tnp-btn tnp-btn--success tnp-btn--sm" onClick={handleAddTable}>
              + Tabel
            </button>
          </div>
        </div>

        <div className="tnp-tables-list">
          {tables.map((t) => (
            <div
              key={t.id}
              className={`tnp-table-item ${activeTableId === t.id ? 'tnp-table-item--active' : ''}`}
              onClick={() => {
                setActiveTableId(t.id);
                setIsSidebarOpen(false);
              }}
            >
              <div className="tnp-table-item__header">
                <h4 className="tnp-table-item__title">📊 {t.title || 'Tanpa Judul'}</h4>
                <button
                  className="tnp-table-item__delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTable(t.id);
                  }}
                  title="Hapus Tabel"
                >
                  ×
                </button>
              </div>
              <span className="tnp-table-item__info">
                {t.rows?.length || 0} Baris × {t.columns?.length || 0} Kolom
              </span>
            </div>
          ))}
          {tables.length === 0 && (
            <div className="tnp-empty">
              <span>📊</span>
              <p>Belum ada tabel</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid Editor */}
      <div className="tnp-main">
        {activeTable ? (
          <>
            {/* Toolbar */}
            <div className="tnp-toolbar">
              <div className="tnp-toolbar__left">
                <button
                  className="tnp-sidebar-toggle"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  title="Daftar Tabel"
                >
                  ☰
                </button>
                <button
                  className="tnp-btn tnp-btn--ghost tnp-btn--sm tnp-sync-quick-btn"
                  onClick={() => setShowSettings(true)}
                  title="Koneksi Database / Sync"
                >
                  {syncKey ? '🟢 Sync' : '📶 Sync'}
                </button>
                <input
                  type="text"
                  value={activeTable.title}
                  onChange={(e) => handleUpdateTitle(e.target.value)}
                  placeholder="Nama Tabel"
                  className="tnp-title-input"
                />
              </div>

              <div className="tnp-toolbar__center">
                <input
                  type="text"
                  placeholder="🔍 Cari sel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="tnp-search-input"
                />
              </div>

              <div className="tnp-toolbar__right">
                <button className="tnp-btn tnp-btn--ghost tnp-btn--sm" onClick={handleAddRow} title="Tambah Baris Baru">
                  + Baris
                </button>
                <button className="tnp-btn tnp-btn--ghost tnp-btn--sm" onClick={handleAddColumn} title="Tambah Kolom Baru">
                  + Kolom
                </button>
                <button className="tnp-btn tnp-btn--ghost tnp-btn--sm" onClick={handleExportCSV} title="Ekspor ke CSV">
                  📥 CSV
                </button>
                <button
                  className="tnp-btn tnp-btn--ghost tnp-btn--sm"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  title="Impor CSV"
                >
                  📤 Impor
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Grid Scroll Container */}
            <div className="tnp-grid-container">
              <table className="tnp-table">
                <thead>
                  <tr>
                    <th className="tnp-th tnp-th--index">#</th>
                    {activeTable.columns.map((colName, cIdx) => (
                      <th key={cIdx} className="tnp-th">
                        <div className="tnp-th-content">
                          <input
                            type="text"
                            value={colName}
                            onChange={(e) => handleUpdateColumnHeader(cIdx, e.target.value)}
                            className="tnp-col-input"
                          />
                          {activeTable.columns.length > 1 && (
                            <button
                              className="tnp-col-delete"
                              onClick={() => handleDeleteColumn(cIdx)}
                              title="Hapus Kolom Ini"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(activeTable.rows || []).map((rowObj, rIdx) => (
                    <tr key={rowObj.id || rIdx} className="tnp-tr">
                      <td className="tnp-td tnp-td--index">
                        <button
                          className="tnp-row-delete"
                          onClick={() => handleDeleteRow(rIdx)}
                          title="Hapus Baris Ini"
                        >
                          ✕
                        </button>
                        <span>{rIdx + 1}</span>
                      </td>
                      {(rowObj.cells || []).map((cellValue, cIdx) => {
                        const isMatch =
                          searchQuery.trim() !== '' &&
                          (cellValue || '').toLowerCase().includes(searchQuery.toLowerCase());

                        return (
                          <td key={cIdx} className="tnp-td">
                            <input
                              type="text"
                              data-cell={`${rIdx}-${cIdx}`}
                              value={cellValue || ''}
                              onChange={(e) => handleUpdateCell(rIdx, cIdx, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                              className={`tnp-cell-input ${isMatch ? 'tnp-cell-input--highlight' : ''}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Status bar */}
            <div className="tnp-statusbar">
              <div>
                Total: {activeTable.rows?.length || 0} Baris, {activeTable.columns?.length || 0} Kolom
              </div>
              <div>
                Status Sync:{' '}
                {syncStatus === 'synced' && <span className="tnp-status-badge tnp-status-badge--synced">🟢 Tersimpan</span>}
                {syncStatus === 'saving' && <span className="tnp-status-badge tnp-status-badge--saving">⏳ Menyimpan...</span>}
                {syncStatus === 'local' && <span className="tnp-status-badge tnp-status-badge--local">💾 Lokal</span>}
                {syncStatus === 'error' && <span className="tnp-status-badge" style={{ background: 'rgba(255,69,58,0.2)', color: '#ff453a' }}>⚠️ Error</span>}
              </div>
            </div>
          </>
        ) : (
          <div className="tnp-empty">
            <span className="tnp-empty__icon">📊</span>
            <p>Pilih tabel atau buat tabel baru</p>
            <button className="tnp-btn tnp-btn--success" onClick={handleAddTable}>
              + Buat Tabel Baru
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableNotepad;
