import { create } from 'zustand';

interface DebugPanelState {
  isOpen: boolean;
  position: { x: number; y: number };
  collapsedSections: Set<string>; // 'events', 'network', 'abilities', 'state'
  eventLimit: number;
  autoScroll: boolean;
  selectedTarget: 'self' | 'opponent';
  pingHistory: number[]; // Last 10 ping results

  // Actions
  togglePanel: () => void;
  setPosition: (x: number, y: number) => void;
  toggleSection: (section: string) => void;
  setEventLimit: (limit: number) => void;
  setAutoScroll: (enabled: boolean) => void;
  setSelectedTarget: (target: 'self' | 'opponent') => void;
  addPingResult: (rtt: number) => void;
  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
}

export const useDebugStore = create<DebugPanelState>((set, get) => ({
  isOpen: false,
  position: { x: 10, y: 10 },
  collapsedSections: new Set(),
  eventLimit: 100,
  autoScroll: true,
  selectedTarget: 'opponent',
  pingHistory: [],

  togglePanel: () => {
    set(state => ({ isOpen: !state.isOpen }));
    get().saveToLocalStorage();
  },

  setPosition: (x, y) => {
    set({ position: { x, y } });
    get().saveToLocalStorage();
  },

  toggleSection: (section) => {
    set(state => {
      const newSet = new Set(state.collapsedSections);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return { collapsedSections: newSet };
    });
    get().saveToLocalStorage();
  },

  setEventLimit: (limit) => set({ eventLimit: limit }),

  setAutoScroll: (enabled) => set({ autoScroll: enabled }),

  setSelectedTarget: (target) => set({ selectedTarget: target }),

  addPingResult: (rtt) => {
    set(state => {
      const newHistory = [...state.pingHistory, rtt];
      if (newHistory.length > 10) newHistory.shift();
      return { pingHistory: newHistory };
    });
  },

  loadFromLocalStorage: () => {
    try {
      const position = localStorage.getItem('tetris_debug_panel_position');
      const collapsed = localStorage.getItem('tetris_debug_panel_collapsed');
      const settings = localStorage.getItem('tetris_debug_panel_settings');

      if (position) set({ position: JSON.parse(position) });
      if (collapsed) set({ collapsedSections: new Set(JSON.parse(collapsed)) });
      if (settings) {
        const s = JSON.parse(settings);
        set({ eventLimit: s.eventLimit, autoScroll: s.autoScroll });
      }
    } catch (e) {
      console.warn('Failed to load debug panel settings:', e);
    }
  },

  saveToLocalStorage: () => {
    const { position, collapsedSections, eventLimit, autoScroll } = get();
    try {
      localStorage.setItem('tetris_debug_panel_position', JSON.stringify(position));
      localStorage.setItem('tetris_debug_panel_collapsed', JSON.stringify([...collapsedSections]));
      localStorage.setItem('tetris_debug_panel_settings', JSON.stringify({ eventLimit, autoScroll }));
    } catch (e) {
      console.warn('Failed to save debug panel settings:', e);
    }
  },
}));
