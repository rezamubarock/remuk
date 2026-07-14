import React from 'react';
import { motion } from 'framer-motion';
import { useWindowManager } from '@core/hooks/useWindowManager';
import { useStore } from '@core/store';
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

/* ─── Single Dock Folder Icon ─── */
const DockFolderIcon = ({ folder }) => {
  const openApp = useStore((s) => s.openApp);
  const windows = useStore((s) => s.windows);
  const restoreWindow = useStore((s) => s.restoreWindow);
  const focusWindow = useStore((s) => s.focusWindow);

  // Check if this folder window is already open
  const openFolderWindow = windows.find((w) => w.toolId === folder.id);
  const running = !!openFolderWindow;

  const handleClick = () => {
    if (openFolderWindow) {
      if (openFolderWindow.minimized) {
        useStore.setState({
          windows: windows.map((w) =>
            w.id === openFolderWindow.id ? { ...w, minimized: false } : w
          ),
        });
        focusWindow(openFolderWindow.id);
      } else {
        focusWindow(openFolderWindow.id);
      }
      return;
    }

    // Open folder as a special window
    openApp({
      id: folder.id,
      name: folder.name,
      icon: folder.icon,
      isFolder: true,
      apps: folder.apps,
      defaultSize: { width: 420, height: 300 },
      minSize: { width: 300, height: 200 },
      resizable: true,
      singleton: true,
    });
  };

  return (
    <motion.div
      className={`dock-icon ${running ? 'dock-icon--running' : ''}`}
      onClick={handleClick}
      whileHover={{ scale: 1.35, y: -8 }}
      whileTap={{ scale: 1.15, y: -4 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      title={folder.name}
      role="button"
      aria-label={`Buka folder ${folder.name}`}
      tabIndex={0}
    >
      <div className="dock-icon__app" style={{ background: 'linear-gradient(145deg, #3a3a4c, #1f1f2e)' }}>
        <span className="dock-icon__emoji">{folder.icon}</span>
      </div>
      <span className="dock-icon__label">{folder.name}</span>
    </motion.div>
  );
};

/* ─── Dock Container ─── */
const Dock = () => {
  const toggleLaunchpad = useStore((s) => s.toggleLaunchpad);
  const appPlacements = useStore((s) => s.appPlacements);
  const appOrder = useStore((s) => s.appOrder) || [];
  const folders = useStore((s) => s.folders) || [];

  // Tools that belong inside any folders
  const toolsInFolders = new Set(folders.flatMap((f) => f.apps || []));

  // 1. Sort the entire TOOLS list according to the current appOrder
  const sortedTools = [...TOOLS].sort((a, b) => {
    const idxA = appOrder.indexOf(a.id);
    const idxB = appOrder.indexOf(b.id);
    const posA = idxA === -1 ? 999 : idxA;
    const posB = idxB === -1 ? 999 : idxB;
    return posA - posB;
  });

  // 2. Filter tools shown in dock (exclude those grouped in folders)
  const dockTools = sortedTools.filter((tool) => {
    const placement = appPlacements[tool.id] || { dock: true };
    const matchesDock = placement.dock !== false;
    const isInsideFolder = toolsInFolders.has(tool.id);
    return matchesDock && !isInsideFolder;
  });

  // 3. Filter folders shown in dock
  const dockFolders = folders.filter((f) => f.placements?.dock === true);

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

      {(dockTools.length > 0 || dockFolders.length > 0) && <div className="dock__separator" />}

      {/* Render Placed Folders first or with apps */}
      {dockFolders.map((folder) => (
        <DockFolderIcon key={folder.id} folder={folder} />
      ))}

      {/* Render Placed Dock Tools */}
      {dockTools.map((tool) => (
        <DockIcon key={tool.id} tool={tool} />
      ))}
    </div>
  );
};

export default Dock;
