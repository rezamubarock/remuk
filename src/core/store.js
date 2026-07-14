import { create } from 'zustand';
import { persist } from 'zustand/middleware';

let windowIdCounter = 1;

const generateWindowId = () => `win-${Date.now()}-${windowIdCounter++}`;

const DEFAULT_POSITION_OFFSET = 30;

/**
 * Hitung posisi window baru agar cascade (bertumpuk rapi)
 */
const calculateInitialPosition = (existingWindows, defaultSize) => {
  const menubarHeight = 28;
  const dockHeight = 90;
  const margin = 40;

  const availW = window.innerWidth - defaultSize.width - margin * 2;
  const availH = window.innerHeight - menubarHeight - dockHeight - defaultSize.height - margin * 2;

  const offset = (existingWindows.length % 8) * DEFAULT_POSITION_OFFSET;

  return {
    x: Math.max(margin, Math.min(margin + offset, availW + margin)),
    y: Math.max(menubarHeight + margin, Math.min(menubarHeight + margin + offset, availH + menubarHeight + margin)),
  };
};

export const useStore = create(
  persist(
    (set, get) => ({
      // ─── Window State ───
      windows: [],
      activeWindowId: null,
      snapIndicator: null, // 'left' | 'right' | null

      /**
       * Buka tool sebagai window baru
       * @param {object} tool - dari registry TOOLS
       */
      openApp: (tool) => {
        const state = get();
        const { windows } = state;

        // Singleton check: jika tool.singleton dan sudah ada → fokuskan saja
        if (tool.singleton) {
          const existing = windows.find((w) => w.toolId === tool.id && !w.minimized);
          if (existing) {
            get().focusWindow(existing.id);
            return;
          }
        }

        const position = calculateInitialPosition(windows, tool.defaultSize);

        const newWindow = {
          id: generateWindowId(),
          toolId: tool.id,
          title: tool.name,
          icon: tool.icon,
          position,
          size: { ...tool.defaultSize },
          minSize: tool.minSize || { width: 280, height: 200 },
          resizable: tool.resizable !== false,
          minimized: false,
          maximized: false,
          zIndex: 100 + windows.length + 1,
        };

        set((s) => ({
          windows: [...s.windows, newWindow],
          activeWindowId: newWindow.id,
        }));
      },

      /**
       * Tutup window berdasarkan ID
       */
      closeWindow: (windowId) => {
        set((s) => {
          const remaining = s.windows.filter((w) => w.id !== windowId);
          const newActive =
            s.activeWindowId === windowId
              ? remaining.length > 0
                ? remaining[remaining.length - 1].id
                : null
              : s.activeWindowId;
          return { windows: remaining, activeWindowId: newActive };
        });
      },

      /**
       * Minimize window
       */
      minimizeWindow: (windowId) => {
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === windowId ? { ...w, minimized: true, maximized: false } : w
          ),
          activeWindowId:
            s.activeWindowId === windowId ? null : s.activeWindowId,
        }));
      },

      /**
       * Restore window dari minimize
       */
      restoreWindow: (windowId) => {
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === windowId ? { ...w, minimized: false } : w
          ),
          activeWindowId: windowId,
        }));
        get().focusWindow(windowId);
      },

      /**
       * Toggle maximize window
       */
      toggleMaximizeWindow: (windowId) => {
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === windowId ? { ...w, maximized: !w.maximized } : w
          ),
        }));
      },

      /**
       * Fokuskan window (bawa ke depan)
       */
      focusWindow: (windowId) => {
        set((s) => {
          const maxZ = Math.max(...s.windows.map((w) => w.zIndex), 100);
          return {
            activeWindowId: windowId,
            windows: s.windows.map((w) =>
              w.id === windowId ? { ...w, zIndex: maxZ + 1 } : w
            ),
          };
        });
      },

      /**
       * Update posisi window (saat drag)
       */
      updateWindowPosition: (windowId, position) => {
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === windowId ? { ...w, position } : w
          ),
        }));
      },

      /**
       * Update ukuran window (saat resize)
       */
      updateWindowSize: (windowId, size) => {
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === windowId ? { ...w, size } : w
          ),
        }));
      },

      /**
       * Snap window ke kiri atau kanan (split view)
       */
      snapWindow: (windowId, side) => {
        const menubarHeight = 28;
        const dockHeight = 90;
        const w = window.innerWidth / 2;
        const h = window.innerHeight - menubarHeight - dockHeight;

        set((s) => ({
          windows: s.windows.map((win) =>
            win.id === windowId
              ? {
                  ...win,
                  maximized: false,
                  position: { x: side === 'left' ? 0 : w, y: menubarHeight },
                  size: { width: w, height: h },
                }
              : win
          ),
          snapIndicator: null,
        }));
      },

      setSnapIndicator: (side) => set({ snapIndicator: side }),

      // ─── Notification State ───
      notifications: [],

      addNotification: (notification) => {
        const id = `notif-${Date.now()}`;
        set((s) => ({
          notifications: [...s.notifications, { ...notification, id }],
        }));
        setTimeout(() => get().removeNotification(id), notification.duration || 4000);
      },

      removeNotification: (id) => {
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        }));
      },
    }),
    {
      name: 'remuk-state',
      // Hanya persist windows yang tidak minimized untuk menghindari state stale
      partialize: (state) => ({
        windows: state.windows.map((w) => ({
          ...w,
          // Reset minimized state saat reload
          minimized: false,
        })),
        activeWindowId: state.activeWindowId,
      }),
    }
  )
);
