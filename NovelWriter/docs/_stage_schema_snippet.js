// === STAGE_SCHEMA_BEGIN ===
		// Stage-aware novel JSON schemas: optional early → obligatory later.
		// Canonical novelData keys; LLM aliases normalized both directions.
		const NW_STAGE_SCHEMA_VERSION = 1;
		const NW_FIELD_ALIASES = {
			characters: ['characters', 'cast', 'characterList', 'CharacterList', 'chars'],
			subplots: ['subplots', 'subplotList', 'threads', 'Subplots'],
			name: ['name', 'Name', 'characterName', 'charName'],
			backstory: ['backstory', 'Backstory', 'backStory', 'bio', 'history'],
			arc: ['arc', 'Arc', 'characterArc', 'charArc', 'arcSummary'],
			obligations: ['obligations', 'beats', 'dramatizableObligations', 'mustDramatize'],
			novelOutline: ['novelOutline', 'outline', 'novel_outline'],
			plotOutline: ['plotOutline', 'plot', 'generalPlotOutline'],
			storyArcOutline: ['storyArcOutline', 'storyArc', 'arcOutline'],
			chapterOutlines: ['chapterOutlines', 'outlines', 'chapter_outlines'],
			chapterArcs: ['chapterArcs', 'arcs', 'chapter_arcs'],
			chapterBlueprints: ['chapterBlueprints', 'blueprints', 'chapter_blueprints'],
			chapters: ['chapters', 'chapterTexts', 'prose'],
			chapter: ['chapter', 'text', 'content', 'prose', 'body', 'chapterText'],
			setting: ['setting', 'Setting', 'worldSetting'],
			worldBible: ['worldBible', 'world', 'world_bible', 'bible'],
			storyArc: ['storyArc', 'story_arc', 'arc'],
			generalPlot: ['generalPlot', 'plot', 'general_plot'],
			title: ['title', 'Title', 'bookTitle'],
			genre: ['genre', 'Genre'],
			authors: ['authors', 'authorList', 'AuthorList'],
			improvements: ['improvements', 'suggestions', 'bookImprovements']
		};

		/** Stage progression: early = soft/optional; later = fail-closed required. */
		function defaultStageSchemas() {
			const floors = (typeof NW_DENSITY !== 'undefined') ? NW_DENSITY : { castBackstoryMinWords: 80, castArcMinWords: 60, subplotMinWords: 120, stubCharLimit: 40, outlinePlotMinChars: 120 };
			return {
				'tab1.storyInfo': {
					id: 'tab1.storyInfo', tab: 'tab1', phase: 'invent',
					required: ['genre'],
					optional: ['title', 'storyArc', 'generalPlot', 'setting', 'numChapters', 'chapterLength', 'authorStyle', 'styleGuide', 'authors', 'author'],
					llmResponse: { oneOf: ['storyArc', 'generalPlot', 'setting', 'title'] },
					strict: false
				},
				'tab1.fetchAuthors': {
					id: 'tab1.fetchAuthors', tab: 'tab1', phase: 'invent',
					required: [],
					optional: ['authors'],
					llmResponse: { shape: 'authors[]' },
					strict: false
				},
				'tab2.suggestCharacters': {
					id: 'tab2.suggestCharacters', tab: 'tab2', phase: 'invent',
					required: ['characters'],
					itemRequired: { characters: ['name'] },
					itemOptional: { characters: ['backstory', 'arc', 'obligations'] },
					llmResponse: { shape: 'characters[]', fields: ['name', 'backstory', 'arc'] },
					strict: false,
					notes: 'Thin cast OK at invent; enrich densifies before Tab5.'
				},
				'tab2.refineCharacters': {
					id: 'tab2.refineCharacters', tab: 'tab2', phase: 'refine',
					required: ['characters'],
					itemRequired: { characters: ['name', 'backstory', 'arc'] },
					itemOptional: { characters: ['obligations'] },
					itemMinWords: { characters: { backstory: Math.floor((floors.castBackstoryMinWords || 80) * 0.5), arc: Math.floor((floors.castArcMinWords || 60) * 0.5) } },
					llmResponse: { shape: 'characters[]', fields: ['name', 'backstory', 'arc', 'obligations'] },
					strict: false
				},
				'tab2.enrichCharacters': {
					id: 'tab2.enrichCharacters', tab: 'tab2', phase: 'enrich',
					required: ['characters'],
					itemRequired: { characters: ['name', 'backstory', 'arc'] },
					itemOptional: { characters: ['obligations'] },
					itemMinWords: { characters: { backstory: floors.castBackstoryMinWords || 80, arc: floors.castArcMinWords || 60 } },
					llmResponse: { shape: 'characters[]', fields: ['name', 'backstory', 'arc', 'obligations'] },
					strict: true,
					failClosed: true
				},
				'tab3.suggestSubplots': {
					id: 'tab3.suggestSubplots', tab: 'tab3', phase: 'invent',
					required: ['subplots'],
					llmResponse: { shape: 'subplots[]' },
					strict: false,
					notes: 'Short stubs tolerated at invent; enrich before Tab5.'
				},
				'tab3.enrichSubplots': {
					id: 'tab3.enrichSubplots', tab: 'tab3', phase: 'enrich',
					required: ['subplots'],
					itemMinWords: { subplots: floors.subplotMinWords || 120 },
					llmResponse: { shape: 'subplots[]' },
					strict: true,
					failClosed: true
				},
				'tab4.generateNovelOutlines': {
					id: 'tab4.generateNovelOutlines', tab: 'tab4', phase: 'outline',
					required: ['novelOutline'],
					optional: ['plotOutline', 'storyArcOutline', 'chapterBlueprints'],
					llmResponse: { shape: 'outlines', fields: ['novelOutline', 'plotOutline', 'storyArcOutline', 'chapterBlueprints'] },
					strict: true
				},
				'tab4.generateChapterOutline': {
					id: 'tab4.generateChapterOutline', tab: 'tab4', phase: 'outline',
					required: ['chapterOutlines'],
					optional: ['chapterArcs', 'chapterBlueprints'],
					llmResponse: { shape: 'chapterOutline' },
					strict: true
				},
				'tab5.readiness': {
					id: 'tab5.readiness', tab: 'tab5', phase: 'gate',
					required: ['characters', 'subplots', 'novelOutline'],
					itemRequired: { characters: ['name', 'backstory', 'arc'] },
					itemMinWords: {
						characters: { backstory: floors.castBackstoryMinWords || 80, arc: floors.castArcMinWords || 60 },
						subplots: floors.subplotMinWords || 120
					},
					strict: true,
					failClosed: true,
					notes: 'Delegates density floors + outline obligations.'
				},
				'tab5.generateChapter': {
					id: 'tab5.generateChapter', tab: 'tab5', phase: 'draft',
					required: ['chapter'],
					optional: ['obligationCoverage'],
					llmResponse: { shape: 'chapterProse', fields: ['chapter'] },
					strict: true,
					failClosed: true
				},
				'tab5.continuityAudit': {
					id: 'tab5.continuityAudit', tab: 'tab5', phase: 'audit',
					required: [],
					llmResponse: { shape: 'continuityFindings' },
					strict: true
				},
				'tab6.checkSpellingAndGrammar': {
					id: 'tab6.checkSpellingAndGrammar', tab: 'tab6', phase: 'edit',
					required: ['chapter'],
					llmResponse: { shape: 'chapterProse' },
					strict: false
				},
				'tab7.suggestBookImprovements': {
					id: 'tab7.suggestBookImprovements', tab: 'tab7', phase: 'improve',
					required: [],
					optional: ['improvements'],
					llmResponse: { shape: 'improvements[]' },
					strict: false
				}
			};
		}

		let stageSchemaCatalog = defaultStageSchemas();

		function getStageSchema(stageId) {
			return stageSchemaCatalog[stageId] || null;
		}

		function skillIdToStageId(skillId) {
			if (!skillId) return null;
			if (ensureStageSchemas()[skillId]) return skillId;
			const map = {
				'tab1.suggestStoryArc': 'tab1.storyInfo',
				'tab1.suggestGeneralPlot': 'tab1.storyInfo',
				'tab1.suggestSetting': 'tab1.storyInfo',
				'tab1.suggestStoryInfo': 'tab1.storyInfo',
				'tab1.fetchStyleGuide': 'tab1.storyInfo',
				'tab2.scrapeBookInfoForCharacters': 'tab2.suggestCharacters',
				'tab4.updateChapterOutline': 'tab4.generateChapterOutline',
				'tab4.incorporateOutlineSuggestions': 'tab4.generateNovelOutlines',
				'tab5.reviseChapterForQuality': 'tab5.generateChapter',
				'tab6.updateChapter': 'tab6.checkSpellingAndGrammar'
			};
			return map[skillId] || skillId;
		}

		function pickAliased(obj, canonical) {
			if (!obj || typeof obj !== 'object') return undefined;
			const keys = NW_FIELD_ALIASES[canonical] || [canonical];
			for (let i = 0; i < keys.length; i++) {
				if (Object.prototype.hasOwnProperty.call(obj, keys[i]) && obj[keys[i]] != null) {
					return obj[keys[i]];
				}
			}
			return undefined;
		}

		function normalizeCharacterItem(raw) {
			if (raw == null) return null;
			if (typeof raw === 'string') {
				const name = raw.trim();
				return name ? { name: name, backstory: '', arc: '', obligations: [] } : null;
			}
			if (typeof raw !== 'object') return null;
			const name = String(pickAliased(raw, 'name') || raw.name || '').trim();
			const backstory = String(pickAliased(raw, 'backstory') || '').trim();
			const arc = String(pickAliased(raw, 'arc') || '').trim();
			let obligations = pickAliased(raw, 'obligations');
			if (typeof obligations === 'string' && obligations.trim()) obligations = [obligations.trim()];
			if (!Array.isArray(obligations)) obligations = [];
			if (!name && !backstory && !arc) return null;
			return { name: name, backstory: backstory, arc: arc, obligations: obligations };
		}

		function normalizeSubplotItem(raw) {
			if (raw == null) return '';
			if (typeof raw === 'string') return raw.trim();
			if (typeof raw === 'object') {
				const t = raw.text || raw.subplot || raw.throughline || raw.summary || raw.description;
				if (t) return String(t).trim();
				try { return JSON.stringify(raw); } catch (_) { return String(raw); }
			}
			return String(raw).trim();
		}

		function unwrapLlmEnvelope(raw) {
			if (raw == null) return raw;
			if (typeof raw === 'string') {
				let s = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
				if (/^[\{\[]/.test(s)) {
					try { return JSON.parse(s); } catch (_) {
						const blob = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
						if (blob) {
							try { return JSON.parse(blob[0]); } catch (_2) { return { chapter: raw, _jsonParseError: true }; }
						}
					}
				}
				return { chapter: raw };
			}
			if (typeof raw !== 'object') return raw;
			// Drop parse-error chapter wrappers when a better payload exists deeper
			if (raw._jsonParseError && raw.chapter && typeof raw.chapter === 'string') {
				const inner = unwrapLlmEnvelope(raw.chapter);
				if (inner && typeof inner === 'object' && !inner._jsonParseError) return inner;
			}
			return raw;
		}

		/**
		 * Inbound: LLM / UI blob → canonical novelData-shaped object for a stage.
		 */
		function normalizeInbound(stageId, raw, ctx) {
			ctx = ctx || {};
			const stage = getStageSchema(skillIdToStageId(stageId) || stageId) || {};
			const unwrapped = unwrapLlmEnvelope(raw);
			const out = { _stage: stage.id || stageId, _schemaVersion: NW_STAGE_SCHEMA_VERSION };
			const src = (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)) ? unwrapped : {};

			// Array root → shape guess
			if (Array.isArray(unwrapped)) {
				const shape = (stage.llmResponse && stage.llmResponse.shape) || '';
				if (shape.indexOf('subplot') >= 0) {
					out.subplots = unwrapped.map(normalizeSubplotItem).filter(Boolean);
					return out;
				}
				if (shape.indexOf('author') >= 0) {
					out.authors = unwrapped.map(String);
					return out;
				}
				if (shape.indexOf('improvement') >= 0) {
					out.improvements = unwrapped;
					return out;
				}
				out.characters = unwrapped.map(normalizeCharacterItem).filter(Boolean);
				return out;
			}

			const chars = pickAliased(src, 'characters');
			if (Array.isArray(chars)) out.characters = chars.map(normalizeCharacterItem).filter(Boolean);
			const subs = pickAliased(src, 'subplots');
			if (Array.isArray(subs)) out.subplots = subs.map(normalizeSubplotItem);
			const authors = pickAliased(src, 'authors');
			if (Array.isArray(authors)) out.authors = authors.map(String);
			const improvements = pickAliased(src, 'improvements');
			if (Array.isArray(improvements)) out.improvements = improvements;

			['title', 'genre', 'storyArc', 'generalPlot', 'setting', 'novelOutline', 'plotOutline', 'storyArcOutline'].forEach(function (k) {
				const v = pickAliased(src, k);
				if (v != null && String(v).trim()) out[k] = typeof v === 'string' ? v.trim() : v;
			});
			const world = pickAliased(src, 'worldBible');
			if (world != null) out.worldBible = world;
			const chOut = pickAliased(src, 'chapterOutlines');
			if (Array.isArray(chOut)) out.chapterOutlines = chOut;
			const chArc = pickAliased(src, 'chapterArcs');
			if (Array.isArray(chArc)) out.chapterArcs = chArc;
			const bp = pickAliased(src, 'chapterBlueprints');
			if (Array.isArray(bp)) out.chapterBlueprints = bp;
			const chapter = pickAliased(src, 'chapter');
			if (chapter != null) out.chapter = typeof chapter === 'string' ? chapter : String(chapter);
			// continuity / quality passthrough
			if (src.findings || src.continuityFindings) out.continuityFindings = src.findings || src.continuityFindings;
			if (src.scores || src.qualityScores) out.qualityScores = src.scores || src.qualityScores;
			if (src.obligationCoverage) out.obligationCoverage = src.obligationCoverage;
			// Keep unknown keys for debug (non-canonical)
			out._rawTopKeys = Object.keys(src);
			return out;
		}

		/**
		 * Outbound: novelData → stable LLM-facing payload + schema instruction lines.
		 */
		function normalizeOutbound(stageId, novelDataIn, ctx) {
			ctx = ctx || {};
			const nd = novelDataIn || (typeof novelData !== 'undefined' ? novelData : {}) || {};
			const stage = getStageSchema(skillIdToStageId(stageId) || stageId) || {};
			const floors = (typeof densityFloorsForBook === 'function') ? densityFloorsForBook(nd) : { backstory: 80, arc: 60, subplot: 120 };
			const payload = {
				schemaVersion: NW_STAGE_SCHEMA_VERSION,
				stage: stage.id || stageId,
				phase: stage.phase || 'unknown',
				required: stage.required || [],
				optional: stage.optional || [],
				itemRequired: stage.itemRequired || {},
				itemMinWords: stage.itemMinWords || {},
				floors: floors
			};
			if ((stage.required || []).indexOf('characters') >= 0 || (stage.optional || []).indexOf('characters') >= 0 || (stage.llmResponse && String(stage.llmResponse.shape || '').indexOf('characters') >= 0)) {
				payload.characters = (nd.characters || []).map(normalizeCharacterItem).filter(Boolean);
			}
			if ((stage.required || []).indexOf('subplots') >= 0 || (stage.llmResponse && String(stage.llmResponse.shape || '').indexOf('subplot') >= 0)) {
				payload.subplots = (nd.subplots || []).map(normalizeSubplotItem);
			}
			['title', 'genre', 'storyArc', 'generalPlot', 'setting', 'novelOutline', 'plotOutline', 'storyArcOutline', 'authorStyle', 'styleGuide'].forEach(function (k) {
				if (nd[k] != null && String(nd[k]).trim()) payload[k] = nd[k];
			});
			if (nd.worldBible || nd.world) payload.worldBible = nd.worldBible || nd.world;
			if (nd.chapterBlueprints) payload.chapterBlueprints = nd.chapterBlueprints;
			if (nd.chapterOutlines) payload.chapterOutlines = nd.chapterOutlines;
			return payload;
		}

		function schemaPromptLines(stageId) {
			const stage = getStageSchema(skillIdToStageId(stageId) || stageId);
			if (!stage) return [];
			const lr = stage.llmResponse || {};
			const lines = [
				'--- Stage schema (' + (stage.id || stageId) + ', phase=' + (stage.phase || '?') + ') ---',
				'Canonical keys only in JSON. Aliases (cast→characters, backStory→backstory) are accepted but prefer canonical.',
				'Required top-level: ' + JSON.stringify(stage.required || []),
				'Optional top-level: ' + JSON.stringify(stage.optional || [])
			];
			if (stage.itemRequired) lines.push('Required per-item fields: ' + JSON.stringify(stage.itemRequired));
			if (stage.itemMinWords) lines.push('Minimum word floors: ' + JSON.stringify(stage.itemMinWords));
			if (lr.shape === 'characters[]') {
				lines.push('Return JSON only: {"characters":[{"name":"...","backstory":"...","arc":"...","obligations":["..."]}, ...]}');
			} else if (lr.shape === 'subplots[]') {
				lines.push('Return JSON only: {"subplots":["<enriched throughline>", ...]}');
			} else if (lr.shape === 'chapterProse') {
				lines.push('Return JSON only: {"chapter":"<prose>"} OR plain chapter prose.');
			} else if (lr.shape === 'authors[]') {
				lines.push('Return JSON only: {"authors":["Name", ...]}');
			} else if (lr.shape === 'outlines') {
				lines.push('Return JSON only: {"novelOutline":"...","plotOutline":"...","storyArcOutline":"...","chapterBlueprints":[...]}');
			} else if (lr.fields) {
				lines.push('Return JSON only including fields: ' + JSON.stringify(lr.fields));
			}
			if (stage.failClosed) lines.push('FAIL-CLOSED: missing required fields or below word floors abort the pipeline.');
			return lines;
		}

		function validateAgainstStageSchema(stageId, data, ctx) {
			ctx = ctx || {};
			const stage = getStageSchema(skillIdToStageId(stageId) || stageId);
			const failures = [];
			if (!stage) return { ok: true, failures: [], stageId: stageId, skipped: true };
			const nd = ctx.novelData || {};
			const floors = (typeof densityFloorsForBook === 'function') ? densityFloorsForBook(nd) : { backstory: 80, arc: 60, subplot: 120 };
			const wordCount = (typeof nwWordCount === 'function') ? nwWordCount : function (s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; };

			(stage.required || []).forEach(function (k) {
				const v = data && data[k];
				const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
				if (empty) failures.push('required_missing:' + k);
			});

			if (data && Array.isArray(data.characters) && stage.itemRequired && stage.itemRequired.characters) {
				const need = stage.itemRequired.characters;
				const mins = (stage.itemMinWords && stage.itemMinWords.characters) || {};
				data.characters.forEach(function (c, i) {
					const label = (c && c.name) || ('#' + i);
					need.forEach(function (f) {
						if (!c || !String(c[f] || '').trim()) failures.push('item_missing:' + label + '.' + f);
					});
					if (mins.backstory != null && wordCount(c && c.backstory) < mins.backstory) {
						failures.push('item_thin:' + label + '.backstory words<' + mins.backstory);
					}
					if (mins.arc != null && wordCount(c && c.arc) < mins.arc) {
						failures.push('item_thin:' + label + '.arc words<' + mins.arc);
					}
				});
			}
			if (data && Array.isArray(data.subplots) && stage.itemMinWords && stage.itemMinWords.subplots != null) {
				const minS = stage.itemMinWords.subplots;
				data.subplots.forEach(function (s, i) {
					const text = normalizeSubplotItem(s);
					if (wordCount(text) < minS) failures.push('item_thin:subplot#' + i + ' words<' + minS);
				});
			}
			if (data && stage.llmResponse && stage.llmResponse.shape === 'chapterProse') {
				const ch = data.chapter || '';
				if (!String(ch).trim()) failures.push('required_missing:chapter');
			}
			return {
				ok: failures.length === 0,
				failures: failures,
				stageId: stage.id || stageId,
				strict: !!stage.strict,
				failClosed: !!stage.failClosed,
				floors: floors
			};
		}

		function exportStageSchemas() {
			return { schemaVersion: NW_STAGE_SCHEMA_VERSION, stages: ensureStageSchemas(), aliases: NW_FIELD_ALIASES };
		}

		function importStageSchemas(blob) {
			if (!blob || typeof blob !== 'object') return false;
			if (blob.stages && typeof blob.stages === 'object') {
				stageSchemaCatalog = Object.assign({}, defaultStageSchemas(), blob.stages);
				return true;
			}
			return false;
		}
		// === STAGE_SCHEMA_END ===

