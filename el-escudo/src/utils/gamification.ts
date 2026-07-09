const XP_PER_LEVEL = 1000;

/**
 * Calculates the user's level and XP progress based on total accumulated XP.
 *
 * @param totalXp - Total experience points accumulated by the user.
 * @returns Object containing level, XP for current level, current level XP, and XP needed for next level.
 */
export const calculateLevel = (totalXp: number) => {
  const safeXp = Math.max(0, totalXp);
  const level = Math.floor(safeXp / XP_PER_LEVEL) + 1;
  const xpForLevel = (level - 1) * XP_PER_LEVEL;
  const currentLevelXp = safeXp - xpForLevel;
  const nextLevelXp = XP_PER_LEVEL;
  return { level, xpForLevel, currentLevelXp, nextLevelXp };
};

/**
 * Returns a military-style rank title based on the user's level.
 *
 * @param level - The user's current level (1+).
 * @returns Rank title string.
 */
export const getRankTitle = (level: number): string => {
  const safeLevel = Math.max(1, level);
  if (safeLevel >= 20) return 'COMANDANTE SUPREMO';
  if (safeLevel >= 15) return 'GENERAL DE DIVISIÓN';
  if (safeLevel >= 10) return 'CAPITÁN DE ÉLITE';
  if (safeLevel >= 7) return 'TENENTE TÁCTICO';
  if (safeLevel >= 5) return 'CABO PRIMERO';
  if (safeLevel >= 3) return 'SOLDADO EXPERTO';
  return 'RECLUTA';
};
