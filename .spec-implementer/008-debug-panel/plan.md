# Implementation Plan for Spec 008: Debug Panel

## Overview
- Total steps: 14
- Estimated new files: 8
- Estimated modified files: 5

## Steps

### Step 1: Create DebugLogger Service (Pure Logic)

**Files to create:**
- `packages/web/src/services/debug/DebugLogger.ts` — Event logging service

**Implementation details:**
```typescript
export interface DebugEvent {
  timestamp: number;
  direction: 'in' | 'out';
  type: string;
  data: any;
}

export class DebugLogger {
  private events: DebugEvent[] = [];
  private subscribers: Set<(events: DebugEvent[]) => void> = new Set();
  private maxEvents: number = 500;

  logIncoming(data: any): void {
    this.addEvent({ timestamp: Date.now(), direction: 'in', type: data.type, data });
  }

  logOutgoing(data: any): void {
    this.addEvent({ timestamp: Date.now(), direction: 'out', type: data.type, data });
  }

  private addEvent(event: DebugEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift(); // Keep only last maxEvents
    }
    this.notify();
  }

  subscribe(callback: (events: DebugEvent[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    this.subscribers.forEach(cb => cb([...this.events]));
  }

  getEvents(): DebugEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
    this.notify();
  }

  setMaxEvents(max: number): void {
    this.maxEvents = max;
  }

  exportToJSON(): string {
    return JSON.stringify(this.events, null, 2);
  }
}
```

**Test:**
- Create `packages/web/src/__tests__/debugLogger.test.ts`
- Test cases:
  - Should log incoming messages
  - Should log outgoing messages
  - Should limit to maxEvents
  - Should notify subscribers
  - Should clear events
  - Should export to JSON
- Run: `pnpm --filter web test debugLogger`

**Verify:**
- Tests pass
- Build succeeds: `pnpm --filter web build`

---

### Step 2: Create Debug Store (State Management)

**Files to create:**
- `packages/web/src/stores/debugStore.ts` — Zustand store for debug panel state

**Implementation details:**
Follow the pattern from `abilityStore.ts` (line 32-38):
```typescript
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
```

**Test:**
- Create `packages/web/src/__tests__/debugStore.test.ts`
- Test cases:
  - Should toggle panel open/closed
  - Should update position
  - Should toggle sections
  - Should add ping results and limit to 10
- Run: `pnpm --filter web test debugStore`

**Verify:**
- Tests pass
- Build succeeds

---

### Step 3: Modify ServerAuthGameClient to Support Debug Logging

**Files to modify:**
- `packages/web/src/services/partykit/ServerAuthGameClient.ts`

**Implementation details:**

1. **Line 2**: Add import:
```typescript
import type { DebugLogger } from '../debug/DebugLogger';
```

2. **Line 36**: Add private property:
```typescript
private debugLogger: DebugLogger | null = null;
```

3. **Line 38**: Update constructor signature:
```typescript
constructor(roomId: string, playerId: string, host: string, loadout: string[], _aiOpponent?: any, debugLogger?: DebugLogger) {
  this.roomId = roomId;
  this.playerId = playerId;
  this.loadout = loadout;
  this.debugLogger = debugLogger || null;
  // ... existing PartySocket initialization
}
```

4. **Line 61**: Wrap message handler (after `JSON.parse`):
```typescript
this.socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  this.debugLogger?.logIncoming(data); // ADD THIS LINE

  switch (data.type) {
    // ... existing cases
  }
});
```

5. **Line 127-130**: Wrap send method:
```typescript
private send(data: any): void {
  if (this.socket.readyState === WebSocket.OPEN) {
    this.debugLogger?.logOutgoing(data); // ADD THIS LINE
    this.socket.send(JSON.stringify(data));
  }
}
```

6. **Add new method at end of class**:
```typescript
/**
 * Send ping for RTT measurement
 */
sendPing(callback: (rtt: number) => void): void {
  const timestamp = Date.now();
  const handler = (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    if (data.type === 'debug_pong' && data.timestamp === timestamp) {
      const rtt = Date.now() - timestamp;
      callback(rtt);
      this.socket.removeEventListener('message', handler);
    }
  };
  this.socket.addEventListener('message', handler);
  this.send({ type: 'debug_ping', timestamp });
}
```

**Test:**
No new test file needed (integration tested in Step 10).

**Verify:**
- Build succeeds
- No TypeScript errors

---

### Step 4: Modify PartykitGameSync to Support Debug Logging

