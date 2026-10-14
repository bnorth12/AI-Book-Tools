import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const dispatchOnly = "github.event_name == 'workflow_dispatch'";
const secretReference = /secrets\s*(?:\.\s*XAI_API_KEY\b|\[\s*['"]XAI_API_KEY['"]\s*\])/i;

function guard(source) {
  const workflow = load(source);
  const smokeSteps = [];
  for (const [jobId, job] of Object.entries(workflow.jobs || {})) {
    for (const [index, step] of (job.steps || []).entries()) {
      if (step.name === 'Grok endpoint smoke test') {
        smokeSteps.push({ step, path: ['jobs', jobId, 'steps', String(index)] });
      }
    }
  }
  assert.equal(smokeSteps.length, 1, 'Expected exactly one Grok endpoint smoke test step');
  const smoke = smokeSteps[0];
  assert.equal(smoke.step.if, dispatchOnly, 'Grok smoke if must be exactly dispatch-only');
  assert.equal(
    smoke.step.env?.XAI_API_KEY,
    '${{ secrets.XAI_API_KEY }}',
    'Grok smoke must retain its step-scoped XAI_API_KEY secret'
  );

  const allowedPath = [...smoke.path, 'env', 'XAI_API_KEY'];
  let references = 0;
  function visit(value, path = []) {
    if (typeof value === 'string' && secretReference.test(value)) {
      assert.deepEqual(path, allowedPath, 'XAI_API_KEY secret must only appear in the Grok step env');
      references++;
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        visit(key, [...path, key, '<key>']);
        visit(child, [...path, key]);
      }
    }
  }
  visit(workflow);
  assert.equal(references, 1, 'Expected exactly one step-scoped XAI_API_KEY secret reference');
}

const fixture = `jobs:
  test:
    steps:
      - name: Grok endpoint smoke test
        if: ${dispatchOnly}
        env:
          XAI_API_KEY: '\${{ secrets.XAI_API_KEY }}'
        run: echo smoke
`;

try {
  guard(fixture);
  assert.throws(
    () => guard(fixture.replace(dispatchOnly, `github.event_name == 'pull_request' || ${dispatchOnly}`)),
    /Grok smoke if must be exactly dispatch-only/
  );
  assert.throws(
    () => guard(fixture.replace('    steps:', "    env:\n      XAI_API_KEY: '${{ secrets.XAI_API_KEY }}'\n    steps:")),
    /XAI_API_KEY secret must only appear in the Grok step env/
  );
  assert.throws(
    () => guard(fixture + "      - name: Other step\n        env:\n          XAI_API_KEY: '${{ secrets.XAI_API_KEY }}'\n"),
    /XAI_API_KEY secret must only appear in the Grok step env/
  );
  console.log('PASS: fixtures accept dispatch-only and reject PR access and other job/step secret references');
  guard(readFileSync(new URL('../.github/workflows/test.yml', import.meta.url), 'utf8'));
  console.log('PASS: test.yml restricts the XAI secret and Grok smoke to workflow_dispatch');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
