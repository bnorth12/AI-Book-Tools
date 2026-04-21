# UI Unification Threat Model and Cyber Threat Analysis

Date: 2026-04-19
Branch: feature/ui-unification-foundation
Related execution plan: docs/architecture/ui-unification/UI_UNIFICATION_EXECUTION_TEST_PLAN.md

## Scope

This analysis covers the UI-only release slice for NovelWriter, BookEditor, and BookDecomposer:

- Shared token CSS adoption and shell HTML structure updates.
- External font loading from Google Fonts.
- Addition of data-testid selectors for test stability.

Out of scope:

- Backend services/endpoints.
- Authentication or authorization model changes.
- New persistent storage keys or server-side data flows.

## Scoring Method

- Attack Surface (AS): 0-5 where 0 is not exposed and 5 is broad externally reachable surface.
- Likelihood (L): 1-5 probability under current architecture/deployment assumptions.
- Impact (I): 1-5 severity if exploited.
- Inherent Risk: L x I before mitigation.
- Residual Risk: Residual L x Residual I after mitigation.

## Trust Boundaries and Data Flows (Per-Flow STRIDE + CIA)

All data flows are evaluated individually for CIA and each STRIDE category.

- CIA values: Low, Medium, High.
- STRIDE values: None, Low, Medium, High.
- Flow risk score: L x I (1-5 scale for each).

| Flow ID | Boundary Category | Data Flow | Information Type | C | I | A | S | T | R | ID | D | E | L | I | Inherent | Key Mitigation | Residual L | Residual I | Residual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DF-01 | External Dependency Boundary | Browser <-> Google Fonts CDN (`fonts.googleapis.com`, `fonts.gstatic.com`) | Public static assets (CSS/fonts) | Low | Medium | Medium | Low | Medium | None | Low | Medium | None | 2 | 3 | 6 | CSP allowlists; optional self-hosted fonts; dependency trust notes | 1 | 2 | 2 |
| DF-02 | Internal Static Asset Boundary | Browser <-> same-origin static assets (`shared/ui-unification-tokens.css`, app HTML) | Public application assets | Low | High | Medium | None | Medium | None | Low | Medium | Low | 2 | 3 | 6 | Static asset integrity checks in release flow; controlled deploy path | 1 | 2 | 2 |
| DF-03 | Client Runtime Boundary | DOM/Test selector exposure (`data-testid`) <-> rendered runtime | Internal element metadata | Low | Medium | Low | None | Low | None | Medium | Low | None | 2 | 2 | 4 | Naming hygiene policy; no sensitive data in selector attributes | 1 | 2 | 2 |
| DF-04 | Sensitive Input Boundary | API key entry field -> in-memory JS state -> outbound auth header | API credential (transient) | High | High | Medium | Low | Medium | Low | High | Low | Low | 3 | 4 | 12 | Non-persistence guardrails; release-gate checks for storage/export leakage | 2 | 3 | 6 |
| DF-05 | Export/Artifact Boundary | App runtime -> session/book exports and release evidence artifacts | Mixed: user content, logs, report artifacts | Medium | High | Medium | Low | Medium | Medium | Medium | Low | Low | 2 | 3 | 6 | Artifact handling policy; provenance checks; report/evidence path controls | 1 | 2 | 2 |
| DF-06 | LLM API Egress Boundary | App runtime -> xAI API request payload (prompt/context/model metadata) | Mixed: user-authored content, generation context, request metadata, credential header | High | High | Medium | Medium | High | Low | High | Medium | Low | 3 | 4 | 12 | HTTPS enforcement, strict endpoint allowlist, request minimization/redaction, no secret logging, outbound schema guardrails | 2 | 3 | 6 |
| DF-07 | LLM API Ingress Boundary | xAI API response payload -> app parser/runtime update path | Untrusted generated content and structured JSON payloads | Medium | High | Medium | Medium | High | Medium | Medium | Medium | Medium | 3 | 4 | 12 | Strict response validation/parsing, output encoding/sanitization, JSON schema checks before state mutation, defensive error handling | 2 | 3 | 6 |

Legend:

- `S`: Spoofing
- `T`: Tampering
- `R`: Repudiation
- `ID`: Information Disclosure
- `D`: Denial of Service
- `E`: Elevation of Privilege

