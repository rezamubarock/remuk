import React, { useState, useEffect } from 'react';
import DeviceShell from './shell/DeviceShell';
import Lockscreen from './shell/Lockscreen';
import { useStore } from './core/store';
import { getToolById } from './core/registry';

const App = () => {
  const openApp = useStore((s) => s.openApp);
  const [isLocked, setIsLocked] = useState(true);

  // Handle URL shortcut: ?open=tool-id
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toolId = params.get('open');
    if (toolId) {
      const tool = getToolById(toolId);
      if (tool) openApp(tool);
    }
  }, [openApp]);

  if (isLocked) {
    return <Lockscreen onUnlock={() => setIsLocked(false)} />;
  }

  return <DeviceShell />;
};

export default App;
