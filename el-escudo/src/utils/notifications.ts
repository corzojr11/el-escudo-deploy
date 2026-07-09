import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiPost } from '../api/requests';

export async function registerForPushNotificationsAsync() {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981', // Colors.accent.green
    });
  }

  if (!Device.isDevice) {
    if (__DEV__) {
      console.warn('Push notifications require a physical device. Skipping token registration.');
    }
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    // Learn more about projectId: https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to obtain Expo push token:', error);
    }
    return null;
  }

  if (token) {
    try {
      await apiPost('/api/v1/push-tokens', { token });
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to register push token:', error);
      }
    }
  }

  return token;
}
