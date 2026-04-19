const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'HerbalBookForge', 'HerbalBookForge.html');

if (!fs.existsSync(target)) {
  console.error(`Missing target file: ${target}`);
  process.exit(1);
}

const content = fs.readFileSync(target, 'utf8');
const failures = [];

const requiredIds = [
  'HBF1', 'HBF2', 'HBF3', 'HBF4', 'HBF5', 'HBF6', 'HBF7', 'HBF8',
  'HBF.SU1', 'HBF.SU2', 'HBF.SU3', 'HBF.SU4', 'HBF.SU5', 'HBF.SU6', 'HBF.SU7', 'HBF.SU8',
  'HBF.BG.G1', 'HBF.BG.G2', 'HBF.BG.BGA1', 'HBF.BG.BGA2', 'HBF.BG.BGA3',
  'HBF.OL1', 'HBF.OL2', 'HBF.OL3', 'HBF.OL4', 'HBF.OL5', 'HBF.OL6', 'HBF.OL7',
  'HBF.CH1', 'HBF.CH2', 'HBF.CH3', 'HBF.CH4', 'HBF.CH5',
  'HBF.DR1', 'HBF.DR2', 'HBF.DR3', 'HBF.DR4',
  'HBF.PE1', 'HBF.PE2',
  'HBF.SA1', 'HBF.SA2', 'HBF.SA3', 'HBF.SA4',
  'HBF.PR1', 'HBF.PR2', 'HBF.PR3', 'HBF.PR4',
  'HBF.GEN1', 'HBF.GEN2', 'HBF.GEN3', 'HBF.GEN4',
];

for (const id of requiredIds) {
  const re = new RegExp(`${id.replace(/\./g, '\\.')}\\s*:`, 'm');
  if (!re.test(content)) {
    failures.push(`Missing requirement comment for ${id}`);
  }
}

const plannedIds = [
  'HBF.DR1', 'HBF.DR2', 'HBF.DR3', 'HBF.DR4',
  'HBF.SA1', 'HBF.SA2', 'HBF.SA3', 'HBF.SA4',
  'HBF.PR1', 'HBF.PR2', 'HBF.PR3', 'HBF.PR4',
];

for (const id of plannedIds) {
  const todoRe = new RegExp(`TODO\\s+${id.replace(/\./g, '\\.')}\\s*:`, 'm');
  const statusRe = new RegExp(`TODO\\s+${id.replace(/\./g, '\\.')}\\s+Status\\s*:`, 'm');
  if (!todoRe.test(content)) {
    failures.push(`Missing TODO line for ${id}`);
  }
  if (!statusRe.test(content)) {
    failures.push(`Missing TODO status line for ${id}`);
  }
}

const implementedLines = content.match(/Implemented:\s*[^\n]*/g) || [];
for (const line of implementedLines) {
  if (!/Date:\s*\d{4}-\d{2}-\d{2}/.test(line)) {
    failures.push(`Implemented line missing Date field: ${line.trim()}`);
  }
}

const todoIds = new Set();
for (const m of content.matchAll(/TODO\s+(HBF(?:\.[A-Z0-9]+)+)\s*:/g)) {
  todoIds.add(m[1]);
}
for (const id of todoIds) {
  if (!requiredIds.includes(id)) {
    failures.push(`TODO references unknown requirement id: ${id}`);
  }
}

if (failures.length) {
  console.error('Governance check FAILED');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log('Governance check PASSED');
console.log(`Validated ${requiredIds.length} requirement IDs`);
console.log(`Validated ${plannedIds.length} planned TODO requirement pairs`);
