import React, { Suspense, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowManager } from '@core/hooks/useWindowManager';
import { getToolById } from '@core/registry';

const WINDOW_VARIANTS = {
  initial: { opacity: 0, scale: 0.88, y: 20 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 10,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

/* ─────────────────────────────────────────
   Window Chrome Component
───────────────────────────────────────── */
const Window = ({ win }) => {
  const {
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    updateWindowPosition,
    updateWindowSize,
    snapWindow,
    setSnapIndicator,
    activeWindowId,
  } = useWindowManager();

  const windowRef = useRef(null);
  const dragState = useRef(null);
  const resizeState = useRef(null);
  const tool = getToolById(win.toolId);

  const isFocused = win.id === activeWindowId;

  /* ─── Drag Logic ─── */
  const handleTitlebarMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.traffic-lights')) return;
      if (win.maximized) return;

      focusWindow(win.id);
      e.preventDefault();

      const startX = e.clientX - win.position.x;
      const startY = e.clientY - win.position.y;

      dragState.current = { startX, startY };

      const onMouseMove = (ev) => {
        const x = ev.clientX - dragState.current.startX;
        const y = Math.max(28, ev.clientY - dragState.current.startY); // can't go above menubar

        updateWindowPosition(win.id, { x, y });

        // Snap indicator
        if (ev.clientX < 20) {
          setSnapIndicator('left');
        } else if (ev.clientX > window.innerWidth - 20) {
          setSnapIndicator('right');
        } else {
          setSnapIndicator(null);
        }
      };

      const onMouseUp = (ev) => {
        if (ev.clientX < 20) snapWindow(win.id, 'left');
        else if (ev.clientX > window.innerWidth - 20) snapWindow(win.id, 'right');
        else setSnapIndicator(null);

        dragState.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [win, focusWindow, updateWindowPosition, snapWindow, setSnapIndicator]
  );

  /* ─── Resize Logic ─── */
  const handleResizeMouseDown = useCallback(
    (e, direction) => {
      if (!win.resizable || win.maximized) return;
      e.preventDefault();
      e.stopPropagation();

      focusWindow(win.id);

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = win.size.width;
      const startH = win.size.height;
      const startPX = win.position.x;
      const startPY = win.position.y;
      const minW = win.minSize?.width || 280;
      const minH = win.minSize?.height || 200;

      resizeState.current = { direction };

      const onMouseMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let newW = startW, newH = startH, newX = startPX, newY = startPY;

        if (direction.includes('e')) newW = Math.max(minW, startW + dx);
        if (direction.includes('w')) {
          newW = Math.max(minW, startW - dx);
          newX = startPX + (startW - newW);
        }
        if (direction.includes('s')) newH = Math.max(minH, startH + dy);
        if (direction.includes('n')) {
          newH = Math.max(minH, startH - dy);
          newY = Math.max(28, startPY + (startH - newH));
        }

        updateWindowPosition(win.id, { x: newX, y: newY });
        updateWindowSize(win.id, { width: newW, height: newH });
      };

      const onMouseUp = () => {
        resizeState.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [win, focusWindow, updateWindowPosition, updateWindowSize]
  );

  /* ─── Double-click title bar to maximize ─── */
  const handleTitlebarDoubleClick = () => toggleMaximizeWindow(win.id);

  if (win.minimized) return null;

  const windowStyle = win.maximized
    ? {}
    : {
        left: win.position.x,
        top: win.position.y,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.zIndex,
      };

  const ToolComponent = tool?.component;

  return (
    <motion.div
      key={win.id}
      ref={windowRef}
      className={`window ${isFocused ? 'window--focused' : ''} ${win.maximized ? 'window--maximized' : ''}`}
      style={windowStyle}
      variants={WINDOW_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      onMouseDown={() => focusWindow(win.id)}
      data-window-id={win.id}
    >
      {/* Title Bar */}
      <div
        className="window__titlebar"
        onMouseDown={handleTitlebarMouseDown}
        onDoubleClick={handleTitlebarDoubleClick}
      >
        {/* Traffic Lights */}
        <div className="traffic-lights">
          <button
            className="traffic-light traffic-light--close"
            title="Tutup"
            onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
          />
          <button
            className="traffic-light traffic-light--minimize"
            title="Sembunyikan"
            onClick={(e) => { e.stopPropagation(); minimizeWindow(win.id); }}
          />
          <button
            className="traffic-light traffic-light--maximize"
            title="Perbesar"
            onClick={(e) => { e.stopPropagation(); toggleMaximizeWindow(win.id); }}
          />
        </div>

        {/* Window Icon + Title */}
        <span className="window__icon">{win.icon}</span>
        <span className="window__title">{win.title}</span>
      </div>

      {/* Window Body */}
      <div className="window__body">
        <Suspense
          fallback={
            <div className="window-loader">
              <div className="window-loader__spinner" />
              <span className="window-loader__text">Memuat {win.title}…</span>
            </div>
          }
        >
          {ToolComponent ? <ToolComponent windowId={win.id} /> : (
            <div className="window-loader">
              <span style={{ fontSize: 32 }}>❓</span>
              <span className="window-loader__text">Tool tidak ditemukan</span>
            </div>
          )}
        </Suspense>
      </div>

      {/* Resize Handles */}
      {win.resizable && !win.maximized && (
        <>
          {['n','s','e','w','ne','nw','se','sw'].map((dir) => (
            <div
              key={dir}
              className={`resize-handle resize-handle--${dir}`}
              onMouseDown={(e) => handleResizeMouseDown(e, dir)}
            />
          ))}
        </>
      )}
    </motion.div>
  );
};

/* ─────────────────────────────────────────
   Window Layer — renders all windows
───────────────────────────────────────── */
const WindowLayer = () => {
  const { windows, snapIndicator } = useWindowManager();

  return (
    <>
      {/* Snap Indicator */}
      <AnimatePresence>
        {snapIndicator && (
          <motion.div
            key={`snap-${snapIndicator}`}
            className={`snap-indicator snap-indicator--${snapIndicator}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Windows */}
      <div className="window-layer">
        <AnimatePresence>
          {windows.map((win) => (
            <Window key={win.id} win={win} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

export default WindowLayer;
