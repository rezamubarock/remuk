import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@core/store';
import { useWindowManager } from '@core/hooks/useWindowManager';
import { TOOLS } from '@core/registry';

const LAUNCHPAD_VARIANTS = {
  initial: { opacity: 0, scale: 1.08 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2, ease: 'easeIn' } },
};

const Launchpad = () => {
  const setLaunchpadOpen = useStore((s) => s.setLaunchpadOpen);
  const appPlacements = useStore((s) => s.appPlacements) || {};
  const { openTool } = useWindowManager();

  const [search, setSearch] = useState('');

  // Clear search on mount
  useEffect(() => {
    setSearch('');
  }, []);

  const appOrder = useStore((s) => s.appOrder) || [];

  // Filter tools: must be in drawer/launchpad AND match search filter
  const sortedTools = [...TOOLS].sort((a, b) => {
    const idxA = appOrder.indexOf(a.id);
    const idxB = appOrder.indexOf(b.id);
    const posA = idxA === -1 ? 999 : idxA;
    const posB = idxB === -1 ? 999 : idxB;
    return posA - posB;
  });

  const drawerApps = sortedTools.filter((tool) => {
    const placement = appPlacements[tool.id] || { drawer: true };
    const matchesDrawer = placement.drawer !== false;
    const matchesSearch = tool.name.toLowerCase().includes(search.toLowerCase());
    return matchesDrawer && matchesSearch;
  });

  const handleAppClick = (e, toolId) => {
    e.stopPropagation(); // prevent closing launchpad
    openTool(toolId);
    setLaunchpadOpen(false);
  };

  return (
    <motion.div
      className="launchpad-overlay"
      variants={LAUNCHPAD_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={() => setLaunchpadOpen(false)}
    >
      {/* Clicking inside launchpad-content (outside grid items or search bar) bubbles up to close */}
      <div className="launchpad-content">
        {/* Search bar */}
        <div className="launchpad-search-container" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            placeholder="Cari Aplikasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="launchpad-search"
            autoFocus
          />
        </div>

        {/* Grid list of apps */}
        <div className="launchpad-grid">
          {drawerApps.map((tool) => (
            <motion.div
              key={tool.id}
              className="launchpad-item"
              onClick={(e) => handleAppClick(e, tool.id)}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            >
              <div
                className="launchpad-item__icon"
                style={{
                  background: `linear-gradient(145deg, ${tool.color || '#0A84FF'}, ${tool.colorAlt || '#5E5CE6'})`,
                }}
              >
                <span style={{ fontSize: 44, lineHeight: 1 }}>{tool.icon}</span>
              </div>
              <span className="launchpad-item__label">{tool.name}</span>
            </motion.div>
          ))}

          {drawerApps.length === 0 && (
            <div className="launchpad-empty" onClick={(e) => e.stopPropagation()}>
              <span>🔍</span>
              <p>Aplikasi tidak ditemukan</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Launchpad;
