# Changelog

All notable changes to AI Book Tools will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Post-release follow-up items only.

### Security

- HerbalBookForge redaction fix7.5 (PR #185 T1/T2). T1: the userinfo patterns (V1_USERINFO, V2_USERINFO, SRC306,
  schema/story-core-2.0.json :261/:274/:306 and the smoke harness copies) keep at most one line-break run between fixed
  characters, and STANDALONE_PARAM_SOURCE checks the next character before its line-break lookbehind. Both match the
  same strings as before and now run in linear time on long line-break runs. redactAll on 32768 newlines drops from
  about 6.8 s to about 15 ms. T2: the free-text JSON pair pass decodes the key before isSecretField, and a key that does
  not decode is treated as secret. tests/sec: 2555/2555 on Node 20 and 22. Smoke: 1798 PASS / 0 FAIL, pin 25243682 unchanged.
- HerbalBookForge fix7.5-D: URL param names (paramNameIsSecret) and Cookie names (cookieIsSecret) are decoded until
  stable, with the same 4-pass cap as the standalone param rule. A malformed name, or one still changing after 4 decodes,
  is treated as secret. FLIP/F1 (`?%2574oken=x`) now removes the whole URL; re-pinned with gen-flip-f1.mjs.
- HerbalBookForge fix7.5-D3: the F1 flip generator is committed as `tools/hbf/gen-flip-f1.mjs` (asserts the spec
  output on all 3 strip paths before writing), and `rows.hbf.test.mjs` pins `hbf-rows-flip.json` at sha256 `241bdd49`.
- HerbalBookForge credential redaction NEL fix (fix7.4): HBF `HerbalBookForge.html` sha256 `d824f617`, schema `6abefa05`,
  smoke `3d79b90f` base; `tests/sec/hbf` rows and NEL tests; frozen `fixtures/ref-v23-rows.json` (`1ee8e5fe`) sha-pinned.
  Gates: fix7.4 SUMS `8238ee8a` (Engineering `ba692fa3`, Reviewer `ecb5c93b`).
- Smoke ReDoS2: the userinfo seeded-fuzz check now compares each pattern's diff set with the pinned TIGHTEN set
  (`scripts/redos2-pinned-tighten-set-8238ee8a.json`, sha256 `25243682`) exactly, both ways; any LOOSEN is red.

### Notes

- Timing (Engineering): `ps` elapsed time and wall-clock durations include time the box was paused or suspended.
  Read run durations from `/proc/uptime` (monotonic) deltas, not wall clock or `ps` etime. Timing run of record on fix7.4:
  SUMS `ef1bfb8a`; Node 20.19.2 86m05s wall / 2326.5 s uptime, Node 22.23.3 70m52s wall / 1708.5 s uptime
  (sequential legs; the gap is box pause/suspend, not test time). Earlier concurrent-leg wall times are load, not a baseline.

## [1.2.0] - 2026-04-19

### Added

- Administrative closeout alignment for release/checklist documentation and version metadata consistency checks.

### Changed

- Finalized NovelWriter stabilization release as `v0.3.4`.
- Aligned HerbalBookForge release references to `v0.9.5`.
- Bumped GitHub Actions workflow dependencies to `actions/checkout@v6` and `actions/setup-node@v6`.
- Updated release closeout documentation to reflect current GitHub issue/PR state.

### Fixed

- Fixed invalid HTML body structure and duplicate loading indicator IDs in NovelWriter.
- Added missing improvement status handler and corrected tab navigation label/state behavior for request log and consolidated breakdowns.
- Added schema-aligned session export metadata (`schemaVersion`, `sourceTool`, `sourceVersion`, `exportedAt`) in NovelWriter exports.
- Added hybrid import handling in NovelWriter: strict shared-schema support plus legacy NovelWriter migration path with warnings.
- Added Tab 11 Agent Prompts manager with editable per-tab/per-agent system prompts and dedicated prompt profile import/export.
- Added character and subplot counter synchronization for add-actions, AI generation, import, and data collection.
- Updated regression workflow to include advanced non-default complexity testing, fetched-author usage, refinement flow, mixed improvement statuses, and end-of-run session roundtrip coverage.

## [1.1.0] - 2026-04-17

### Initial Release

- Shared schema sample artifacts for BookDecomposer multi-agent validation
- Multi-agent regression coverage for BookEditor and BookDecomposer

### Changed

- Released BookEditor v0.4.0 with shared-schema export metadata and automatic endpoint routing for standard and multi-agent models
- Released BookDecomposer v0.2.0 with model selection, shared-schema export metadata, and automatic endpoint routing for standard and multi-agent models
- Updated launcher and READMEs to reflect current tool versions and shared schema support

## [1.0.0] - 2026-04-17

### Added

- Initial release of AI Book Tools
- NovelWriter v0.3.3 - Comprehensive novel creation tool
- BookEditor v0.2.0 - Book editing and improvement tool
- BookDecomposer v0.1.0 - Book analysis and decomposition tool
- HerbalBookForge v0.9.3 - Specialized herbal book creation tool
- Main launcher page (index.html)
- MIT License
- Security-conscious .gitignore configuration

### Features

- AI-powered writing assistance using xAI API
- Browser-based interface (no installation required)
- Export/import functionality for projects
- Comprehensive user guides and documentation
- Responsive design for various screen sizes

---

## Version History by Tool

### NovelWriter

- **v0.3.4** - Latest stable release with schema-aligned export/import hardening and workflow fixes
- **v0.3.3** - Prior stable release
- **v0.3.0** - Added chapter editing capabilities
- **v0.2.0** - Added subplot management
- **v0.1.0** - Initial character development features

### BookEditor

- **v0.4.0** - Latest stable release with shared-schema metadata and multi-agent endpoint routing
- **v0.3.0** - Added schema interoperability groundwork and chapter editing refinements
- **v0.2.0** - Expanded editing workflow
- **v0.1.0** - Initial editing features

### BookDecomposer

- **v0.2.0** - Latest stable release with model selection, shared schema export, and multi-agent endpoint routing
- **v0.1.0** - Initial analysis features

### HerbalBookForge

- **v0.9.5** - Latest stable release
- **v0.9.3** - Prior stable release
- **v0.9.0** - Added safety guidelines
- **v0.8.0** - Enhanced herbal expertise prompts

---

## Contributing to Future Releases

To propose changes for future releases:

1. Create an issue describing the proposed change
2. Discuss with maintainers
3. Implement changes in a feature branch
4. Submit a pull request with detailed description

## Release Process

1. **Planning**: Features and fixes planned for next release
2. **Development**: Implementation and testing
3. **Beta Testing**: Limited release for feedback
4. **Release**: Version bump and changelog update
5. **Announcement**: GitHub release with highlights

---

*For older changes not documented here, please check the git commit history.*
