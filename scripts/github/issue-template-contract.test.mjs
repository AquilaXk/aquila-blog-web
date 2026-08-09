import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryUrl = "https://github.com/AquilaXk/aquila-blog-web";
const governanceFiles = [
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/CONTRIBUTING.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/CODE_OF_CONDUCT.md",
];

const read = (file) => readFile(file, "utf8");

function assertRequiredField(form, { id, label, type }) {
  const fieldPattern = new RegExp(
    `- type: ${type}\\n    id: ${id}\\n    attributes:[\\s\\S]*?      label: ${label}[\\s\\S]*?    validations:\\n      required: true`,
  );

  assert.match(form, fieldPattern);
}

test("bug form requires the Web reproduction and delivery contract", async () => {
  const form = await read(".github/ISSUE_TEMPLATE/bug_report.yml");

  assert.match(form, /^name: "🐞 Bug report"$/m);
  assert.match(form, /^title: "\[Bug\] "$/m);

  assertRequiredField(form, {
    id: "severity",
    label: "Severity",
    type: "dropdown",
  });
  for (const option of ["Sev1", "Sev2", "Sev3", "Sev4"]) {
    assert.match(form, new RegExp(`- ${option} - `));
  }

  for (const field of [
    { id: "domain", label: "Domain", type: "input" },
    { id: "summary", label: "Summary", type: "textarea" },
    {
      id: "steps_to_reproduce",
      label: "Steps To Reproduce",
      type: "textarea",
    },
    { id: "expected_result", label: "Expected Result", type: "textarea" },
    { id: "actual_result", label: "Actual Result", type: "textarea" },
    { id: "impact", label: "Impact", type: "textarea" },
    {
      id: "execution_contract",
      label: "Execution Contract",
      type: "textarea",
    },
    {
      id: "verification_delivery",
      label: "Verification & Delivery",
      type: "textarea",
    },
  ]) {
    assertRequiredField(form, field);
  }

  for (const pathPattern of ["src/**", "pages/**", "e2e/**", ".github/workflows/**"]) {
    assert.match(form, new RegExp(pathPattern.replaceAll("*", "\\\\*")));
  }

  assert.match(form, new RegExp(`${repositoryUrl}/issues`));
  assert.match(form, /id: duplicate_check[\s\S]*?required: true/);
});

test("task form uses the same execution and delivery vocabulary", async () => {
  const form = await read(".github/ISSUE_TEMPLATE/task_request.yml");

  for (const field of [
    { id: "domain", label: "Domain", type: "input" },
    {
      id: "execution_contract",
      label: "Execution Contract",
      type: "textarea",
    },
    {
      id: "verification_delivery",
      label: "Verification & Delivery",
      type: "textarea",
    },
  ]) {
    assertRequiredField(form, field);
  }
});

test("issue configuration blocks blank issues without contact links", async () => {
  const config = await read(".github/ISSUE_TEMPLATE/config.yml");

  assert.match(config, /^blank_issues_enabled: false$/m);
  assert.match(config, /^contact_links: \[\]$/m);
});

test("governance links target the Web repository and exclude upstream URLs", async () => {
  const contents = await Promise.all(governanceFiles.map(read));
  const governance = contents.join("\n");

  assert.match(governance, new RegExp(`${repositoryUrl}/issues`));
  assert.match(governance, new RegExp(`${repositoryUrl}/pulls`));
  assert.match(governance, new RegExp(`${repositoryUrl}/compare\\?expand=1`));
  assert.match(governance, /https:\/\/github\.com\/AquilaXk\)/);
  assert.doesNotMatch(governance, /morethanmin|morethan-log/);
});

// FUNDING is intentionally excluded: sponsor and payment settings require separate authority.
