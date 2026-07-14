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
  const [activeTab, setActiveTab] = useState('layout'); // 'layout' | 'folders'
  const [cloudSyncStatus, setCloudSyncStatus] = useState('ready');

  // Folder creation form states
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');

  const { 
    appPlacements, 
    updateAppPlacement, 
    appOrder, 
    setAppOrder, 
    folders, 
    createFolder, 
    deleteFolder, 
    updateFolderPlacements, 
    updateFolderApps 
  } = useStore();

  const { service: firebaseService } = useService('firebase-firestore');

  // Firestore Sync Helper
  const syncToCloud = async (updatedPlacements, updatedOrder, updatedFolders) => {
    if (firebaseService?.db) {
      setCloudSyncStatus('syncing');
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const docRef = doc(firebaseService.db, 'notes', 'settings_placements');
        await setDoc(docRef, { 
          placements: updatedPlacements, 
          order: updatedOrder,
          folders: updatedFolders 
        });
        setCloudSyncStatus('ready');
      } catch (err) {
        console.error('Failed to sync to Firestore:', err);
        setCloudSyncStatus('error');
      }
    }
  };

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

  // Layout Placement Toggles
  const handleTogglePlacement = async (toolId, type, currentVal) => {
    const currentPlacements = { ...appPlacements };
    const currentToolPlacement = currentPlacements[toolId] || { dock: true, desktop: true, drawer: true };
    const updatedToolPlacement = { ...currentToolPlacement, [type]: !currentVal };
    const updatedPlacements = { ...currentPlacements, [toolId]: updatedToolPlacement };

    updateAppPlacement(toolId, { [type]: !currentVal });
    await syncToCloud(updatedPlacements, appOrder.length === 0 ? TOOLS.map((t) => t.id) : appOrder, folders);
  };

  // Layout Sorting (Move Up/Down)
  const handleMove = async (toolId, direction) => {
    let currentOrder = [...appOrder];
    if (currentOrder.length === 0) {
      currentOrder = TOOLS.map((t) => t.id);
    }

    const index = currentOrder.indexOf(toolId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;

    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[newIndex];
    currentOrder[newIndex] = temp;

    setAppOrder(currentOrder);
    await syncToCloud(appPlacements, currentOrder, folders);
  };

  // Folder Manager: Create Folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName) return;

    const newFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName,
      icon: newFolderIcon || '📁',
      apps: [],
      placements: { dock: true, desktop: true, drawer: true },
    };

    const updatedFolders = [...folders, newFolder];
    useStore.setState({ folders: updatedFolders }); // update Zustand directly for instant action
    setNewFolderName('');
    setNewFolderIcon('📁');

    await syncToCloud(appPlacements, appOrder.length === 0 ? TOOLS.map((t) => t.id) : appOrder, updatedFolders);
  };

  // Folder Manager: Delete Folder
  const handleDeleteFolder = async (folderId) => {
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    deleteFolder(folderId);
    await syncToCloud(appPlacements, appOrder.length === 0 ? TOOLS.map((t) => t.id) : appOrder, updatedFolders);
  };

  // Folder Manager: Toggle App inside Folder
  const handleToggleAppInFolder = async (folderId, appId) => {
    const updatedFolders = folders.map((f) => {
      if (f.id === folderId) {
        const alreadyIn = f.apps.includes(appId);
        const nextApps = alreadyIn 
          ? f.apps.filter((id) => id !== appId)
          : [...f.apps, appId];
        return { ...f, apps: nextApps };
      }
      return f;
    });

    useStore.setState({ folders: updatedFolders });
    await syncToCloud(appPlacements, appOrder.length === 0 ? TOOLS.map((t) => t.id) : appOrder, updatedFolders);
  };

  // Folder Manager: Toggle Folder Placement (Dock/Desktop/Drawer)
  const handleToggleFolderPlacement = async (folderId, type, currentVal) => {
    const updatedFolders = folders.map((f) => {
      if (f.id === folderId) {
        return { ...f, placements: { ...f.placements, [type]: !currentVal } };
      }
      return f;
    });

    useStore.setState({ folders: updatedFolders });
    await syncToCloud(appPlacements, appOrder.length === 0 ? TOOLS.map((t) => t.id) : appOrder, updatedFolders);
  };

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
      {/* Settings Header */}
      <div className="st-header">
        <div className="st-header__row">
          <div>
            <h3>Kustomisasi Layout</h3>
            <div className="st-tabs">
              <button 
                className={`st-tab-btn ${activeTab === 'layout' ? 'st-tab-btn--active' : ''}`}
                onClick={() => setActiveTab('layout')}
              >
                Letak & Urutan
              </button>
              <button 
                className={`st-tab-btn ${activeTab === 'folders' ? 'st-tab-btn--active' : ''}`}
                onClick={() => setActiveTab('folders')}
              >
                Kelola Folder ({folders.length})
              </button>
            </div>
          </div>
          <div className="st-cloud-status">
            {cloudSyncStatus === 'syncing' && <span className="st-status st-status--syncing">🔄 Sinkronisasi cloud...</span>}
            {cloudSyncStatus === 'ready' && <span className="st-status st-status--ready">🟢 Tersimpan di Cloud</span>}
            {cloudSyncStatus === 'error' && <span className="st-status st-status--error">🔴 Gagal simpan ke cloud</span>}
          </div>
        </div>
      </div>

      {/* Settings Content Tabs */}
      <div className="st-content">
        {activeTab === 'layout' ? (
          <table className="st-table">
            <thead>
              <tr>
                <th>Aplikasi & Urutan</th>
                <th>Dock</th>
                <th>Layar Utama</th>
                <th>Laci/Launchpad</th>
              </tr>
            </thead>
            <tbody>
              {sortedTools.map((tool, idx) => {
                const placement = getPlacement(tool.id);
                return (
                  <tr key={tool.id}>
                    <td className="st-table__app-info-col">
                      <div className="st-sort-btns">
                        <button 
                          onClick={() => handleMove(tool.id, 'up')}
                          disabled={idx === 0}
                          className="st-sort-btn"
                        >
                          ▲
                        </button>
                        <button 
                          onClick={() => handleMove(tool.id, 'down')}
                          disabled={idx === sortedTools.length - 1}
                          className="st-sort-btn"
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
                          onChange={() => handleTogglePlacement(tool.id, 'dock', placement.dock)}
                        />
                        <span className="st-slider" />
                      </label>
                    </td>
                    <td>
                      <label className="st-switch">
                        <input
                          type="checkbox"
                          checked={placement.desktop}
                          onChange={() => handleTogglePlacement(tool.id, 'desktop', placement.desktop)}
                        />
                        <span className="st-slider" />
                      </label>
                    </td>
                    <td>
                      <label className="st-switch">
                        <input
                          type="checkbox"
                          checked={placement.drawer}
                          onChange={() => handleTogglePlacement(tool.id, 'drawer', placement.drawer)}
                        />
                        <span className="st-slider" />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="st-folders-manager">
            {/* Create Folder Form */}
            <form onSubmit={handleCreateFolder} className="st-create-folder-form glass">
              <h4>Buat Folder Baru</h4>
              <div className="st-create-folder-form__row">
                <input
                  type="text"
                  maxLength="2"
                  value={newFolderIcon}
                  onChange={(e) => setNewFolderIcon(e.target.value)}
                  placeholder="📁"
                  className="st-create-folder-input st-create-folder-input--icon"
                  title="Emoji Ikon Folder"
                />
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nama Folder (misal: Utilitas Teks)"
                  className="st-create-folder-input"
                  required
                />
                <button type="submit" className="st-lock__btn st-create-folder-btn">+ Buat</button>
              </div>
            </form>

            {/* Folders List */}
            <div className="st-folders-list">
              {folders.map((folder) => (
                <div key={folder.id} className="st-folder-item glass">
                  <div className="st-folder-item__header">
                    <div className="st-folder-item__title">
                      <span className="st-folder-item__icon">{folder.icon}</span>
                      <h4>{folder.name}</h4>
                    </div>
                    <button 
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="st-folder-delete-btn"
                    >
                      Hapus Folder
                    </button>
                  </div>

                  {/* Folder placements settings */}
                  <div className="st-folder-placements">
                    <span>Tampilkan di:</span>
                    <label className="st-folder-placement-toggle">
                      <input 
                        type="checkbox"
                        checked={folder.placements.dock}
                        onChange={() => handleToggleFolderPlacement(folder.id, 'dock', folder.placements.dock)}
                      />
                      Dock
                    </label>
                    <label className="st-folder-placement-toggle">
                      <input 
                        type="checkbox"
                        checked={folder.placements.desktop}
                        onChange={() => handleToggleFolderPlacement(folder.id, 'desktop', folder.placements.desktop)}
                      />
                      Desktop
                    </label>
                    <label className="st-folder-placement-toggle">
                      <input 
                        type="checkbox"
                        checked={folder.placements.drawer}
                        onChange={() => handleToggleFolderPlacement(folder.id, 'drawer', folder.placements.drawer)}
                      />
                      Laci (Launchpad)
                    </label>
                  </div>

                  {/* Apps Selection inside this Folder */}
                  <div className="st-folder-apps">
                    <h5>Pilih Aplikasi yang Dimasukkan:</h5>
                    <div className="st-folder-apps-grid">
                      {TOOLS.map((tool) => {
                        const isIn = folder.apps.includes(tool.id);
                        return (
                          <label key={tool.id} className={`st-folder-app-checkbox ${isIn ? 'st-folder-app-checkbox--active' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isIn}
                              onChange={() => handleToggleAppInFolder(folder.id, tool.id)}
                            />
                            <span>{tool.icon} {tool.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {folders.length === 0 && (
                <div className="st-folders-empty">
                  <span>📂</span>
                  <p>Belum ada folder yang dibuat</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsTool;
