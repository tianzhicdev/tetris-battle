export interface AIPersona {
  id: string; // "bot_<name>"
  name: string;
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

  // All AI opponents use adaptive mirroring — no difficulty tiers
  // Rank is set near the target rank with some variance
  let rank: number;

  if (targetRank) {
    // Slight variance around target rank (±100)
    const variance = Math.floor(Math.random() * 200) - 100;
    rank = Math.max(200, targetRank + variance);
  } else {
    // Default to mid-range rank
    rank = 800 + Math.floor(Math.random() * 400);
  }

  return {
    id: `bot_${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    rank,
    isBot: true,
  };
}
