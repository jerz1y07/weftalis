# Weftalis Roadmap

This roadmap for Weftalis is intentionally incremental. Each phase should be reviewed before work begins on the next one.

## Phase 1: Project Foundation

- Establish the repository structure and project documents.
- Clarify scope, terminology, contribution expectations, and safety constraints.
- Add lightweight checks only when the project has content to check.

## Phase 2: Static Website Prototype

- Design a small, read-only browsing experience.
- Use sample data rather than a database or external service.
- Test whether users can understand and compare workflow entries.

## Phase 3: Workflow Package Specification

- Define the smallest useful package structure and metadata fields.
- Document versioning, permissions, inputs, outputs, dependencies, and provenance.
- Publish examples and gather feedback before stabilizing the format.

## Phase 4: Validator

- Build a local command-line validator for the package specification.
- Produce clear, beginner-friendly validation errors.
- Add test fixtures for valid and invalid packages.

## Phase 5: Registry Builder and Initial Packages

- Generate stable Registry JSON from validated local Packages.
- Add initial n8n and dify Workflow Packages.
- Keep invalid Packages separate with actionable validation results.

## Phase 6: Website Registry Integration

- Read real generated Registry data in the static website.
- Keep the site read-only and independent from mock data.
- Check and build the website locally from committed Registry data.

## Phase 7: GitHub-Native Contribution and CI

- Define a Pull Request-based Workflow submission and human-review process.
- Add contribution, security, conduct, review, and CI documentation.
- Prepare GitHub issue forms, a Pull Request template, and read-only GitHub Actions checks.
- Verify Registry synchronization while ignoring only generated timestamp fields.

Status: complete. The repository is public, and the CI workflow has run successfully on GitHub. Pull Request behavior still requires normal review whenever the first external contribution arrives.

## Phase 8: Public Testing

- Invite a small group of authors and users to test the registry.
- Collect feedback on discovery, trust, portability, and contribution friction.
- Revise the specification and roadmap based on evidence.

Status: ongoing. The public repository and static site provide the initial test surface; no broad adoption or production-readiness claim is made.

## Phase 9: Public Website Readiness

- Deploy the static website through GitHub Pages.
- Add production canonical metadata, sitemap, robots policy, and base-path verification.
- Confirm that the public site remains read-only and uses committed Registry data.

Status: complete. The public project site is available at <https://jerz1y07.github.io/weftalis/>.

## Phase 10: First Public Release

- Audit the repository and production site as the v0.1.0 release candidate.
- Prepare the changelog, release notes, architecture summary, limitations, and release checklist.
- Reproduce all component, Registry, website, format, privacy, and production checks.
- Stop for maintainer review before creating a tag or GitHub Release.

Status: the release candidate is prepared and awaiting maintainer review. No `v0.1.0` tag or GitHub Release exists.
