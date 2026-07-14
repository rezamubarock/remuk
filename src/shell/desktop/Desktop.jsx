import React from 'react';
import Wallpaper from '../Wallpaper';
import MenuBar from './MenuBar';
import Dock from './Dock';
import WindowLayer from '@components/Window';
import NotificationCenter from '@components/Notification';
import { useWindowManager } from '@core/hooks/useWindowManager';

import Launchpad from './Launchpad';

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
          if (e.target === e.currentTarget) {
            // Deselect logic
          }
        }}
      />

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
