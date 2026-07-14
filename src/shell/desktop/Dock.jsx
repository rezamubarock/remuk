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

/* ─── Dock Container ─── */
const Dock = () => {
  return (
    <div className="dock" role="navigation" aria-label="Dock aplikasi">
      {TOOLS.map((tool) => (
        <DockIcon key={tool.id} tool={tool} />
      ))}
    </div>
  );
};

export default Dock;
