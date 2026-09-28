


## Agent Skills (I/O around prompts)

Skills sit between Tab11 system prompts and callAI:

1. `packSkillInputs(skillId, ctx)` binds digests / floors / blueprints / evidence into user content.
2. `getSkillSystemPrompt(skillId)` = system prompt + skill ability.
3. `validateSkillOutput(skillId, response)` runs declared validators (density, obligations, …).

Full catalog covers Pass0 invent → enrich → outlines → draft → continuity → QE/edit → improvements.
Fail-closed gates (density / Tab5 readiness / obligation coverage) remain authoritative over soft skill validation warnings.
