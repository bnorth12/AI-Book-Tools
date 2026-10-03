// === BEAT_COVERAGE_BEGIN ===
// A1/A2: fail-closed chapter blueprint beat obligations (no pad-to-N).
// Required six: sceneGoal, castArcBeat, subplotPressure, dialogueTurn, sensoryWorldHook, turnOrPayoff
var NW_BEAT_REQUIRED = ['sceneGoal', 'castArcBeat', 'subplotPressure', 'dialogueTurn', 'sensoryWorldHook', 'turnOrPayoff'];
var NW_BEAT_STUB_CHARS = (typeof NW_DENSITY !== 'undefined' && NW_DENSITY.stubCharLimit) ? NW_DENSITY.stubCharLimit : 40;

function nwBeatFieldText(v) {
	if (v == null) return '';
	if (typeof v === 'string') return v.trim();
	if (Array.isArray(v)) return v.map(function (x) { return nwBeatFieldText(x); }).filter(Boolean).join('; ');
	if (typeof v === 'object') {
		if (v.name && (v.beat || v.text || v.summary || v.detail || v.description)) {
			return String(v.name).trim() + ': ' + String(v.beat || v.text || v.summary || v.detail || v.description || '').trim();
		}
		if (v.beat || v.text || v.summary || v.goal) return String(v.beat || v.text || v.summary || v.goal || '').trim();
		try { return JSON.stringify(v); } catch (_) { return String(v); }
	}
	return String(v).trim();
}

function normalizeChapterBeatPack(raw, chapterNum) {
	if (raw == null) return null;
	var bp = raw;
	if (typeof raw === 'string') {
		try { bp = JSON.parse(raw); } catch (_) { bp = { arcStep: raw }; }
	}
	if (typeof bp !== 'object') return null;
	// Fix 2 (NW_GATE_FIX_SPEC): `role` (e.g. 'rising action') is a label, not a scene goal; it stays on the pack for display only.
		var sceneGoal = nwBeatFieldText(bp.sceneGoal || bp.goal || '');
	var castArcBeat = nwBeatFieldText(bp.castArcBeat || '');
	if (!castArcBeat && Array.isArray(bp.characterBeats) && bp.characterBeats.length) {
		castArcBeat = bp.characterBeats.map(nwBeatFieldText).filter(Boolean).join('; ');
	}
	if (!castArcBeat) castArcBeat = nwBeatFieldText(bp.arcStep || '');
	var subplotPressure = nwBeatFieldText(bp.subplotPressure || bp.subplot || '');
	var dialogueTurn = nwBeatFieldText(bp.dialogueTurn || bp.dialogue || bp.dialogueObligation || '');
	var sensoryWorldHook = nwBeatFieldText(bp.sensoryWorldHook || '');
	if (!sensoryWorldHook && Array.isArray(bp.worldHooks) && bp.worldHooks.length) {
		// Fix 2: nwBeatFieldText, not String() (object hooks became [object Object]). No arcStep fallback here by design.
		sensoryWorldHook = bp.worldHooks.map(nwBeatFieldText).filter(Boolean).join('; ');
	}
	var turnOrPayoff = nwBeatFieldText(bp.turnOrPayoff || bp.payoff || '');
	if (!turnOrPayoff && Array.isArray(bp.allowedPayoffs) && bp.allowedPayoffs.length) {
		turnOrPayoff = bp.allowedPayoffs.map(nwBeatFieldText).filter(Boolean).join('; ');
	}
	if (!turnOrPayoff) turnOrPayoff = nwBeatFieldText(bp.arcStep || '');
	return {
		chapter: bp.chapter != null ? bp.chapter : chapterNum,
		sceneGoal: sceneGoal,
		castArcBeat: castArcBeat,
		subplotPressure: subplotPressure,
		dialogueTurn: dialogueTurn,
		sensoryWorldHook: sensoryWorldHook,
		turnOrPayoff: turnOrPayoff,
		// preserve extras for packing
		characterBeats: bp.characterBeats,
		worldHooks: bp.worldHooks,
		allowedPayoffs: bp.allowedPayoffs,
		deferredThreads: bp.deferredThreads,
		role: bp.role || '',
		arcStep: bp.arcStep || ''
	};
}

