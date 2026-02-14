import type { AIDifficultyLevel } from './aiDifficulty';

export interface AIPersona {
  id: string; // "bot_<name>"
  name: string;
  difficulty: AIDifficultyLevel;
  rank: number;
  isBot: true; // Flag for internal use only
}

const BOT_NAMES = [
  'TetrisBot_42', 'BlockMaster', 'RowClearer', 'StackAttack',
  'LineBuster', 'PiecePerfect', 'GridWarrior', 'ComboKing',
  'TetrisNinja', 'StackSensei', 'DropZone', 'ClearMachine',
  'BlockBuster', 'RowRanger', 'PiecePlayer', 'GridGuru',
  'LineLeader', 'StackStriker', 'TetrisTrainer', 'ComboChamp',
  'PuzzlePro', 'BlockBrigade', 'RowRuler', 'GridGlider',
];

export function generateAIPersona(targetRank?: number): AIPersona {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];

  // If targetRank provided, match difficulty to it
  // Otherwise pick random difficulty
  let difficulty: AIDifficultyLevel;
  let rank: number;

  if (targetRank) {
    // Match difficulty: easy (200-600), medium (700-1300), hard (1400-2200)
    if (targetRank < 700) {
      difficulty = 'easy';
      rank = 200 + Math.floor(Math.random() * 400);
    } else if (targetRank < 1400) {
      difficulty = 'medium';
      rank = 700 + Math.floor(Math.random() * 600);
    } else {
      difficulty = 'hard';
      rank = 1400 + Math.floor(Math.random() * 800);
    }
    // Adjust toward target within range
    rank = Math.floor((rank + targetRank) / 2);
  } else {
    // Random
    difficulty = (['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)]) as AIDifficultyLevel;
    rank = difficulty === 'easy' ? 200 + Math.floor(Math.random() * 400)
         : difficulty === 'medium' ? 700 + Math.floor(Math.random() * 600)
         : 1400 + Math.floor(Math.random() * 800);
  }

  return {
    id: `bot_${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    difficulty,
    rank,
    isBot: true,
  };
}
