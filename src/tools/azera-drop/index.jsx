import React, { useState, useEffect, useRef } from 'react';
import { useService } from '@core/hooks/useService';
import { useDevice } from '@core/hooks/useDevice';
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
    // Audio might be blocked if user hasn't interacted with document yet
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

// WebRTC Configuration with multiple reliable STUN servers
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

// Helper: Wait for ICE gathering to complete before sending SDP (Vanilla ICE)
// This embeds all local LAN IP and STUN candidates directly inside the SDP offer/answer!
const waitForIceGathering = (pc, maxTimeoutMs = 1200) => {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    let timer = null;
    const checkState = () => {
      if (pc.iceGatheringState === 'complete') {
        if (timer) clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', checkState);
    timer = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', checkState);
      resolve();
    }, maxTimeoutMs);
  });
};

// Helper: Safe candidate adding with queue if remote description isn't set yet
const addIceCandidateSafe = async (pc, candidate, queueRef) => {
  if (!pc || !candidate) return;
  try {
    if (pc.remoteDescription && pc.remoteDescription.type) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      queueRef.current.push(candidate);
    }
  } catch (e) {
    console.warn('[AzeraDrop] addIceCandidate error:', e);
  }
};

const flushIceCandidateQueue = async (pc, queueRef) => {
  if (!pc || !pc.remoteDescription) return;
  while (queueRef.current.length > 0) {
    const cand = queueRef.current.shift();
    try {
      await pc.addIceCandidate(new RTCIceCandidate(cand));
    } catch (e) {
      console.warn('[AzeraDrop] flush candidate error:', e);
    }
  }
};