function scoreBeatCoverage(nd, opts) {
	nd = nd || {};
	opts = opts || {};
	var cap = Number(opts.chapterCap) || Number(nd.numChapters) || Number(opts.e2eCap) || 0;
	var list = Array.isArray(nd.chapterBlueprints) ? nd.chapterBlueprints : [];
	if (!cap || cap < 1) cap = Math.max(list.length, 1);
	var stubLimit = NW_BEAT_STUB_CHARS;
	var perChapter = [];
	var failures = [];
	var namedChars = (nd.characters || []).map(function (c) {
		return String((c && c.name) || '').trim().toLowerCase();
	}).filter(function (n) { return n.length >= 2; });
	var hasSubplots = (nd.subplots || []).length >= 1;

	for (var i = 0; i < cap; i++) {
		var ch = i + 1;
		var raw = list[i];
		if (raw == null) {
			raw = list.find(function (b) {
				return b && (b.chapter === ch || b.chapter === String(ch));
			});
		}
		var pack = normalizeChapterBeatPack(raw, ch);
		var row = { chapter: ch, ok: true, missing: [], stub: [], castNamed: false };
		if (!pack) {
			row.ok = false;
			row.missing = NW_BEAT_REQUIRED.slice();
			failures.push('beat_missing_blueprint:ch' + ch);
			perChapter.push(row);
			continue;
		}
		NW_BEAT_REQUIRED.forEach(function (k) {
			var t = nwBeatFieldText(pack[k]);
			if (!t) {
				row.missing.push(k);
				failures.push('beat_missing:' + k + ':ch' + ch);
			} else if (t.length < stubLimit) {
				row.stub.push(k);
				failures.push('beat_stub:' + k + ':ch' + ch + ':chars=' + t.length + '<' + stubLimit);
			}
		});
		var castText = String(pack.castArcBeat || '').toLowerCase();
		row.castNamed = !namedChars.length || namedChars.some(function (n) {
			var parts = n.replace(/^dr\.\s+/, '').split(/\s+/).filter(function (p) { return p.length >= 4; });
			return castText.indexOf(n) >= 0 || parts.some(function (p) { return castText.indexOf(p) >= 0; });
		});
		if (namedChars.length && !row.castNamed) {
			failures.push('beat_cast_unnamed:ch' + ch);
			row.ok = false;
		}
		if (hasSubplots && !nwBeatFieldText(pack.subplotPressure)) {
			// already covered by missing; keep explicit
		}
		if (row.missing.length || row.stub.length) row.ok = false;
		row.pack = {
			sceneGoal: pack.sceneGoal,
			castArcBeat: pack.castArcBeat,
			subplotPressure: pack.subplotPressure,
			dialogueTurn: pack.dialogueTurn,
			sensoryWorldHook: pack.sensoryWorldHook,
			turnOrPayoff: pack.turnOrPayoff
		};
		perChapter.push(row);
	}
	return {
		passed: failures.length === 0,
		failures: failures,
		perChapter: perChapter,
		required: NW_BEAT_REQUIRED.slice(),
		chapterCap: cap,
		stubCharLimit: stubLimit
	};
}

function assertBeatCoverageOrThrow(nd, opts) {
	var r = scoreBeatCoverage(nd, opts);
	if (!r.passed) {
		var msg = 'BEAT COVERAGE FAIL-CLOSED: ' + (r.failures || []).slice(0, 10).join(' | ') +
			'. Run enrichChapterBlueprints until all six beats are non-stub for every chapter in cap.';
		if (typeof console !== 'undefined') console.error(msg);
		if (typeof alert === 'function') alert(msg);
		throw new Error(msg);
	}
	return r;
}
// === BEAT_COVERAGE_END ===

