import { abilityIcons, controlIcons } from './all-icons';

interface IconProps {
  type?: 'ability' | 'control';
  name: string;
  color?: string;
  size?: number;
  glow?: boolean;
  active?: boolean;
}

export function Icon({
  type = 'ability',
  name,
  color = '#fff',
  size = 32,
  glow = false,
  active = false,
}: IconProps) {
  const lib = type === 'control' ? controlIcons : abilityIcons;
  const renderIcon = lib[name];

  const displayColor = active ? color : type === 'control' ? color : '#ffffffcc';

  // If icon not found, render fallback
  if (!renderIcon) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size / 3,
          color: displayColor,
          opacity: 0.5,
        }}
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      style={{
        filter: glow || active ? `drop-shadow(0 0 6px ${color}88)` : 'none',
        transition: 'filter 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      {renderIcon(displayColor, size)}
    </div>
  );
}
