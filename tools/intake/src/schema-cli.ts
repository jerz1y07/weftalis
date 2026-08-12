#!/usr/bin/env node

import { createSchemaRegistry, schemaIds } from "./schema-validator.js";

try {
  const ajv = await createSchemaRegistry();
  for (const schemaId of Object.values(schemaIds)) {
    if (!ajv.getSchema(schemaId)) {
      throw new Error(`Missing compiled schema: ${schemaId}`);
    }
  }
  console.log(`Weftalis Intake Schemas\n\nValidated: ${Object.keys(schemaIds).length}\nResult: SUCCESS`);
} catch {
  console.error("Weftalis Intake Schemas\n\nSchema validation failed.\nNo Workflow was executed.");
  process.exitCode = 1;
}