**Files to modify:**
- `packages/web/src/services/partykit/gameSync.ts`

**Implementation details:**

1. **Line 2**: Add import:
```typescript
import type { DebugLogger } from '../debug/DebugLogger';
```

2. **Line 10**: Add private property:
```typescript
private debugLogger: DebugLogger | null = null;
```

3. **Line 12**: Update constructor signature:
```typescript
constructor(roomId: string, playerId: string, host: string, aiOpponent?: any, debugLogger?: DebugLogger) {
  this.roomId = roomId;
  this.playerId = playerId;
  this.aiOpponent = aiOpponent;
  this.debugLogger = debugLogger || null;
  // ... existing initialization
}
```

4. **Line 35**: Wrap message handler:
```typescript
this.socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  this.debugLogger?.logIncoming(data); // ADD THIS LINE

  switch (data.type) {
    // ... existing cases
  }
});
```

5. **Line 149**: Wrap send method:
```typescript
private send(data: any): void {
  if (this.socket.readyState === WebSocket.OPEN) {
    this.debugLogger?.logOutgoing(data); // ADD THIS LINE
    this.socket.send(JSON.stringify(data));
  }
}
```

6. **Add new method at end of class**:
```typescript
sendPing(callback: (rtt: number) => void): void {
  const timestamp = Date.now();
  const handler = (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    if (data.type === 'debug_pong' && data.timestamp === timestamp) {
      const rtt = Date.now() - timestamp;
      callback(rtt);
      this.socket.removeEventListener('message', handler);
    }
  };
  this.socket.addEventListener('message', handler);
  this.send({ type: 'debug_ping', timestamp });
}
```

**Test:**
No new test file needed (integration tested in Step 11).

**Verify:**
- Build succeeds
- No TypeScript errors

---

### Step 5: Add Debug Ping/Pong to PartyKit Server

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

1. **Line 123**: Add new case in onMessage switch statement (before the existing cases):
```typescript
onMessage(message: string, sender: Party.Connection) {
  const data = JSON.parse(message);

  // Debug ping/pong support
  if (data.type === 'debug_ping') {
    sender.send(JSON.stringify({
      type: 'debug_pong',
      timestamp: data.timestamp,
      serverTime: Date.now(),
    }));
    return;
  }

  switch (data.type) {
    // ... existing cases
  }
}
```

**Test:**
No unit test needed (integration tested via client in Step 10/11).

**Verify:**
- Build succeeds: `pnpm --filter partykit build`
- No TypeScript errors

---

### Step 6: Create EventsLog Component

**Files to create:**
- `packages/web/src/components/debug/EventsLog.tsx`

**Implementation details:**
Follow MainMenu.tsx styling patterns (inline styles with glassDark):
```typescript
import { useEffect, useRef, useState } from 'react';
import type { DebugEvent } from '../../services/debug/DebugLogger';
import { glassDark, mergeGlass } from '../../styles/glassUtils';

interface EventsLogProps {
  events: DebugEvent[];
  autoScroll: boolean;
  onClear: () => void;
  onExport: () => void;
}

export function EventsLog({ events, autoScroll, onClear, onExport }: EventsLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const filteredEvents = filter
    ? events.filter(e => e.type.toLowerCase().includes(filter.toLowerCase()))
    : events;

  const getEventColor = (event: DebugEvent): string => {
    if (event.type.includes('error')) return '#ff0000';
    if (event.type.includes('ability')) return '#ffaa00';
    if (event.direction === 'in') return '#00aaff';
    return '#ffaa00';
  };

  const formatTime = (timestamp: number): string => {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Filter by type..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={mergeGlass(glassDark(), {
            padding: '4px 8px',
            fontSize: '10px',
            border: '1px solid rgba(0, 255, 0, 0.3)',
            borderRadius: '4px',
            color: '#00ff00',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            flex: 1,
            marginRight: '8px',
          })}
        />
        <button onClick={onClear} style={buttonStyle}>Clear</button>
        <button onClick={onExport} style={{ ...buttonStyle, marginLeft: '4px' }}>Export</button>
      </div>

      <div
        ref={scrollRef}
        style={{
          maxHeight: '200px',
          overflowY: 'auto',
          fontSize: '10px',
          fontFamily: 'monospace',
        }}
      >
        {filteredEvents.map((event, i) => (
          <div
            key={i}
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            style={{
              padding: '4px 8px',
              borderBottom: '1px solid rgba(0, 255, 0, 0.2)',
              cursor: 'pointer',
              color: getEventColor(event),
            }}
          >
            <div>
              [{formatTime(event.timestamp)}] {event.direction === 'in' ? '↓' : '↑'} {event.type}
            </div>
            {expandedIndex === i && (
              <pre style={{ fontSize: '9px', marginTop: '4px', color: '#aaa' }}>
                {JSON.stringify(event.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
        {filteredEvents.length} / {events.length} events
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '10px',
  border: '1px solid rgba(0, 255, 0, 0.5)',
  borderRadius: '4px',
  backgroundColor: 'rgba(0, 255, 0, 0.1)',
  color: '#00ff00',
  cursor: 'pointer',
};
```

