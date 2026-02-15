/**
 * Theme Card Component
 * Individual theme card with preview, name, and active state
 */

import { motion } from 'framer-motion';
import type { Theme } from '../themes/types';
import { ThemePreview } from './ThemePreview';

interface ThemeCardProps {
  theme: Theme;
  isActive: boolean;
  onClick: () => void;
}

export function ThemeCard({ theme, isActive, onClick }: ThemeCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        position: 'relative',
        cursor: 'pointer',
        padding: '12px',
        borderRadius: '12px',
        border: isActive ? '3px solid #60a5fa' : '2px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: isActive ? 'rgba(96, 165, 250, 0.1)' : 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Active Indicator */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#60a5fa',
            boxShadow: '0 0 8px rgba(96, 165, 250, 0.8)',
          }}
        />
      )}

      {/* Preview */}
      <div style={{ marginBottom: '8px' }}>
        <ThemePreview theme={theme} />
      </div>

      {/* Theme Name */}
      <div
        style={{
          fontSize: '14px',
          fontWeight: '600',
          color: isActive ? '#60a5fa' : '#fff',
          textAlign: 'center',
          marginBottom: '4px',
        }}
      >
        {theme.name}
      </div>

      {/* Theme Description */}
      <div
        style={{
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.6)',
          textAlign: 'center',
          lineHeight: '1.3',
          minHeight: '28px',
        }}
      >
        {theme.description}
      </div>

      {/* Category Badge */}
      <div
        style={{
          marginTop: '8px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {theme.category}
      </div>
    </motion.div>
  );
}
