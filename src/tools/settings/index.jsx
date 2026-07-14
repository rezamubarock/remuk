import React, { useState } from 'react';
import { useStore } from '@core/store';
import { useService } from '@core/hooks/useService';
import { TOOLS } from '@core/registry';
import './settings.css';

const HASH_TARGET = 'c698768cef456a29cfb3ae70494c984f293522f2f48620b461d2a156f2d5bb88'; // SHA-256 of "111111Aa"

const sha256 = async (string) => {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const SettingsTool = () => {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState('ready'); // 'ready' | 'syncing' | 'error'

  const { appPlacements, updateAppPlacement, appOrder, setAppOrder } = useStore();
  const { service: firebaseService } = useService('firebase-firestore');

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError(false);

    try {
      const hashed = await sha256(password);
      if (hashed === HASH_TARGET) {
        setUnlocked(true);
      } else {
        setError(true);
        setPassword('');
      }
    } catch (err) {
      console.error('[Settings] Hashing error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPlacement = (toolId) => {
    return appPlacements[toolId] || { dock: true, desktop: true, drawer: true };
  };

  const handleToggle = async (toolId, type, currentVal) => {
    const currentPlacements = { ...appPlacements };
    const currentToolPlacement = currentPlacements[toolId] || { dock: true, desktop: true, drawer: true };
    const updatedToolPlacement = { ...currentToolPlacement, [type]: !currentVal };
    const updatedPlacements = { ...currentPlacements, [toolId]: updatedToolPlacement };

    updateAppPlacement(toolId, { [type]: !currentVal });

    // Save both placements and order
    if (firebaseService?.db) {
      setCloudSyncStatus('syncing');
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const docRef = doc(firebaseService.db, 'notes', 'settings_placements');
        
        let currentOrder = [...appOrder];
        if (currentOrder.length === 0) {
          currentOrder = TOOLS.map((t) => t.id);
        }

        await setDoc(docRef, { placements: updatedPlacements, order: currentOrder });
        setCloudSyncStatus('ready');
      } catch (err) {
        console.error('Failed to save placements in Firestore:', err);
        setCloudSyncStatus('error');
      }
    }
  };

  const handleMove = async (toolId, direction) => {
    let currentOrder = [...appOrder];
    if (currentOrder.length === 0) {
      currentOrder = TOOLS.map((t) => t.id);
    }

    const index = currentOrder.indexOf(toolId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;

    // Swap items in order list
    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[newIndex];
    currentOrder[newIndex] = temp;

    setAppOrder(currentOrder);

    // Write to Firestore settings_placements
    if (firebaseService?.db) {
      setCloudSyncStatus('syncing');
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const docRef = doc(firebaseService.db, 'notes', 'settings_placements');
        
        const currentPlacements = { ...appPlacements };

        await setDoc(docRef, { placements: currentPlacements, order: currentOrder });
        setCloudSyncStatus('ready');
      } catch (err) {
        console.error('Failed to save placements & order in Firestore:', err);
        setCloudSyncStatus('error');
      }
    }
  };

  // Sort tools list in UI based on current order list
  const sortedTools = [...TOOLS].sort((a, b) => {
    const idxA = appOrder.indexOf(a.id);
    const idxB = appOrder.indexOf(b.id);
    const posA = idxA === -1 ? 999 : idxA;
    const posB = idxB === -1 ? 999 : idxB;
    return posA - posB;
  });

  if (!unlocked) {
    return (
      <div className="st-lock">
        <div className="st-lock__card">
          <span className="st-lock__icon">🔒</span>
          <h3>Kustomisasi Terkunci</h3>
          <p>Masukkan kata sandi kustomisasi untuk mengonfigurasi peletakan shortcut aplikasi.</p>
          
          <form onSubmit={handleUnlock} className="st-lock__form">
            <input
              type="password"
              placeholder="Kata Sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`st-lock__input ${error ? 'st-lock__input--error' : ''}`}
              autoFocus
              disabled={loading}
            />
            {error && <p className="st-lock__error-text">Kata sandi salah!</p>}
            <button type="submit" className="st-lock__btn" disabled={loading || !password}>
              {loading ? 'Memverifikasi...' : 'Buka Kunci'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="st">
      <div className="st-header">
        <div className="st-header__row">
          <div>
            <h3>Kustomisasi Tata Letak Aplikasi</h3>
            <p>Atur di mana ikon shortcut aplikasi akan ditampilkan secara global.</p>
          </div>
          <div className="st-cloud-status">
            {cloudSyncStatus === 'syncing' && <span className="st-status st-status--syncing">🔄 Sinkronisasi cloud...</span>}
            {cloudSyncStatus === 'ready' && <span className="st-status st-status--ready">🟢 Tersimpan di Cloud (remuk.id)</span>}
            {cloudSyncStatus === 'error' && <span className="st-status st-status--error">🔴 Gagal simpan ke cloud</span>}
          </div>
        </div>
      </div>

      <div className="st-content">
        <table className="st-table">
          <thead>
            <tr>
              <th>Aplikasi & Urutan</th>
              <th>Dock</th>
              <th>Desktop/Layar Utama</th>
              <th>Laci/Launchpad</th>
            </tr>
          </thead>
          <tbody>
            {sortedTools.map((tool, idx) => {
              const placement = getPlacement(tool.id);
              return (
                <tr key={tool.id}>
                  <td className="st-table__app-info-col">
                    {/* Sort buttons */}
                    <div className="st-sort-btns">
                      <button 
                        onClick={() => handleMove(tool.id, 'up')}
                        disabled={idx === 0}
                        className="st-sort-btn"
                        title="Geser Ke Atas"
                      >
                        ▲
                      </button>
                      <button 
                        onClick={() => handleMove(tool.id, 'down')}
                        disabled={idx === sortedTools.length - 1}
                        className="st-sort-btn"
                        title="Geser Ke Bawah"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="st-table__app-info">
                      <span className="st-table__icon">{tool.icon}</span>
                      <span className="st-table__name">{tool.name}</span>
                    </div>
                  </td>
                  <td>
                    <label className="st-switch">
                      <input
                        type="checkbox"
                        checked={placement.dock}
                        onChange={() => handleToggle(tool.id, 'dock', placement.dock)}
                      />
                      <span className="st-slider" />
                    </label>
                  </td>
                  <td>
                    <label className="st-switch">
                      <input
                        type="checkbox"
                        checked={placement.desktop}
                        onChange={() => handleToggle(tool.id, 'desktop', placement.desktop)}
                      />
                      <span className="st-slider" />
                    </label>
                  </td>
                  <td>
                    <label className="st-switch">
                      <input
                        type="checkbox"
                        checked={placement.drawer}
                        onChange={() => handleToggle(tool.id, 'drawer', placement.drawer)}
                      />
                      <span className="st-slider" />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SettingsTool;