**Test:**
No dedicated test (visually verified in Step 13).

**Verify:**
- Component compiles
- No TypeScript errors

---

### Step 7: Create NetworkStats Component

**Files to create:**
- `packages/web/src/components/debug/NetworkStats.tsx`

**Implementation details:**
```typescript
import { glassDark, mergeGlass } from '../../styles/glassUtils';

interface NetworkStatsProps {
  pingHistory: number[];
  onPingTest: () => void;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

export function NetworkStats({ pingHistory, onPingTest, connectionStatus }: NetworkStatsProps) {
  const currentRTT = pingHistory[pingHistory.length - 1];
  const avgRTT = pingHistory.length > 0
    ? Math.round(pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length)
    : 0;
  const minRTT = pingHistory.length > 0 ? Math.min(...pingHistory) : 0;
  const maxRTT = pingHistory.length > 0 ? Math.max(...pingHistory) : 0;

  const statusColor = {
    connected: '#00ff00',
    connecting: '#ffaa00',
    disconnected: '#ff0000',
  }[connectionStatus];

  return (
    <div style={{ marginBottom: '12px', fontSize: '11px' }}>
      <div style={{ marginBottom: '6px' }}>
        <div style={{ color: '#aaa' }}>Connection: <span style={{ color: statusColor }}>{connectionStatus.toUpperCase()}</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
        <div>RTT: <span style={{ color: '#00ff9d' }}>{currentRTT || '--'}ms</span></div>
        <div>Avg: <span style={{ color: '#00aaff' }}>{avgRTT || '--'}ms</span></div>
        <div>Min: <span style={{ color: '#00ff00' }}>{minRTT || '--'}ms</span></div>
        <div>Max: <span style={{ color: '#ff6600' }}>{maxRTT || '--'}ms</span></div>
      </div>
      <button onClick={onPingTest} style={buttonStyle}>
        Ping Test
      </button>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '10px',
  border: '1px solid rgba(0, 255, 0, 0.5)',
  borderRadius: '4px',
  backgroundColor: 'rgba(0, 255, 0, 0.1)',
  color: '#00ff00',
  cursor: 'pointer',
  width: '100%',
};
```

**Test:**
No dedicated test (visually verified in Step 13).

**Verify:**
- Component compiles
- No TypeScript errors

---

### Step 8: Create AbilityTriggers Component

**Files to create:**
- `packages/web/src/components/debug/AbilityTriggers.tsx`

**Implementation details:**
```typescript
import { ABILITIES } from '@tetris-battle/game-core';
import { glassDark, glassBlue, glassPurple, mergeGlass } from '../../styles/glassUtils';

interface AbilityTriggersProps {
  selectedTarget: 'self' | 'opponent';
  onTargetChange: (target: 'self' | 'opponent') => void;
  onTrigger: (abilityType: string, target: 'self' | 'opponent') => void;
}

export function AbilityTriggers({ selectedTarget, onTargetChange, onTrigger }: AbilityTriggersProps) {
  const buffs = Object.values(ABILITIES).filter(a => a.category === 'buff');
  const debuffs = Object.values(ABILITIES).filter(a => a.category === 'debuff');

  const handleTrigger = (abilityType: string) => {
    onTrigger(abilityType, selectedTarget);
  };

  return (
    <div style={{ marginBottom: '12px', fontSize: '10px' }}>
      {/* Target selector */}
      <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="radio"
            checked={selectedTarget === 'self'}
            onChange={() => onTargetChange('self')}
          />
          Self
        </label>
        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="radio"
            checked={selectedTarget === 'opponent'}
            onChange={() => onTargetChange('opponent')}
          />
          Opponent
        </label>
      </div>

      {/* Buffs */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#00aaff', marginBottom: '4px' }}>Self Buffs:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {buffs.map(ability => (
            <button
              key={ability.id}
              onClick={() => handleTrigger(ability.type)}
              style={abilityButtonStyle('#00aaff')}
              title={`${ability.name} (${ability.cost} stars)`}
            >
              {ability.shortName}
            </button>
          ))}
        </div>
      </div>

      {/* Debuffs */}
      <div>
        <div style={{ color: '#ff6600', marginBottom: '4px' }}>Opponent Debuffs:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {debuffs.map(ability => (
            <button
              key={ability.id}
              onClick={() => handleTrigger(ability.type)}
              style={abilityButtonStyle('#ff6600')}
              title={`${ability.name} (${ability.cost} stars)`}
            >
              {ability.shortName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const abilityButtonStyle = (color: string): React.CSSProperties => ({
  padding: '4px 6px',
  fontSize: '9px',
  border: `1px solid ${color}`,
  borderRadius: '3px',
  backgroundColor: `${color}22`,
  color: color,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});
```

