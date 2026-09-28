/** Pure anti-slop tell detectors — B1 offline only; not wired into NovelWriter.html yet. */
export const SLOP_TELLS = ['cadence', 'stockMetaphor', 'hedgeStack', 'nameEcho', 'emotionLabel', 'overExplain'];

export const SLOP_TELL_FLOORS = {
  cadence: 60,
  stockMetaphor: 55,
  hedgeStack: 50,
  nameEcho: 55,
  emotionLabel: 50,
  overExplain: 55
};

const METAPHOR_BANK = [
  'heart of gold', 'cold as ice', 'time stood still', 'double-edged sword',
  'light at the end of the tunnel', 'tip of the iceberg', 'calm before the storm',
  'needle in a haystack', 'blessing in disguise', ' Pandora\'s box'.trim(),
  'crystal clear', 'unbreakable bond', 'whispered secrets', 'against all odds'
];

const HEDGES = ['maybe', 'perhaps', 'seemed', 'seems', 'as if', 'almost', 'somewhat', 'kind of', 'sort of', 'might', 'could have', 'appeared to'];
const EMOTION = /\b(felt|was|were|seemed|appeared)\s+(very\s+)?(sad|angry|happy|afraid|scared|nervous|excited|lonely|guilty|ashamed|proud|anxious|relieved)\b/gi;
const TRANSITIONS = ['however', 'therefore', 'moreover', 'furthermore', 'additionally', 'consequently', 'thus', 'hence', 'meanwhile', 'nevertheless'];

function sentences(text) {
  return String(text || '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
}
function words(text) {
  return String(text || '').split(/\s+/).filter(Boolean);
}
function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

function scoreCadence(text) {
  const sents = sentences(text);
  const hits = [];
  if (sents.length < 3) return { score: 0, hits };
  const lens = sents.map(s => words(s).length);
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lens.length;
  const stdev = Math.sqrt(variance);
  const lower = text.toLowerCase();
  let tHits = 0;
  TRANSITIONS.forEach(t => {
    const m = lower.match(new RegExp('\\b' + t + '\\b', 'gi'));
    if (m) tHits += m.length;
  });
  let score = 0;
  if (stdev < 2.5) { score += 40; hits.push('low_variance:' + stdev.toFixed(2)); }
  score += Math.min(40, tHits * 12);
  if (tHits >= 2) hits.push('transitionHits=' + tHits);
  return { score: clamp(score), hits };
}

function scoreStockMetaphor(text) {
  const lower = text.toLowerCase();
  const hits = [];
  let n = 0;
  METAPHOR_BANK.forEach(p => {
    if (lower.includes(p)) { n++; hits.push(p); }
  });
  return { score: clamp(n * 28), hits };
}

function scoreHedgeStack(text) {
  const w = words(text.toLowerCase());
  const hits = [];
  let worst = 0;
  for (let i = 0; i < w.length; i++) {
    let c = 0;
    const window = w.slice(i, i + 40).join(' ');
    HEDGES.forEach(h => {
      const re = new RegExp('\\b' + h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const m = window.match(re);
      if (m) c += m.length;
    });
    if (c > worst) worst = c;
  }
  if (worst >= 3) hits.push('hedgeWindow=' + worst);
  return { score: clamp(worst >= 3 ? 40 + worst * 15 : worst * 10), hits };
}

function stripDialogue(text) {
  return String(text || '')
    .replace(/"([^"\\]|\\.)*"/g, ' ')
    .replace(/\u201C([^\u201D]*)\u201D/g, ' ')
    .replace(/'([^'\\]|\\.)*'/g, ' ');
}
function scoreNameEcho(text) {
  const w = words(stripDialogue(text));
  const hits = [];
  let worst = 0;
  let worstName = '';
  for (let i = 0; i < w.length; i++) {
    const window = w.slice(i, i + 25);
    const counts = {};
    window.forEach(tok => {
      if (/^[A-Z][a-z]{2,}$/.test(tok)) counts[tok] = (counts[tok] || 0) + 1;
    });
    Object.entries(counts).forEach(([name, c]) => {
      if (c > worst) { worst = c; worstName = name; }
    });
  }
  if (worst >= 3) hits.push('nameEcho:' + worstName + 'x' + worst);
  return { score: clamp(worst >= 3 ? 35 + worst * 18 : 0), hits };
}

function scoreEmotionLabel(text) {
  const hits = [];
  const m = String(text).match(EMOTION) || [];
  m.forEach(x => hits.push(x));
  return { score: clamp(m.length * 35), hits };
}

function scoreOverExplain(text) {
  const sents = sentences(text);
  const hits = [];
  let worst = 0;
  for (let i = 1; i < sents.length; i++) {
    const a = new Set(words(sents[i - 1].toLowerCase()).map(x => x.replace(/[^a-z]/g, '')).filter(x => x.length > 3));
    const b = new Set(words(sents[i].toLowerCase()).map(x => x.replace(/[^a-z]/g, '')).filter(x => x.length > 3));
    if (!a.size || !b.size) continue;
    let inter = 0;
    a.forEach(x => { if (b.has(x)) inter++; });
    const union = a.size + b.size - inter;
    const j = inter / union;
    if (j > worst) worst = j;
    if (j >= 0.55) hits.push('overlap=' + j.toFixed(2));
  }
  return { score: clamp(worst >= 0.55 ? 40 + worst * 50 : worst * 40), hits };
}

const SCORERS = {
  cadence: scoreCadence,
  stockMetaphor: scoreStockMetaphor,
  hedgeStack: scoreHedgeStack,
  nameEcho: scoreNameEcho,
  emotionLabel: scoreEmotionLabel,
  overExplain: scoreOverExplain
};

export function scoreSlopTells(text, floors) {
  floors = Object.assign({}, SLOP_TELL_FLOORS, floors || {});
  const tells = {};
  const failures = [];
  SLOP_TELLS.forEach(k => {
    const r = SCORERS[k](text);
    const ok = r.score < floors[k];
    tells[k] = { score: r.score, hits: r.hits, ok };
    if (!ok) failures.push('tell_high:' + k + ':' + r.score + '>=' + floors[k]);
  });
  return { tells, passed: failures.length === 0, failures, floors };
}
