import React, { useState, useEffect, useRef } from 'react';
import { useService } from '@core/hooks/useService';
import './azera-drop.css';

const sha256 = async (string) => {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

// Play classic AirDrop-like chord sequence
const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playNote = (freq, time, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.2, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + duration);
    };

    const now = ctx.currentTime;
    playNote(659.25, now, 0.2); // E5
    playNote(880.00, now + 0.1, 0.4); // A5
  } catch (e) {
    // browser blocks audio before interaction
  }
};

const DEFAULT_AVATARS = ['🦊', '🐱', '🐼', '🦁', '🐸', '🐨', '🦄', '🐰', '🐯', '🐙', '🦖', '🐬', '🦉', '🐝', '🐧'];

// Detect device model name from user agent
const getDeviceName = () => {
  const ua = navigator.userAgent;
  let os = "Device";
  let browser = "";
  
  if (/windows/i.test(ua)) os = "Windows PC";
  else if (/macintosh|mac os/i.test(ua)) os = "Macbook";
  else if (/iphone/i.test(ua)) os = "iPhone";
  else if (/ipad/i.test(ua)) os = "iPad";
  else if (/android/i.test(ua)) {
    os = /mobile/i.test(ua) ? "HP Android" : "Tablet Android";
  } else if (/linux/i.test(ua)) os = "Linux PC";
  
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Safari";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/edge|edg/i.test(ua)) browser = "Edge";
  else if (/opr/i.test(ua)) browser = "Opera";
  
  return browser ? `${os} (${browser})` : os;
};

// Generate stable random emoji from peer ID hash sum
const getStableAvatar = (id) => {
  const charSum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return DEFAULT_AVATARS[Math.abs(charSum) % DEFAULT_AVATARS.length];
};

