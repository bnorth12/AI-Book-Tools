// Realistic HBF project JSON (drafts, outlines, chat history, citations, a few credential links), from
// sec-sweep-hbf/timing-save.mjs :4-:16 (plan "Save-path timing"). The secrets use the marker SEK so a leak is easy to spot.
export const para = ['Valerian root is a classic nervine; traditional dose is 1-3 mL of a 1:5 tincture in 60% ethanol, up to 3x daily. ',
  'Caution: may potentiate sedatives and should be avoided before driving. A 10% glycerite suits children over 6. ',
  'Chamomile tea (2-3 g dried flower per cup, steeped 10 min) eases mild digestive upset; see https://pubmed.ncbi.nlm.nih.gov/20251119/ for review. ',
  'Lemon balm pairs well with passionflower; 25%-30% glycerin preserves the extract. Store at 60% humidity away from light. '];
export const cites = ['Barnes J. Herbal Medicines, 3rd ed. https://doi.org/10.1016/j.jep.2020.112345', 'ESCOP monograph https://www.ema.europa.eu/docs/valerian.pdf',
  'Hoffmann D. Medical Herbalism https://b.s3.amazonaws.com/refs/h.pdf?X-Amz-Credential=AK&X-Amz-Signature=SEK (accessed 2026-10-01)', 'Mars B. https://e.com/refs?page=2&sort=asc'];
export function project(target) {
  let i = 0;
  const p = { meta: { name: 'Herbal Book', version: '1.0.0' }, setup: { collectionIds: ['c1'], preferredModel: 'grok-4.7' },
    goals: { mainGoal: para[0], tone: 'Warm', chatHistory: [] }, outline: '### Chapter 1\n- A', chapterOutlines: [], drafts: [] };
  while (JSON.stringify(p).length < target) {
    const ch = i++; let t = ''; for (let j = 0; j < 40; j++) t += para[(ch + j) % 4];
    p.chapterOutlines.push({ chapterId: 'c' + ch, title: 'Chapter ' + ch, annotation: para[ch % 4].repeat(5) + ' (ch ' + ch + ')' });
    p.drafts.push({ chapterId: 'c' + ch, chapterTitle: 'Chapter ' + ch, draftText: t + (ch % 7 === 0 ? ' Source: https://e.com/a.pdf?token=SEK.' : ''), qualityFlags: ['Dosage range not specified'], sources: cites.map((c) => c + ' [' + ch + ']'), notes: 'See https://www.ema.europa.eu/x ch' + ch });
    p.goals.chatHistory.push({ role: 'user', content: para[ch % 4] + ' q' + ch });
  }
  return p;
}
