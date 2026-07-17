# Human-Reviewed Writing Pipeline

This Dify example turns user-supplied material into a draft, checks selected factual claims against a user-selected public source, and returns final copy only after a human approval decision. It never automatically publishes the result.

## Inputs

- `source_material`: the factual basis for the document.
- `writing_brief`: audience, purpose, tone, and constraints.

## Output

`final_document` is the approved copy with fact-check notes incorporated.

## Permissions and review

The Code node structures the initial draft, so `code_execution` is declared. The HTTP Request node checks public evidence, so `network_access` and external data transfer are declared. The export has no credential configuration, file access, email, or publishing node. A human must review the draft and fact-check notes before the final output path is selected.

## Limitations

Static fact checking can miss context, ambiguity, and recent changes. Human approval remains mandatory. This package is registry sample data and is not connected to an external project or publication system.
