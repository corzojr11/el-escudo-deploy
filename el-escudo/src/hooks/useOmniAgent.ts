import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store';
import { apiGet } from '../api/requests';

const OMNI_AGENT_TASK = 'OMNI-agent-check';
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours per type
let nativeTaskRegistered = false;

interface OMNISuggestion {
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  action?: string;
}

interface AgentCheckResponse {
  suggestions: OMNISuggestion[];
}

export const useOmniAgent = (enabled = true) => {
  const notificationsEnabled = useAppStore((state) => state.userProfile?.notificationsEnabled ?? false);

  const registerBackgroundTask = useCallback(async () => {
    if (!enabled) return;
    if (Platform.OS === 'web' || !Device.isDevice) return;

    try {
      const [{ default: Notifications }, { default: BackgroundTask }, { default: TaskManager }] = await Promise.all([
        import('expo-notifications'),
        import('expo-background-task'),
        import('expo-task-manager'),
      ]);

      if (!nativeTaskRegistered) {
        TaskManager.defineTask(OMNI_AGENT_TASK, async () => {
          try {
            const notifEnabled = await AsyncStorage.getItem('@notificationsEnabled');
            if (notifEnabled !== 'true') {
              return BackgroundTask.BackgroundTaskResult.Success;
            }

            const res = await apiGet('/api/v1/omni/agent-check');
            if (!res.ok) {
              return BackgroundTask.BackgroundTaskResult.Failed;
            }

            const data: AgentCheckResponse = await res.json();
            if (!data.suggestions || data.suggestions.length === 0) {
              return BackgroundTask.BackgroundTaskResult.Success;
            }

            const cooldownsStr = await AsyncStorage.getItem('@OMNICooldowns');
            const cooldowns: Record<string, number> = cooldownsStr ? JSON.parse(cooldownsStr) : {};
            const now = Date.now();

            let hasNewNotification = false;

            for (const suggestion of data.suggestions) {
              if (suggestion.priority !== 'high') continue;

              const lastTime = cooldowns[suggestion.type] || 0;
              if (now - lastTime < COOLDOWN_MS) continue;

              await Notifications.scheduleNotificationAsync({
                content: {
                  title: suggestion.title,
                  body: suggestion.message,
                  data: { action: suggestion.action, type: suggestion.type },
                },
                trigger: null,
              });

              cooldowns[suggestion.type] = now;
              hasNewNotification = true;
            }

            if (hasNewNotification) {
              await AsyncStorage.setItem('@OMNICooldowns', JSON.stringify(cooldowns));
            }

            return BackgroundTask.BackgroundTaskResult.Success;
          } catch {
            return BackgroundTask.BackgroundTaskResult.Failed;
          }
        });
        nativeTaskRegistered = true;
      }

      await AsyncStorage.setItem('@notificationsEnabled', notificationsEnabled ? 'true' : 'false');

      if (!notificationsEnabled) {
        if (typeof BackgroundTask.unregisterTaskAsync === 'function') {
          await BackgroundTask.unregisterTaskAsync(OMNI_AGENT_TASK);
        }
        return;
      }

      if (typeof BackgroundTask.registerTaskAsync === 'function') {
        await BackgroundTask.registerTaskAsync(OMNI_AGENT_TASK, {
          minimumInterval: 15,
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('OMNI background task setup skipped:', error);
      }
    }
  }, [enabled, notificationsEnabled]);

  useEffect(() => {
    if (!enabled) return;
    void registerBackgroundTask();
  }, [enabled, registerBackgroundTask]);
};
