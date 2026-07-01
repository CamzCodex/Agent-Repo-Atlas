import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSchema(value, schema, pointer = "#") {
  if (schema.$ref) {
    throw new Error(`$ref is not supported at ${pointer}`);
  }

  if (schema.type) {
    if (schema.type === "object" && !isObject(value)) {
      return [`${pointer}: expected object`];
    }
    if (schema.type === "array" && !Array.isArray(value)) {
      return [`${pointer}: expected array`];
    }
    if (schema.type === "string" && typeof value !== "string") {
      return [`${pointer}: expected string`];
    }
    if (schema.type === "number" && typeof value !== "number") {
      return [`${pointer}: expected number`];
    }
  }

  if (schema.type === "string") {
    const errors = [];
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${pointer}: string shorter than ${schema.minLength}`);
    }
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) {
      errors.push(`${pointer}: string does not match pattern ${schema.pattern}`);
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${pointer}: value not in enum`);
    }
    return errors;
  }

  if (schema.type === "number") {
    const errors = [];
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${pointer}: number below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${pointer}: number above maximum ${schema.maximum}`);
    }
    return errors;
  }

  if (schema.type === "array") {
    const errors = [];
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${pointer}: array shorter than ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${pointer}: array longer than ${schema.maxItems}`);
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          errors.push(`${pointer}: array has duplicate items`);
          break;
        }
        seen.add(key);
      }
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateSchema(item, schema.items, `${pointer}/${index}`));
      });
    }
    return errors;
  }

  if (schema.type === "object") {
    const errors = [];
    const required = schema.required ?? [];
    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${pointer}: missing required property ${key}`);
      }
    }
    const properties = schema.properties ?? {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        errors.push(...validateSchema(value[key], childSchema, `${pointer}/${key}`));
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${pointer}: unexpected property ${key}`);
        }
      }
    }
    return errors;
  }

  return [];
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  const entrySchema = await loadJson(path.join(root, "schemas", "repo-entry.schema.json"));
  const indexSchema = await loadJson(path.join(root, "schemas", "repo-index.schema.json"));
  const index = await loadJson(path.join(root, "registries", "repo-index.json"));

  const repoDir = path.join(root, "registries", "repos");
  const repoFiles = (await readdir(repoDir)).filter((name) => name.endsWith(".json"));

  const indexErrors = validateSchema(index, indexSchema);
  if (indexErrors.length) {
    indexErrors.forEach(fail);
  }

  const listed = new Set(index.entries);
  for (const repoFile of repoFiles) {
    const fullPath = path.join(repoDir, repoFile);
    const entry = await loadJson(fullPath);
    const errors = validateSchema(entry, entrySchema);
    if (errors.length) {
      errors.forEach(fail);
    }
    if (!listed.has(entry.slug)) {
      fail(`registries/repo-index.json does not list ${entry.slug}`);
    }
  }

  for (const slug of index.entries) {
    const filePath = path.join(repoDir, `${slug}.json`);
    try {
      await readFile(filePath, "utf8");
    } catch {
      fail(`missing registry file for ${slug}`);
    }
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }

  console.log("Registry validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

