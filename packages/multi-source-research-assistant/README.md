# Multi-Source Research Assistant

This n8n example receives a research topic and user-selected public URLs. It retrieves the public pages, combines the evidence, pauses for a human evidence decision, and then prepares a structured summary. It does not send email, publish content, or read from or write to the filesystem.

## Inputs

- `research_topic`: the research question.
- `public_source_urls`: public pages chosen by the user.

## Output

`research_summary` contains findings, source references, uncertainties, and human review notes.

## Permissions and review

The HTTP Request nodes require outbound network access and send the requested URLs to their public hosts. The export contains no credential configuration. The Human Evidence Review Gate must approve the collected evidence before the final summary step.

## Limitations

The example does not prove that a source is accurate, current, or unbiased. A reviewer must inspect evidence and citations. The package is registry sample data and is not connected to an external project or service.
