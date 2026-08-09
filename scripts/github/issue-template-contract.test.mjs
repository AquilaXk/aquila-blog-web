import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import YAML from "yaml";

const repositoryUrl = "https://github.com/AquilaXk/aquila-blog-web";
const governanceFiles = {
  ".github/CONTRIBUTING.md": [
    `${repositoryUrl}/issues`,
    `${repositoryUrl}/issues/new?template=task_request.yml`,
    `${repositoryUrl}/pulls`,
    `${repositoryUrl}/compare?expand=1`,
  ],
  ".github/PULL_REQUEST_TEMPLATE.md": [`${repositoryUrl}/issues/XX`],
  ".github/CODE_OF_CONDUCT.md": ["https://github.com/AquilaXk)"],
};
const supportedFieldTypes = new Set(["markdown", "input", "textarea", "dropdown", "checkboxes"]);

const read = (file) => readFile(file, "utf8");

function assertObject(value, message) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), message);
}

function findField(form, id) {
  const field = form.body.find((item) => item.id === id);
  assert.ok(field, `missing field: ${id}`);
  return field;
}

function validateIssueForm(form) {
  assertObject(form, "form must be an object");
  for (const key of ["name", "description", "labels", "body"]) {
    assert.ok(key in form, `form must include ${key}`);
  }
  assert.equal(typeof form.name, "string");
  assert.equal(typeof form.description, "string");
  assert.ok(Array.isArray(form.labels), "labels must be an array");
  assert.ok(Array.isArray(form.body), "body must be an array");

  const ids = new Set();
  for (const field of form.body) {
    assertObject(field, "each body entry must be an object");
    assert.ok(supportedFieldTypes.has(field.type), `unsupported field type: ${field.type}`);
    assertObject(field.attributes, "each body entry must have attributes");

    if (field.type === "markdown") {
      continue;
    }

    assert.equal(typeof field.id, "string", "non-markdown fields must have an id");
    assert.match(field.id, /^[A-Za-z0-9_-]+$/, `invalid field id: ${field.id}`);
    assert.ok(!ids.has(field.id), `duplicate field id: ${field.id}`);
    ids.add(field.id);
    assert.equal(typeof field.attributes.label, "string", `missing label: ${field.id}`);
    if (field.type !== "checkboxes") {
      assert.equal(field.validations?.required, true, `field must be required: ${field.id}`);
    }

    if (field.type === "dropdown") {
      assert.ok(Array.isArray(field.attributes.options), `dropdown options: ${field.id}`);
      assert.ok(field.attributes.options.every((option) => typeof option === "string"));
    }
    if (field.type === "checkboxes") {
      assert.ok(Array.isArray(field.attributes.options), `checkbox options: ${field.id}`);
      for (const option of field.attributes.options) {
        assertObject(option, `checkbox option: ${field.id}`);
        assert.equal(typeof option.label, "string", `checkbox label: ${field.id}`);
        if ("required" in option) {
          assert.equal(typeof option.required, "boolean", `checkbox required: ${field.id}`);
        }
      }
    }
  }
}

function assertRequiredField(form, { id, label, type }) {
  const field = findField(form, id);
  assert.equal(field.type, type, `field type: ${id}`);
  assert.equal(field.attributes.label, label, `field label: ${id}`);
  assert.equal(field.validations?.required, true, `field must be required: ${id}`);
  return field;
}

function assertGovernanceContent(file, content) {
  for (const url of governanceFiles[file]) {
    assert.ok(content.includes(url), `missing current-repository URL in ${file}: ${url}`);
  }
  assert.doesNotMatch(content, /morethanmin|morethan-log/);
}

async function readForm(file) {
  const form = YAML.parse(await read(file));
  validateIssueForm(form);
  return form;
}

