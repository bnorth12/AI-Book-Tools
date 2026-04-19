const XAI_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const DEFAULT_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

const QUALITY_RUBRIC = [
  'chapterCoherence',
  'characterConsistency',
  'subplotIntegration',
  'sceneClarity',
  'emotionalImpact',
  'continuityIntegrity',
  'proseSpecificity',
];

function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null;

  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      // fall through
    }
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeQualityPayload(payload) {
  const rubric = payload?.rubric && typeof payload.rubric === 'object' ? payload.rubric : {};
  const normalizedRubric = {};

  for (const key of QUALITY_RUBRIC) {
    const raw = rubric[key] || {};
    const score = Number(raw.score || 0);
    normalizedRubric[key] = {
      score: Number.isFinite(score) ? Math.max(1, Math.min(10, score)) : 1,
      evidence: String(raw.evidence || '').trim(),
    };
  }

  const overallScore = Number(payload?.overallScore || average(Object.values(normalizedRubric).map((item) => item.score)));

  return {
    overallScore: Number.isFinite(overallScore) ? Math.max(1, Math.min(10, overallScore)) : 1,
    verdict: String(payload?.verdict || '').trim(),
    strengths: Array.isArray(payload?.strengths) ? payload.strengths.map((item) => String(item).trim()).filter(Boolean) : [],
    weaknesses: Array.isArray(payload?.weaknesses) ? payload.weaknesses.map((item) => String(item).trim()).filter(Boolean) : [],
    rubric: normalizedRubric,
  };
}

