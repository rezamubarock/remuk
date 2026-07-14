import React from 'react';
import Wallpaper from '../Wallpaper';
import MenuBar from './MenuBar';
import Dock from './Dock';
import WindowLayer from '@components/Window';
import NotificationCenter from '@components/Notification';
import { useWindowManager } from '@core/hooks/useWindowManager';

const Desktop = () => {
  const { focusedWindow } = useWindowManager();

  return (
    <div className="desktop">
      {/* Background */}
      <Wallpaper />

      {/* Menu Bar */}
      <MenuBar activeWindowTitle={focusedWindow?.title} />

      {/* Desktop workspace (click deselects) */}
      <div
        className="desktop__workspace"
        onMouseDown={(e) => {
          // Only deselect if clicking directly on workspace (not on window)
          if (e.target === e.currentTarget) {
            // Deselect: no action needed, Zustand keeps last active
          }
        }}
      />

      {/* Windows */}
      <WindowLayer />

      {/* Dock */}
      <Dock />

      {/* Notifications */}
      <NotificationCenter />
    </div>
  );
};

export default Desktop;
