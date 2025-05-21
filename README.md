# Upload Distributor

Upload Distributor is a system for uploading and distributing audio content to multiple platforms simultaneously. It enables DJs to upload an MP3 file along with a songlist, which is then distributed to AzuraCast, Mixcloud, and SoundCloud. The system consists of a daemon that handles the upload processing and distribution, a web client for browser-based uploads, and a macOS client with a FileZilla-like interface.

## Recent Updates

- **Email-Based Authentication**: Implemented secure magic link authentication with role-based token expiration, replacing password-based authentication.
- **M3U8 Parser Support**: Added support for Rekordbox M3U8 playlist files, expanding the range of supported file formats.
- **Standardized Logging System**: Created a comprehensive logging system across all parsers with configurable log levels.
- **Standardized Retry Logic**: Implemented a flexible RetryUtils module for consistent error handling and recovery across all destination services.
- **DRY Refactoring**: Moved platform-specific metadata creation from file-processor.ts to respective service classes, eliminating code duplication.
- **Enhanced Error Handling**: Improved error recovery with specialized retry strategies for each destination platform.
- **Terminology Standardization**: Clarified terminology throughout the codebase to distinguish between client-to-daemon transfers ("send"/"receive") and daemon-to-destination transfers ("upload").

## Documentation

- [Architecture Overview](docs/architecture.md) - System design and operational flow
- [Tech Stack](docs/tech-stack.md) - Technologies used across the project
- [Daemon APIs](docs/daemon-apis.md) - Internal APIs exposed by the daemon
- [Destination APIs](docs/destination-apis.md) - Integration with AzuraCast, Mixcloud, and SoundCloud
- [Web Client](docs/web-client.md) - Design and responsibilities of the web client
- [macOS Client](docs/macos-client.md) - Design and responsibilities of the macOS client
- [Songlists](docs/songlists.md) - Structure and handling of songlist files
- [Implementation Plan](docs/Implementation-plan.md) - Proposed implementation steps

## Development Setup

### Prerequisites

- Node.js (v18 or later)
- npm (v10 or later)
- Git

### First-time Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd uploadDistributor
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory based on `.env.example`:
   ```
   cp .env.example .env
   ```

4. Build all packages:
   ```
   npm run build
   ```

### Development Workflow

- Start the daemon in development mode:
  ```
  npm run dev --filter=@uploadDistributor/daemon
  ```

- Run linting:
  ```
  npm run lint
  ```

- Type checking:
  ```
  npm run check-types
  ```

- Format code:
  ```
  npm run format
  ```

### Testing

- Run all tests:
  ```
  npm run test
  ```

- Test a specific package:
  ```
  npm run test --filter=@uploadDistributor/daemon
  ```

### Project Structure

- `apps/` - Client applications
  - `web-ui/` - Next.js web client
  - `macos-client/` - Electron-based macOS client
- `packages/` - Shared packages and services
  - `daemon/` - Core processing daemon
  - `shared/` - Shared utilities and types
  - `songlists/` - Storage for songlist data files
  - `eslint-config/` - ESLint configurations
  - `typescript-config/` - TypeScript configurations