test("bug form requires the Web reproduction and delivery contract", async () => {
  const form = await readForm(".github/ISSUE_TEMPLATE/bug_report.yml");

  assert.equal(form.name, "🐞 Bug report");
  assert.equal(form.title, "[Bug] ");

  const severity = assertRequiredField(form, {
    id: "severity",
    label: "Severity",
    type: "dropdown",
  });
  for (const option of ["Sev1", "Sev2", "Sev3", "Sev4"]) {
    assert.ok(severity.attributes.options.some((value) => value.startsWith(option)));
  }

  for (const field of [
    { id: "domain", label: "Domain", type: "input" },
    { id: "summary", label: "Summary", type: "textarea" },
    { id: "steps_to_reproduce", label: "Steps To Reproduce", type: "textarea" },
    { id: "expected_result", label: "Expected Result", type: "textarea" },
    { id: "actual_result", label: "Actual Result", type: "textarea" },
    { id: "impact", label: "Impact", type: "textarea" },
    { id: "execution_contract", label: "Execution Contract", type: "textarea" },
    { id: "verification_delivery", label: "Verification & Delivery", type: "textarea" },
  ]) {
    assertRequiredField(form, field);
  }

  for (const pathPattern of ["src/**", "pages/**", "e2e/**", ".github/workflows/**"]) {
    assert.ok(findField(form, "domain").attributes.placeholder.includes(pathPattern));
  }

  const duplicateCheck = findField(form, "duplicate_check");
  assert.equal(duplicateCheck.type, "checkboxes");
  assert.equal(duplicateCheck.attributes.options[0].required, true);
  assert.match(duplicateCheck.attributes.options[0].label, new RegExp(`${repositoryUrl}/issues`));
});

test("task form uses the same execution and delivery vocabulary", async () => {
  const form = await readForm(".github/ISSUE_TEMPLATE/task_request.yml");

  const taskType = assertRequiredField(form, {
    id: "task_type",
    label: "Task Type",
    type: "dropdown",
  });
  assert.ok(taskType.attributes.options.includes("Feature"));

  for (const field of [
    { id: "domain", label: "Domain", type: "input" },
    { id: "execution_contract", label: "Execution Contract", type: "textarea" },
    { id: "verification_delivery", label: "Verification & Delivery", type: "textarea" },
  ]) {
    assertRequiredField(form, field);
  }
});

test("form validator rejects required, id, and field-type mutations", async () => {
  const form = await readForm(".github/ISSUE_TEMPLATE/bug_report.yml");
  const requiredFalse = structuredClone(form);
  findField(requiredFalse, "domain").validations.required = false;
  assert.throws(() => validateIssueForm(requiredFalse), /field must be required/);

  const requiredMissing = structuredClone(form);
  delete findField(requiredMissing, "domain").validations.required;
  assert.throws(() => validateIssueForm(requiredMissing), /field must be required/);

  const duplicateId = structuredClone(form);
  findField(duplicateId, "summary").id = "domain";
  assert.throws(() => validateIssueForm(duplicateId), /duplicate field id/);

  const invalidId = structuredClone(form);
  findField(invalidId, "summary").id = "summary/details";
  assert.throws(() => validateIssueForm(invalidId), /invalid field id/);

  const unsupportedType = structuredClone(form);
  findField(unsupportedType, "summary").type = "radio";
  assert.throws(() => validateIssueForm(unsupportedType), /unsupported field type/);
});

test("issue configuration blocks blank issues without contact links", async () => {
  const config = YAML.parse(await read(".github/ISSUE_TEMPLATE/config.yml"));

  assertObject(config, "config must be an object");
  assert.equal(config.blank_issues_enabled, false);
  assert.deepEqual(config.contact_links, []);
});

test("each governance file targets the Web repository and excludes upstream URLs", async (t) => {
  for (const file of Object.keys(governanceFiles)) {
    await t.test(file, async () => {
      const content = await read(file);
      assertGovernanceContent(file, content);
    });
  }

  for (const file of Object.keys(governanceFiles)) {
    const badContent = `${await read(file)}\nhttps://github.com/morethanmin/morethan-log`;
    assert.throws(() => assertGovernanceContent(file, badContent), /morethanmin|morethan-log/);
  }
});

// FUNDING is intentionally excluded: sponsor and payment settings require separate authority.
