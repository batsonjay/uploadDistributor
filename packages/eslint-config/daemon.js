import { config as baseConfig } from "./base.js";

/**
 * ESLint configuration for the daemon package.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  ...baseConfig,
  {
    files: ["**/*.js", "**/*.ts"],
    rules: {
      // Node.js specific rules
      "no-console": "off", // Allow console for server-side logging
      "no-process-exit": "warn", // Warn about process.exit() usage
      "node/no-deprecated-api": "error", // Prevent usage of deprecated Node.js APIs
      
      // Error handling
      "no-throw-literal": "error", // Only throw Error objects
      "handle-callback-err": "warn", // Ensure errors in callbacks are handled
      
      // Async patterns
      "no-await-in-loop": "warn", // Warn about sequential awaits in loops
      "require-await": "warn", // Ensure async functions use await
      
      // Security
      "no-eval": "error", // Prevent eval usage
      "no-new-func": "error", // Prevent new Function() usage
    },
  },
];
