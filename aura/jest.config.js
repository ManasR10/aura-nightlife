module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  // Extend the RN preset's pattern to also transform ESM packages in node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(' + [
      'react-native',
      '@react-native(-community)?',
      '@react-navigation',
      'react-native-screens',
      'react-native-safe-area-context',
    ].join('|') + ')/)',
  ],
};
