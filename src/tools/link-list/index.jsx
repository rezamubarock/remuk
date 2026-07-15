import React, { useState, useEffect } from 'react';
import { useService } from '@core/hooks/useService';
import './link-list.css';

// target hash for password "rausyani"
const AUTH_HASH_TARGET = '1800cee37bd1f9d84755f2c0ffa7c75a4b5a12279687d88b0b33330e0a8976d8';

const sha256 = async (string) => {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const POPULAR_EMOJIS = [
  '🔗', '🌐', '🐙', '💻', '📱', '📰', '📚', '🛠️', '🎨', '🚀', 
  '🔥', '💡', '🎮', '🎥', '🎵', '📷', '💰', '📈', '🛒', '🍔', 
  '✈️', '🏠', '❤️', '🌟', '🤖', '👾', '👽', '🧠', '⚙️', '🔒'
];

const DEFAULT_STARTER_DATA = {
  categories: [
    { id: 'cat-starter-1', name: 'Alat & Desain', icon: '🛠️' },
    { id: 'cat-starter-2', name: 'Developer', icon: '💻' },
    { id: 'cat-starter-3', name: 'Media Sosial', icon: '📱' }
  ],
  links: [
    { id: 'link-starter-1', catId: 'cat-starter-1', title: 'Remuk.id', url: 'https://remuk.id', desc: 'Situs OS Portal alat online gratis', icon: '🌐' },
    { id: 'link-starter-2', catId: 'cat-starter-2', title: 'GitHub', url: 'https://github.com', desc: 'Repositori kode & kolaborasi developer', icon: '🐙' },
    { id: 'link-starter-3', catId: 'cat-starter-3', title: 'Google', url: 'https://google.com', desc: 'Mesin pencari terpopuler sedunia', icon: '🔍' }
  ]
};

const LinkList = () => {
  const { isReady: isFirebaseReady, service: firebaseService } = useService('firebase-firestore');
  
  // Data lists
  const [categories, setCategories] = useState([]);
  const [links, setLinks] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState('all');
  
  // Authorization status
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('remuk_linklist_unlocked') === 'true');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  
  // View states
  const [activeTab, setActiveTab] = useState('bookmarks'); // 'bookmarks' | 'manage-categories' | 'manage-links'

  // Input states for Add Category
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');

  // Input states for Add Link
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');
  const [newLinkCatId, setNewLinkCatId] = useState('');
  const [newLinkEmoji, setNewLinkEmoji] = useState('');

  // Firestore helpers
  const getFirestoreHelpers = async () => {
    const { doc, getDoc, setDoc, onSnapshot } = await import('firebase/firestore');
    return { doc, getDoc, setDoc, onSnapshot };
  };

  // Sync data with Firestore
  useEffect(() => {
    if (!isFirebaseReady || !firebaseService?.db) return;

    let unsub;
    const syncData = async () => {
      const { doc, setDoc, onSnapshot } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', 'settings_linklist');

      unsub = onSnapshot(docRef, async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setCategories(data.categories || []);
          setLinks(data.links || []);
        } else {
          // Initialize default starter template
          await setDoc(docRef, DEFAULT_STARTER_DATA);
        }
      });
    };

    syncData();
    return () => {
      if (unsub) unsub();
    };
  }, [isFirebaseReady, firebaseService]);

  const saveToFirestore = async (cats, lks) => {
    if (!isFirebaseReady || !firebaseService?.db) return;
    try {
      const { doc, setDoc } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', 'settings_linklist');
      await setDoc(docRef, { categories: cats, links: lks });
    } catch (e) {
      console.error('Failed to save bookmark settings:', e);
    }
  };

  // Handle Auth submission
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setPasswordError(false);

    try {
      const hashed = await sha256(passwordInput);
      if (hashed === AUTH_HASH_TARGET) {
        setIsAdmin(true);
        sessionStorage.setItem('remuk_linklist_unlocked', 'true');
        setShowPasswordModal(false);
        setPasswordInput('');
        setActiveTab('manage-links');
      } else {
        setPasswordError(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle manage tab with password barrier
  const handleManageClick = () => {
    if (isAdmin) {
      setActiveTab(activeTab === 'bookmarks' ? 'manage-links' : 'bookmarks');
    } else {
      setShowPasswordModal(true);
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('remuk_linklist_unlocked');
    setActiveTab('bookmarks');
  };

  // Add Category
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const randomEmoji = POPULAR_EMOJIS[Math.floor(Math.random() * POPULAR_EMOJIS.length)];
    const emoji = newCatEmoji.trim() || randomEmoji;

    const newCat = {
      id: `cat-${Date.now()}`,
      name: newCatName.trim(),
      icon: emoji
    };

    const updatedCats = [...categories, newCat];
    setCategories(updatedCats);
    saveToFirestore(updatedCats, links);

    setNewCatName('');
    setNewCatEmoji('');
  };

  // Delete Category (also deletes associated links)
  const handleDeleteCategory = (catId) => {
    if (window.confirm('Hapus kategori ini? Semua tautan di dalamnya juga akan terhapus.')) {
      const updatedCats = categories.filter((c) => c.id !== catId);
      const updatedLinks = links.filter((l) => l.catId !== catId);
      
      setCategories(updatedCats);
      setLinks(updatedLinks);
      saveToFirestore(updatedCats, updatedLinks);

      if (selectedCatId === catId) {
        setSelectedCatId('all');
      }
    }
  };

  // Add Link
  const handleAddLink = (e) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim() || !newLinkCatId) return;

    let targetUrl = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    const randomEmoji = POPULAR_EMOJIS[Math.floor(Math.random() * POPULAR_EMOJIS.length)];
    const emoji = newLinkEmoji.trim() || randomEmoji;

    const newLink = {
      id: `link-${Date.now()}`,
      catId: newLinkCatId,
      title: newLinkTitle.trim(),
      url: targetUrl,
      desc: newLinkDesc.trim() || 'Tanpa deskripsi.',
      icon: emoji
    };

    const updatedLinks = [...links, newLink];
    setLinks(updatedLinks);
    saveToFirestore(categories, updatedLinks);

    setNewLinkTitle('');
    setNewLinkUrl('');
    setNewLinkDesc('');
    setNewLinkEmoji('');
  };

  // Delete Link
  const handleDeleteLink = (linkId) => {
    if (window.confirm('Hapus tautan bookmark ini?')) {
      const updatedLinks = links.filter((l) => l.id !== linkId);
      setLinks(updatedLinks);
      saveToFirestore(categories, updatedLinks);
    }
  };

  // Filter links by category selection
  const filteredLinks = selectedCatId === 'all' 
    ? links 
    : links.filter((l) => l.catId === selectedCatId);

  return (
    <div className="linklist">
      {/* Password authentication Modal */}
      {showPasswordModal && (
        <div className="ll-modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="ll-modal glass" onClick={(e) => e.stopPropagation()}>
            <h3>Autentikasi Administrator</h3>
            <p>Masukkan kata sandi pengelola untuk memodifikasi kategori & bookmark.</p>
            <form onSubmit={handleAuthSubmit} className="ll-modal__form">
              <input
                type="password"
                placeholder="Kata sandi"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className={`ll-input ${passwordError ? 'll-input--error' : ''}`}
                autoFocus
              />
              {passwordError && <p className="ll-error-text">Kata sandi salah!</p>}
              <div className="ll-modal__buttons">
                <button type="submit" className="ll-btn ll-btn--accent">Masuk</button>
                <button type="button" onClick={() => setShowPasswordModal(false)} className="ll-btn ll-btn--ghost">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Header / Navigation bar */}
      <div className="ll-header">
        <div className="ll-header__logo">
          <span>🔗</span>
          <h3>LinkList Manager</h3>
        </div>

        <div className="ll-header__actions">
          {isAdmin && activeTab !== 'bookmarks' && (
            <>
              <button 
                onClick={() => setActiveTab(activeTab === 'manage-links' ? 'manage-categories' : 'manage-links')}
                className="ll-tab-toggle"
              >
                {activeTab === 'manage-links' ? '📂 Kelola Kategori' : '🔗 Kelola Link'}
              </button>
              <button onClick={handleLogout} className="ll-logout-btn">
                Keluar Admin
              </button>
            </>
          )}

          <button onClick={handleManageClick} className={`ll-manage-btn ${activeTab !== 'bookmarks' ? 'll-manage-btn--active' : ''}`}>
            {activeTab === 'bookmarks' ? '⚙️ Kelola' : '👁️ Lihat Bookmark'}
          </button>
        </div>
      </div>

      {activeTab === 'bookmarks' ? (
        // ─── VIEW 1: BOOKMARKS GRID ───
        <div className="ll-body">
          {/* Categories Sidebar */}
          <div className="ll-sidebar glass">
            <button
              onClick={() => setSelectedCatId('all')}
              className={`ll-cat-item ${selectedCatId === 'all' ? 'll-cat-item--active' : ''}`}
            >
              <span className="icon">📂</span>
              <span className="name">Semua Bookmark</span>
              <span className="badge">{links.length}</span>
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`ll-cat-item ${selectedCatId === cat.id ? 'll-cat-item--active' : ''}`}
              >
                <span className="icon">{cat.icon}</span>
                <span className="name">{cat.name}</span>
                <span className="badge">{links.filter((l) => l.catId === cat.id).length}</span>
              </button>
            ))}
          </div>

          {/* Links Grid */}
          <div className="ll-grid-container">
            <div className="ll-grid">
              {filteredLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ll-card glass"
                >
                  <div className="ll-card__header">
                    <span className="emoji">{link.icon}</span>
                    <span className="category-label">
                      {categories.find((c) => c.id === link.catId)?.name || 'Kategori'}
                    </span>
                  </div>
                  <h4 className="ll-card__title">{link.title}</h4>
                  <p className="ll-card__desc">{link.desc}</p>
                  <span className="ll-card__url">{link.url.replace(/^https?:\/\/(www\.)?/i, '')}</span>
                </a>
              ))}

              {filteredLinks.length === 0 && (
                <div className="ll-empty">
                  <span>📂</span>
                  <p>Tidak ada bookmark dalam kategori ini.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'manage-categories' ? (
        // ─── VIEW 2: MANAGE CATEGORIES (ADMIN) ───
        <div className="ll-admin-container">
          <div className="ll-admin-left glass">
            <h4>📁 Tambah Kategori Baru</h4>
            <form onSubmit={handleAddCategory} className="ll-form">
              <div className="ll-form-group">
                <label>Nama Kategori:</label>
                <input
                  type="text"
                  placeholder="misal: Belanja, Edukasi"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="ll-input"
                  required
                />
              </div>

              <div className="ll-form-group">
                <label>Pilih Emoji (Kosongkan untuk acak):</label>
                <input
                  type="text"
                  placeholder="Ketik satu emoji atau tempel"
                  value={newCatEmoji}
                  onChange={(e) => setNewCatEmoji(e.target.value)}
                  className="ll-input"
                  maxLength="4"
                />
                <div className="ll-emoji-picker">
                  {POPULAR_EMOJIS.slice(0, 15).map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setNewCatEmoji(em)}
                      className="emoji-select-btn"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="ll-btn ll-btn--accent ll-btn--full">
                + Tambah Kategori
              </button>
            </form>
          </div>

          <div className="ll-admin-right glass">
            <h4>📁 Daftar Kategori Saat Ini ({categories.length})</h4>
            <div className="ll-table-wrapper">
              <table className="ll-table">
                <thead>
                  <tr>
                    <th>Emoji</th>
                    <th>Nama Kategori</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id}>
                      <td className="center-text" style={{ fontSize: '20px' }}>{cat.icon}</td>
                      <td><strong>{cat.name}</strong></td>
                      <td>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="action-delete-btn"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan="3" className="center-text">Belum ada kategori kustom.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // ─── VIEW 3: MANAGE LINKS (ADMIN) ───
        <div className="ll-admin-container">
          <div className="ll-admin-left glass">
            <h4>🔗 Tambah Link Baru</h4>
            <form onSubmit={handleAddLink} className="ll-form">
              <div className="ll-form-group">
                <label>Judul Link:</label>
                <input
                  type="text"
                  placeholder="misal: YouTube, Canva"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  className="ll-input"
                  required
                />
              </div>

              <div className="ll-form-group">
                <label>Alamat URL:</label>
                <input
                  type="text"
                  placeholder="misal: youtube.com"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="ll-input"
                  required
                />
              </div>

              <div className="ll-form-group">
                <label>Pilih Kategori:</label>
                <select
                  value={newLinkCatId}
                  onChange={(e) => setNewLinkCatId(e.target.value)}
                  className="ll-select"
                  required
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ll-form-group">
                <label>Deskripsi Ringkas:</label>
                <input
                  type="text"
                  placeholder="misal: Menonton video online gratis"
                  value={newLinkDesc}
                  onChange={(e) => setNewLinkDesc(e.target.value)}
                  className="ll-input"
                />
              </div>

              <div className="ll-form-group">
                <label>Pilih Emoji (Kosongkan untuk acak):</label>
                <input
                  type="text"
                  placeholder="Ketik satu emoji atau tempel"
                  value={newLinkEmoji}
                  onChange={(e) => setNewLinkEmoji(e.target.value)}
                  className="ll-input"
                  maxLength="4"
                />
                <div className="ll-emoji-picker">
                  {POPULAR_EMOJIS.slice(15, 30).map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setNewLinkEmoji(em)}
                      className="emoji-select-btn"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="ll-btn ll-btn--accent ll-btn--full" disabled={categories.length === 0}>
                {categories.length === 0 ? 'Buat Kategori Dulu' : '+ Tambah Link'}
              </button>
            </form>
          </div>

          <div className="ll-admin-right glass">
            <h4>🔗 Daftar Tautan Link ({links.length})</h4>
            <div className="ll-table-wrapper">
              <table className="ll-table">
                <thead>
                  <tr>
                    <th>Emoji</th>
                    <th>Judul / Deskripsi</th>
                    <th>Kategori</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id}>
                      <td className="center-text" style={{ fontSize: '20px' }}>{link.icon}</td>
                      <td>
                        <strong>{link.title}</strong>
                        <p className="table-desc">{link.desc}</p>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="table-url">{link.url}</a>
                      </td>
                      <td>
                        <span className="table-cat-badge">
                          {categories.find((c) => c.id === link.catId)?.name || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          className="action-delete-btn"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {links.length === 0 && (
                    <tr>
                      <td colSpan="4" className="center-text">Belum ada tautan link bookmark.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkList;
