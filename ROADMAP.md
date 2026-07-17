# Roadmap

This roadmap is intentionally incremental. Each phase should be reviewed before work begins on the next one.

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

## Phase 5: GitHub-Native Submission

- Define a pull-request-based submission process.
- Run validation checks on proposed packages.
- Document review, updates, deprecation, and removal policies.

## Phase 6: Public Testing

- Invite a small group of authors and users to test the registry.
- Collect feedback on discovery, trust, portability, and contribution friction.
- Revise the specification and roadmap based on evidence.