async function callQualityJudge(apiKey, payload) {
  const response = await fetch(XAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Quality judge request failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const parsed = safeParseJson(content);
  if (!parsed) {
    throw new Error(`Unable to parse quality judge response: ${content.slice(0, 500)}`);
  }

  return normalizeQualityPayload(parsed);
}

async function judgeChapterQuality({
  apiKey,
  title,
  genre,
  variantId,
  storyArc,
  generalPlot,
  setting,
  characters,
  subplots,
  chapterOutline,
  chapterArc,
  chapterText,
  continuityAudit,
}) {
  if (!apiKey) throw new Error('Missing apiKey for quality judge');
  if (!chapterText || !chapterText.trim()) throw new Error('Missing chapterText for quality judge');

  const messages = [
    {
      role: 'system',
      content: [
        'You are a fiction quality evaluator.',
        'Judge the final chapter output for writing quality, not compliance theater.',
        'Use the rubric categories exactly as provided and score each from 1-10.',
        'The proxies are supporting evidence only; the defining characteristic is quality of the final chapter.',
        'Return strict JSON only.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Variant: ${variantId}`,
        `Title: ${title || 'Untitled'}`,
        `Genre: ${genre || 'unknown'}`,
        `Story Arc: ${storyArc || 'N/A'}`,
        `Plot: ${generalPlot || 'N/A'}`,
        `Setting: ${setting || 'N/A'}`,
        `Characters: ${JSON.stringify(characters || [])}`,
        `Subplots: ${JSON.stringify(subplots || [])}`,
        `Chapter Outline: ${chapterOutline || 'N/A'}`,
        `Chapter Arc: ${chapterArc || 'N/A'}`,
        `Continuity Audit Context: ${JSON.stringify(continuityAudit || {})}`,
        'Rubric categories to score from 1-10:',
        '- chapterCoherence: does the chapter read as a coherent, causally connected unit?',
        '- characterConsistency: do characters act, speak, and feel in ways consistent with setup and arc?',
        '- subplotIntegration: are subplot elements meaningfully integrated rather than bolted on?',
        '- sceneClarity: are scene goals, transitions, and physical/logical beats understandable?',
        '- emotionalImpact: does the chapter create meaningful tension, feeling, or momentum?',
        '- continuityIntegrity: does the chapter preserve established facts and avoid obvious contradiction?',
        '- proseSpecificity: is the prose concrete, specific, and non-generic?',
        'Return strict JSON with this shape:',
        '{',
        '  "overallScore": 1-10,',
        '  "verdict": "<short judgment>",',
        '  "strengths": ["<strength>", "..."],',
        '  "weaknesses": ["<weakness>", "..."],',
        '  "rubric": {',
        '    "chapterCoherence": {"score": 1-10, "evidence": "<evidence>"},',
        '    "characterConsistency": {"score": 1-10, "evidence": "<evidence>"},',
        '    "subplotIntegration": {"score": 1-10, "evidence": "<evidence>"},',
        '    "sceneClarity": {"score": 1-10, "evidence": "<evidence>"},',
        '    "emotionalImpact": {"score": 1-10, "evidence": "<evidence>"},',
        '    "continuityIntegrity": {"score": 1-10, "evidence": "<evidence>"},',
        '    "proseSpecificity": {"score": 1-10, "evidence": "<evidence>"}',
        '  }',
        '}',
        'Final chapter to evaluate:',
        chapterText,
      ].join('\n'),
    },
  ];

  return callQualityJudge(apiKey, {
    model: DEFAULT_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages,
  });
}

async function judgeArtifactQuality({
  apiKey,
  variantId,
  artifactType,
  context,
  artifactText,
}) {
  if (!apiKey) throw new Error('Missing apiKey for quality judge');
  if (!artifactText || !artifactText.trim()) throw new Error('Missing artifactText for quality judge');

  const messages = [
    {
      role: 'system',
      content: [
        'You are a quality evaluator for novel development artifacts.',
        'Score quality from 1-10 for each rubric category and provide specific evidence.',
        'The defining criterion is product quality; operational proxies are secondary context only.',
        'Return strict JSON only.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Variant: ${variantId}`,
        `Artifact Type: ${artifactType || 'generic'}`,
        `Context: ${JSON.stringify(context || {})}`,
        'Rubric categories to score from 1-10:',
        '- chapterCoherence: internally coherent structure and causal logic of the artifact.',
        '- characterConsistency: alignment with established character intent/state where applicable.',
        '- subplotIntegration: meaningful linkage to central and secondary narrative threads.',
        '- sceneClarity: clarity and interpretability of beats, transitions, or instructions.',
        '- emotionalImpact: expected narrative tension/momentum implied by the artifact.',
        '- continuityIntegrity: consistency with provided context and constraints.',
        '- proseSpecificity: concrete, non-generic language and actionable specificity.',
        'Return strict JSON with this shape:',
        '{',
        '  "overallScore": 1-10,',
        '  "verdict": "<short judgment>",',
        '  "strengths": ["<strength>", "..."],',
        '  "weaknesses": ["<weakness>", "..."],',
        '  "rubric": {',
        '    "chapterCoherence": {"score": 1-10, "evidence": "<evidence>"},',
        '    "characterConsistency": {"score": 1-10, "evidence": "<evidence>"},',
        '    "subplotIntegration": {"score": 1-10, "evidence": "<evidence>"},',
        '    "sceneClarity": {"score": 1-10, "evidence": "<evidence>"},',
        '    "emotionalImpact": {"score": 1-10, "evidence": "<evidence>"},',
        '    "continuityIntegrity": {"score": 1-10, "evidence": "<evidence>"},',
        '    "proseSpecificity": {"score": 1-10, "evidence": "<evidence>"}',
        '  }',
        '}',
        'Artifact content to evaluate:',
        artifactText,
      ].join('\n'),
    },
  ];

  return callQualityJudge(apiKey, {
    model: DEFAULT_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages,
  });
}

async function judgePairwiseQuality({
  apiKey,
  context,
  artifactType,
  baselineArtifact,
  candidateArtifact,
  baselineLabel = 'baseline',
  candidateLabel = 'candidate',
}) {
  if (!apiKey) throw new Error('Missing apiKey for pairwise quality judge');
  if (!baselineArtifact || !candidateArtifact) {
    throw new Error('Pairwise quality judge requires both baselineArtifact and candidateArtifact');
  }

  const payload = {
    model: DEFAULT_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You are a strict fiction quality arbiter.',
          'Compare two artifacts and decide which is higher quality overall.',
          'Use the rubric dimensions and explain concrete tradeoffs.',
          'Return strict JSON only.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Artifact Type: ${artifactType || 'generic'}`,
          `Context: ${JSON.stringify(context || {})}`,
          `Option A (${baselineLabel}):`,
          baselineArtifact,
          `Option B (${candidateLabel}):`,
          candidateArtifact,
          'Return strict JSON:',
          '{',
          '  "winner": "A|B|tie",',
          '  "confidence": 0.0-1.0,',
          '  "reasoning": ["<short reason>", "..."],',
          '  "dimensionWinners": {',
          '    "chapterCoherence": "A|B|tie",',
          '    "characterConsistency": "A|B|tie",',
          '    "subplotIntegration": "A|B|tie",',
          '    "sceneClarity": "A|B|tie",',
          '    "emotionalImpact": "A|B|tie",',
          '    "continuityIntegrity": "A|B|tie",',
          '    "proseSpecificity": "A|B|tie"',
          '  }',
          '}',
        ].join('\n'),
      },
    ],
  };

  const response = await fetch(XAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pairwise quality judge request failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const raw = safeParseJson(content) || {};
  const winner = ['A', 'B', 'tie'].includes(raw?.winner) ? raw.winner : 'tie';
  return {
    winner,
    confidence: Math.max(0, Math.min(1, Number(raw?.confidence || 0))),
    reasoning: Array.isArray(raw?.reasoning) ? raw.reasoning : [],
    dimensionWinners: raw?.dimensionWinners && typeof raw.dimensionWinners === 'object' ? raw.dimensionWinners : {},
  };
}

module.exports = {
  QUALITY_RUBRIC,
  judgeChapterQuality,
  judgeArtifactQuality,
  judgePairwiseQuality,
};