**Test:**
No dedicated test (visually verified in Step 13).

**Verify:**
- Component compiles
- No TypeScript errors

---

### Step 9: Create GameStateInspector Component

**Files to create:**
- `packages/web/src/components/debug/GameStateInspector.tsx`

**Implementation details:**
```typescript
import { useState } from 'react';
import { glassDark, mergeGlass } from '../../styles/glassUtils';

interface GameStateInspectorProps {
  yourState: any;
  opponentState: any;
}

export function GameStateInspector({ yourState, opponentState }: GameStateInspectorProps) {
  const [viewingState, setViewingState] = useState<'your' | 'opponent' | null>(null);

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert('Copied to clipboard!');
  };

  return (
    <div style={{ marginBottom: '12px', fontSize: '10px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <button onClick={() => setViewingState('your')} style={buttonStyle}>
          View Your State
        </button>
        <button onClick={() => setViewingState('opponent')} style={buttonStyle}>
          View Opponent State
        </button>
      </div>

      {viewingState && (
        <div style={mergeGlass(glassDark(), {
          padding: '8px',
          borderRadius: '4px',
          maxHeight: '300px',
          overflowY: 'auto',
        })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ color: '#00ff00', fontWeight: 'bold' }}>
              {viewingState === 'your' ? 'Your State' : 'Opponent State'}
            </div>
            <button
              onClick={() => copyToClipboard(viewingState === 'your' ? yourState : opponentState)}
              style={{ ...buttonStyle, fontSize: '9px', padding: '2px 6px' }}
            >
              Copy
            </button>
          </div>
          <pre style={{ fontSize: '9px', color: '#aaa', margin: 0 }}>
            {JSON.stringify(viewingState === 'your' ? yourState : opponentState, null, 2)}
          </pre>
          <button onClick={() => setViewingState(null)} style={{ ...buttonStyle, marginTop: '8px' }}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '10px',
  border: '1px solid rgba(0, 255, 0, 0.5)',
  borderRadius: '4px',
  backgroundColor: 'rgba(0, 255, 0, 0.1)',
  color: '#00ff00',
  cursor: 'pointer',
};
```

**Test:**
No dedicated test (visually verified in Step 13).

**Verify:**
- Component compiles
- No TypeScript errors

---

### Step 10: Create Main DebugPanel Component

**Files to create:**
- `packages/web/src/components/debug/DebugPanel.tsx`

