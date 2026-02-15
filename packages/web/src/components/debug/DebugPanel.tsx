import { useEffect, useState, useRef } from 'react';
import { EventsLog } from './EventsLog';
import { NetworkStats } from './NetworkStats';
import { AbilityTriggers } from './AbilityTriggers';
import { GameStateInspector } from './GameStateInspector';
import { useDebugStore } from '../../stores/debugStore';
import type { DebugLogger } from '../../services/debug/DebugLogger';
import type { DebugEvent } from '../../services/debug/DebugLogger';

interface DebugPanelProps {
  debugLogger: DebugLogger;
  gameClient: any; // ServerAuthGameClient
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
    pingHistory,
    togglePanel,
    setPosition,
    toggleSection,
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
