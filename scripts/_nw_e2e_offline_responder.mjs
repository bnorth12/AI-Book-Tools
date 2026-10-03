/**
 * Offline fixture responder for the NovelWriter Tracked E2E runner (PR3 of the #117 split).
 *
 * Builds deterministic xAI-shaped responses from a vendored seed `novelData` (default
 * `scripts/fixtures/nw_slop/b3r_seed.json`) so `run-tracked-e2e.mjs` can drive the real page
 * functions with no network, no API key and no paid calls. The runner wires this into
 * Playwright `page.route()`; nothing here touches the network.
 *
 * Each rule matches a prompt by a distinctive phrase from NovelWriter.html and returns the JSON
 * shape that prompt asks for. A prompt that matches no rule gets a generic JSON reply and is
 * recorded in `unmatched`, which the offline smoke requires to stay empty.
 */

function words(s) {
  const t = String(s || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

function estTokens(s) {
  return Math.max(1, Math.ceil(String(s || '').length / 4));
}

function subplotText(s) {
  if (!s) return '';
  if (typeof s === 'string') return s;
  return String((s.title || s.name || '') + ': ' + (s.summary || s.description || s.text || '')).trim();
}

export function promptTextFromBody(body) {
  if (!body || typeof body !== 'object') return '';
  if (Array.isArray(body.messages)) {
    return body.messages.map((m) => (m && typeof m.content === 'string' ? m.content : '')).join('\n\n');
  }
  if (typeof body.input === 'string') return body.input;
  return '';
}

/**
 * @param {object} seed  novelData-like seed (title, storyArc, characters, subplots, outlines, chapters, ...)
 * @returns {{ respond: (body: object) => { content: string, rule: string, usage: object }, unmatched: string[], log: object[] }}
 */
export function createOfflineResponder(seed) {
  const s = seed || {};
  const chapters = (s.chapters || []).map((c) => String(c || '')).filter((c) => c.trim());
  // Normalize to the shape NovelWriter's outline prompt asks for (list fields are arrays).
  const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));
  const blueprints = (Array.isArray(s.chapterBlueprints) ? s.chapterBlueprints : []).map((b) => Object.assign({}, b, {
    subplotPressure: asList(b && b.subplotPressure),
    characterBeats: asList(b && b.characterBeats).filter((c) => c && typeof c === 'object'),
    allowedPayoffs: asList(b && b.allowedPayoffs),
    deferredThreads: asList(b && b.deferredThreads),
    worldHooks: asList(b && b.worldHooks)
  }));
  const world = s.worldBible || {};
  const settingText = String(s.setting || '').trim() ||
    [world.name, world.summary].filter(Boolean).join(': ') ||
    'A near-future Pacific logistics corridor of docks, relay posts and bridge yards.';
  const plotText = String(s.generalPlot || '').trim() || String(s.plotOutline || '').slice(0, 1600);
  const unmatched = [];
  const log = [];

  const chapterAt = (n) => (chapters.length ? chapters[(Math.max(1, n) - 1) % chapters.length] : 'Offline fixture chapter.');
  const blueprintAt = (n) => blueprints.find((b) => b && Number(b.chapter) === n) || blueprints[(Math.max(1, n) - 1) % Math.max(1, blueprints.length)] || {};

  function chapterOutline(n) {
    const own = String((s.chapterOutlines || [])[n - 1] || '');
    if (words(own) >= 200) return own;
    const bp = blueprintAt(n);
    const parts = [
      own,
      bp.sceneGoal, bp.arcStep, bp.castArcBeat, bp.subplotPressure, bp.dialogueTurn,
      bp.sensoryWorldHook, bp.turnOrPayoff,
      'World hooks: ' + (bp.worldHooks || []).join('; ') + '.',
      'Character beats: ' + (bp.characterBeats || []).map((c) => (c && c.name ? c.name + ' ' + (c.beat || '') : '')).join(' ') + '.',
      'Deferred threads: ' + (bp.deferredThreads || []).join('; ') + '.'
    ].filter((x) => String(x || '').trim());
    let text = parts.join('\n\n');
    // Pad from the plot outline (still seed prose) until the outline clears the runner's 180-word floor.
    const plot = String(s.plotOutline || '').split(/\n+/).filter(Boolean);
    let i = 0;
    while (words(text) < 220 && i < plot.length) text += '\n\n' + plot[i++];
    return text;
  }

  function chapterArc(n) {
    const own = String((s.chapterArcs || [])[n - 1] || '');
    if (own.length >= 200) return own;
    const bp = blueprintAt(n);
    return [own, bp.castArcBeat, bp.turnOrPayoff, bp.dialogueTurn].filter(Boolean).join(' ');
  }

  function halves(text) {
    const paras = String(text).split(/\n\n+/);
    const mid = Math.max(1, Math.floor(paras.length / 2));
    return [paras.slice(0, mid).join('\n\n'), paras.slice(mid).join('\n\n') || paras.join('\n\n')];
  }

  function firstChapterNum(text, re) {
    const m = String(text).match(re || /Chapter\s+(\d+)/i);
    return m ? parseInt(m[1], 10) || 1 : 1;
  }

  function characters(count) {
    const all = (s.characters || []).filter((c) => c && c.name).map((c) => ({ name: c.name, backstory: c.backstory || '', arc: c.arc || '' }));
    return count ? all.slice(0, count) : all;
  }

  // Ordered: first match wins. `test` gets the full prompt text (system + user).
  const rules = [
    // PR1 HTML: runC1Smoke() makes one cheap ping call.
    { id: 'c1SmokePing', test: (p) => /Reply with exactly: ok/i.test(p), json: () => ({ reply: 'ok' }) },
    // main: 'List 100 notable authors ...'; PR1: 'List 100 authors suited to drafting a <genre> book ...'
    { id: 'fetchAuthors', test: (p) => /List 100 (?:notable )?authors/i.test(p),
      json: () => ({ authors: [
        { value: 'kimstanleyrobinson', name: 'Kim Stanley Robinson' },
        { value: 'marthawells', name: 'Martha Wells' },
        { value: 'adrianchaikovsky', name: 'Adrian Tchaikovsky' }
      ] }) },
    { id: 'fetchStyleGuide', test: (p) => /Create a detailed style guide/i.test(p),
      json: () => ({ styleGuide: s.styleGuide || 'Plain, concrete, technical prose.' }) },
    { id: 'suggestStoryInfo', test: (p) => /Suggest story info for a/i.test(p),
      json: () => ({ title: s.title || 'Offline Fixture', storyArc: s.storyArc || '', generalPlot: plotText, setting: settingText, styleGuide: s.styleGuide || '' }) },
    { id: 'scrapeBookInfoForCharacters', test: (p) => /Extract all character names/i.test(p),
      json: () => ({ characters: characters(0).map((c) => ({ name: c.name })) }) },
    { id: 'judgeProseQualityLLM', test: (p) => /terse literary quality rater|Score this prose sample/i.test(p),
      json: () => ({ interest: 72, readability: 74, aiSlopRisk: 28, humanLikeness: 70, rationale: 'offline fixture judge (deterministic)' }) },
    // Gate fix 1: Enrich Chapter Blueprints (auto after a thin outline, or NW_E2E_ENRICH) and its targeted retries.
    // Returns the seed's blueprints as-is: a six-beat seed passes, an old-shape seed stays thin (deterministic fail).
    { id: 'enrichChapterBlueprints', test: (p) => /Enrich \(densify\) chapterBlueprints|BLUEPRINT BEAT RETRY/i.test(p),
      json: () => ({ chapterBlueprints: blueprints }) },
    { id: 'runChapterContinuityAudit', test: (p) => /Audit continuity for Chapter/i.test(p),
      json: (p) => {
        const n = firstChapterNum(p, /Audit continuity for Chapter\s+(\d+)/i);
        const bp = blueprintAt(n);
        return {
          chapterSummary: String(chapterAt(n)).split(/\s+/).slice(0, 160).join(' '),
          unresolvedThreads: (bp.deferredThreads || []).slice(0, 3),
          storyArcProgress: { currentBeat: bp.arcStep || '', nextBeat: (blueprintAt(n + 1).arcStep || ''), riskLevel: 'low' },
          characterArcProgress: (bp.characterBeats || []).map((c) => ({ name: c.name, currentState: c.beat || '', nextBeat: '', risk: 'low' })),
          continuityRisks: [],
          recommendedFixes: []
        };
      } },
    { id: 'suggestBookImprovements', test: (p) => /suggest 7-10 detailed improvements/i.test(p),
      json: () => ({ improvements: [
        'Chapter 1 pacing: the dock opening restates the twelve-millisecond spike twice before Kwan acts. Cut the second restatement and move her refusal earlier so the stakes land in the first scene.',
        'Chapter 2 character development: give the harbor chaplain one concrete decision that costs something, so the ritual-space subplot has pressure of its own.',
        'Coherence across chapters: name the relay posts consistently and keep the bridge drill timeline explicit between chapters.'
      ] }) },
    { id: 'breakdownImprovement', test: (p) => /Break down this suggested improvement/i.test(p),
      json: () => ({ breakdown: { characters: 'Kwan: act earlier in Ch. 1.', subplots: 'Chaplaincy: add one cost.', novelOutlines: 'Keep relay names consistent.', chapterOutlines: { 1: 'Move refusal earlier.' }, chapters: { 1: 'Cut the second restatement.' } } }) },
    { id: 'checkSpellingAndGrammar', test: (p) => /Check the following text for spelling and grammar/i.test(p),
      json: () => ({ corrections: 'No corrections (offline fixture).' }) },
    { id: 'suggestCharacters', test: (p) => /"characters"\s*:\s*\[/.test(p),
      json: (p) => {
        const m = p.match(/Generate\s+(\d+)\s+additional/i) || p.match(/exactly\s+(\d+)\s+existing\s+characters/i) ||
          p.match(/Number of Characters counter is\s+(\d+)/i);
        const n = m ? parseInt(m[1], 10) : 0;
        return { characters: characters(n > 0 ? n : 3) };
      } },
    { id: 'suggestSubplots', test: (p) => /"subplots"\s*:\s*\[/.test(p),
      json: () => ({ subplots: (s.subplots || []).map(subplotText).filter(Boolean) }) },
    { id: 'outlines', test: (p) => /"novelOutline"\s*:\s*"</.test(p) && /"plotOutline"/.test(p),
      json: (p) => {
        const out = { novelOutline: s.novelOutline || '', plotOutline: s.plotOutline || '', storyArcOutline: s.storyArcOutline || '' };
        if (/"chapterBlueprints"/.test(p)) out.chapterBlueprints = blueprints;
        return out;
      } },
    { id: 'chapterOutline', test: (p) => /"outline"\s*:\s*"</.test(p) && /"arc"\s*:\s*"</.test(p),
      json: (p) => {
        const n = firstChapterNum(p, /(?:for|of)\s+Chapter\s+(\d+)/i);
        return { outline: chapterOutline(n), arc: chapterArc(n) };
      } },
    { id: 'generateChapterPart1', test: (p) => /first half text/i.test(p),
      json: (p) => ({ chapter: halves(chapterAt(firstChapterNum(p)))[0] }) },
    { id: 'generateChapterPart2', test: (p) => /second half text/i.test(p),
      json: (p) => ({ chapter: halves(chapterAt(firstChapterNum(p, /Continue Chapter\s+(\d+)/i)))[1] }) },
    { id: 'updateOrReviseChapter', test: (p) => /"chapter"\s*:\s*"</.test(p),
      json: (p) => ({ chapter: chapterAt(firstChapterNum(p, /(?:Update|Revise|Rewrite|Edit)\s+Chapter\s+(\d+)/i) || firstChapterNum(p)) }) },
    { id: 'storyArc', test: (p) => /"storyArc"\s*:\s*"</.test(p), json: () => ({ storyArc: s.storyArc || '' }) },
    { id: 'generalPlot', test: (p) => /"generalPlot"\s*:\s*"</.test(p), json: () => ({ generalPlot: plotText }) },
    { id: 'setting', test: (p) => /"setting"\s*:\s*"</.test(p), json: () => ({ setting: settingText }) }
  ];

  function respond(body) {
    const prompt = promptTextFromBody(body);
    let rule = rules.find((r) => {
      try { return r.test(prompt); } catch (_) { return false; }
    });
    let payload;
    if (rule) {
      payload = rule.json(prompt);
    } else {
      // Generic reply: fill every "key": "<...>" placeholder in the prompt's JSON template.
      const keys = Array.from(new Set(Array.from(prompt.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"\s*:\s*"</g)).map((m) => m[1])));
      payload = {};
      keys.forEach((k) => { payload[k] = 'offline fixture ' + k; });
      if (!keys.length) payload.chapter = 'offline fixture reply';
      unmatched.push(prompt.replace(/\s+/g, ' ').slice(0, 160));
      rule = { id: 'UNMATCHED' };
    }
    const content = JSON.stringify(payload);
    const usage = {
      prompt_tokens: estTokens(prompt),
      completion_tokens: estTokens(content),
      total_tokens: estTokens(prompt) + estTokens(content)
    };
    log.push({ i: log.length + 1, rule: rule.id, promptChars: prompt.length, contentChars: content.length, usage });
    return { content, rule: rule.id, usage };
  }

  return { respond, unmatched, log };
}

/** Shape a responder result as the xAI endpoint the page called (chat completions or responses). */
export function toXaiResponse(body, result, url) {
  const model = (body && body.model) || 'offline-fixture';
  if (/\/responses\b/.test(String(url || '')) || (body && typeof body.input === 'string' && !Array.isArray(body.messages))) {
    return {
      id: 'offline-' + Date.now(),
      object: 'response',
      model,
      output_text: result.content,
      output: [{ type: 'message', content: [{ type: 'output_text', text: result.content }] }],
      usage: { input_tokens: result.usage.prompt_tokens, output_tokens: result.usage.completion_tokens, total_tokens: result.usage.total_tokens }
    };
  }
  return {
    id: 'offline-chatcmpl',
    object: 'chat.completion',
    model,
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: result.content } }],
    usage: result.usage
  };
}
