## Brief overview
This rule establishes a guideline for maintaining manageable file sizes across the project. Files approaching or exceeding 500 lines should be flagged for potential refactoring to improve maintainability and readability.

## File size monitoring
- Monitor code and documentation files as they approach 500 lines in length
- Notify the developer when a file reaches approximately 450-500 lines
- Suggest refactoring options to keep file sizes below this general upper bound

## Refactoring strategies
- For code files: Consider extracting modules, classes, or functions into separate files
- For documentation: Consider breaking into multiple topic-focused documents with cross-references
- Maintain logical cohesion when splitting files (don't split arbitrarily)
- Ensure proper exports/imports or documentation links are established when refactoring

## Implementation considerations
- This guideline applies to both source code and documentation files
- Some exceptions may be appropriate for generated files, configuration files, or files where splitting would reduce clarity
- The 500-line guideline is not absolute but serves as a trigger for evaluation

## Communication style
- When a file approaches the size limit, provide a clear notification
- Include specific suggestions for how the file might be logically divided
- Explain the benefits of maintaining smaller, focused files
