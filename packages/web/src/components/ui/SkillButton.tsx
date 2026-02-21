import { T } from '../../design-tokens';
import { Icon } from './Icon';

interface SkillButtonProps {
  icon: string;
  cost: number;
  color: string;
  active?: boolean;
  canAfford?: boolean;
  onClick?: () => void;
}

export function SkillButton({
  icon,
  cost,
  color,
  active,
  canAfford,
  onClick,
}: SkillButtonProps) {
  return (
    <div
      onClick={canAfford ? onClick : undefined}
      style={{
        width: 52,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        cursor: canAfford ? 'pointer' : 'default',
        opacity: active ? 1 : canAfford ? 0.32 : 0.1,
        transition: 'all 0.25s ease',
        padding: '6px 0',
      }}
    >
      <Icon name={icon} color={color} size={28} active={active} />
      <div
        style={{
          fontSize: 7,
          color: active ? `${color}cc` : '#ffffff33',
          fontFamily: T.font.display,
          letterSpacing: 1,
          transition: 'color 0.25s',
        }}
      >
        ★{cost}
      </div>
    </div>
  );
}
