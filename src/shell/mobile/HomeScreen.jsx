import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TOOLS } from '@core/registry';
import { Suspense } from 'react';

const ICONS_PER_PAGE = 20; // 4 kolom × 5 baris

/* ─── Mobile App Icon ─── */
const MobileAppIcon = ({ tool, onOpen }) => (
  <motion.div
    className="app-icon-mobile"
    onClick={() => onOpen(tool)}
    whileTap={{ scale: 0.88 }}
    transition={{ type: 'spring', stiffness: 600, damping: 20 }}
    role="button"
    aria-label={`Buka ${tool.name}`}
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onOpen(tool)}
  >
    <div
      className="app-icon-mobile__app"
      style={{
        background: `linear-gradient(145deg, ${tool.color || '#0A84FF'}, ${tool.colorAlt || '#5E5CE6'})`,
      }}
    >
      <span style={{ fontSize: 30, lineHeight: 1 }}>{tool.icon}</span>
    </div>
    <span className="app-icon-mobile__label">{tool.name}</span>
  </motion.div>
);

/* ─── Mobile App Sheet ─── */
const AppSheet = ({ tool, onClose }) => {
  const ToolComponent = tool?.component;

  return (
    <motion.div
      className="app-sheet"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
    >
      <div className="app-sheet__header">
        <button className="app-sheet__back" onClick={onClose} aria-label="Kembali">
          ‹ Kembali
        </button>
        <span className="app-sheet__title">
          {tool.icon} {tool.name}
        </span>
      </div>
      <div className="app-sheet__body">
        <Suspense
          fallback={
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16, color:'rgba(255,255,255,0.4)' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.1)', borderTopColor:'#0A84FF', animation:'spin 0.8s linear infinite' }} />
              <span style={{ fontSize:13 }}>Memuat {tool.name}…</span>
            </div>
          }
        >
          {ToolComponent ? <ToolComponent /> : null}
        </Suspense>
      </div>
    </motion.div>
  );
};

/* ─── Home Screen ─── */
const HomeScreen = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [openTool, setOpenTool] = useState(null);
  const touchStartX = useRef(null);

  // Split tools into pages
  const pages = [];
  for (let i = 0; i < TOOLS.length; i += ICONS_PER_PAGE) {
    pages.push(TOOLS.slice(i, i + ICONS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  /* ─── Swipe Gesture ─── */
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0 && currentPage < pages.length - 1) setCurrentPage((p) => p + 1);
      if (dx > 0 && currentPage > 0) setCurrentPage((p) => p - 1);
    }
    touchStartX.current = null;
  };

  return (
    <>
      {/* Home Screen */}
      <div
        className="homescreen"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="homescreen__pages"
          style={{ transform: `translateX(${-currentPage * 100}vw)` }}
        >
          {pages.map((pageTool, pi) => (
            <div key={pi} className="homescreen__page">
              {pageTool.map((tool) => (
                <MobileAppIcon
                  key={tool.id}
                  tool={tool}
                  onOpen={setOpenTool}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Page indicator dots */}
      {pages.length > 1 && (
        <div className="page-indicator">
          {pages.map((_, i) => (
            <div
              key={i}
              className={`page-dot ${i === currentPage ? 'page-dot--active' : ''}`}
              onClick={() => setCurrentPage(i)}
            />
          ))}
        </div>
      )}

      {/* App Sheet overlay */}
      <AnimatePresence>
        {openTool && (
          <AppSheet
            key={openTool.id}
            tool={openTool}
            onClose={() => setOpenTool(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default HomeScreen;
