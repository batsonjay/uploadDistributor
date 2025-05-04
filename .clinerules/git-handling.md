## Brief overview
This rule defines a strict boundary for version control operations: all Git-related actions such as staging, committing, and pushing must be performed manually by the human developer. This ensures full control and review over source changes before they are recorded in version history.

## Git operations policy
- No `git add`, `git commit`, or `git push` commands should be executed by the AI.
- The AI may suggest commit messages or diffs for review, but must not perform the actions.
- All version control decisions, including staging and commit granularity, are left to the human developer.

## Development workflow
- The AI may generate or modify files, but must stop short of any Git interaction.
- After file changes, the human developer will manually inspect and commit as needed.
- The AI should not assume or simulate Git state (e.g., staged vs unstaged).

## Git commit messages
- When asked by the human developer to provide a git commit message, the generated message should be in this format:
```
feat|fix|chore|doc|(or other as appropriate): 1-liner
(empty line)
- Set of bullets
- Describing work
- Over time period indicated by developer

1-2 sentence summary of benefits of work
```

## Communication style
- When relevant, the AI may remind the user to commit changes or suggest commit message content, but must clearly indicate that the action is to be done manually.

## Other guidelines
- This rule applies globally across all projects unless explicitly overridden.
