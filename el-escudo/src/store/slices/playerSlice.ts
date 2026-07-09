export interface PlayerSlice {
  player: {
    level: number;
    xpCurrent: number;
    xpToNext: number;
    credits: number;
    title: string;
  };
  racha: {
    days: number;
    activeDays: boolean[];
  };
  xpAnimation: { amount: number; visible: boolean; id: number };
  levelUpNotification: { visible: boolean; newLevel: number; newTitle: string };
  toast: { visible: boolean; message: string };
  missionCompleted: { visible: boolean; missionName: string; xpReward: number };
  achievementUnlocked: { visible: boolean; name: string; description: string };

  addXP: (amount: number) => void;
}

export const createPlayerSlice = (set: any, get: any): PlayerSlice => ({
  player: {
    level: 1,
    xpCurrent: 0,
    xpToNext: 1000,
    credits: 0,
    title: 'Guardián Novato',
  },
  racha: {
    days: 0,
    activeDays: [false, false, false, false, false, false, false],
  },
  xpAnimation: { amount: 0, visible: false, id: 0 },
  levelUpNotification: { visible: false, newLevel: 0, newTitle: '' },
  toast: { visible: false, message: '' },
  missionCompleted: { visible: false, missionName: '', xpReward: 0 },
  achievementUnlocked: { visible: false, name: '', description: '' },

  addXP: (amount: number) => {
    if (amount === 0) return;
    set((state: any) => {
      const p = { ...state.player };
      const currentLevel = p.level;
      const newXP = p.xpCurrent + amount;
      let lvlUp = false;
      let finalXP = newXP;
      let finalLvl = p.level;
      if (newXP >= p.xpToNext) {
        lvlUp = true;
        finalXP = newXP - p.xpToNext;
        finalLvl = p.level + 1;
      } else if (newXP < 0) {
        finalXP = Math.max(0, newXP);
      }
      const leveledUp = finalLvl > currentLevel;
      return {
        player: { ...p, xpCurrent: finalXP, level: finalLvl, credits: amount > 0 ? p.credits + amount : p.credits },
        xpAnimation: amount > 0 ? { amount, visible: true, id: Date.now() } : state.xpAnimation,
        levelUpNotification: leveledUp && amount > 0
          ? { visible: true, newLevel: finalLvl, newTitle: p.title }
          : state.levelUpNotification,
      };
    });
    if (amount > 0) {
      setTimeout(() => {
        set({ xpAnimation: { amount: 0, visible: false, id: 0 } });
      }, 900);
    }
  },
});
