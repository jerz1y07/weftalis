# Workflow Package Template

Copy this entire directory to `packages/<your-workflow-id>`. Remove the leading underscore from the copied directory name so Registry Builder can discover it.

1. Choose a lowercase `id` containing letters, numbers, and hyphens. The Package folder name must exactly match this `id`.
2. Replace every placeholder in `workflow.yaml`. Declare the capabilities used by the real platform nodes, including network, file, code, publishing, email, and platform-managed credential access.
3. Export the original workflow into `source/` and update `runtime.platform`, `runtime.minimum_version`, and `runtime.source_file`.
4. Replace the example input and output with safe, representative data.
5. Update this README with setup, inputs, outputs, permissions, human-review points, and known limitations.

From the repository root, validate the copied Package:

```bash
cd validator
npm run validate -- ../packages/<your-workflow-id>
```

Then generate the local Registry:

```bash
cd tools/registry-builder
npm run build-registry
```

Never commit passwords, tokens, private keys, credential values, or other secrets. Refer to credentials only as values that the target platform must provide securely at runtime.

The `_template` directory itself is intentionally incomplete and is always ignored by Registry Builder. It is not a real Workflow Package.