**Implementation details:**
```typescript
import { useEffect, useState, useRef } from 'react';
import { EventsLog } from './EventsLog';
import { NetworkStats } from './NetworkStats';
import { AbilityTriggers } from './AbilityTriggers';
import { GameStateInspector } from './GameStateInspector';
import { useDebugStore } from '../../stores/debugStore';
import { glassDark, mergeGlass } from '../../styles/glassUtils';
import type { DebugLogger } from '../../services/debug/DebugLogger';
import type { DebugEvent } from '../../services/debug/DebugLogger';

interface DebugPanelProps {
  debugLogger: DebugLogger;
  gameClient: any; // ServerAuthGameClient or PartykitGameSync
  yourState: any;
  opponentState: any;
  onAbilityTrigger: (abilityType: string, target: 'self' | 'opponent') => void;
}

export function DebugPanel({
  debugLogger,
  gameClient,
  yourState,
  opponentState,
  onAbilityTrigger,
}: DebugPanelProps) {
  const {
    isOpen,
    position,
    collapsedSections,
    eventLimit,
    autoScroll,
    selectedTarget,
    pingHistory,
    togglePanel,
    setPosition,
    toggleSection,
    setSelectedTarget,
    addPingResult,
    loadFromLocalStorage,
  } = useDebugStore();

  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  // Subscribe to debug logger
  useEffect(() => {
    const unsubscribe = debugLogger.subscribe((newEvents) => {
      setEvents(newEvents.slice(-eventLimit));
    });
    return unsubscribe;
  }, [debugLogger, eventLimit]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        if (e.key === 'D') {
          e.preventDefault();
          togglePanel();
        } else if (e.key === 'L') {
          e.preventDefault();
          debugLogger.clear();
        } else if (e.key === 'P') {
          e.preventDefault();
          handlePingTest();
        } else if (e.key === 'E') {
          e.preventDefault();
          handleExport();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel, debugLogger]);

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition(e.clientX - dragOffset.x, e.clientY - dragOffset.y);
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, setPosition]);

  const handlePingTest = () => {
    if (gameClient?.sendPing) {
      gameClient.sendPing((rtt: number) => {
        addPingResult(rtt);
      });
    }
  };

  const handleExport = () => {
    const json = debugLogger.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tetris-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const connectionStatus = gameClient?.socket?.readyState === WebSocket.OPEN ? 'connected' :
    gameClient?.socket?.readyState === WebSocket.CONNECTING ? 'connecting' : 'disconnected';

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        width: '400px',
        maxHeight: '80vh',
        overflowY: 'auto',
        background: 'rgba(0, 0, 0, 0.95)',
        border: '2px solid #00ff00',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 255, 0, 0.3)',
        fontFamily: 'monospace',
        color: '#00ff00',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          background: 'rgba(0, 255, 0, 0.1)',
          padding: '8px 12px',
          borderBottom: '1px solid #00ff00',
          cursor: 'move',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '12px' }}>🐛 Debug Panel</div>
        <button
          onClick={togglePanel}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#00ff00',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '12px' }}>
        {/* Events Log */}
        <Section title="Events Log" count={events.length} collapsed={collapsedSections.has('events')} onToggle={() => toggleSection('events')}>
          <EventsLog
            events={events}
            autoScroll={autoScroll}
            onClear={() => debugLogger.clear()}
            onExport={handleExport}
          />
        </Section>

        {/* Network Stats */}
        <Section title="Network Stats" collapsed={collapsedSections.has('network')} onToggle={() => toggleSection('network')}>
          <NetworkStats
            pingHistory={pingHistory}
            onPingTest={handlePingTest}
            connectionStatus={connectionStatus}
          />
        </Section>

        {/* Ability Triggers */}
        <Section title="Ability Triggers" collapsed={collapsedSections.has('abilities')} onToggle={() => toggleSection('abilities')}>
          <AbilityTriggers
            selectedTarget={selectedTarget}
            onTargetChange={setSelectedTarget}
            onTrigger={onAbilityTrigger}
          />
        </Section>

        {/* Game State Inspector */}
        <Section title="Game State Inspector" collapsed={collapsedSections.has('state')} onToggle={() => toggleSection('state')}>
          <GameStateInspector
            yourState={yourState}
            opponentState={opponentState}
          />
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          marginBottom: '8px',
          fontSize: '11px',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {collapsed ? '▶' : '▼'} {title} {count !== undefined && `(${count})`}
        </span>
      </div>
      {!collapsed && children}
    </div>
  );
}
```

**Test:**
No dedicated test (integration tested in Step 13).

**Verify:**
- Component compiles
- No TypeScript errors

---

### Step 11: Integrate DebugPanel into ServerAuthMultiplayerGame

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Implementation details:**

1. **Line 5**: Add imports:
```typescript
import { DebugLogger } from '../services/debug/DebugLogger';
import { DebugPanel } from './debug/DebugPanel';
```

2. **Line 61**: Add state for debug mode:
```typescript
const [debugLogger, setDebugLogger] = useState<DebugLogger | null>(null);
const [isDebugMode, setIsDebugMode] = useState(false);
```

