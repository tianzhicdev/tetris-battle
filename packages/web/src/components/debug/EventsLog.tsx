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
              <pre style={{ fontSize: '9px', marginTop: '4px', color: '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
