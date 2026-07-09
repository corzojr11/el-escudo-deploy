import { useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { copyAsync } from 'expo-file-system/legacy';
import { Goal } from '../types/api';

interface UseGoalShareReturn {
  viewShotRef: React.RefObject<ViewShot>;
  shareGoal: (goal: Goal, completedAt?: string, xpEarned?: number) => Promise<void>;
  isSharing: boolean;
}

export const useGoalShare = (): UseGoalShareReturn => {
  const viewShotRef = useRef<ViewShot>(null);
  const isSharingRef = useRef(false);

  const shareGoal = useCallback(async (goal: Goal, _completedAt?: string, _xpEarned = 500) => {
    if (isSharingRef.current || !viewShotRef.current) return;

    isSharingRef.current = true;

    try {
      const uri = await viewShotRef.current.capture?.();

      if (!uri) {
        Alert.alert('Error', 'No se pudo generar la imagen para compartir.');
        return;
      }

      const fileName = `escudo-meta-${goal.id}-${Date.now()}.png`;
      const destFile = new File(Paths.cache, fileName);

      await copyAsync({ from: uri, to: destFile.uri });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(destFile.uri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir meta completada',
          UTI: 'public.png',
        });
      } else {
        Alert.alert('Compartir no disponible', 'Tu dispositivo no soporta compartir archivos.');
      }
    } catch (error) {
      console.error('Error compartiendo meta:', error);
      Alert.alert('Error', 'No se pudo compartir la imagen. Inténtalo de nuevo.');
    } finally {
      isSharingRef.current = false;
    }
  }, []);

  return {
    viewShotRef: viewShotRef as React.RefObject<ViewShot>,
    shareGoal,
    isSharing: isSharingRef.current,
  };
};
