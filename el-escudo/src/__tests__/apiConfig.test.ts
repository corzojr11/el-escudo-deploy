describe('api config', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('detects localhost urls', () => {
    const { isLocalhostUrl } = require('../config/api');

    expect(isLocalhostUrl('http://localhost:8000')).toBe(true);
    expect(isLocalhostUrl('http://127.0.0.1:8001')).toBe(true);
    expect(isLocalhostUrl('https://example.com')).toBe(false);
  });

  it('drops stored localhost urls on native', async () => {
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));

    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const { loadApiBaseUrl, getApiBaseUrl, setApiBaseUrl, resetApiBaseUrl } = require('../config/api');

    await AsyncStorage.setItem('@elescudo.apiBaseUrl', 'http://localhost:8000');

    await loadApiBaseUrl();
    expect(getApiBaseUrl()).toBe('');
    expect(await AsyncStorage.getItem('@elescudo.apiBaseUrl')).toBeNull();

    await setApiBaseUrl('http://localhost:8000');
    expect(getApiBaseUrl()).toBe('');
    expect(await AsyncStorage.getItem('@elescudo.apiBaseUrl')).toBeNull();

    await resetApiBaseUrl();
  });
});
