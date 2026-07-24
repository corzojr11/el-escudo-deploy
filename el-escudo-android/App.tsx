import React, { useRef, useCallback, useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, SafeAreaView, StatusBar, Platform, BackHandler, Linking, Button } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

function getWebAppUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_WEB_APP_URL;
  if (!url || url.trim() === '') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function getEasProjectId(): string | undefined {
  const easConfig = Constants.easConfig as Record<string, unknown> | undefined;
  if (easConfig?.projectId && typeof easConfig.projectId === 'string' && easConfig.projectId.trim() !== '') {
    return easConfig.projectId;
  }
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const extraEas = extra?.eas as Record<string, unknown> | undefined;
  if (extraEas?.projectId && typeof extraEas.projectId === 'string' && extraEas.projectId.trim() !== '') {
    return extraEas.projectId;
  }
  const envProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (envProjectId && envProjectId.trim() !== '') return envProjectId;
  return undefined;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#000000',
  });
}

export default function App() {
  const webAppUrl = getWebAppUrl();
  const easProjectId = getEasProjectId();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [pendingNotificationPath, setPendingNotificationPath] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const webReadyRef = useRef(false);

  const originRef = useRef<string | null>(null);
  if (webAppUrl && !originRef.current) {
    try {
      originRef.current = new URL(webAppUrl).origin;
    } catch {
      originRef.current = null;
    }
  }

  const injectTokenToWeb = useCallback((token: string) => {
    if (!webViewRef.current) return;
    const payload = JSON.stringify({ type: 'expo-push-token', token });
    const script = `(function(){window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(payload)}}));})();true;`;
    webViewRef.current.injectJavaScript(script);
  }, []);

  const navigateToPath = useCallback((path: string) => {
    if (!webAppUrl || !originRef.current) return;
    try {
      const targetUrl = new URL(path, originRef.current);
      if (targetUrl.origin !== originRef.current) {
        webViewRef.current?.injectJavaScript(`window.location.href=${JSON.stringify(originRef.current + '/')};true;`);
        return;
      }
      webViewRef.current?.injectJavaScript(`window.location.href=${JSON.stringify(targetUrl.href)};true;`);
    } catch {
      webViewRef.current?.injectJavaScript(`window.location.href=${JSON.stringify(originRef.current + '/')};true;`);
    }
  }, [webAppUrl]);

  const handleLoadStart = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
  }, []);

  const handleError = useCallback((event: { nativeEvent: { description: string } }) => {
    setLoading(false);
    setError(event.nativeEvent.description || 'Error de conexión');
  }, []);

  const handleNavigationStateChange = useCallback((navState: { canGoBack: boolean }) => {
    setCanGoBack(navState.canGoBack);
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    try {
      const message = JSON.parse(data);
      if (message.type === 'web-ready') {
        webReadyRef.current = true;
        if (tokenRef.current) {
          injectTokenToWeb(tokenRef.current);
        }
        if (pendingNotificationPath) {
          navigateToPath(pendingNotificationPath);
          setPendingNotificationPath(null);
        }
      }
    } catch {
      // ignore non-JSON messages
    }
  }, [pendingNotificationPath, navigateToPath, injectTokenToWeb]);

  const registerForPushNotifications = useCallback(async () => {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
        android: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: easProjectId,
      });
      const token = tokenData.data;
      tokenRef.current = token;
      if (webReadyRef.current) {
        injectTokenToWeb(token);
      }
    } catch (err) {
      console.error('Error getting push token:', err);
    }
  }, [easProjectId, injectTokenToWeb]);

  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    const path = (data?.path as string) ?? '/';
    if (webReadyRef.current) {
      navigateToPath(path);
    } else {
      setPendingNotificationPath(path);
    }
  }, [navigateToPath]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    registerForPushNotifications();
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });
    return () => subscription.remove();
  }, [handleNotificationResponse, registerForPushNotifications]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [canGoBack]);

  if (!webAppUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.configContainer}>
          <Text style={styles.configTitle}>Configuracion requerida</Text>
          <Text style={styles.configText}>
            La variable de entorno <Text style={styles.code}>EXPO_PUBLIC_WEB_APP_URL</Text> no esta configurada.
          </Text>
          <Text style={styles.configText}>
            Copia <Text style={styles.code}>.env.example</Text> a <Text style={styles.code}>.env</Text> y define la URL de produccion de la web (HTTPS).
          </Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeLine}>EXPO_PUBLIC_WEB_APP_URL=https://tu-dominio.vercel.app</Text>
          </View>
          <Text style={styles.configText}>
            La app no cargara una URL por defecto ni localhost por seguridad.
          </Text>
          {!easProjectId && (
            <View style={styles.warningBlock}>
              <Text style={styles.warningText}>
                EXPO_PUBLIC_EAS_PROJECT_ID no configurado. El token Expo Push requerira vincular el proyecto con EAS.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.loadingText}>Cargando El Escudo...</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Error de conexion</Text>
      <Text style={styles.errorText}>{error}</Text>
      <Text style={styles.errorText}>Verifica tu conexion e intentalo de nuevo.</Text>
      <Button title="Reintentar" onPress={() => webViewRef.current?.reload()} color="#fff" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {loading && renderLoading()}
      {error && renderError()}

      <WebView
        ref={webViewRef}
        source={{ uri: webAppUrl }}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="never"
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        allowFileAccessFromFileURLs={false}
        thirdPartyCookiesEnabled={true}
        userAgent={Platform.OS === 'android' ? 'ElEscudo-Android/1.0' : 'ElEscudo-iOS/1.0'}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={(request) => {
          if (!request.url) return true;
          try {
            const url = new URL(request.url);
            if (url.origin === originRef.current) return true;
            Linking.openURL(request.url);
            return false;
          } catch {
            return false;
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  configContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  configTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  configText: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  code: {
    fontFamily: 'monospace',
    color: '#fff',
    backgroundColor: '#222',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeBlock: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
  },
  codeLine: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#0f0',
  },
  warningBlock: {
    backgroundColor: '#332200',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#664400',
  },
  warningText: {
    fontSize: 14,
    color: '#ffcc00',
    textAlign: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 100,
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 24,
    zIndex: 100,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ff6b6b',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 8,
  },
});
