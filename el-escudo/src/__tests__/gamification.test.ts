import { calculateLevel, getRankTitle } from '../utils/gamification';

describe('gamification utils', () => {
  describe('calculateLevel', () => {
    it('returns level 1 for 0 XP', () => {
      const result = calculateLevel(0);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(0);
      expect(result.nextLevelXp).toBe(1000);
    });

    it('returns level 1 for XP less than 1000', () => {
      const result = calculateLevel(500);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(500);
      expect(result.xpForLevel).toBe(0);
    });

    it('returns level 2 for exactly 1000 XP', () => {
      const result = calculateLevel(1000);
      expect(result.level).toBe(2);
      expect(result.currentLevelXp).toBe(0);
      expect(result.xpForLevel).toBe(1000);
    });

    it('returns level 5 for 4905 XP', () => {
      const result = calculateLevel(4905);
      expect(result.level).toBe(5);
      expect(result.currentLevelXp).toBe(905);
      expect(result.xpForLevel).toBe(4000);
    });

    it('returns level 10 for 9999 XP', () => {
      const result = calculateLevel(9999);
      expect(result.level).toBe(10);
      expect(result.currentLevelXp).toBe(999);
    });

    it('returns level 20 for 19000 XP', () => {
      const result = calculateLevel(19000);
      expect(result.level).toBe(20);
      expect(result.currentLevelXp).toBe(0);
    });

    it('handles very high XP values correctly', () => {
      const result = calculateLevel(99999);
      expect(result.level).toBe(100);
      expect(result.currentLevelXp).toBe(999);
    });

    it('treats negative XP as 0', () => {
      const result = calculateLevel(-500);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(0);
    });

    it('treats negative XP consistently', () => {
      const result = calculateLevel(-10000);
      expect(result.level).toBe(1);
      expect(result.xpForLevel).toBe(0);
    });
  });

  describe('getRankTitle', () => {
    it('returns RECLUTA for level 1', () => {
      expect(getRankTitle(1)).toBe('RECLUTA');
    });

    it('returns RECLUTA for level 2', () => {
      expect(getRankTitle(2)).toBe('RECLUTA');
    });

    it('returns SOLDADO EXPERTO for level 3', () => {
      expect(getRankTitle(3)).toBe('SOLDADO EXPERTO');
    });

    it('returns SOLDADO EXPERTO for level 4', () => {
      expect(getRankTitle(4)).toBe('SOLDADO EXPERTO');
    });

    it('returns CABO PRIMERO for level 5', () => {
      expect(getRankTitle(5)).toBe('CABO PRIMERO');
    });

    it('returns CABO PRIMERO for level 6', () => {
      expect(getRankTitle(6)).toBe('CABO PRIMERO');
    });

    it('returns TENENTE TÁCTICO for level 7', () => {
      expect(getRankTitle(7)).toBe('TENENTE TÁCTICO');
    });

    it('returns TENENTE TÁCTICO for level 9', () => {
      expect(getRankTitle(9)).toBe('TENENTE TÁCTICO');
    });

    it('returns CAPITÁN DE ÉLITE for level 10', () => {
      expect(getRankTitle(10)).toBe('CAPITÁN DE ÉLITE');
    });

    it('returns CAPITÁN DE ÉLITE for level 14', () => {
      expect(getRankTitle(14)).toBe('CAPITÁN DE ÉLITE');
    });

    it('returns GENERAL DE DIVISIÓN for level 15', () => {
      expect(getRankTitle(15)).toBe('GENERAL DE DIVISIÓN');
    });

    it('returns GENERAL DE DIVISIÓN for level 19', () => {
      expect(getRankTitle(19)).toBe('GENERAL DE DIVISIÓN');
    });

    it('returns COMANDANTE SUPREMO for level 20', () => {
      expect(getRankTitle(20)).toBe('COMANDANTE SUPREMO');
    });

    it('returns COMANDANTE SUPREMO for very high levels', () => {
      expect(getRankTitle(100)).toBe('COMANDANTE SUPREMO');
    });

    it('treats negative levels as level 1 (RECLUTA)', () => {
      expect(getRankTitle(-5)).toBe('RECLUTA');
    });

    it('treats level 0 as level 1 (RECLUTA)', () => {
      expect(getRankTitle(0)).toBe('RECLUTA');
    });
  });
});
