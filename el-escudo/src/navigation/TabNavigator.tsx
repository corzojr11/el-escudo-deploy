import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
import { Colors } from '../theme/colors';
import { ErrorBoundary } from '../components/ErrorBoundary';

import OmniChatScreen from '../screens/OmniChatScreen';
import EstadoScreen from '../screens/EstadoScreen';
import MoreScreen from '../screens/MoreScreen';

import ScheduleScreen from '../screens/ScheduleScreen';
import FinancesScreen from '../screens/FinancesScreen';
import HealthScreen from '../screens/HealthScreen';

const ScreenShell: React.FC<{ screenName: string; children: React.ReactNode }> = ({ screenName, children }) => (
  <ErrorBoundary screenName={screenName}>{children}</ErrorBoundary>
);

export type RootTabParamList = {
  Inicio: undefined;
  Turnos: undefined;
  Finanzas: undefined;
  Salud: undefined;
  Estado: undefined;
  Mas: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_BAR_STYLE = {
  backgroundColor: 'rgba(10, 10, 11, 0.96)',
  borderTopWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.08)',
  height: Platform.OS === 'ios' ? 88 : 76,
  paddingBottom: Platform.OS === 'ios' ? 18 : 14,
  paddingTop: 8,
  paddingHorizontal: 6,
};

const TAB_BAR_ITEM_STYLE = {
  flex: 1,
  marginHorizontal: 0,
  paddingVertical: 2,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const ICON_MAP: Record<string, [React.ComponentProps<typeof Ionicons>['name'], React.ComponentProps<typeof Ionicons>['name']]> = {
  Inicio: ['chatbubble', 'chatbubble-outline'],
  Turnos: ['time', 'time-outline'],
  Finanzas: ['card', 'card-outline'],
  Salud: ['pulse', 'pulse-outline'],
  Estado: ['home', 'home-outline'],
  Mas: ['apps', 'apps-outline'],
};

const TabNavigator: React.FC = () => {
  const isWeb = Platform.OS === 'web';
  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      screenOptions={({ route }) => ({
        headerShown: false,
        freezeOnBlur: false,
        sceneStyle: isWeb ? styles.webScene : undefined,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.accent.green,
        tabBarInactiveTintColor: Colors.text.muted,
        tabBarStyle: isWeb ? [TAB_BAR_STYLE, styles.webTabBar] : TAB_BAR_STYLE,
        tabBarItemStyle: TAB_BAR_ITEM_STYLE,
        tabBarIcon: ({ focused, color }) => {
          const [filled, outline] = ICON_MAP[route.name] ?? ['help', 'help-outline'];
          return (
            <View style={[styles.iconShell, focused && styles.iconShellActive]}>
              <Ionicons name={focused ? filled : outline} size={20} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Inicio" children={() => <ScreenShell screenName="Inicio"><OmniChatScreen /></ScreenShell>} />
      <Tab.Screen name="Turnos" children={() => <ScreenShell screenName="Turnos"><ScheduleScreen /></ScreenShell>} />
      <Tab.Screen name="Finanzas" children={() => <ScreenShell screenName="Finanzas"><FinancesScreen /></ScreenShell>} />
      <Tab.Screen name="Salud" children={() => <ScreenShell screenName="Salud"><HealthScreen /></ScreenShell>} />
      <Tab.Screen name="Estado" children={() => <ScreenShell screenName="Estado"><EstadoScreen /></ScreenShell>} />
      <Tab.Screen name="Mas" children={() => <ScreenShell screenName="Más"><MoreScreen /></ScreenShell>} />
    </Tab.Navigator>
  );
};

export default TabNavigator;

const styles = StyleSheet.create({
  webScene: {
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: Colors.border.subtle,
    borderRightColor: Colors.border.subtle,
    backgroundColor: Colors.bg.primary,
  },
  webTabBar: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: Colors.border.subtle,
    borderRightColor: Colors.border.subtle,
  },
  iconShell: {
    width: 36,
    height: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShellActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 157, 0.22)',
    boxShadow: '0px 0px 8px rgba(0, 229, 255, 0.25)',
    elevation: 3,
  },
});


