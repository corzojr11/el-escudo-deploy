import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { copyAsync } from 'expo-file-system/legacy';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Goal } from '../../types/api';
import GoalAchievementCard from './GoalAchievementCard';

interface GoalShareButtonProps {
  goal: Goal;
  completedAt?: string;
  xpEarned?: number;
}

const GoalShareButton: React.FC<GoalShareButtonProps> = ({ goal, completedAt, xpEarned = 500 }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);
  const viewShotRef = React.useRef<ViewShot>(null);

  const executeShare = useCallback(async () => {
    if (!viewShotRef.current) return;

    try {
      const uri = await viewShotRef.current.capture?.();
      if (!uri) {
        Alert.alert('Error', 'No se pudo generar la imagen.');
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
      Alert.alert('Error', 'No se pudo compartir la imagen.');
    } finally {
      setIsSharing(false);
      setCaptureReady(false);
    }
  }, [goal.id]);

  const handlePress = () => {
    if (isSharing) return;
    setIsSharing(true);
    setCaptureReady(true);
    setTimeout(executeShare, 150);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.shareButton}
        onPress={handlePress}
        disabled={isSharing}
        activeOpacity={0.7}
      >
        <Ionicons name={isSharing ? 'hourglass-outline' : 'share-social-outline'} size={14} color={Colors.accent.gold} />
        <Text style={styles.shareButtonText}>{isSharing ? 'Generando...' : 'Compartir'}</Text>
      </TouchableOpacity>

      {/* Off-screen capture area */}
      {captureReady && (
        <View style={styles.captureArea}>
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1, result: 'tmpfile' }}
          >
            <GoalAchievementCard
              goal={goal}
              completedAt={completedAt}
              xpEarned={xpEarned}
              variant="share"
            />
          </ViewShot>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  shareButtonText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.gold,
    letterSpacing: 0.5,
  },
  captureArea: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
});

export default GoalShareButton;
