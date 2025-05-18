# Debugging Notes for ESM Module Issues with ts-node

## Issue Overview

When working with TypeScript and ESM modules in a monorepo setup, we encountered issues with ts-node not properly resolving module imports. This document outlines the issues, how to recognize them, and how to address them.

### Symptoms

The main symptoms of this issue are:

1. The application works fine when built with `npm run build` and run with `npm run start`
2. The application fails with cryptic errors when run with `npm run dev` (which uses ts-node)
3. Error messages are often unhelpful, such as:
   ```
   node:internal/modules/run_main:104
       triggerUncaughtException(
       ^
   [Object: null prototype] {
     [Symbol(nodejs.util.inspect.custom)]: [Function: [nodejs.util.inspect.custom]]
   }
   ```
4. The error occurs specifically when importing from packages that use ESM modules with `.js` extensions in their import statements

### Root Cause

The root cause of this issue is how ts-node handles ESM modules with TypeScript:

1. In ESM modules with TypeScript, you need to use `.js` extensions in import statements (e.g., `import { foo } from './bar.js'`), even though the actual files have `.ts` extensions
2. This is because the compiled JavaScript files will have `.js` extensions, and the import statements need to match that
3. However, ts-node looks for the actual files on disk, which have `.ts` extensions, causing a mismatch
4. This issue is particularly problematic in monorepos where packages depend on each other

## Debugging Process

To debug this issue, we created temporary test scripts that helped isolate the problem:

1. **Isolated Parser Test**: We created a test script that imported and used the M3U8 parser directly, bypassing the daemon. This script worked correctly, confirming that the issue was with how the parser was being integrated into the daemon, not with the parser itself.

2. **Module Import Test**: We created a test script that imported modules one by one to identify which specific import was causing the issue. This helped narrow down the problem to the integration between the daemon and the songlist-parser package.

These test scripts were instrumental in identifying that the issue was related to how ts-node handles ESM modules with TypeScript, not with the code itself.

## Solutions

There are several approaches to addressing this issue:

1. **Build First, Then Run**: The most reliable approach is to build all packages first with `npm run build` and then run the compiled JavaScript files with `npm run start`. This ensures that all imports are resolved correctly.

2. **Use ts-node-esm**: If you need to use ts-node for development, use the `ts-node-esm` command instead of `ts-node`. This provides better support for ESM modules.

3. **Configure tsconfig.json**: Ensure that your tsconfig.json has the correct settings for ESM modules:
   ```json
   {
     "compilerOptions": {
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "esModuleInterop": true
     }
   }
   ```

4. **Use Consistent Import Styles**: Ensure that all packages in your monorepo use the same import style (either all CommonJS or all ESM).

## Specific Issues Fixed

In addition to the ESM module issues, we also fixed two other issues:

1. **React StrictMode Double Execution**: React's StrictMode was causing components to render twice in development mode, which was causing the upload form to be submitted twice. We fixed this by adding useRef guards in the React components to prevent duplicate form submissions.

2. **Songlist File Extension Handling**: In file-processor.ts, there was an issue with how the songlist file path was constructed. It was using the artwork filename extension but replacing '.jpg' with '.rtf', which was causing it to look for an '.rtf' file when an '.m3u8' file was uploaded. We fixed this by properly checking for all supported file extensions.

## Conclusion

ESM module issues with ts-node can be tricky to debug, but understanding the root cause and having a systematic approach to debugging can help resolve them. The key is to recognize the symptoms and apply the appropriate solution based on your project's needs.

For our project, we've implemented a standardized logging system across all parsers, fixed the file extension handling, and added protection against React StrictMode double execution. These changes collectively resolved the issues that were preventing the M3U8 parser from working correctly within the system.
