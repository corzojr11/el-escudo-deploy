import { useMemo } from 'react';
import { useAppStore } from '../store';
import { darkColors, lightColors } from './colors';

export const useColors = () => {
  const isDarkMode = useAppStore((state) => state.isDarkMode ?? true);
  
  return useMemo(() => (isDarkMode ? darkColors : lightColors), [isDarkMode]);
};
