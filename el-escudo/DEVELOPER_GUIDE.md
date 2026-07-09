# El Escudo — Developer Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the App
```bash
npx expo start
```
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app on your device

### 3. Run Tests
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Project Structure

```
el-escudo/
├── src/
│   ├── components/    # Reusable UI components
│   ├── screens/       # Main app screens
│   ├── store/         # Zustand state management
│   ├── theme/         # Design tokens (colors, spacing, typography)
│   ├── utils/         # Helper functions
│   └── __tests__/     # Unit tests
├── app.tsx            # App entry point
├── jest.config.js     # Jest configuration
└── package.json       # Dependencies and scripts
```

## Theme Configuration

Design tokens are centralized in `src/theme/spacing.ts`:

### Spacing Scale
| Token | Value (px) |
|-------|------------|
| xxs   | 2          |
| xs    | 4          |
| sm    | 8          |
| md    | 12         |
| base  | 16         |
| lg    | 20         |
| xl    | 24         |
| xxl   | 32         |
| xxxl  | 48         |

### Border Radius Scale
| Token | Value (px) |
|-------|------------|
| none  | 0          |
| xxs   | 2          |
| xs    | 4          |
| sm    | 8          |
| md    | 12         |
| lg    | 16         |
| xl    | 24         |
| xxl   | 32         |
| full  | 999        |

### Layout Constants
| Token            | Value |
|------------------|-------|
| inputBarHeight   | 64    |
| hudHeight        | 56    |
| messagePaddingH  | 16    |
| messagePaddingV  | 10    |
| maxBubbleWidth   | 82%   |

**Always import from `src/theme/spacing.ts` instead of using hardcoded values.**

## State Management

The app uses **Zustand** for state management. Key patterns:

- Store: `src/store/appStore.ts`
- Hydration: Call `hydrateStore()` on app start
- Mocking in tests: Use `jest.mock('../store/appStore')`

## Testing Guidelines

- Unit tests for pure functions go in `src/__tests__/`
- Mock Zustand store to avoid API calls
- Mock `react-native-wagmi-charts` for chart components
- Mock `useFocusEffect` with cleanup function return

## Key Dependencies

| Package                  | Purpose                    |
|--------------------------|----------------------------|
| zustand                  | State management           |
| @supabase/supabase-js    | Backend API client         |
| react-native-wagmi-charts| Data visualization         |
| lucide-react-native      | Icon library               |
| @testing-library/react-native | UI testing           |
| jest-expo                | Jest preset for Expo       |

## Troubleshooting

### Tests fail with "Can't access .root on unmounted test renderer"
- Ensure `react-test-renderer` version matches React version (19.1.0)
- Check that all async operations are wrapped in `act()`

### Charts not rendering in tests
- Add mock for `react-native-wagmi-charts` in test setup

### Expo won't start
- Clear cache: `npx expo start -c`
- Reinstall: `rm -rf node_modules && npm install`