### Per-Flow Notes

#### DF-01 (External font dependency)

- Highest STRIDE exposure is Tampering/DoS due to third-party availability and content integrity dependency.
- Residual risk assumes fallback fonts and deployment hardening controls are applied where required.

#### DF-02 (Same-origin static assets)

- Integrity dominates due to direct impact on rendered UI behavior.
- Risk remains moderate without deployment hygiene, low with controlled release/deploy process.

#### DF-03 (`data-testid` metadata exposure)

- Primary concern is Information Disclosure of internal structure, but not secrets.
- Keep selectors free of credential/content-bearing values.

#### DF-04 (API key transient flow)

- Highest CIA and STRIDE sensitivity in this release slice.
- Elevated risk remains until explicit release-gate checks verify no storage/export persistence.

#### DF-05 (Export and release artifact flow)

- Integrity and repudiation risk matter for provenance and audit trail quality.
- Policy-driven controls reduce residual risk when consistently enforced.

#### DF-06 (Outbound app-to-LLM request flow)

- Explicitly captures information disclosure risk for prompt/context data leaving the browser.
- Also captures spoofing/tampering concerns on destination trust and in-transit integrity assumptions.
- Mitigations focus on transport trust, endpoint restriction, and request data minimization.

#### DF-07 (Inbound LLM-to-app response flow)

- Explicitly captures untrusted content risks, including malformed/hostile payload patterns.
- STRIDE emphasis includes tampering-like payload abuse, repudiation/audit traceability, and potential elevation via unsafe render/parse paths.
- Mitigations focus on strict validation, sanitization, and controlled state mutation.

## Cyber Threat Analysis Notes

Threat paths considered for this release slice:

1. Third-party style asset manipulation path:
   - Entry: external stylesheet/font delivery.
   - Effect: UI tampering, degraded trust/readability, potential CSS-based abuse in broader hosting contexts.
   - Countermeasures: CSP, dependency hardening, optional self-hosted fonts.
2. Availability degradation path:
   - Entry: CDN outage/latency.
   - Effect: delayed or degraded rendering.
   - Countermeasures: fallback font stacks, optional self-hosting in production.
3. Metadata exposure path:
   - Entry: published `data-testid` selectors.
   - Effect: minor internal structure disclosure.
   - Countermeasures: naming hygiene and no sensitive values in selector strings.
4. Client credential handling path:
   - Entry: API key entered in browser input.
   - Effect: accidental persistence/exposure risk if implementation regresses.
   - Countermeasures: enforce non-persistence rule and release-gate validation.
5. Outbound prompt/context disclosure path:
   - Entry: app runtime sends chapter/story context to LLM API.
   - Effect: unintended disclosure of sensitive user content or metadata if overly broad payloads are sent/logged.
   - Countermeasures: payload minimization/redaction, endpoint allowlisting, and no secret-bearing request logs.
6. Inbound response manipulation path:
   - Entry: LLM response payload enters parser/runtime mutation path.
   - Effect: malformed or adversarial content could cause unsafe parsing, bad state updates, or downstream rendering risks.
   - Countermeasures: strict JSON/schema validation, sanitization, and guarded write paths.

## Residual Risk

- Overall residual risk: Low.
- Highest residual items by data flow: DF-04, DF-06, and DF-07 (Residual Risk 6 each)
   until release-gate checks and response-validation controls are fully operationalized.
- No critical or high residual risks remain for current local-use release assumptions.

## Suggested Mitigation Implementation Scope

1. Add hosted-environment hardening guidance:
   - CSP allowlists for style/font origins.
   - external dependency trust assumptions.
2. Evaluate optional self-hosted font package for shared-hosting/production profiles.
3. Add release-gate checks for:
   - API keys never persisted in localStorage/sessionStorage/export payloads.
   - no sensitive strings embedded in `data-testid` attributes.
4. Record mitigation status and evidence in release closeout artifacts.

## Traceability

- Execution and risk gate: docs/architecture/ui-unification/UI_UNIFICATION_EXECUTION_TEST_PLAN.md
- Release SSDLC checklist: docs/governance/FEATURE_RELEASE_SSDL_CHECKLIST.md
- Work planning and mitigation backlog: docs/roadmap/NEXT_MINOR_RELEASE_UI_UNIFICATION_TODO.md