3. **Line 93**: Check for debug URL parameter:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.get('debug') === 'true';
  setIsDebugMode(debugEnabled);
  if (debugEnabled) {
    setDebugLogger(new DebugLogger());
  }
}, []);
```

4. **Line 100** (in the existing useEffect that creates ServerAuthGameClient): Pass debugLogger:
```typescript
const gameClient = new ServerAuthGameClient(
  roomId,
  playerId,
  host,
  profile.loadout,
  aiOpponent,
  debugLogger || undefined  // ADD THIS PARAMETER
);
```

5. **Line 458** (in handleAbilityActivate): Add debug mode bypass:
```typescript
const handleAbilityActivate = (abilityType: string) => {
  const ability = ABILITIES[abilityType];
  if (!ability) return;

  // In debug mode, bypass star cost check
  if (!isDebugMode && yourState && yourState.stars < ability.cost) {
    console.log('[ABILITY] Not enough stars:', yourState.stars, '<', ability.cost);
    return;
  }

  // ... rest of existing code
};
```

6. **Line ~550** (in JSX, before the closing fragment): Add DebugPanel:
```typescript
return (
  <>
    {/* ... existing game UI ... */}

    {/* Debug Panel */}
    {isDebugMode && debugLogger && (
      <DebugPanel
        debugLogger={debugLogger}
        gameClient={gameClientRef.current}
        yourState={yourState}
        opponentState={opponentState}
        onAbilityTrigger={(abilityType, target) => {
          if (target === 'opponent') {
            handleAbilityActivate(abilityType);
          } else {
            // Self-targeting abilities (buffs) - trigger on own state
            // For now, just log (server-auth doesn't support self-buffs yet)
            console.log('[DEBUG] Self-ability trigger not implemented in server-auth mode:', abilityType);
          }
        }}
      />
    )}
  </>
);
```

**Test:**
Integration tested in Step 13.

**Verify:**
- Build succeeds
- No TypeScript errors

---

### Step 12: Integrate DebugPanel into PartykitMultiplayerGame

**Files to modify:**
- `packages/web/src/components/PartykitMultiplayerGame.tsx`

**Implementation details:**

1. **Line ~1**: Add imports:
```typescript
import { DebugLogger } from '../services/debug/DebugLogger';
import { DebugPanel } from './debug/DebugPanel';
```

2. **Add state** (after existing useState declarations):
```typescript
const [debugLogger, setDebugLogger] = useState<DebugLogger | null>(null);
const [isDebugMode, setIsDebugMode] = useState(false);
```

3. **Add useEffect for debug mode**:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.get('debug') === 'true';
  setIsDebugMode(debugEnabled);
  if (debugEnabled) {
    setDebugLogger(new DebugLogger());
  }
}, []);
```

4. **Find the line** where PartykitGameSync is instantiated (around line 140), update:
```typescript
const gameSync = new PartykitGameSync(
  roomId,
  playerId,
  host,
  aiOpponent,
  debugLogger || undefined  // ADD THIS PARAMETER
);
```

5. **In handleAbilityActivate** (around line 396): Add debug mode bypass:
```typescript
const handleAbilityActivate = (abilityType: string) => {
  const ability = ABILITIES[abilityType];
  if (!ability) return;

  // In debug mode, bypass star cost check
  if (!isDebugMode && !canActivate(abilityType, gameState.stars)) {
    return;
  }

  // ... rest of existing code
};
```

6. **In JSX** (before closing fragment): Add DebugPanel:
```typescript
{isDebugMode && debugLogger && (
  <DebugPanel
    debugLogger={debugLogger}
    gameClient={gameSyncRef.current}
    yourState={gameState}
    opponentState={opponentGameState}
    onAbilityTrigger={(abilityType, target) => {
      if (target === 'opponent') {
        handleAbilityActivate(abilityType);
      } else {
        // Self buffs - apply locally
        console.log('[DEBUG] Triggering self-ability:', abilityType);
        handleAbilityActivate(abilityType);
      }
    }}
  />
)}
```

**Test:**
Integration tested in Step 13.

**Verify:**
- Build succeeds
- No TypeScript errors

---

### Step 13: Manual Integration Testing

**Test procedure:**

1. **Start dev server:**
```bash
pnpm dev
```

2. **Test debug panel activation:**
   - Open `http://localhost:5173/?debug=true`
   - Press `Ctrl+Shift+D`
   - Verify: Panel appears/disappears

3. **Test panel dragging:**
   - Drag panel header
   - Verify: Panel moves
   - Refresh page
   - Verify: Panel position persists

4. **Test events log:**
   - Start a multiplayer game
   - Press keyboard keys (move left, right, rotate)
   - Verify: Events appear in log with timestamps
   - Click on event
   - Verify: Expands to show full JSON
   - Click "Clear"
   - Verify: Log empties
   - Click "Export"
   - Verify: JSON file downloads

5. **Test network stats:**
   - Click "Ping Test"
   - Verify: RTT value appears
   - Click multiple times
   - Verify: Avg/Min/Max update

