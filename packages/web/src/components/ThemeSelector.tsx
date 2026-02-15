/**
 * Theme Selector Component
 * Modal overlay for selecting themes with category filters
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { getAllThemes } from '../themes/index';
import { ThemeCard } from './ThemeCard';

interface ThemeSelectorProps {
  currentThemeId: string;
  onSelectTheme: (themeId: string) => void;
  onClose: () => void;
}

type ThemeCategory = 'all' | 'modern' | 'retro' | 'artistic' | 'experimental';

const CATEGORY_LABELS: Record<ThemeCategory, string> = {
  all: 'All Themes',
  modern: 'Modern',
  retro: 'Retro',
  artistic: 'Artistic',
  experimental: 'Experimental',
};

export function ThemeSelector({ currentThemeId, onSelectTheme, onClose }: ThemeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<ThemeCategory>('all');
  const allThemes = getAllThemes();

  // Filter themes by category
  const filteredThemes = allThemes.filter(theme => {
    if (selectedCategory === 'all') return true;
    return theme.category === selectedCategory;
  });

  const handleThemeSelect = (themeId: string) => {
    onSelectTheme(themeId);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'rgba(20, 20, 30, 0.95)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h2
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#fff',
                margin: 0,
              }}
            >
              Choose Your Theme
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              ×
            </button>
          </div>

          {/* Category Filter */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {(Object.keys(CATEGORY_LABELS) as ThemeCategory[]).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor:
                    selectedCategory === category
                      ? 'rgba(96, 165, 250, 0.3)'
                      : 'rgba(255, 255, 255, 0.1)',
                  color: selectedCategory === category ? '#60a5fa' : 'rgba(255, 255, 255, 0.7)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={theme.id === currentThemeId}
              onClick={() => handleThemeSelect(theme.id)}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredThemes.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            No themes found in this category.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
