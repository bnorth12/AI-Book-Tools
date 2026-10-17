// SEC-SWEEP #180 split commit A (CoS ruling c): step-only placeholder. Fails if either shipped file is missing, if its
// stripper block cannot be extracted (markers, else the SECRET_FIELD_DENYLIST..stripSecretFields span), or if the block
// does not load into node:vm with stripSecretFields and isSecretField. The LOCKED-RULE-v2.2 rows land in commit B.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TOOLS, readTool, stripperBlock, loadTool } from './_load.mjs';

for (const tool of ['BE', 'BD']) {
  test(`${tool}/SS-LOAD shipped file exists, stripper block extracts and loads`, () => {
    assert.ok(fs.existsSync(TOOLS[tool]), `${tool}: ${TOOLS[tool]} is missing`);
    const { block, via } = stripperBlock(readTool(tool));
    assert.ok(via === 'markers' || via === 'span', `${tool}: unknown extraction mode ${via}`);
    assert.match(block, /function stripSecretFields\s*\(/, `${tool}: extracted block has no stripSecretFields`);
    assert.match(block, /function isSecretField\s*\(/, `${tool}: extracted block has no isSecretField`);
    const T = loadTool(tool);
    assert.equal(typeof T.stripSecretFields, 'function');
    assert.equal(typeof T.isSecretField, 'function');
  });
}
