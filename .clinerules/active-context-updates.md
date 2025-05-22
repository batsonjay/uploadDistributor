## Brief overview
This rule defines when and how to update the active context file in the project. The active context file should only be updated after specific milestones and with explicit user confirmation to ensure it accurately reflects the current state of the project.

## Update timing
- Only update the active-context.md file after a git commit message has been made
- Wait for explicit confirmation from the user that an update is appropriate at this time
- Do not update the active context immediately after completing implementation tasks
- Treat the active context as a milestone document rather than a real-time progress tracker

## Update content
- When updating, accurately reflect the completed steps and next steps
- Focus on high-level accomplishments rather than implementation details
- Ensure the "Current Task" section reflects the actual next focus area
- Keep the "Next Steps" section aligned with the implementation plan

## User confirmation
- Ask the user if it's appropriate to update the active context after major milestones
- Use phrasing like "Would you like me to update the active context file now?"
- Do not assume that completing a task automatically warrants an active context update
- Wait for explicit confirmation before making any changes to the active context

## Version control integration
- Updates to the active context should generally follow git commits
- This ensures the active context reflects stable, committed changes
- The active context should represent the state of the codebase as reflected in version control
- This prevents the active context from getting out of sync with the actual code state
