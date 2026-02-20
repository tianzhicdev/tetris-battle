import { Icon } from './Icon';

interface ControlButtonProps {
  icon: string;
  wide?: boolean;
  pressed?: boolean;
  onPress?: () => void;
}

export function ControlButton({ icon, wide, pressed, onPress }: ControlButtonProps) {
  return (
    <button
      onPointerDown={onPress}
      style={{
        width: wide ? 58 : 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: pressed
          ? 'rgba(0,240,240,0.08)'
          : 'rgba(255,255,255,0.025)',
        border: pressed
          ? '1px solid rgba(0,240,240,0.2)'
          : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 0.1s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon
        type="control"
        name={icon}
        color={pressed ? '#00f0f0' : '#ffffff30'}
        size={24}
      />
    </button>
  );
}
