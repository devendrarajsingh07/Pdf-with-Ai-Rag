/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/test-guard.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/test-cleanup.ts'],
  verbose: true,
  clearMocks: true,
};
