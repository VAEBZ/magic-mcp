/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/websocket/__tests__/unit/websocket.types.test.ts'
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json'
      }
    ]
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['./src/library-docs/websocket/__tests__/setup.ts'],
  testTimeout: 30000,
  fakeTimers: {
    enableGlobally: true
  }
};
