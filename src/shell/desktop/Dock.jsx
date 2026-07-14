import React from 'react';
import { motion } from 'framer-motion';
import { useWindowManager } from '@core/hooks/useWindowManager';
import { TOOLS } from '@core/registry';

/* ─── Icon background gradient per tool ─── */
const IconBackground = ({ color, colorAlt }) => (
  <div
    className="dock-icon__app-bg"
    style={{
      background: `linear-gradient(145deg, ${color || '#0A84FF'}, ${colorAlt || '#5E5CE6'})`,
    }}
  />
);

/* ─── Single Dock Icon ─── */
const DockIcon = ({ tool }) => {
  const { openTool, isToolRunning, windows, restoreWindow } = useWindowManager();
  const running = isToolRunning(tool.id);

  const handleClick = () => {
    // Jika ada window minimized dari tool ini → restore
    const minimizedWin = windows.find(
      (w) => w.toolId === tool.id && w.minimized
    );
    if (minimizedWin) {
      restoreWindow(minimizedWin.id);
      return;
    }
    openTool(tool.id);
  };

  return (
    <motion.div
      className={`dock-icon ${running ? 'dock-icon--running' : ''}`}
      onClick={handleClick}
      whileHover={{ scale: 1.35, y: -8 }}
      whileTap={{ scale: 1.15, y: -4 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      title={tool.name}
      role="button"
      aria-label={`Buka ${tool.name}`}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <div className="dock-icon__app">
        <IconBackground color={tool.color} colorAlt={tool.colorAlt} />
        <span className="dock-icon__emoji">{tool.icon}</span>
      </div>
      <span className="dock-icon__label">{tool.name}</span>
    </motion.div>
  );
};

import { useStore } from '@core/store';

/* ─── Dock Container ─── */
const Dock = () => {
  const toggleLaunchpad = useStore((s) => s.toggleLaunchpad);
  const appPlacements = useStore((s) => s.appPlacements);
  const appOrder = useStore((s) => s.appOrder) || [];

  // 1. Sort the entire TOOLS list according to the current appOrder
  const sortedTools = [...TOOLS].sort((a, b) => {
    const idxA = appOrder.indexOf(a.id);
    const idxB = appOrder.indexOf(b.id);
    const posA = idxA === -1 ? 999 : idxA;
    const posB = idxB === -1 ? 999 : idxB;
    return posA - posB;
  });

  // 2. Filter tools shown in dock
  const dockTools = sortedTools.filter((tool) => {
    const placement = appPlacements[tool.id] || { dock: true };
    return placement.dock !== false;
  });

  return (
    <div className="dock" role="navigation" aria-label="Dock aplikasi">
      {/* Permanent Launchpad Icon */}
      <motion.div
        className="dock-icon"
        onClick={toggleLaunchpad}
        whileHover={{ scale: 1.35, y: -8 }}
        whileTap={{ scale: 1.15, y: -4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        title="Launchpad"
        role="button"
        aria-label="Buka Launchpad"
        tabIndex={0}
      >
        <div className="dock-icon__app" style={{ background: 'linear-gradient(145deg, #1d1d26, #2c2c3e)' }}>
          <span className="dock-icon__emoji">🚀</span>
        </div>
        <span className="dock-icon__label">Launchpad</span>
      </motion.div>

      {dockTools.length > 0 && <div className="dock__separator" />}

      {/* Placed Dock Tools */}
      {dockTools.map((tool) => (
        <DockIcon key={tool.id} tool={tool} />
      ))}
    </div>
  );
};

export default Dock;
