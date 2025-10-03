module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  // Allow standard .spec.ts / .test.ts and Nest e2e style *.e2e-spec.ts
  testRegex: '.*\\.(e2e-spec|spec|test)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/index.ts'],
  coverageDirectory: './coverage',
  setupFiles: ['dotenv/config'],
};
