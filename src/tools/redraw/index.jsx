import React, { useState, useEffect, useRef } from 'react';
import { useService } from '@core/hooks/useService';
import './redraw.css';

const sha256 = async (string) => {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const BRUSH_COLORS = [
  '#FFFFFF', // White
  '#FF453A', // Red
  '#FF9F0A', // Orange
  '#FFD60A', // Yellow
  '#30D158', // Green
  '#0A84FF', // Blue
  '#BF5AF2', // Purple
  '#FF375F', // Pink
  '#8E8E93', // Grey
];

const ReDraw = () => {
  const { isReady: isFirebaseReady, service: firebaseService } = useService('firebase-firestore');
  
  // Canvas states
  const [networkKey, setNetworkKey] = useState('');
  const [customRoomCode, setCustomRoomCode] = useState(() => localStorage.getItem('remuk_redraw_room') || '');
  const [brushColor, setBrushColor] = useState('#FFFFFF');
  const [brushWidth, setBrushWidth] = useState(5);
  const [activeTool, setActiveTool] = useState('brush'); // 'brush' | 'eraser'
  
  // Drawing state
  const [paths, setPaths] = useState([]);
  
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef(null);
  const pathsStateRef = useRef([]);

  // Sync ref to current paths
  useEffect(() => {
    pathsStateRef.current = paths;
  }, [paths]);

  // Fetch Public IP to identify local network room ID
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
      setNetworkKey(`draw_${hash.substring(0, 12)}`);
    };
    fetchNetKey();
  }, [customRoomCode]);

  // Firestore helpers
  const getFirestoreHelpers = async () => {
    const { doc, setDoc, onSnapshot } = await import('firebase/firestore');
    return { doc, setDoc, onSnapshot };
  };

  // Sync with Firestore: listen to paths change
  useEffect(() => {
    if (!isFirebaseReady || !firebaseService?.db || !networkKey) return;

    let unsub;
    const setupSync = async () => {
      const { doc, onSnapshot } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', `redraw_${networkKey}`);

      unsub = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const remotePaths = data.paths || [];
          setPaths(remotePaths);
          drawAllPaths(remotePaths);
        } else {
          setPaths([]);
          clearLocalCanvas();
        }
      });
    };

    setupSync();
    return () => {
      if (unsub) unsub();
    };
  }, [isFirebaseReady, firebaseService, networkKey]);

  // Setup canvas size & contexts on mount/resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.parentNode.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      contextRef.current = ctx;

      // Redraw everything with the new scale context
      drawAllPaths(pathsStateRef.current);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Utility to clear local canvas context
  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Render all paths on HTML5 Canvas
  const drawAllPaths = (pathsList) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    clearLocalCanvas();

    pathsList.forEach((path) => {
      if (!path.points || path.points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      
      const [start, ...rest] = path.points;
      ctx.moveTo(start.x, start.y);
      rest.forEach((pt) => {
        ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    });
  };

  // Push latest path array list to Firestore
  const saveToFirestore = async (updatedPaths) => {
    if (!isFirebaseReady || !firebaseService?.db || !networkKey) return;
    try {
      const { doc, setDoc } = await getFirestoreHelpers();
      const docRef = doc(firebaseService.db, 'notes', `redraw_${networkKey}`);
      await setDoc(docRef, { paths: updatedPaths });
    } catch (e) {
      console.error('Failed to sync canvas paths:', e);
    }
  };

  // Get relative mouse/touch coordinate from canvas bounding rect
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // Mouse Down / Touch Start
  const startDrawing = (e) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const { x, y } = getCoordinates(e);

    const color = activeTool === 'eraser' ? '#0c0c14' : brushColor;
    const width = brushWidth;

    currentPathRef.current = {
      color,
      width,
      points: [{ x, y }]
    };

    const ctx = contextRef.current;
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.moveTo(x, y);
    }
  };

  // Mouse Move / Touch Move
  const draw = (e) => {
    if (!isDrawingRef.current || !currentPathRef.current) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);

    currentPathRef.current.points.push({ x, y });

    const ctx = contextRef.current;
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  // Mouse Up / Touch End -> Commit path to paths state and push to Firestore
  const stopDrawing = () => {
    if (!isDrawingRef.current || !currentPathRef.current) return;
    isDrawingRef.current = false;

    // Filter out micro points/taps
    if (currentPathRef.current.points.length > 1) {
      const updatedPaths = [...paths, currentPathRef.current];
      setPaths(updatedPaths);
      saveToFirestore(updatedPaths);
    }
    
    currentPathRef.current = null;
  };

  // Undo last stroke path
  const handleUndo = () => {
    if (paths.length === 0) return;
    const updated = paths.slice(0, -1);
    setPaths(updated);
    drawAllPaths(updated);
    saveToFirestore(updated);
  };

  // Reset drawing paths completely
  const handleClear = () => {
    if (paths.length === 0) return;
    if (window.confirm('Hapus seluruh coretan di kanvas ini? Perubahan akan tersinkronisasi ke perangkat lain.')) {
      setPaths([]);
      clearLocalCanvas();
      saveToFirestore([]);
    }
  };

  // Save drawing as PNG Image
  const handleSaveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create temporary canvas to add background fill since canvas is transparent
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Fill dark canvas background
    tempCtx.fillStyle = '#0c0c14';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw main canvas
    tempCtx.drawImage(canvas, 0, 0);

    const url = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `redraw-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRoomConfig = () => {
    const code = prompt("Masukkan Code Room Kanvas baru (misal: redraw123):", customRoomCode);
    if (code !== null) {
      const cleanCode = code.toLowerCase().trim();
      setCustomRoomCode(cleanCode);
      if (cleanCode) {
        localStorage.setItem('remuk_redraw_room', cleanCode);
      } else {
        localStorage.removeItem('remuk_redraw_room');
      }
    }
  };

  return (
    <div className="redraw">
      {/* Upper Control Bar toolbar */}
      <div className="redraw-toolbar">
        {/* Draw tools selector */}
        <div className="redraw-toolbar__group">
          <button 
            className={`tool-btn ${activeTool === 'brush' ? 'tool-btn--active' : ''}`}
            onClick={() => setActiveTool('brush')}
            title="Kuas Coretan"
          >
            ✏️ Kuas
          </button>
          <button 
            className={`tool-btn ${activeTool === 'eraser' ? 'tool-btn--active' : ''}`}
            onClick={() => setActiveTool('eraser')}
            title="Penghapus"
          >
            🧽 Penghapus
          </button>
        </div>

        {/* Brush size slider config */}
        <div className="redraw-toolbar__group scale-slider">
          <span className="slider-label">Ukuran: {brushWidth}px</span>
          <input
            type="range"
            min="2"
            max="25"
            value={brushWidth}
            onChange={(e) => setBrushWidth(parseInt(e.target.value))}
            className="brush-slider"
          />
        </div>

        {/* Actions panel */}
        <div className="redraw-toolbar__group">
          <button onClick={handleUndo} className="action-btn" title="Undo coretan terakhir" disabled={paths.length === 0}>
            ↩️ Undo
          </button>
          <button onClick={handleClear} className="action-btn action-btn--danger" title="Bersihkan seluruh kanvas" disabled={paths.length === 0}>
            🗑️ Bersihkan
          </button>
          <button onClick={handleSaveImage} className="action-btn action-btn--accent" title="Simpan sebagai berkas PNG">
            💾 Simpan PNG
          </button>
        </div>

        {/* Room configuration indicator */}
        <div className="redraw-toolbar__room">
          <span className="room-indicator" title={networkKey}>
            Room: {customRoomCode ? customRoomCode : 'IP Wi-Fi'}
          </span>
          <button onClick={handleRoomConfig} className="room-btn" title="Ganti Room sinkronisasi kanvas">
            ⚙️ Room
          </button>
        </div>
      </div>

      {/* Palette selector (Hidden if Eraser is active) */}
      {activeTool === 'brush' && (
        <div className="redraw-palette">
          {BRUSH_COLORS.map((color) => (
            <button
              key={color}
              className={`color-dot ${brushColor === color ? 'color-dot--active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setBrushColor(color)}
              title={color}
            />
          ))}
        </div>
      )}

      {/* Main Drawing Canvas Container */}
      <div className="redraw-canvas-container">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="redraw-canvas"
        />
      </div>
    </div>
  );
};

export default ReDraw;