const AzeraDrop = () => {
  const { isReady: isFirebaseReady, service: firebaseService } = useService('firebase-firestore');
  const { isMobile } = useDevice();

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
  
  const [incomingTransfer, setIncomingTransfer] = useState(null); // { id, senderId, senderName, senderIcon, fileName, fileSize, progress, status, error, offer, totalBytes, fileType }
  const [outgoingTransfer, setOutgoingTransfer] = useState(null); // { id, peer, fileName, progress, status, error }
  const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'info' (for mobile layout)
  
  const fileInputRef = useRef(null);
  const selectedPeerRef = useRef(null);

  // Refs for tracking current transfers inside Firestore callbacks without stale closures
  const incomingTransferRef = useRef(null);
  const outgoingTransferRef = useRef(null);
  useEffect(() => { incomingTransferRef.current = incomingTransfer; }, [incomingTransfer]);
  useEffect(() => { outgoingTransferRef.current = outgoingTransfer; }, [outgoingTransfer]);

  // WebRTC refs
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const receivedSizeRef = useRef(0);
  const transferMetaRef = useRef(null);
  const iceQueueRef = useRef([]);
  const processedCandidatesRef = useRef(new Set());
  const connectionTimeoutRef = useRef(null);

  // Firestore helpers
  const getFirestoreHelpers = async () => {
    const { doc, setDoc, deleteField, onSnapshot } = await import('firebase/firestore');
    return { doc, setDoc, deleteField, onSnapshot };
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
          try {
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
          } catch (e) {
            console.warn('[AzeraDrop] Heartbeat write error:', e);
          }
        };

        await updateHeartbeat();
        heartbeatInterval = setInterval(updateHeartbeat, 4000);

        // Instantly refresh heartbeat when mobile browser tab becomes visible again
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            updateHeartbeat();
          }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return async () => {
          clearInterval(heartbeatInterval);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  // Clean up WebRTC resources helper
  const closeWebRTC = () => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch (e) {}
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch (e) {}
      peerConnectionRef.current = null;
    }
    receivedChunksRef.current = [];
    receivedSizeRef.current = 0;
    transferMetaRef.current = null;
    iceQueueRef.current = [];
    processedCandidatesRef.current.clear();
  };

  // Unified Firestore Listeners: active peers list & transfer signals
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
          const now = Date.now();

          Object.keys(peersMap).forEach((id) => {
            if (id === peerId) return; // Don't show myself
            const p = peersMap[id];
            if (!p) return;

            const lastSeen = Number(p.lastSeen) || now;
            // Protect against clock skew between mobile and desktop:
            // If lastSeen is in the future (skew), age is 0. If in the past, now - lastSeen.
            const age = now >= lastSeen ? (now - lastSeen) : 0;

            // Consider peer active if updated within 60 seconds
            if (age < 60000) {
              list.push({
                ...p,
                id: p.id || id
              });
            }
          });
          setPeers(list);
        } else {
          setPeers([]);
        }
      });

      // 2. Listen for active transfers (both incoming offers & outgoing responses)
      const transfersDocRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
      unsubTransfers = onSnapshot(transfersDocRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        const transfersMap = data.transfers || {};

        Object.keys(transfersMap).forEach(async (id) => {
          const trans = transfersMap[id];
          if (!trans) return;

          // ─── ROLE A: RECEIVER ───
          if (trans.receiverId === peerId) {
            // New incoming transfer request
            if (trans.status === 'pending') {
              if (!incomingTransferRef.current || incomingTransferRef.current.id !== trans.id) {
                playNotificationSound();
                setIncomingTransfer({ ...trans, progress: 0 });
              }
            }

            // Late ICE candidates from sender during accepted state
            if (trans.status === 'accepted' && incomingTransferRef.current?.id === trans.id) {
              if (trans.senderCandidates && peerConnectionRef.current) {
                trans.senderCandidates.forEach((cand) => {
                  const candKey = cand.candidate || JSON.stringify(cand);
                  if (!processedCandidatesRef.current.has(candKey)) {
                    processedCandidatesRef.current.add(candKey);
                    addIceCandidateSafe(peerConnectionRef.current, cand, iceQueueRef);
                  }
                });
              }
            }

            // Sender cancelled request
            if (trans.status === 'cancelled' && incomingTransferRef.current?.id === trans.id) {
              setIncomingTransfer(null);
              closeWebRTC();
            }
          }

          // ─── ROLE B: SENDER ───
          if (trans.senderId === peerId && outgoingTransferRef.current?.id === trans.id) {
            // Receiver accepted and sent SDP Answer
            if (trans.status === 'accepted' && trans.answer && peerConnectionRef.current) {
              if (peerConnectionRef.current.signalingState === 'have-local-offer') {
                try {
                  console.log('[AzeraDrop] Sender received SDP answer, setting remote description...');
                  await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(trans.answer));
                  await flushIceCandidateQueue(peerConnectionRef.current, iceQueueRef);
                } catch (e) {
                  console.error('[AzeraDrop] Failed to set remote answer description:', e);
                }
              }

              // Late ICE candidates from receiver
              if (trans.receiverCandidates && peerConnectionRef.current) {
                trans.receiverCandidates.forEach((cand) => {
                  const candKey = cand.candidate || JSON.stringify(cand);
                  if (!processedCandidatesRef.current.has(candKey)) {
                    processedCandidatesRef.current.add(candKey);
                    addIceCandidateSafe(peerConnectionRef.current, cand, iceQueueRef);
                  }
                });
              }
            }

            // Receiver declined
            if (trans.status === 'declined') {
              setOutgoingTransfer((prev) => prev ? { ...prev, status: 'declined' } : null);
              closeWebRTC();
            }

            // Completed on receiver
            if (trans.status === 'completed' && outgoingTransferRef.current?.status !== 'completed') {
              setOutgoingTransfer((prev) => prev ? { ...prev, progress: 100, status: 'completed' } : null);
            }
          }
        });
      });
    };

    setupListeners();

    return () => {
      if (unsubPeers) unsubPeers();
      if (unsubTransfers) unsubTransfers();
    };
  }, [isFirebaseReady, firebaseService, networkKey, peerId]);

  // Handle peer selection for file sharing
  const handlePeerClick = (peer) => {
    selectedPeerRef.current = peer;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Sender: Initialize P2P connection, gather candidates, send SDP Offer and stream file
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    const peer = selectedPeerRef.current;
    if (!file || !peer || !networkKey || !firebaseService?.db) return;

    closeWebRTC();
    const transferId = `trans-${Date.now()}`;
    
    setOutgoingTransfer({
      id: transferId,
      peer,
      fileName: file.name,
      progress: 0,
      status: 'connecting',
      error: null
    });

    // 30s timeout guard
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = setTimeout(() => {
      if (outgoingTransferRef.current?.status === 'connecting') {
        setOutgoingTransfer((prev) => prev ? {
          ...prev,
          status: 'error',
          error: 'Koneksi jalur P2P timeout. Pastikan kedua perangkat berada di jaringan Wi-Fi yang sama atau coba gunakan Room Manual.'
        } : null);
        closeWebRTC();
      }
    }, 30000);

    try {
      // 1. Setup RTCPeerConnection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = pc;
      iceQueueRef.current = [];
      processedCandidatesRef.current.clear();

      // Monitor ICE and connection states
      pc.oniceconnectionstatechange = () => {
        console.log('[AzeraDrop Sender] ICE state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[AzeraDrop Sender] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
        } else if (pc.connectionState === 'failed') {
          setOutgoingTransfer((prev) => prev ? {
            ...prev,
            status: 'error',
            error: 'Jalur P2P gagal tersambung. Pastikan firewall tidak memblokir koneksi lokal.'
          } : null);
          closeWebRTC();
        }
      };

      // 2. Setup DataChannel
      const dc = pc.createDataChannel('fileTransfer', { ordered: true });
      dc.binaryType = 'arraybuffer';
      dataChannelRef.current = dc;

      // 3. Trickle ICE candidate handler (debounced)
      const senderCandidatesList = [];
      let candidateTimer = null;
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          senderCandidatesList.push(ev.candidate.toJSON());
          if (candidateTimer) clearTimeout(candidateTimer);
          candidateTimer = setTimeout(async () => {
            try {
              const { doc, setDoc } = await getFirestoreHelpers();
              const docRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
              await setDoc(docRef, {
                transfers: {
                  [transferId]: { senderCandidates: [...senderCandidatesList] }
                }
              }, { merge: true });
            } catch (e) {}
          }, 150);
        }
      };

      // 4. Data channel open trigger -> Stream file in slices
      dc.onopen = () => {
        console.log('[AzeraDrop] DataChannel is OPEN on Sender! Starting data stream...');
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        setOutgoingTransfer((prev) => prev ? { ...prev, status: 'sending', progress: 0 } : null);
        
        const chunkSize = 16384; // 16KB per frame
        let offset = 0;
        const fileReader = new FileReader();

        const readNextChunk = () => {
          if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;
          const slice = file.slice(offset, offset + chunkSize);
          fileReader.readAsArrayBuffer(slice);
        };

        fileReader.onload = (event) => {
          if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;
          
          const buffer = event.target.result;
          dataChannelRef.current.send(buffer);
          offset += buffer.byteLength;
          
          const progress = Math.min(99, Math.floor((offset / file.size) * 100));
          setOutgoingTransfer((prev) => prev ? { ...prev, progress } : null);

          if (offset < file.size) {
            // Buffer flow control to prevent memory overflow
            if (dataChannelRef.current.bufferedAmount > 65536 * 4) {
              setTimeout(readNextChunk, 20);
            } else {
              readNextChunk();
            }
          } else {
            // Send EOF signal token
            console.log('[AzeraDrop] File stream complete, sending EOF_SIGNAL...');
            dataChannelRef.current.send('EOF_SIGNAL');
            setOutgoingTransfer((prev) => prev ? { ...prev, progress: 100, status: 'completed' } : null);
            
            // Mark complete in Firestore
            getFirestoreHelpers().then(async ({ doc, setDoc }) => {
              try {
                const docRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
                await setDoc(docRef, {
                  transfers: {
                    [transferId]: { status: 'completed' }
                  }
                }, { merge: true });
              } catch (e) {}
            });
          }
        };

        readNextChunk();
      };

      // 5. Create local SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for complete ICE gathering so offer SDP contains all local and STUN candidates (Vanilla ICE)
      await waitForIceGathering(pc, 1200);

      // 6. Push complete Offer & metadata to transfers room doc
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
            fileType: file.type || 'application/octet-stream',
            totalBytes: file.size,
            status: 'pending',
            offer: { sdp: pc.localDescription.sdp, type: pc.localDescription.type },
            senderCandidates: [...senderCandidatesList],
            createdAt: Date.now()
          }
        }
      }, { merge: true });

    } catch (err) {
      console.error('[AzeraDrop] Send file error:', err);
      setOutgoingTransfer((prev) => prev ? { ...prev, status: 'error', error: err.message } : null);
      closeWebRTC();
    }
  };

  // Receiver: Accept P2P connection, gather candidates, send SDP Answer and receive file
  const handleAccept = async () => {
    if (!incomingTransfer || !firebaseService?.db) return;
    
    // Save metadata in ref to avoid closure issues
    const currentTransfer = incomingTransfer;
    transferMetaRef.current = {
      id: currentTransfer.id,
      fileName: currentTransfer.fileName,
      fileType: currentTransfer.fileType || 'application/octet-stream',
      totalBytes: currentTransfer.totalBytes
    };

    closeWebRTC();
    setIncomingTransfer((prev) => prev ? { ...prev, status: 'connecting', progress: 0 } : null);

    // 30s timeout guard
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = setTimeout(() => {
      if (incomingTransferRef.current?.status === 'connecting') {
        setIncomingTransfer((prev) => prev ? {
          ...prev,
          status: 'error',
          error: 'Koneksi jalur P2P timeout. Pastikan kedua perangkat berada di jaringan Wi-Fi yang sama.'
        } : null);
        closeWebRTC();
      }
    }, 30000);

    try {
      // 1. Setup peer connection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = pc;
      iceQueueRef.current = [];
      processedCandidatesRef.current.clear();

      pc.oniceconnectionstatechange = () => {
        console.log('[AzeraDrop Receiver] ICE state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[AzeraDrop Receiver] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
        } else if (pc.connectionState === 'failed') {
          setIncomingTransfer((prev) => prev ? {
            ...prev,
            status: 'error',
            error: 'Jalur P2P gagal tersambung.'
          } : null);
          closeWebRTC();
        }
      };

      // 2. Trickle ICE candidate handler (debounced)
      const receiverCandidatesList = [];
      let candidateTimer = null;
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          receiverCandidatesList.push(ev.candidate.toJSON());
          if (candidateTimer) clearTimeout(candidateTimer);
          candidateTimer = setTimeout(async () => {
            try {
              const { doc, setDoc } = await getFirestoreHelpers();
              const docRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
              await setDoc(docRef, {
                transfers: {
                  [currentTransfer.id]: { receiverCandidates: [...receiverCandidatesList] }
                }
              }, { merge: true });
            } catch (e) {}
          }, 150);
        }
      };

      // 3. Listen for data channel creation
      pc.ondatachannel = (ev) => {
        console.log('[AzeraDrop] Receiver got ondatachannel!');
        const dc = ev.channel;
        dc.binaryType = 'arraybuffer';
        dataChannelRef.current = dc;

        dc.onopen = () => {
          console.log('[AzeraDrop] DataChannel is OPEN on Receiver! Ready to receive data...');
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setIncomingTransfer((prev) => prev ? { ...prev, status: 'receiving', progress: 0 } : null);
        };

        receivedChunksRef.current = [];
        receivedSizeRef.current = 0;

        dc.onmessage = (e) => {
          // Check for string EOF token
          if (typeof e.data === 'string' && e.data === 'EOF_SIGNAL') {
            console.log('[AzeraDrop] Received EOF_SIGNAL! Assembling file blob...');
            const meta = transferMetaRef.current || currentTransfer;
            const fileBlob = new Blob(receivedChunksRef.current, { type: meta.fileType });
            const fileUrl = URL.createObjectURL(fileBlob);
            
            // Trigger instant download
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = meta.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(fileUrl);

            setIncomingTransfer((prev) => prev ? { ...prev, status: 'completed', progress: 100 } : null);
            closeWebRTC();
          } else {
            // Binary arraybuffer chunk
            receivedChunksRef.current.push(e.data);
            receivedSizeRef.current += e.data.byteLength;
            
            const meta = transferMetaRef.current || currentTransfer;
            const progress = Math.min(99, Math.floor((receivedSizeRef.current / meta.totalBytes) * 100));
            setIncomingTransfer((prev) => prev ? { ...prev, progress } : null);
          }
        };
      };

      // 4. Set Remote SDP Description (Offer from Sender)
      await pc.setRemoteDescription(new RTCSessionDescription(currentTransfer.offer));
      await flushIceCandidateQueue(pc, iceQueueRef);

      // Add sender candidates if any already arrived
      if (currentTransfer.senderCandidates) {
        currentTransfer.senderCandidates.forEach((cand) => {
          const candKey = cand.candidate || JSON.stringify(cand);
          if (!processedCandidatesRef.current.has(candKey)) {
            processedCandidatesRef.current.add(candKey);
            addIceCandidateSafe(pc, cand, iceQueueRef);
          }
        });
      }

      // 5. Generate SDP Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for complete ICE gathering so answer SDP contains all local and STUN candidates (Vanilla ICE)
      await waitForIceGathering(pc, 1200);

      // 6. Write Answer to Firestore
      const { doc, setDoc } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
      
      await setDoc(docRef, {
        transfers: {
          [currentTransfer.id]: {
            status: 'accepted',
            answer: { sdp: pc.localDescription.sdp, type: pc.localDescription.type },
            receiverCandidates: [...receiverCandidatesList]
          }
        }
      }, { merge: true });

    } catch (err) {
      console.error('[AzeraDrop] Accept transfer error:', err);
      setIncomingTransfer((prev) => prev ? { ...prev, status: 'error', error: err.message } : null);
      closeWebRTC();
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
          [incomingTransfer.id]: {
            status: 'declined'
          }
        }
      }, { merge: true });
      
      setIncomingTransfer(null);
      closeWebRTC();

      setTimeout(async () => {
        try {
          await setDoc(docRef, {
            transfers: {
              [incomingTransfer.id]: deleteField()
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
      closeWebRTC();
    }
  };

  const closeOutgoingModal = async () => {
    if (outgoingTransfer && firebaseService?.db) {
      try {
        const { doc, setDoc, deleteField } = await getFirestoreHelpers();
        const docRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
        await setDoc(docRef, {
          transfers: {
            [outgoingTransfer.id]: deleteField()
          }
        }, { merge: true });
      } catch (e) {}
    }
    setOutgoingTransfer(null);
    closeWebRTC();
  };

  const closeIncomingModal = async () => {
    if (incomingTransfer && firebaseService?.db) {
      try {
        const { doc, setDoc, deleteField } = await getFirestoreHelpers();
        const docRef = doc(firebaseService.db, 'notes', `drop_transfers_${networkKey}`);
        await setDoc(docRef, {
          transfers: {
            [incomingTransfer.id]: deleteField()
          }
        }, { merge: true });
      } catch (e) {}
    }
    setIncomingTransfer(null);
    closeWebRTC();
  };

  return (
    <div className="azera-wrapper">
      {/* Segmented control tab header for mobile view layout */}
      <div className="azera-tabs-header">
        <button 
          className={`azera-tab-btn ${activeTab === 'radar' ? 'azera-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('radar')}
        >
          📡 Radar Pencarian
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
              
              {(!incomingTransfer.status || incomingTransfer.status === 'pending') && (
                <>
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
                </>
              )}

              {incomingTransfer.status === 'connecting' && (
                <div className="azera-status">
                  <div className="spinner-mini" />
                  <span>Menghubungkan jalur P2P...</span>
                  <button onClick={closeIncomingModal} className="btn btn--decline" style={{ marginTop: '14px', width: '100%' }}>Batal</button>
                </div>
              )}

              {incomingTransfer.status === 'receiving' && (
                <div className="azera-progress">
                  <div className="azera-progress__bar">
                    <div className="fill" style={{ width: `${incomingTransfer.progress}%` }} />
                  </div>
                  <span>Menerima data... {incomingTransfer.progress}%</span>
                </div>
              )}

              {incomingTransfer.status === 'completed' && (
                <div className="azera-status success">
                  <span>🟢 Berkas selesai diunduh secara P2P!</span>
                  <button onClick={closeIncomingModal} className="btn btn--ok">Tutup</button>
                </div>
              )}

              {incomingTransfer.status === 'error' && (
                <div className="azera-status error">
                  <span>Gagal: {incomingTransfer.error}</span>
                  <button onClick={closeIncomingModal} className="btn btn--ok">Tutup</button>
                </div>
              )}
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
              
              {outgoingTransfer.status === 'connecting' && (
                <div className="azera-status">
                  <div className="spinner-mini" />
                  <span>Menghubungkan jalur P2P...</span>
                  <button onClick={closeOutgoingModal} className="btn btn--decline" style={{ marginTop: '14px', width: '100%' }}>Batal</button>
                </div>
              )}

              {outgoingTransfer.status === 'sending' && (
                <div className="azera-progress">
                  <div className="azera-progress__bar">
                    <div className="fill" style={{ width: `${outgoingTransfer.progress}%` }} />
                  </div>
                  <span>Mengirim langsung... {outgoingTransfer.progress}%</span>
                </div>
              )}

              {outgoingTransfer.status === 'completed' && (
                <div className="azera-status success">
                  <span>🟢 Berkas diterima & diunduh!</span>
                  <button onClick={closeOutgoingModal} className="btn btn--ok">Tutup</button>
                </div>
              )}

              {outgoingTransfer.status === 'declined' && (
                <div className="azera-status error">
                  <span>🔴 Pengiriman ditolak oleh penerima.</span>
                  <button onClick={closeOutgoingModal} className="btn btn--ok">Tutup</button>
                </div>
              )}

              {outgoingTransfer.status === 'error' && (
                <div className="azera-status error">
                  <span>Gagal: {outgoingTransfer.error}</span>
                  <button onClick={closeOutgoingModal} className="btn btn--ok">Tutup</button>
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
              *AzeraDrop menggunakan <strong>WebRTC (DataChannel)</strong> untuk mengirimkan file secara langsung antar-browser tanpa server perantara. Berkas dikirim langsung lewat Wi-Fi/LAN lokal dengan kecepatan maksimal tanpa batas ukuran berkas.
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
              const baseRadius = isMobile ? 80 : 110;
              const radius = baseRadius + (idx % 2 === 0 ? 0 : (isMobile ? 15 : 25));
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

          {/* Quick peer list bar for mobile when devices are found */}
          {peers.length > 0 && isMobile && (
            <div className="azera-mobile-peer-list">
              <span className="azera-mobile-peer-list__title">Perangkat Ditemukan ({peers.length}):</span>
              <div className="azera-mobile-peer-list__items">
                {peers.map((peer) => (
                  <button
                    key={peer.id}
                    onClick={() => handlePeerClick(peer)}
                    className="azera-mobile-peer-chip"
                  >
                    <span className="avatar">{peer.avatar}</span>
                    <span className="name">{peer.name}</span>
                    <span className="action">Kirim ➔</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
