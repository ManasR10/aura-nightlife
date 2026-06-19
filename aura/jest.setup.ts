/**
 * Jest setup — mock native modules that require a real device/emulator.
 * This file runs after the test framework is installed (setupFilesAfterEnv).
 */

// react-native-screens: suppress "not linked" error from enableScreens()
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
}));

// @react-navigation/native-stack: uses react-native-screens native modules
// which can't run in a jsdom/node test environment. Replace with a minimal
// pure-JS implementation that renders the initial screen.
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const { View } = require('react-native');

  function createNativeStackNavigator() {
    function Navigator({
      children,
    }: {
      children: React.ReactNode;
    }) {
      // Render only the first Screen child (initial route)
      const screens = React.Children.toArray(children);
      return React.createElement(View, null, screens[0] ?? null);
    }

    function Screen({
      component: Component,
      initialParams,
    }: {
      component: React.ComponentType<Record<string, unknown>>;
      name: string;
      initialParams?: Record<string, unknown>;
    }) {
      const navigation = { navigate: jest.fn(), goBack: jest.fn() };
      const route = { params: initialParams ?? {}, name: 'Home', key: 'Home' };
      return React.createElement(Component, { navigation, route } as Record<string, unknown>);
    }

    return { Navigator, Screen };
  }

  return { createNativeStackNavigator };
});

// react-native-safe-area-context: minimal inline mock
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { width: 375, height: 812, x: 0, y: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaView: View,
    SafeAreaConsumer: ({ children }: { children: (i: typeof insets) => React.ReactNode }) =>
      children(insets),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    SafeAreaInsetsContext: { Consumer: ({ children }: { children: (i: typeof insets) => React.ReactNode }) => children(insets) },
  };
});

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: {
    app: jest.fn(() => ({ name: '[DEFAULT]' })),
  },
}));

const mockAuthModule = {
  onAuthStateChanged: jest.fn((callback: (user: null) => void) => {
    callback(null);
    return jest.fn();
  }),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(async (email: string) => ({
    user: {
      email,
      displayName: '',
      phoneNumber: null,
      photoURL: null,
      updateProfile: jest.fn(),
    },
  })),
  currentUser: null,
  signOut: jest.fn(),
};

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => mockAuthModule,
}));

const mockDocRef = {
  get: jest.fn(async () => ({
    exists: false,
    data: () => null,
  })),
  set: jest.fn(async () => undefined),
  update: jest.fn(async () => undefined),
};

const mockFirestoreModule = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => mockDocRef),
  })),
  FieldValue: {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  },
};

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: () => mockFirestoreModule,
}));

const mockMessagingFactory = Object.assign(
  jest.fn(() => ({
    requestPermission: jest.fn(async () => 1),
    getToken: jest.fn(async () => 'mock-fcm-token'),
  })),
  {
    AuthorizationStatus: {
      AUTHORIZED: 1,
      PROVISIONAL: 2,
    },
  },
);

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: mockMessagingFactory,
}));

// @react-native-community/geolocation: native module fails in Jest env
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn((success: any) =>
      success({ coords: { latitude: 19.076, longitude: 72.877, accuracy: 50 }, timestamp: Date.now() }),
    ),
    watchPosition: jest.fn(() => 0),
    clearWatch: jest.fn(),
    stopObserving: jest.fn(),
    requestAuthorization: jest.fn(),
  },
}));

jest.mock('@react-native-firebase/storage', () => {
  const task = {
    on: jest.fn(),
    then: jest.fn(() => Promise.resolve()),
    catch: jest.fn(() => Promise.resolve()),
  };
  const ref = {
    putFile: jest.fn(() => task),
    getDownloadURL: jest.fn(async () => 'https://mock-storage-url/video.mp4'),
  };
  return {
    __esModule: true,
    default: () => ({ ref: jest.fn(() => ref) }),
  };
});

const mockFunctionsInstance = {
  httpsCallable: jest.fn(() => jest.fn(async () => ({ data: {} }))),
};

jest.mock('@react-native-firebase/functions', () => ({
  __esModule: true,
  default:      () => mockFunctionsInstance,
  getFunctions: () => mockFunctionsInstance,
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn((_opts: unknown, cb: (res: { didCancel: boolean }) => void) =>
    cb({ didCancel: true }),
  ),
  launchImageLibrary: jest.fn((_opts: unknown, cb: (res: { didCancel: boolean }) => void) =>
    cb({ didCancel: true }),
  ),
}));
