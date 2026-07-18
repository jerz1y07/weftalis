# Weftalis Validator v0.1

The Weftalis Validator checks a Weftalis Workflow Package locally before it is reviewed or shared. It reads metadata and platform export files as data. It never executes the Workflow.

## Current capabilities

The Validator can:

- accept a Workflow Package directory or a direct path to `workflow.yaml`;
- parse the manifest as YAML;
- validate the manifest with `spec/workflow.schema.json` using AJV's JSON Schema Draft 2020-12 implementation;
- validate `license` with an SPDX expression parser;
- reject unsafe, absolute, Windows-drive, backslash, traversal, URL-encoded traversal, and package-escaping symbolic-link paths;
- confirm that every referenced path exists and is a regular file;
- scan the manifest and referenced text files for several common secret patterns;
- parse basic n8n JSON and Dify YAML export structure;
- compare a limited set of statically detected capabilities with declared permissions and safety metadata; and
- report unknown platform nodes for manual review.

## Installation

Node.js 20.19.0 or newer is the minimum version. Use a supported Node.js release line: Node.js 20.19+, 22.12+, or 24+.

From the repository root:

```bash
cd validator
npm install
```

No external Workflow service is needed.

## JSON Schema strict mode

The Validator uses AJV's real Draft 2020-12 entry point. AJV strict mode and format validation remain enabled. Only AJV's `strictTypes` schema-lint option is disabled because the v0.1 Schema defines `checkpoints` as an array in its parent schema, then applies `minItems` or `maxItems` inside conditional subschemas without repeating the type. This is valid Draft 2020-12 behavior. Changing the Schema in memory merely to satisfy that lint would make validation less transparent.

## CLI usage

Validate a Package directory:

```bash
npm run validate -- ./fixtures/valid-n8n-package
```

Or point directly to its manifest:

```bash
npm run validate -- ./fixtures/valid-n8n-package/workflow.yaml
```

The Validator automatically uses the Package directory as the path boundary and loads the repository's `spec/workflow.schema.json`.

## Output and exit codes

The output lists passed checks with `✓`, warnings with `⚠`, and errors with `✗`. A details section explains the file and approximate line when that information is available.

- Exit code `0`: valid; warnings may still be present.
- Exit code `1`: invalid because one or more Package errors were found.
- Exit code `2`: the Validator could not run, for example because the argument, Schema, or manifest file could not be read.

Errors mean the Package does not meet a rule or contradicts statically detected evidence. Warnings mean the limited static analysis is uncertain or a useful optional declaration is missing. Warnings require human attention but do not make the Package invalid.

## Supported platforms

### n8n

The v0.1 Adapter parses JSON with `nodes` and `connections`. It has limited recognition for HTTP requests, email/Gmail/SMTP, file reads and writes, code/function nodes, and credential references.

### Dify

The v0.1 Adapter parses YAML with `workflow.graph.nodes`. It has limited recognition for HTTP request nodes, code nodes, and credential or provider configuration.

An unknown node produces a warning. It is never treated as proof that the Workflow is safe.

## Secret scanning limitations

The scanner looks for common OpenAI, GitHub, AWS, Bearer-token, private-key, and credential-assignment patterns. Findings show only a redacted fragment, not the complete suspected value. Test fixtures contain only obvious fake values.

Secret scanning is heuristic. It can produce false positives and false negatives. Passing the scan does not mean a Package is free of secrets or absolutely safe. Reviewers must still inspect Package contents manually and use platform-managed credential storage.

## Other current limitations

- Static detection covers only explicitly documented node patterns and does not understand every community or future node.
- The Validator cannot prove that permissions, dependencies, risk, data-handling, testing, inputs, or outputs are truthful.
- It does not prove that an export will execute correctly or is compatible with the declared platform version.
- It does not detect every possible data transfer, malicious instruction, obfuscation, or credential format.
- It does not certify quality, usefulness, legal safety, or overall security.
- It does not connect to n8n, Dify, GitHub, or any external API.

## Development checks

Run all automated tests:

```bash
npm test
```

Check TypeScript types and create build output:

```bash
npm run typecheck
npm run build
```

## Safety boundary: no execution

The Validator only reads and parses files. It does not run Workflow nodes, evaluate fixture code, contact platform services, resolve remote resources, or make external API calls. A successful validation is a metadata and static-evidence check, not permission to execute an untrusted Workflow.