6. **Test ability triggers:**
   - Select "Opponent" target
   - Click "QUAKE" (Earthquake)
   - Verify: Opponent's board shifts
   - Verify: No stars deducted
   - Select "Self" target
   - Click "2X STARS" (Cascade Multiplier)
   - Verify: Works (in legacy mode) or logs not implemented (in server-auth mode)

7. **Test state inspector:**
   - Click "View Your State"
   - Verify: JSON modal appears with current game state
   - Click "Copy"
   - Paste into text editor
   - Verify: Valid JSON
   - Click "View Opponent State"
   - Verify: Opponent's state appears

8. **Test keyboard shortcuts:**
   - `Ctrl+Shift+L` → Events log clears
   - `Ctrl+Shift+P` → Ping test runs
   - `Ctrl+Shift+E` → Events export

9. **Test section collapsing:**
   - Click "▼ Events Log"
   - Verify: Collapses to "▶ Events Log"
   - Click again
   - Verify: Expands
   - Refresh page
   - Verify: Collapsed state persists

10. **Test in both modes:**
    - Test with `?debug=true` (legacy mode)
    - Test with `?debug=true&serverAuth=true` (server-auth mode)
    - Verify: Works in both

**Verify:**
- All manual tests pass
- No console errors
- Panel is usable and helpful for debugging

---

### Step 14: Write Tests for Core Components

**Files to create:**
- `packages/web/src/__tests__/debugLogger.test.ts`
- `packages/web/src/__tests__/debugStore.test.ts`

**Implementation details:**

**debugLogger.test.ts:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { DebugLogger } from '../services/debug/DebugLogger';

describe('DebugLogger', () => {
  let logger: DebugLogger;

  beforeEach(() => {
    logger = new DebugLogger();
  });

  it('should log incoming messages', () => {
    logger.logIncoming({ type: 'test', data: 'value' });
    const events = logger.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].direction).toBe('in');
    expect(events[0].type).toBe('test');
  });

  it('should log outgoing messages', () => {
    logger.logOutgoing({ type: 'test', data: 'value' });
    const events = logger.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].direction).toBe('out');
  });

  it('should limit to maxEvents', () => {
    logger.setMaxEvents(3);
    logger.logIncoming({ type: 'msg1' });
    logger.logIncoming({ type: 'msg2' });
    logger.logIncoming({ type: 'msg3' });
    logger.logIncoming({ type: 'msg4' });
    const events = logger.getEvents();
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('msg2'); // First one was dropped
  });

  it('should notify subscribers', () => {
    let notified = false;
    logger.subscribe(() => { notified = true; });
    logger.logIncoming({ type: 'test' });
    expect(notified).toBe(true);
  });

  it('should clear events', () => {
    logger.logIncoming({ type: 'test' });
    logger.clear();
    expect(logger.getEvents()).toHaveLength(0);
  });

  it('should export to JSON', () => {
    logger.logIncoming({ type: 'test', value: 123 });
    const json = logger.exportToJSON();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('test');
  });

  it('should unsubscribe correctly', () => {
    let count = 0;
    const unsubscribe = logger.subscribe(() => { count++; });
    logger.logIncoming({ type: 'test1' });
    expect(count).toBe(1);
    unsubscribe();
    logger.logIncoming({ type: 'test2' });
    expect(count).toBe(1); // Should not increment
  });
});
```

**debugStore.test.ts:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useDebugStore } from '../stores/debugStore';

describe('DebugStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useDebugStore.setState({
      isOpen: false,
      position: { x: 10, y: 10 },
      collapsedSections: new Set(),
      eventLimit: 100,
      autoScroll: true,
      selectedTarget: 'opponent',
      pingHistory: [],
    });
  });

  it('should toggle panel open/closed', () => {
    expect(useDebugStore.getState().isOpen).toBe(false);
    useDebugStore.getState().togglePanel();
    expect(useDebugStore.getState().isOpen).toBe(true);
    useDebugStore.getState().togglePanel();
    expect(useDebugStore.getState().isOpen).toBe(false);
  });

  it('should update position', () => {
    useDebugStore.getState().setPosition(100, 200);
    expect(useDebugStore.getState().position).toEqual({ x: 100, y: 200 });
  });

  it('should toggle sections', () => {
    useDebugStore.getState().toggleSection('events');
    expect(useDebugStore.getState().collapsedSections.has('events')).toBe(true);
    useDebugStore.getState().toggleSection('events');
    expect(useDebugStore.getState().collapsedSections.has('events')).toBe(false);
  });

  it('should add ping results and limit to 10', () => {
    for (let i = 0; i < 15; i++) {
      useDebugStore.getState().addPingResult(i * 10);
    }
    expect(useDebugStore.getState().pingHistory).toHaveLength(10);
    expect(useDebugStore.getState().pingHistory[0]).toBe(50); // First 5 were dropped
  });

  it('should change selected target', () => {
    useDebugStore.getState().setSelectedTarget('self');
    expect(useDebugStore.getState().selectedTarget).toBe('self');
  });

  it('should update event limit', () => {
    useDebugStore.getState().setEventLimit(50);
    expect(useDebugStore.getState().eventLimit).toBe(50);
  });

  it('should update auto scroll', () => {
    useDebugStore.getState().setAutoScroll(false);
    expect(useDebugStore.getState().autoScroll).toBe(false);
  });
});
```

