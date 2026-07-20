# Changelog

All notable changes to Weftalis are documented in this file. The structure is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning for repository releases.

## [Unreleased]

No changes are recorded after the v0.1.0 release candidate yet.

## [0.1.0] - Release candidate

This candidate was prepared on 2026-07-20. It has not been tagged or published as a GitHub Release.

### Added

- Weftalis Workflow Package Specification v0.1, including a human-readable specification, JSON Schema Draft 2020-12 schema, and structural examples.
- Weftalis Validator v0.1 for local structural, path, file, license, secret-pattern, n8n, Dify, permission, and safety-declaration checks without Workflow execution.
- Weftalis Registry Builder v0.1 for discovering local Packages, using the Validator, and generating deterministic Registry content apart from documented timestamps.
- Generated accepted and rejected Registry JSON documents, plus synchronization checks for website Registry data.
- Two initial example Workflow Packages: Multi-Source Research Assistant for n8n and Human-Reviewed Writing Pipeline for Dify.
- A read-only static Next.js website and GitHub Pages deployment at <https://jerz1y07.github.io/weftalis/>.
- GitHub-native contribution guides, review guidance, issue forms, a Pull Request template, and read-only CI checks.
- Apache License 2.0, security guidance, brand guidance, product direction, and community conduct documentation.

### Security

- Workflow exports, manifests, examples, and fixtures are read and parsed as data; the Validator, Registry Builder, CI workflow, and website do not execute submitted Workflows.
- Secret scanning covers several common credential patterns and redacts reported fragments, but it is heuristic and may miss secrets or flag safe text.
- A passing Validator or CI result is not a security certification, endorsement, execution guarantee, quality guarantee, or license-ownership verification. Human review remains required.

### Known limitations

- Version 0.1 supports only n8n and Dify Packages and recognizes only a limited set of platform node patterns.
- Static checks cannot prove that metadata is truthful, source exports are executable, runtime versions are compatible, declared inputs and outputs match behavior, or external services are safe.
- Registry discovery is local, non-recursive, and limited to one Package per direct child folder.
- The website is a static catalog. It has no Workflow execution, downloads, uploads, accounts, authentication, database, API, analytics, or custom domain.
- The two included Packages are examples, not production recommendations, and their declared testing metadata is not independent certification.
