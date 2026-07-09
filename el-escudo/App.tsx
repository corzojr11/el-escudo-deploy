import React, { useEffect } from 'react';
import { View, Platform, Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { useNetInfo } from '@react-native-community/netinfo';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';

import TabNavigator from './src/navigation/TabNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { loadApiBaseUrl } from './src/config/api';
import { flushPendingRequests } from './src/api/requests';
import { useAppStore } from './src/store';
import { useOmniAgent } from './src/hooks/useOmniAgent';
import { supabase } from './src/utils/supabase';
import { flushOfflineFinanceOps } from './src/store/slices/financeSlice';

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
  });
  const [apiConfigReady, setApiConfigReady] = React.useState(false);
  const [authReady, setAuthReady] = React.useState(false);
  const netInfo = useNetInfo();

  const session = useAppStore(state => state.session);
  const userProfile = useAppStore(state => state.userProfile);
  const setSession = useAppStore(state => state.setSession);
  const hydrateStore = useAppStore(state => state.hydrateStore);
  const navigationRef = React.useRef<any>(null);

  useOmniAgent(Boolean(apiConfigReady && session));

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (navigationRef.current) {
        navigationRef.current.navigate('Estado');
      }
    });

    return () => subscription.remove();
  }, []);

  const hasHydrated = React.useRef(false);
  const customTheme = React.useMemo(() => ({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#09090B',
    },
  }), []);

  useEffect(() => {
    let alive = true;

    void loadApiBaseUrl().finally(() => {
      if (alive) {
        setApiConfigReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      setSession(session);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setSession(session);
      setAuthReady(true);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [setSession]);

  useEffect(() => {
    if (!apiConfigReady) {
      return;
    }

    const init = async () => {
      if (session && !hasHydrated.current) {
        try {
          void hydrateStore(true).catch((e) => {
            console.error('Hydration failed:', e);
          });
          hasHydrated.current = true;
        } catch (e) {
          console.error('Hydration failed:', e);
        }
      } else if (!session) {
        hasHydrated.current = false;
      }
    };
    init();
  }, [apiConfigReady, session, hydrateStore]);

  useEffect(() => {
    if (!apiConfigReady || netInfo.isConnected !== true ) {
      return;
    }

    void (async () => {
      const flushedRequests = await flushPendingRequests();
      const financeFlushed = await flushOfflineFinanceOps(useAppStore.getState());
      if (flushedRequests > 0 || financeFlushed > 0) {
        await hydrateStore(true);
      }
    })();
  }, [apiConfigReady, netInfo.isConnected, hydrateStore]);

  if (!fontsLoaded || !apiConfigReady || !authReady) {
    return <View style={{ flex: 1, backgroundColor: '#09090B' }} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#09090B' }}>
        {netInfo.isConnected === false ? (
          <View style={{ backgroundColor: '#3F1D1D', paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#FDE68A', fontFamily: 'SpaceGrotesk_600SemiBold', textAlign: 'center' }}>
              Sin conexion. Se conservara lo local hasta reconectar.
            </Text>
          </View>
        ) : null}
        <NavigationContainer ref={navigationRef} theme={customTheme}>
          {!session ? (
            <LoginScreen />
          ) : !userProfile ? (
            <OnboardingScreen />
          ) : (
            <View style={{ flex: 1 }}>
              <TabNavigator />
            </View>
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