const AzeraDrop = () => {
  const { isReady: isFirebaseReady, service: firebaseService } = useService('firebase-firestore');

  // Peer specifications (Persisted locally to keep same emoji/ID)
  const [peerId] = useState(() => {
    let cachedId = localStorage.getItem('remuk_azera_peer_id');
    if (!cachedId) {
      cachedId = `peer-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('remuk_azera_peer_id', cachedId);
    }
    return cachedId;
  });

  const myName = getDeviceName();
  const myAvatar = getStableAvatar(peerId);
  
  // States
  const [networkKey, setNetworkKey] = useState('');
  const [customRoomCode, setCustomRoomCode] = useState(() => localStorage.getItem('remuk_azera_room') || '');
  const [peers, setPeers] = useState([]);
  const [incomingTransfer, setIncomingTransfer] = useState(null);
  const [outgoingTransfer, setOutgoingTransfer] = useState(null);
  const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'info' (for mobile layout)
  
  const fileInputRef = useRef(null);
  const selectedPeerRef = useRef(null);

  // Firestore helpers
  const getFirestoreHelpers = async () => {
    const { doc, setDoc, getDoc, deleteField, onSnapshot } = await import('firebase/firestore');
    return { doc, setDoc, getDoc, deleteField, onSnapshot };
  };

  // Get local network key (IP hash)
  useEffect(() => {
    if (customRoomCode) {
      setNetworkKey(`custom_${customRoomCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
      return;
    }

    const fetchNetKey = async () => {
      let ip = '127.0.0.1';
      try {
        // Use ipify explicitly to enforce IPv4 standard NAT address for identical hash rooms
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        if (data.ip) ip = data.ip;
      } catch (e) {
        try {
          const res = await fetch('https://ipapi.co/json/');
          const data = await res.json();
          if (data.ip) ip = data.ip;
        } catch (err) {}
      }
      const hash = await sha256(ip);
      setNetworkKey(`drop_${hash.substring(0, 12)}`);
    };
    fetchNetKey();
  }, [customRoomCode]);

  // Update peer metadata heartbeat in Firestore (/notes/drop_peers_ROOM)
  useEffect(() => {
    if (!isFirebaseReady || !firebaseService?.db || !networkKey) return;

    let heartbeatInterval;
    const registerPeer = async () => {
      try {
        const { doc, setDoc, deleteField } = await getFirestoreHelpers();
        const docRef = doc(firebaseService.db, 'notes', `drop_peers_${networkKey}`);
        
        const updateHeartbeat = async () => {
          await setDoc(docRef, {
            peers: {
              [peerId]: {
                id: peerId,
                name: myName,
                avatar: myAvatar,
                lastSeen: Date.now()
              }
            }
          }, { merge: true });
        };

        await updateHeartbeat();
        heartbeatInterval = setInterval(updateHeartbeat, 4000);

        // Cleanup on unmount
        return async () => {
          clearInterval(heartbeatInterval);
          try {
            await setDoc(docRef, {
              peers: {
                [peerId]: deleteField()
              }
            }, { merge: true });
          } catch (e) {}
        };
      } catch (e) {
        console.error('Peer registration error:', e);
      }
    };

    let cleanupPromise = registerPeer();

    return () => {
      clearInterval(heartbeatInterval);
      cleanupPromise.then((cleanup) => {
        if (cleanup) cleanup();
      });
    };
  }, [isFirebaseReady, firebaseService, networkKey, peerId, myName, myAvatar]);

  // Listen to peer list & incoming transfers in Firestore (/notes/drop_transfers_ROOM)
  useEffect(() => {
    if (!isFirebaseReady || !firebaseService?.db || !networkKey) return;

    let unsubPeers;
    let unsubTransfers;

    const setupListeners = async () => {
      const { doc, onSnapshot } = await getFirestoreHelpers();

      // 1. Listen for active peers list
      const peersDocRef = doc(firebaseService.db, 'notes', `drop_peers_${networkKey}`);
      unsubPeers = onSnapshot(peersDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const peersMap = data.peers || {};
          const list = [];
          Object.keys(peersMap).forEach((id) => {
            if (id !== peerId && Date.now() - peersMap[id].lastSeen < 12000) {
              list.push(peersMap[id]);
            }
          });
          setPeers(list);
        } else {
          setPeers([]);
        }
      });

      // 2. Listen for transfers targeting me
      const transfersDocRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
      unsubTransfers = onSnapshot(transfersDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const transfersMap = data.transfers || {};
          
          Object.keys(transfersMap).forEach((id) => {
            const trans = transfersMap[id];
            if (trans.receiverId === peerId) {
              if (trans.status === 'pending') {
                playNotificationSound();
                setIncomingTransfer({ ...trans, docId: id });
              } else if (trans.status === 'accepted' && outgoingTransfer?.id === trans.id) {
                setOutgoingTransfer((prev) => prev ? { ...prev, status: 'completed' } : null);
              } else if (trans.status === 'declined' && outgoingTransfer?.id === trans.id) {
                setOutgoingTransfer((prev) => prev ? { ...prev, status: 'declined' } : null);
              }
            }
          });
        }
      });
    };

    setupListeners();

    return () => {
      if (unsubPeers) unsubPeers();
      if (unsubTransfers) unsubTransfers();
    };
  }, [isFirebaseReady, firebaseService, networkKey, peerId, outgoingTransfer?.id]);

  // Listen for output status changes
  useEffect(() => {
    if (!isFirebaseReady || !firebaseService?.db || !networkKey || !outgoingTransfer) return;

    let unsub;
    const listenOutgoing = async () => {
      const { doc, onSnapshot } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
      
      unsub = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const transfersMap = data.transfers || {};
          const trans = transfersMap[outgoingTransfer.id];
          if (trans) {
            if (trans.status === 'accepted') {
              setOutgoingTransfer((prev) => prev ? { ...prev, status: 'completed' } : null);
            } else if (trans.status === 'declined') {
              setOutgoingTransfer((prev) => prev ? { ...prev, status: 'declined' } : null);
            }
          }
        }
      });
    };

    listenOutgoing();
    return () => {
      if (unsub) unsub();
    };
  }, [isFirebaseReady, firebaseService, networkKey, outgoingTransfer?.id]);

  // Handle peer selection for file sharing
  const handlePeerClick = (peer) => {
    selectedPeerRef.current = peer;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Upload file and request transaction
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    const peer = selectedPeerRef.current;
    if (!file || !peer || !networkKey || !firebaseService?.db) return;

    const transferId = `trans-${Date.now()}`;
    setOutgoingTransfer({
      id: transferId,
      peer,
      fileName: file.name,
      progress: 5,
      status: 'uploading',
      error: null
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const progTimer = setInterval(() => {
        setOutgoingTransfer((prev) => {
          if (prev && prev.status === 'uploading' && prev.progress < 90) {
            return { ...prev, progress: prev.progress + 15 };
          }
          return prev;
        });
      }, 300);

      const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progTimer);

      if (!res.ok) throw new Error('Gagal mengupload berkas ke server ephemeral.');
      const resData = await res.json();
      
      const uploadUrl = resData.data.url;
      const downloadUrl = uploadUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');

      setOutgoingTransfer((prev) => prev ? { ...prev, progress: 100, status: 'waiting' } : null);

      // Write transaction request to Firestore Doc
      const { doc, setDoc } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
      
      await setDoc(docRef, {
        transfers: {
          [transferId]: {
            id: transferId,
            senderId: peerId,
            senderName: myName,
            senderIcon: myAvatar,
            receiverId: peer.id,
            fileName: file.name,
            fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            downloadUrl,
            status: 'pending',
            createdAt: Date.now()
          }
        }
      }, { merge: true });

    } catch (err) {
      console.error(err);
      setOutgoingTransfer((prev) => prev ? { ...prev, status: 'error', error: err.message } : null);
    }
  };

  // Accept incoming transfer
  const handleAccept = async () => {
    if (!incomingTransfer || !firebaseService?.db) return;
    try {
      const { doc, setDoc, deleteField } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
      
      await setDoc(docRef, {
        transfers: {
          [incomingTransfer.docId]: {
            status: 'accepted'
          }
        }
      }, { merge: true });

      // Automatically download the file
      const a = document.createElement('a');
      a.href = incomingTransfer.downloadUrl;
      a.download = incomingTransfer.fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setIncomingTransfer(null);

      // Clean up map key after short delay
      setTimeout(async () => {
        try {
          await setDoc(docRef, {
            transfers: {
              [incomingTransfer.docId]: deleteField()
            }
          }, { merge: true });
        } catch (e) {}
      }, 5000);
    } catch (e) {
      console.error(e);
    }
  };

  // Decline incoming transfer
  const handleDecline = async () => {
    if (!incomingTransfer || !firebaseService?.db) return;
    try {
      const { doc, setDoc, deleteField } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
      
      await setDoc(docRef, {
        transfers: {
          [incomingTransfer.docId]: {
            status: 'declined'
          }
        }
      }, { merge: true });
      
      setIncomingTransfer(null);

      setTimeout(async () => {
        try {
          await setDoc(docRef, {
            transfers: {
              [incomingTransfer.docId]: deleteField()
            }
          }, { merge: true });
        } catch (e) {}
      }, 5000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRoomConfig = () => {
    const code = prompt("Masukkan Code Room Jaringan baru (misal: kosan123, wifiantigravity):", customRoomCode);
    if (code !== null) {
      const cleanCode = code.toLowerCase().trim();
      setCustomRoomCode(cleanCode);
      if (cleanCode) {
        localStorage.setItem('remuk_azera_room', cleanCode);
      } else {
        localStorage.removeItem('remuk_azera_room');
      }
    }
  };

  return (
    <div className="azera-wrapper">
      {/* Segmented control tab header for mobile view layout */}
      <div className="azera-tabs-header">
        <button 
          className={`azera-tab-btn ${activeTab === 'radar' ? 'azera-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('radar')}
        >
          📡 Radar Radar
        </button>
        <button 
          className={`azera-tab-btn ${activeTab === 'info' ? 'azera-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          ⚙️ Identitas & Room
        </button>
      </div>

      <div className="azera">
        {/* Invisible file input trigger */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
        />

        {/* Incoming Apple AirDrop Modal Overlay */}
        {incomingTransfer && (
          <div className="azera-dialog-overlay">
            <div className="azera-dialog glass">
              <div className="azera-dialog__avatar">
                <span className="emoji">{incomingTransfer.senderIcon}</span>
              </div>
              <h4 className="azera-dialog__title">AzeraDrop</h4>
              <p className="azera-dialog__desc">
                <strong>{incomingTransfer.senderName}</strong> ingin mengirimkan berkas:
              </p>
              <div className="azera-dialog__file-box">
                <span className="file-icon">📄</span>
                <div className="file-details">
                  <span className="name" title={incomingTransfer.fileName}>{incomingTransfer.fileName}</span>
                  <span className="size">{incomingTransfer.fileSize}</span>
                </div>
              </div>
              <div className="azera-dialog__buttons">
                <button className="btn btn--decline" onClick={handleDecline}>Tolak</button>
                <button className="btn btn--accept" onClick={handleAccept}>Terima</button>
              </div>
            </div>
          </div>
        )}

        {/* Outgoing file upload / transfer status modal */}
        {outgoingTransfer && (
          <div className="azera-dialog-overlay">
            <div className="azera-dialog glass">
              <div className="azera-dialog__avatar animate-pulse">
                <span className="emoji">{outgoingTransfer.peer.avatar}</span>
              </div>
              <h4 className="azera-dialog__title">Mengirim ke {outgoingTransfer.peer.name}</h4>
              <p className="azera-dialog__desc">{outgoingTransfer.fileName}</p>
              
              {outgoingTransfer.status === 'uploading' && (
                <div className="azera-progress">
                  <div className="azera-progress__bar">
                    <div className="fill" style={{ width: `${outgoingTransfer.progress}%` }} />
                  </div>
                  <span>Mengunggah berkas... {outgoingTransfer.progress}%</span>
                </div>
              )}

              {outgoingTransfer.status === 'waiting' && (
                <div className="azera-status">
                  <div className="spinner-mini" />
                  <span>Menunggu persetujuan penerima...</span>
                </div>
              )}

              {outgoingTransfer.status === 'completed' && (
                <div className="azera-status success">
                  <span>🟢 Berkas diterima & diunduh!</span>
                  <button onClick={() => setOutgoingTransfer(null)} className="btn btn--ok">Tutup</button>
                </div>
              )}

              {outgoingTransfer.status === 'declined' && (
                <div className="azera-status error">
                  <span>🔴 Pengiriman ditolak oleh penerima.</span>
                  <button onClick={() => setOutgoingTransfer(null)} className="btn btn--ok">Tutup</button>
                </div>
              )}

              {outgoingTransfer.status === 'error' && (
                <div className="azera-status error">
                  <span>Gagal: {outgoingTransfer.error}</span>
                  <button onClick={() => setOutgoingTransfer(null)} className="btn btn--ok">Tutup</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Left panel: Profile Info (Automatic Device details) */}
        <div className={`azera-left glass ${activeTab === 'info' ? 'show-mobile' : 'hide-mobile'}`}>
          <h4 className="azera-title">📡 Identitas Saya</h4>
          <div className="azera-profile-static">
            <span className="current-avatar current-avatar--static">{myAvatar}</span>
            <div className="azera-profile-static__details">
              <h3 className="name">{myName}</h3>
              <span className="subtitle">Mendeteksi otomatis</span>
            </div>
          </div>

          <div className="azera-info-box">
            <div className="azera-info-row">
              <span>Status:</span>
              <span className="text-success">Siap Menerima</span>
            </div>
            <div className="azera-info-row">
              <span>Room Jaringan:</span>
              <span className="text-secondary" title={networkKey}>{networkKey ? networkKey : 'Menghubungkan...'}</span>
            </div>
            
            <button onClick={handleRoomConfig} className="azera-room-btn">
              {customRoomCode ? '⚙️ Gunakan Room IP Wi-Fi' : '⚙️ Hubungkan Room Manual'}
            </button>

            <p className="note">
              *Secara default, AzeraDrop menghubungkan perangkat pada jaringan Wi-Fi/IP publik yang sama. Jika perangkat tidak saling terdeteksi, klik <strong>Hubungkan Room Manual</strong> di atas lalu ketik kata/kunci yang sama pada kedua perangkat.
            </p>
          </div>
        </div>

        {/* Right panel: Animated Apple Radar for Peer Discovery */}
        <div className={`azera-right glass ${activeTab === 'radar' ? 'show-mobile' : 'hide-mobile'}`}>
          <div className="azera-radar-container">
            {/* Radar Circles expanding ripple */}
            <div className="radar-circle ring--1" />
            <div className="radar-circle ring--2" />
            <div className="radar-circle ring--3" />
            <div className="radar-circle ring--4" />

            {/* Centered User Device */}
            <div className="radar-center">
              <div className="radar-center__avatar">
                <span className="emoji">{myAvatar}</span>
              </div>
              <span className="radar-center__label">Saya</span>
            </div>

            {/* Discovered Peers floating around radar */}
            {peers.map((peer, idx) => {
              const angle = (idx * (360 / Math.max(1, peers.length)) * Math.PI) / 180;
              const radius = 110 + (idx % 2 === 0 ? 0 : 25);
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <button
                  key={peer.id}
                  onClick={() => handlePeerClick(peer)}
                  className="radar-peer"
                  style={{
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
                  }}
                >
                  <div className="radar-peer__avatar">
                    <span className="emoji">{peer.avatar}</span>
                  </div>
                  <span className="radar-peer__label">{peer.name}</span>
                  <span className="radar-peer__hint">Ketuk untuk kirim</span>
                </button>
              );
            })}
          </div>

          {peers.length === 0 && (
            <div className="radar-searching">
              <div className="spinner-radar" />
              <p>Mencari perangkat lain di jaringan yang sama...</p>
              <span>Pastikan perangkat lain juga membuka tool AzeraDrop ini pada room yang sama: <strong>{networkKey}</strong>.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AzeraDrop;
