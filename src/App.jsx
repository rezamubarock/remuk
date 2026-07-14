import React, { useEffect } from 'react';
import DeviceShell from './shell/DeviceShell';
import { useStore } from './core/store';
import { getToolById } from './core/registry';

const App = () => {
  const openApp = useStore((s) => s.openApp);

  // Handle URL shortcut: ?open=tool-id
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toolId = params.get('open');
    if (toolId) {
      const tool = getToolById(toolId);
      if (tool) openApp(tool);
    }
  }, [openApp]);

  return <DeviceShell />;
};

export default App;
