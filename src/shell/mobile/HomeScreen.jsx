import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@core/store';
import { TOOLS } from '@core/registry';
import { Suspense } from 'react';

const ICONS_PER_PAGE = 20; // 4 columns × 5 rows

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
  const [showDrawerFolder, setShowDrawerFolder] = useState(false);
  
  const appPlacements = useStore((s) => s.appPlacements);
  const touchStartX = useRef(null);

  // Filter tools to only those shown on home screen
  const desktopTools = TOOLS.filter((tool) => {
    const placement = appPlacements[tool.id] || { desktop: true };
    return placement.desktop !== false;
  });

  // Filter tools shown in drawer/folder
  const drawerTools = TOOLS.filter((tool) => {
    const placement = appPlacements[tool.id] || { drawer: true };
    return placement.drawer !== false;
  });

  // Prepare tools list to render, adding App Drawer Folder at the end
  const finalTools = [...desktopTools];
  if (drawerTools.length > 0) {
    finalTools.push({
      id: 'app-drawer-folder',
      name: 'Laci Aplikasi',
      icon: '📂',
      isFolder: true,
    });
  }

  // Split final list of items into screen pages
  const pages = [];
  for (let i = 0; i < finalTools.length; i += ICONS_PER_PAGE) {
    pages.push(finalTools.slice(i, i + ICONS_PER_PAGE));
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
                tool.isFolder ? (
                  <motion.div
                    key={tool.id}
                    className="app-icon-mobile"
                    onClick={() => setShowDrawerFolder(true)}
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                    role="button"
                    aria-label="Buka Laci Aplikasi"
                    tabIndex={0}
                  >
                    <div className="app-icon-mobile__app" style={{ background: 'linear-gradient(145deg, #1d1d26, #2c2c3e)' }}>
                      <span style={{ fontSize: 30, lineHeight: 1 }}>📂</span>
                    </div>
                    <span className="app-icon-mobile__label">{tool.name}</span>
                  </motion.div>
                ) : (
                  <MobileAppIcon
                    key={tool.id}
                    tool={tool}
                    onOpen={setOpenTool}
                  />
                )
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

      {/* Mobile iOS-like App Folder Pop-up */}
      <AnimatePresence>
        {showDrawerFolder && (
          <motion.div 
            className="mobile-folder-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDrawerFolder(false)}
          >
            <motion.div 
              className="mobile-folder-card glass"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mobile-folder-header">
                <h3>Laci Aplikasi</h3>
              </div>
              <div className="mobile-folder-grid">
                {drawerTools.map((tool) => (
                  <div 
                    key={tool.id} 
                    className="app-icon-mobile"
                    onClick={() => {
                      setOpenTool(tool);
                      setShowDrawerFolder(false);
                    }}
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
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
