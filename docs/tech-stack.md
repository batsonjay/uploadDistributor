# Tech Stack

This document outlines the technologies used across the Upload Distributor project.

## General Principles

- Favor JavaScript/Node.js where possible for consistency across the stack.
- Leverage existing knowledge of Expo/React for client development.
- Use modular, testable components with clear interfaces.

## Backend

- **Node.js**: Primary runtime for the daemon and any backend services.
- **Express**: For building the daemon's internal API.
- **Busboy**: For handling large multipart file uploads efficiently.
- **Child Process / Worker Threads**: For handling concurrent upload processing.

## Clients

- **React**: UI framework for both web and macOS clients.
- **Expo**: Considered for shared components or future mobile expansion.
- **Electron**: For building the macOS client with native-like capabilities.

## Shared Code

- **Monorepo**: Potential use of a monorepo (e.g., via Turborepo or Nx) to share code between daemon and clients.
- **Common Libraries**: Shared utilities for auth, API calls, and validation.

## Package Management

- **npm** or **yarn**: For dependency management.
- **ESLint + Prettier**: For code consistency.
- **TypeScript** (optional): Considered for type safety across the stack.

## Alternatives Considered

- **Python**: For the daemon, but Node.js is preferred for ecosystem consistency.
- **Native macOS App**: Rejected in favor of Electron for faster development and shared code.

## Local Development

### Upload Handling Considerations

- Use `Busboy` to stream large file uploads without buffering entire files in memory.
- Configure Express to avoid default body parsers for multipart uploads.
- Ensure `limit` settings (e.g., `fileSize`) are tuned to accept files up to 200MB or more.
- Use temporary disk storage during upload processing to reduce memory pressure.

- Development is primarily done on macOS, with final deployment on Linux.
- All components (daemon, web client, macOS client) are designed to run locally on macOS for development.
- Docker may be used to simulate Linux environments if needed.
- Ensure Node.js, npm/yarn, and Git are installed locally.
- Use `brew` for managing dependencies and services (e.g., PostgreSQL, Redis) if required.
