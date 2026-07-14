import { useStore } from '../store';
import { getToolById } from '../registry';

/**
 * Hook untuk berinteraksi dengan window manager.
 * Menyediakan fungsi-fungsi untuk membuka, menutup, dan memanipulasi windows.
 */
export const useWindowManager = () => {
  const {
    windows,
    activeWindowId,
    openApp,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleMaximizeWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    snapWindow,
    setSnapIndicator,
    snapIndicator,
  } = useStore();

  /**
   * Buka tool berdasarkan tool ID
   * @param {string} toolId
   */
  const openTool = (toolId) => {
    const tool = getToolById(toolId);
    if (!tool) {
      console.warn(`[Remuk] Tool tidak ditemukan: "${toolId}"`);
      return;
    }
    openApp(tool);
  };

  /**
   * Ambil semua window yang sedang aktif (tidak minimized)
   */
  const activeWindows = windows.filter((w) => !w.minimized);

  /**
   * Ambil semua window yang di-minimize
   */
  const minimizedWindows = windows.filter((w) => w.minimized);

  /**
   * Cek apakah tool sedang running (ada windownya)
   */
  const isToolRunning = (toolId) => windows.some((w) => w.toolId === toolId);

  /**
   * Ambil window yang sedang focused
   */
  const focusedWindow = windows.find((w) => w.id === activeWindowId);

  return {
    windows,
    activeWindows,
    minimizedWindows,
    activeWindowId,
    focusedWindow,
    snapIndicator,
    openTool,
    openApp,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleMaximizeWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    snapWindow,
    setSnapIndicator,
    isToolRunning,
  };
};
