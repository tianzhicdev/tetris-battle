// Icon wrapper component that will integrate with ability and control icons
// For now, this is a placeholder that can be extended when all-icons is created

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
  // TODO: Import actual icon library once created
  // const lib = type === 'control' ? controlIcons : abilityIcons;
  // const render = lib[name];

  const displayColor = active ? color : type === 'control' ? color : '#ffffffcc';

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
      {/* Placeholder - will be replaced with actual icon rendering */}
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size / 3,
          color: displayColor,
        }}
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    </div>
  );
}