**Test:**
```bash
pnpm --filter web test debugLogger
pnpm --filter web test debugStore
```

**Verify:**
- All tests pass
- Coverage is reasonable (>80% for these files)

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) |
|---------------|-------------------|
| Debug panel opens with `?debug=true` | Step 11, 12 (integration), Step 13 (manual test) |
| Debug panel opens with `Ctrl+Shift+D` | Step 10 (keyboard handler), Step 13 (manual test) |
| Panel is draggable | Step 10 (drag logic), Step 13 (manual test) |
| Panel position persists across refresh | Step 2 (localStorage), Step 10 (load/save), Step 13 (manual test) |
| Events log shows all WebSocket messages | Step 1 (logger), Step 3, 4 (integration), Step 6 (UI), Step 13 (manual test) |
| Network stats update in real-time | Step 7 (component), Step 10 (integration), Step 13 (manual test) |
| Ability triggers work without star cost | Step 8 (UI), Step 11, 12 (bypass logic), Step 13 (manual test) |
| State inspector shows valid JSON | Step 9 (component), Step 10 (integration), Step 13 (manual test) |
| Ping test calculates RTT correctly | Step 3, 4 (sendPing), Step 5 (server pong), Step 7 (UI), Step 13 (manual test) |
| Panel works in both legacy and server-auth modes | Step 3, 4 (both clients), Step 11, 12 (both game components), Step 13 (manual test) |
| Panel handles high message volume (100+ messages/sec) | Step 1 (maxEvents limit), Step 6 (filtered display) |
| Panel handles disconnection gracefully | Step 7 (connection status), Step 13 (manual test) |
| Export works with large logs | Step 1 (exportToJSON), Step 6 (export button), Step 13 (manual test) |
| Events log shows timestamps with millisecond precision | Step 1 (timestamp), Step 6 (formatTime), Step 13 (manual test) |
| Events are color-coded by type | Step 6 (getEventColor), Step 13 (manual test) |
| Expandable rows show full message payload | Step 6 (expandedIndex state), Step 13 (manual test) |
| Filter by message type | Step 6 (filter state), Step 13 (manual test) |
| Clear log button | Step 6 (onClear), Step 10 (keyboard shortcut), Step 13 (manual test) |
| Copy individual message to clipboard | Step 9 (copyToClipboard), Step 13 (manual test) |
| Ping test shows min/max/avg | Step 7 (calculations), Step 13 (manual test) |
| Ability buttons show cost and duration | Step 8 (title attribute), Step 13 (manual test) |
| Keyboard shortcuts work | Step 10 (global listener), Step 13 (manual test) |
| Section collapsing works | Step 10 (Section component), Step 13 (manual test) |

## Build/Test Commands

- **Build all**: `pnpm build:all`
- **Build web**: `pnpm --filter web build`
- **Build partykit**: `pnpm --filter partykit build`
- **Test all web**: `pnpm --filter web test`
- **Test specific**: `pnpm --filter web test debugLogger`
- **Dev mode**: `pnpm dev`
- **Type check**: `pnpm type-check`

## Implementation Order Summary

1. **Pure logic** (Steps 1-2): DebugLogger, debugStore
2. **Integration** (Steps 3-5): Client modifications, server ping/pong
3. **UI components** (Steps 6-10): Sub-components, main panel
4. **Game integration** (Steps 11-12): Wire up to both game modes
5. **Testing** (Steps 13-14): Manual integration tests, unit tests

This order ensures each step builds on tested foundations and nothing is integrated before its dependencies are complete.
