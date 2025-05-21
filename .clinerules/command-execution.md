## Brief overview
This rule defines how command execution should be handled when testing the daemon or web UI components of the project. It ensures that commands are executed in the correct directory by using full paths in cd commands.

## Command execution for testing
- When testing the daemon or web UI components, always precede npm run commands with a cd to the full path
- Use the absolute path to the directory where the npm run command will be executed
- Example: `cd /Users/balearicfm/Projects/uploadDistributor/packages/daemon && npm run dev`
- Example: `cd /Users/balearicfm/Projects/uploadDistributor/apps/web-ui && npm run dev`

## Path specification
- Always use absolute paths rather than relative paths when changing directories
- Do not use shortcuts like `~` or environment variables like `$HOME`
- Ensure the path is complete and accurate to avoid execution in the wrong directory

## Command chaining
- Use the `&&` operator to chain the cd command with the npm run command
- This ensures that the npm command runs in the correct directory context
- Example: `cd /full/path/to/directory && npm run command`

## Error handling
- If a command fails when using a relative path, try using the absolute path instead
- When encountering path-related errors, verify the current working directory before proceeding
- Always kill any currently-running server before starting a new one to avoid port conflicts
- Use `pkill -f "node.*port"` or similar commands to kill processes using specific ports
