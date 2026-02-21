import { useState } from 'react';
import { T } from '../design-tokens';
import { audioManager } from '../services/audioManager';

type MenuGroup = 'pve' | 'pvp';
type GameMode = 'multiplayer' | 'defense-line';

interface ModeMenuGroupProps {
  onSelectMode: (selection: { mode: GameMode; aiOpponent: boolean }) => void;
}

export function ModeMenuGroup({ onSelectMode }: ModeMenuGroupProps) {
  const [activeGroup, setActiveGroup] = useState<MenuGroup | null>(null);

  const runLabel = activeGroup === 'pve' ? 'PVE' : 'PVP';
  const helperLabel =
    activeGroup === 'pve'
      ? 'Play against AI opponents'
      : 'Enter matchmaking queues';

  const openGroup = (group: MenuGroup) => {
    audioManager.playSfx('button_click');
    setActiveGroup(group);
  };

  return (
    <div
      style={{
        width: '100%',
        display: 'grid',
        gap: '10px',
        padding: '14px',
        borderRadius: `${T.radius.xl}px`,
        background: T.bg.panel,
        border: `1px solid ${T.accent.cyan}33`,
        boxShadow: `${T.glow(T.accent.cyan, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
        backdropFilter: 'blur(14px)',
      }}
    >
      {!activeGroup && (
        <>
          <button
            onClick={() => openGroup('pve')}
            style={{
              padding: '14px 16px',
              borderRadius: `${T.radius.lg}px`,
              border: `1px solid ${T.accent.green}44`,
              background: 'rgba(0, 240, 140, 0.08)',
              color: T.accent.green,
              cursor: 'pointer',
              fontFamily: T.font.display,
              fontWeight: 700,
              letterSpacing: '2px',
              fontSize: 'clamp(16px, 3.8vw, 20px)',
              textShadow: T.glow(T.accent.green, 0.8),
              boxShadow: T.glow(T.accent.green, 0.35),
              transition: T.transition.normal,
            }}
          >
            PVE
          </button>

          <button
            onClick={() => openGroup('pvp')}
            style={{
              padding: '14px 16px',
              borderRadius: `${T.radius.lg}px`,
              border: `1px solid ${T.accent.cyan}44`,
              background: 'rgba(0, 240, 240, 0.08)',
              color: T.accent.cyan,
              cursor: 'pointer',
              fontFamily: T.font.display,
              fontWeight: 700,
              letterSpacing: '2px',
              fontSize: 'clamp(16px, 3.8vw, 20px)',
              textShadow: T.glow(T.accent.cyan, 0.8),
              boxShadow: T.glow(T.accent.cyan, 0.35),
              transition: T.transition.normal,
            }}
          >
            PVP
          </button>
        </>
      )}

      {activeGroup && (
        <>
          <div
            style={{
              display: 'grid',
              gap: '4px',
              textAlign: 'center',
              paddingBottom: '4px',
            }}
          >
            <div
              style={{
                color: activeGroup === 'pve' ? T.accent.green : T.accent.cyan,
                fontFamily: T.font.display,
                fontWeight: 700,
                letterSpacing: '2px',
                fontSize: 'clamp(16px, 3.8vw, 20px)',
              }}
            >
              {runLabel}
            </div>
            <div
              style={{
                color: T.text.secondary,
                fontSize: '12px',
                letterSpacing: '0.5px',
              }}
            >
              {helperLabel}
            </div>
          </div>

          <button
            onClick={() => onSelectMode({ mode: 'multiplayer', aiOpponent: activeGroup === 'pve' })}
            style={{
              padding: '13px 14px',
              borderRadius: `${T.radius.lg}px`,
              border: `1px solid ${T.accent.purple}55`,
              background: 'rgba(176, 64, 240, 0.12)',
              color: T.accent.purple,
              cursor: 'pointer',
              fontFamily: T.font.display,
              fontWeight: 700,
              letterSpacing: '1.3px',
              fontSize: 'clamp(14px, 3.5vw, 18px)',
              textShadow: T.glow(T.accent.purple, 0.6),
              boxShadow: T.glow(T.accent.purple, 0.25),
              transition: T.transition.normal,
            }}
          >
            Play StackCraft 2
          </button>

          <button
            onClick={() => onSelectMode({ mode: 'defense-line', aiOpponent: activeGroup === 'pve' })}
            style={{
              padding: '13px 14px',
              borderRadius: `${T.radius.lg}px`,
              border: `1px solid ${T.accent.cyan}55`,
              background: 'rgba(0, 240, 240, 0.1)',
              color: T.accent.cyan,
              cursor: 'pointer',
              fontFamily: T.font.display,
              fontWeight: 700,
              letterSpacing: '1.3px',
              fontSize: 'clamp(14px, 3.5vw, 18px)',
              textShadow: T.glow(T.accent.cyan, 0.6),
              boxShadow: T.glow(T.accent.cyan, 0.25),
              transition: T.transition.normal,
            }}
          >
            Play Defense Line
          </button>

          <button
            onClick={() => {
              audioManager.playSfx('button_click');
              setActiveGroup(null);
            }}
            style={{
              padding: '8px 10px',
              marginTop: '2px',
              borderRadius: `${T.radius.md}px`,
              border: `1px solid ${T.border.subtle}`,
              background: T.bg.button,
              color: T.text.secondary,
              cursor: 'pointer',
              fontFamily: T.font.display,
              fontWeight: 600,
              letterSpacing: '1px',
              fontSize: '12px',
              transition: T.transition.fast,
            }}
          >
            Back
          </button>
        </>
      )}
    </div>
  );
}
