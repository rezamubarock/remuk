import React, { useState } from 'react';
import { useStore } from '@core/store';
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

  const { appPlacements, updateAppPlacement } = useStore();

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

  const handleToggle = (toolId, type, currentVal) => {
    updateAppPlacement(toolId, { [type]: !currentVal });
  };

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
              placeholder="Kata Sandi (111111Aa)"
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
        <h3>Kustomisasi Tata Letak Aplikasi</h3>
        <p>Atur di mana ikon shortcut aplikasi akan ditampilkan.</p>
      </div>

      <div className="st-content">
        <table className="st-table">
          <thead>
            <tr>
              <th>Aplikasi</th>
              <th>Dock</th>
              <th>Desktop/Layar Utama</th>
              <th>Laci/Launchpad</th>
            </tr>
          </thead>
          <tbody>
            {TOOLS.map((tool) => {
              const placement = getPlacement(tool.id);
              return (
                <tr key={tool.id}>
                  <td className="st-table__app-info">
                    <span className="st-table__icon">{tool.icon}</span>
                    <span className="st-table__name">{tool.name}</span>
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
