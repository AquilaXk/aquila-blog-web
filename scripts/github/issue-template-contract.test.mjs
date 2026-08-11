import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import YAML from "yaml";

const repositoryUrl = "https://github.com/AquilaXk/aquila-blog-web";
const formFiles = {
  bug: ".github/ISSUE_TEMPLATE/bug_report.yml",
  task: ".github/ISSUE_TEMPLATE/task_request.yml",
  ops: ".github/ISSUE_TEMPLATE/ops_security_data.yml",
  epic: ".github/ISSUE_TEMPLATE/epic_tracker.yml",
};
const supportedFieldTypes = new Set(["markdown", "input", "textarea", "dropdown", "checkboxes"]);
const legacyRequiredVocabulary =
  /Execution Contract|Verification & Delivery|Exact commands|Commit slices|Unresolved implementation decisions/;

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
  for (const key of ["name", "description", "title", "labels", "body"]) {
    assert.ok(key in form, `form must include ${key}`);
  }
  assert.equal(typeof form.name, "string");
  assert.equal(typeof form.description, "string");
  assert.equal(typeof form.title, "string");
  assert.ok(Array.isArray(form.labels), "labels must be an array");
  assert.ok(Array.isArray(form.body), "body must be an array");

  const ids = new Set();
  for (const field of form.body) {
    assertObject(field, "each body entry must be an object");
    assert.ok(supportedFieldTypes.has(field.type), `unsupported field type: ${field.type}`);
    assertObject(field.attributes, "each body entry must have attributes");

    if (field.type === "markdown") {
      assert.equal(typeof field.attributes.value, "string", "markdown fields require value");
      continue;
    }

    assert.equal(typeof field.id, "string", "non-markdown fields must have an id");
    assert.match(field.id, /^[A-Za-z0-9_-]+$/, `invalid field id: ${field.id}`);
    assert.ok(!ids.has(field.id), `duplicate field id: ${field.id}`);
    ids.add(field.id);
    assert.equal(typeof field.attributes.label, "string", `missing label: ${field.id}`);

    if (field.validations && "required" in field.validations) {
      assert.equal(typeof field.validations.required, "boolean", `invalid required flag: ${field.id}`);
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

function assertRequiredField(form, id, type) {
  const field = findField(form, id);
  assert.equal(field.type, type, `field type: ${id}`);
  assert.equal(field.validations?.required, true, `field must be required: ${id}`);
}

async function readForm(file) {
  const content = await read(file);
  assert.doesNotMatch(content, legacyRequiredVocabulary);
  const form = YAML.parse(content);
  validateIssueForm(form);
  return form;
}

test("four practical issue forms keep only core required fields", async () => {
  const forms = Object.fromEntries(
    await Promise.all(
      Object.entries(formFiles).map(async ([key, file]) => [key, await readForm(file)]),
    ),
  );

  assert.equal(forms.bug.name, "🐞 Bug / Fix");
  assert.equal(forms.task.name, "🛠 Task / Feature / Refactor");
  assert.equal(forms.ops.name, "🛡 Ops / Security / Data");
  assert.equal(forms.epic.name, "🧭 Epic / Tracker");

  for (const [id, type] of [
    ["severity", "dropdown"],
    ["domain", "input"],
    ["summary", "textarea"],
    ["reproduction_evidence", "textarea"],
    ["expected_actual", "textarea"],
    ["impact", "textarea"],
    ["scope", "textarea"],
    ["acceptance", "textarea"],
    ["verification", "textarea"],
  ]) {
    assertRequiredField(forms.bug, id, type);
  }

  for (const [id, type] of [
    ["work_type", "dropdown"],
    ["domain", "input"],
    ["summary", "textarea"],
    ["problem_evidence", "textarea"],
    ["goal", "textarea"],
    ["scope", "textarea"],
    ["acceptance", "textarea"],
    ["verification", "textarea"],
  ]) {
    assertRequiredField(forms.task, id, type);
  }
  assert.equal(findField(forms.task, "approach").validations?.required, undefined);
  assert.equal(findField(forms.task, "dependencies").validations?.required, undefined);

  for (const [id, type] of [
    ["change_type", "dropdown"],
    ["primary_risk", "dropdown"],
    ["domain", "input"],
    ["summary", "textarea"],
    ["problem_evidence", "textarea"],
    ["goal", "textarea"],
    ["scope", "textarea"],
    ["safety_contract", "textarea"],
    ["rollout_rollback", "textarea"],
    ["acceptance", "textarea"],
    ["verification", "textarea"],
  ]) {
    assertRequiredField(forms.ops, id, type);
  }

  for (const [id, type] of [
    ["domain", "input"],
    ["goal", "textarea"],
    ["ownership", "textarea"],
    ["child_issues", "textarea"],
    ["dependency_order", "textarea"],
    ["exit_criteria", "textarea"],
    ["evidence", "textarea"],
  ]) {
    assertRequiredField(forms.epic, id, type);
  }

  for (const form of Object.values(forms)) {
    const ready = findField(form, "ready_check");
    assert.equal(ready.type, "checkboxes");
    assert.ok(ready.attributes.options.every((option) => option.required === true));
    assert.ok(
      ready.attributes.options.some((option) => option.label.includes(`${repositoryUrl}/issues`)),
    );
  }
});

test("issue configuration blocks blank issues", async () => {
  const config = YAML.parse(await read(".github/ISSUE_TEMPLATE/config.yml"));
  assertObject(config, "config must be an object");
  assert.equal(config.blank_issues_enabled, false);
  assert.deepEqual(config.contact_links, []);
});

test("pull request template is outcome and risk focused", async () => {
  const content = await read(".github/PULL_REQUEST_TEMPLATE.md");
  for (const heading of [
    "## Related Issue",
    "## Summary",
    "## Changes",
    "## Scope",
    "## Verification",
    "## Risk & Delivery",
    "## Review Guide",
    "## Evidence",
    "## Checklist",
  ]) {
    assert.ok(content.includes(heading), `missing PR section: ${heading}`);
  }
  assert.doesNotMatch(content, legacyRequiredVocabulary);
  assert.doesNotMatch(content, /Commit plan|Plan ↔ Issue/);
});

test("contributing guide links every issue form and current repository", async () => {
  const content = await read(".github/CONTRIBUTING.md");
  for (const file of Object.values(formFiles)) {
    const template = file.split("/").at(-1);
    assert.ok(
      content.includes(`${repositoryUrl}/issues/new?template=${template}`),
      `missing template link: ${template}`,
    );
  }
  assert.ok(content.includes(`${repositoryUrl}/issues`));
  assert.doesNotMatch(content, /morethanmin|morethan-log|NOTION_PAGE_ID|localhost:8001/);
});
