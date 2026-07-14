import React from 'react';
import Wallpaper from '../Wallpaper';
import MenuBar from './MenuBar';
import Dock from './Dock';
import WindowLayer from '@components/Window';
import NotificationCenter from '@components/Notification';
import { useWindowManager } from '@core/hooks/useWindowManager';
import { useStore } from '@core/store';
import { TOOLS } from '@core/registry';
import { motion } from 'framer-motion';

import Launchpad from './Launchpad';

const Desktop = () => {
  const { focusedWindow, openTool } = useWindowManager();
  const folders = useStore((s) => s.folders) || [];
  const appPlacements = useStore((s) => s.appPlacements);
  const appOrder = useStore((s) => s.appOrder) || [];
  const openApp = useStore((s) => s.openApp);
  const windows = useStore((s) => s.windows);
  const focusWindow = useStore((s) => s.focusWindow);

  // Grouped tools set
  const toolsInFolders = new Set(folders.flatMap((f) => f.apps || []));

  // Sort tools
  const sortedTools = [...TOOLS].sort((a, b) => {
    const idxA = appOrder.indexOf(a.id);
    const idxB = appOrder.indexOf(b.id);
    const posA = idxA === -1 ? 999 : idxA;
    const posB = idxB === -1 ? 999 : idxB;
    return posA - posB;
  });

  // Filter tools to display directly on desktop screen
  const desktopTools = sortedTools.filter((tool) => {
    const placement = appPlacements[tool.id] || { desktop: true };
    return placement.desktop !== false && !toolsInFolders.has(tool.id);
  });

  // Filter folders to display directly on desktop screen
  const desktopFolders = folders.filter((f) => f.placements?.desktop === true);

  const handleFolderClick = (folder) => {
    const openFolderWindow = windows.find((w) => w.toolId === folder.id);
    if (openFolderWindow) {
      if (openFolderWindow.minimized) {
        useStore.setState({
          windows: windows.map((w) =>
            w.id === openFolderWindow.id ? { ...w, minimized: false } : w
          ),
        });
      }
      focusWindow(openFolderWindow.id);
      return;
    }

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
    <div className="desktop">
      {/* Background */}
      <Wallpaper />

      {/* Menu Bar */}
      <MenuBar activeWindowTitle={focusedWindow?.title} />

      {/* Desktop Workspace */}
      <div className="desktop__workspace">
        {/* Desktop shortcuts container (aligned to top right vertically) */}
        <div className="desktop__shortcuts">
          {/* Render folders on desktop */}
          {desktopFolders.map((folder) => (
            <motion.div
              key={folder.id}
              className="desktop-shortcut-icon"
              onClick={() => handleFolderClick(folder)}
              whileTap={{ scale: 0.95 }}
            >
              <div 
                className="desktop-shortcut-icon__app"
                style={{ background: 'linear-gradient(145deg, rgba(58,58,76,0.8), rgba(31,31,46,0.8))', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span style={{ fontSize: 32 }}>{folder.icon}</span>
              </div>
              <span className="desktop-shortcut-icon__label">{folder.name}</span>
            </motion.div>
          ))}

          {/* Render tools on desktop */}
          {desktopTools.map((tool) => (
            <motion.div
              key={tool.id}
              className="desktop-shortcut-icon"
              onClick={() => openTool(tool.id)}
              whileTap={{ scale: 0.95 }}
            >
              <div 
                className="desktop-shortcut-icon__app"
                style={{
                  background: `linear-gradient(145deg, ${tool.color || '#0A84FF'}, ${tool.colorAlt || '#5E5CE6'})`,
                }}
              >
                <span style={{ fontSize: 32 }}>{tool.icon}</span>
              </div>
              <span className="desktop-shortcut-icon__label">{tool.name}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Windows */}
      <WindowLayer />

      {/* Launchpad Fullscreen Overlay */}
      <Launchpad />

      {/* Dock */}
      <Dock />

      {/* Notifications */}
      <NotificationCenter />
    </div>
  );
};

export default Desktop;
