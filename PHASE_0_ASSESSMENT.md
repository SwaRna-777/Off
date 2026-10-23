# Career Intelligence Studio — Phase 0 Assessment

Assessment date: 2026-10-23. Workspace: `Resume_Bulider/`.

## Assessment boundary and verdict

The existing application is a useful, buildable local resume-editor prototype with
working import, structured generation, document editing, matching diagnostics and
export paths. It should be extended incrementally, not rebuilt.

It is not yet an evidence-aware career-management system. The principal blockers
are preservation of career facts, independent job versions, controlled AI changes,
recoverable persistence and trustworthy requirement extraction. Additional MCP
connectivity is not a prerequisite for addressing these blockers.

This assessment made no application-code, dependency, configuration or saved-resume
changes. The requested builds refreshed generated artifacts. This report is the
only new repository document. Diagnostic probes used synthetic data, not personal
resume records. The npm advisory check contacted the npm registry; no company or
job-market research was performed.

Evidence labels used below:

- **Confirmed:** established by current source, command results or a synthetic probe.
- **Implemented, not browser-verified:** handlers/layout exist, but a real browser
  interaction or rendered export was not verified during this assessment.
- **Recommendation:** a proposed future change, not an implemented capability.
- **Unverified:** insufficient evidence to make a runtime, quality or compliance claim.

## 1. Current application architecture

| Layer | Current implementation | Assessment |
| --- | --- | --- |
| Standalone entry | `index.html` → `src/main.jsx` → `src/App.jsx` | React 18/Vite SPA; no application backend is required for local editing. |
| Editor and orchestration | `src/App.jsx`, 548 lines | Owns matching, imports, state, persistence, AI calls, editing, photos, export orchestration and most UI. |
| Shared contract | `src/resume-schema.js` | JSON schema, skill-category labels and a single generation prompt shared with the connector. |
| Matching | `src/App.jsx:20` and `src/App.jsx:368` | In-memory alias dictionary, stopwords, generic tokens, recurring bigrams and literal occurrence counts. |
| Local AI | `src/App.jsx:319` | Browser POST to `http://localhost:11434/api/chat`; default `llama3.2`, schema-constrained JSON, temperature 0.2, no streaming. |
| Persistence | `src/App.jsx:139` and `src/App.jsx:275` | Three localStorage records plus a legacy-key reader; one current document and its input snapshots. |
| Export | `src/App.jsx:124`, `src/App.jsx:187`, `src/resume-pdf.js` | Plain text, DOCX, browser print/PDF, and generated PDF for the embedded host. Separate rendering implementations. |
| Styling | `src/index.css`, Tailwind 4/PostCSS configuration | Mostly custom CSS; responsive three-panel editor; separate print rules and German date-column styling. |
| Embedded entry | `src/chatgpt.jsx`, `src/chatgpt-bridge.js` | Same editor with MCP Apps host messaging, file downloads, reconnects and optional fullscreen. |
| Optional connector | `chatgpt/server.mjs`, `chatgpt/oauth.mjs` | Stateless Node MCP service; two tools; optional external OAuth JWT verification. |
| Builds | `vite.config.js`, `vite.chatgpt.config.js`, `scripts/package-chatgpt.mjs` | Standalone assets and a separate self-contained embedded widget. |

There is no domain-level master-profile repository, job/version database, evidence
ledger, command history, research subsystem, service worker or automated QA suite.
This workspace is also **not currently a Git repository**; `git status` fails for
that reason. There is no code-history rollback available here through Git.

## 2. Working and implemented functionality inventory

### Confirmed through execution

- Both standalone and embedded production builds succeed.
- Both editor variants pass a React server-render smoke check. This is not an
  interactive browser test.
- The existing Vite service returns HTTP 200 at `http://localhost:3000` and listens
  on `127.0.0.1:3000`.
- The existing MCP health endpoint returns HTTP 200 and its process listens on
  `127.0.0.1:8787`.
- Ollama's local API responds. Its model list includes `llama3.2:latest`,
  `qwen3:4b` and `qwen3.6:latest`.
- A synthetic request using the actual prompt and schema completed in about
  5.3 seconds and returned valid JSON with one experience record, one education
  record and two languages. This establishes the request/parse path, not general
  factual correctness or recruiter-quality writing.
- Alias and boundary matching work for several ordinary technical cases. For
  example, JavaScript alone does not satisfy a Java requirement in the scorer.
- Synthetic cache and export probes verify valid-cache loading, fact/link retention
  in text and DOCX, and the configured German PDF document geometry.
- MCP/OAuth syntax and local token-validation probes pass. These do not verify
  an external identity provider or an actual ChatGPT account connection.

### Implemented, with interaction/layout verification still needed

- DOCX raw-text import through Mammoth; pasted resume and JD inputs; word counts
  and approximate token counts. Imports have a 5 MB file limit and 150,000-character
  extracted-text limit. JD input has a 100,000-character limit.
- Editable name, target title, contact details, confirmed authorization text,
  LinkedIn/GitHub/portfolio links, summary, categorized skills, roles, projects,
  education and languages.
- Inline plaintext editing, adding/deleting entries and bullets, and moving roles
  up/down. There is no drag-and-drop reordering implementation.
- Live keyword gauge, matched/missing/leadership tabs, keyword occurrences,
  recruiter notes and a readiness checklist.
- Model selection, re-analysis, timeout/network-error handling and reset confirmation.
- Some delayed-response protection using request identities and edit counters.
- International/German display modes; CEFR selection; optional local photo upload
  and JPEG conversion; normalization of recognized month/year dates.
- Standalone autosave to localStorage. Embedded edits deliberately remain in memory.
- Plain-text download plus clipboard attempt, genuine DOCX, browser print/PDF,
  and host-mediated embedded PDF/Word/text downloads.

Local operation is possible without internet once packages/models are installed,
provided the local web server and Ollama are running. This is not an installed PWA
with a service-worker asset cache. The ChatGPT mode is an explicitly online path.

## 3. Missing and partially developed product capabilities

| Intended principle/capability | Current state |
| --- | --- |
| Separate master career profile | Missing. The “Master Resume” contact form writes to the same mutable `resume` used by the tailored preview. |
| Independent job-specific versions | Missing. One source, one JD and one current document are stored. No version IDs, job records or revision graph. |
| Evidence-aware facts | Missing. There are no source IDs, evidence spans, fact references, verification status or unsupported-claim records. |
| Approval before material AI changes | Missing. Structurally valid results directly replace the current document. |
| History, undo and recovery | Missing as application features. Browser-native editing undo is not a substitute for durable revision history. |
| Technical requirement extraction | Partial. A useful alias dictionary is mixed with arbitrary non-stopword tokens and repeated bigrams. |
| Explainable matching | Partial. The baseline formula is visible, but corpus selection and model-score substitution undermine a stable explanation. |
| Recruiter-quality writing | Unverified. Prompt instructions exist; no evaluation dataset, rubric, evidence checks or approved examples are present. |
| Complete German support | Partial. Dates, language controls and print geometry exist; date validity, chronology and renderer consistency are not enforced. |
| Durable offline preservation | Partial. Latest-state localStorage caching exists; transactional storage, backups, migration and corruption recovery do not. |
| Company/job-market intelligence | Missing. No company records, market datasets, research jobs, citations or permission workflow. |
| Career management | Missing. No saved jobs, applications, status tracking, follow-ups or correspondence history. |
| Optional online research with consent | No research implementation exists. Consequently there is also no research-specific consent boundary yet. |

### ATS and JD implementation: confirmed defects

The baseline is `round(matched unique keywords / total extracted unique keywords × 100)`.
It is an overlap heuristic, not a real ATS acceptance prediction.

1. **Ordinary prose becomes skill requirements.** Every qualifying non-stopword
   token is included (`src/App.jsx:59`). A Python/SQL candidate scored 18% against
   a JD padded with salary/benefits prose; “competitive”, “salary”, “inclusive” and
   “workplace” appeared as missing skills. “Go to our website for the rest…” also
   produces false Go/REST requirements. German morphology is not modeled.
2. **Mention is treated as evidence.** “No experience with Python” scores 100%
   against a Python-only JD. An AWS email address and a `/python` profile URL also
   satisfy those requirements. Contact text is included in the corpus.
3. **The selected document is not always the scoring target.** Changed source
   text can be concatenated with the old printable document (`src/App.jsx:369`).
   A Python source plus a SQL-only printable document therefore scores 100% for
   a Python JD, even though the printable document alone scores 0%.
4. **Injection can manufacture resume facts.** Missing terms are directly appended
   as factual skills or bare employment bullets (`src/App.jsx:396`). Re-analysis
   can then treat those additions as source evidence. A warning is not evidence.
5. **Matching and injection disagree.** The scorer respects Java/JavaScript
   boundaries, but `skillAdded` uses substrings (`src/App.jsx:394`). A JavaScript
   bullet can disable the still-missing Java button.
6. **Model score and explanation can contradict each other.** Any positive local
   model score can replace the baseline, while matched/missing lists remain local
   (`src/App.jsx:372`). The ChatGPT result path clears that override instead.
7. **Readiness is overstated.** Any digit counts as a measurable achievement.
   Bullets mentioning Python 3, OAuth2 and ISO 27001 can satisfy the three-metric
   check without describing outcomes. Recruiter feedback is not tied to stable
   bullet IDs and may remain stale after job edits or reordering.
8. **Phrase weighting is inconsistent.** Repeated phrases may be counted along
   with both component words; unfamiliar multiword products may be fragmented.
   Requirements, preferences, responsibilities and benefits have equal weight.

### Ollama/prompt assessment

The prompt correctly prohibits invented employers, skills, metrics, visa status,
CEFR levels and missing months. It requests source-supported STAR-style bullets,
full career retention, projects and categorized skills. These are valuable rules.

However, structural JSON validation does not verify those rules. A completely
invented CTO role and invented 900% metric pass the current validator. No field
connects a generated claim to source evidence. Subsequent generation can use the
previous generated draft rather than the complete original source, compounding
omissions or unsupported additions.

The live synthetic request returned a schema-valid resume but `match_score: 0`
and empty matched/missing arrays for a JD sharing Python/AWS. The fallback is
therefore necessary; no conclusion about general model accuracy follows from one run.

The provider integration has no discovery-based capability selection, context-budget
enforcement, chunking, prompt versioning or saved evaluation results. Character/4
token counts are estimates. A 150,000-character input limit does not guarantee a
request fits a model's active context. Generation is nonstreaming with a five-minute
timeout; reset/unmount can abort it, but there is no dedicated cancel action.

### Editing, persistence, recovery and export assessment

- AI results call `setResume(generated)` directly (`src/App.jsx:270`,
  `src/App.jsx:352`). There is no proposal/diff/approval transaction or prior snapshot.
- An invalid nested cached field invalidates the whole cached document. Startup
  autosave can then remove or overwrite its sole saved copy. The source text may
  survive, but manual tailored edits need not. No quarantine/recovery UI exists.
- Cache writes are separate, synchronous operations. Quota failure can leave new
  inputs beside an older document. The footer is not a reliable save-status indicator.
- Legacy handling restores source/JD but not a legacy structured resume. There is
  no explicit storage schema version or migration ledger.
- Imports can overwrite typing performed while extraction is pending. Import
  completion does not increment the edit counter used by pending AI results.
  Format changes are also not revision-tracked. These handler-level race findings
  need browser regressions, not an assertion that every ordinary edit is lost.
- Reset invalidates pending imports/AI correctly in several paths and clears only
  the app's four keys. It does not cancel exports already producing a snapshot.
- Stored resume/PII/photo data is ordinary plaintext localStorage, not encrypted
  storage. Embedded reset does not delete ChatGPT conversation data.
- German browser print and generated PDF have date columns, but German DOCX uses
  centered headers, inline dates and predominantly English section headings.
  Word, browser print, generated PDF and TXT do not share one layout contract.
- Date normalization preserves unknown months, which is correct, but also preserves
  invalid `13/2024 – 02/2023` ranges. There is no chronology/gap validator or automatic
  reverse-chronological ordering. Formal DIN compliance is not established.
- Multi-page quality, Unicode/font coverage, photo placement and actual paper output
  require rendered fixtures. Word/PDF visual parity was not verified in this phase.

## 4. Major technical risks

| Priority | Confirmed risk | Consequence |
| --- | --- | --- |
| P0 | One mutable document, immediate AI replacement, no durable history | Approved career facts and manual work can be overwritten without rollback. |
| P0 | No evidence ledger; missing-term injection creates claims | Unsupported skills/metrics can become input to subsequent AI passes. |
| P0 | Latest-only, nontransactional persistence and silent invalid-cache fallback | Recoverable data can be replaced by defaults; partial saves can mix revisions. |
| P1 | Generic token matching, negation/contact false positives, mixed corpus | Misleading scores and recommendations despite an honest heuristic disclaimer. |
| P1 | Inconsistent asynchronous revision guards | Imports or delayed responses can overwrite newer user intent. |
| P1 | No maintained test/lint/CI setup or Git repository | Regressions and recovery are difficult to detect and reproduce. |
| P1 | Renderer divergence and free-text dates | Exports can differ materially from the reviewed German preview. |
| P2 | Monolithic stateful component and duplicated validators | Tight coupling, inconsistent limits and high change cost. |
| P2 | Online deployment still needs external infrastructure | Existing MCP code is not proof of account-connected production readiness. |

Current `npm audit --json` and `npm audit --omit=dev` both report **zero advisories**
from `https://registry.npmjs.org/`. `SECURITY_NOTES.md:35` is a dated 2026-10-21
snapshot reporting three and is now stale. Zero registry advisories does not prove
the absence of application-level security or data-integrity defects.

### MCP security boundary: retain, do not expand now

The connector has only `open_resume_editor` and `present_resume`, returns structured
data, reads its compiled widget once, and has no shared resume database or shell tool.
It implements Host/Origin checking, request bounds and unsafe-public-config rejection.
OAuth verifies asymmetric signatures, issuer, audience, expiry, scopes and optional
subject restrictions. Local no-auth still trusts local processes.

The current local configuration has no public origin, issuer, JWKS or development
token configured; values were checked only as present/absent, without displaying
credentials. A real identity provider, HTTPS termination, rate/concurrency policy
and ChatGPT account end-to-end operation remain outside the verified local setup.
No further MCP connectivity development is recommended for the next phase.

## 5. Recommended architecture improvements

Keep React/Vite, the current editor, Mammoth, local Ollama and the existing exporters.
Introduce boundaries around them incrementally:

1. **Domain model:** distinct `MasterProfile`, immutable `SourceDocument`, `EvidenceFact`,
   `JobTarget`, `ResumeVersion`, `ChangeProposal` and `AnalysisSnapshot` records.
   Give records, roles and bullets stable IDs, schema versions and timestamps.
2. **Local repository:** transactional IndexedDB writes, explicit migrations,
   corruption quarantine, last-good recovery and JSON workspace backup/restore.
   Do not erase the old cache until migration has been committed and verified.
3. **Controlled editing:** reducer/commands for edits, deletes, restores and version
   creation. App state should select records; it should not be the only database.
4. **Evidence-aware AI:** provider adapters produce proposals, not direct state
   mutations. Material facts need evidence references or explicit user confirmation.
   Unsupported suggestions stay outside the exportable document.
5. **Explainable analysis:** a pure, versioned requirement extractor and scorer
   targeting the selected printable version. Display master evidence coverage
   separately. Keep model commentary separate from deterministic match scores.
6. **Document model:** project the selected version into a shared export model,
   then render HTML/DOCX/PDF/TXT with explicit locale/layout policies and fixtures.
7. **Optional online boundary:** later research adapters require user permission,
   declared outbound data, source URLs, retrieval dates and cancellation. Offline
   editing/scoring/export must remain independent of that service.

Do not introduce microservices or replace the existing UI to achieve these boundaries.

## 6. Prioritized implementation roadmap

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 1 | Career-data integrity, versioned local preservation and AI proposal approval | Master data survives tailoring; every accepted material change is reviewable/reversible; recovery tests pass. |
| 2 | Technical requirement extraction and explainable matching | Bilingual fixtures reject benefits prose, negated claims and contact matches; selected-version scores are reproducible. |
| 3 | Evidence-aware writing and Ollama evaluation | Provider requests use preserved evidence, respect context budgets and pass a curated factual/writing rubric. |
| 4 | German profile validation and export parity | Dates/locales are validated without fabrication; representative German/A4/Letter/multi-page exports retain facts and match layout policy. |
| 5 | Jobs, applications and permission-based company/market research | Saved job/application workflow works offline; every optional online action is consented and cited. |
| 6 | Distribution and optional account integration | Backup/recovery and release QA pass; then evaluate PWA/desktop packaging and revisit authenticated MCP deployment if wanted. |

Basic regression tooling belongs at the start of Phase 1 and expands in every phase.

## 7. Detailed recommendation for the next phase

**Approve Phase 1: Master Profile, Evidence, Versions and Controlled Tailoring.**

Implement it in two reviewable increments while preserving existing features:

### 1A — Preserve data before adding intelligence

- Define stable records for a master career profile, immutable imported source text,
  evidence links, saved job targets and independent resume versions.
- Migrate the existing three-key cache into one versioned workspace transaction.
  Keep a migration backup and last-good state. Quarantine malformed records rather
  than silently saving defaults over them. Disclose failures before claiming a save.
- Add a version selector/history, restore-as-new-version, bounded undo/redo and
  workspace JSON export/import. Preserve unknown source details during migration.
- Give async import/generation/export operations a consistent workspace/job/version
  snapshot and cancellation/revision policy. Use stable IDs rather than array indices.
- Establish unit/component/integration fixtures around current features before
  moving their orchestration out of `App.jsx`.

### 1B — Require review before changing a resume

- Local Ollama and embedded-host results create a `ChangeProposal` with before/after
  fields, reason, evidence references and risk flags.
- Show a side-by-side or field-level diff. Accept/reject individual changes, with
  explicit confirmation for material claims. Applying a proposal creates a revision;
  it never mutates the preserved master profile.
- Convert missing-skill injection into a suggestion flow. Unsupported skills and
  bare employment bullets must not enter the exportable document automatically.
- Block unsupported changes to employers, dates, qualifications, CEFR, authorization
  and metrics; allow the user to supply a new evidence record or explicit confirmation.
- Preserve current DOCX/text/photo/language controls and export paths through adapters.
  Keep the matching engine and layout behavior stable except for the minimum changes
  required to target the selected version and stop unsupported injection.

Defer scoring overhaul, market research, employer integrations and MCP connectivity
until these safeguards are accepted. Prompt instructions alone cannot establish
that a generated statement is true; source links and human approval are still necessary.

## 8. Exact files likely to be affected after approval

These are proposed paths, not files created by Phase 0. Keep the first increment
small; additional component extraction should follow demonstrated need.

| Existing file | Planned Phase 1 responsibility |
| --- | --- |
| `src/App.jsx` | Replace latest-only orchestration with workspace selections, proposal review and revision-safe handlers. Preserve the editor. |
| `src/resume-schema.js` | Keep the current document contract; add/derive versioned domain/proposal validation and evidence requirements through explicit adapters. |
| `src/main.jsx` | Initialize the workspace repository/provider and recovery UI. |
| `src/index.css` | Small additions for version, proposal, save-status and recovery controls; no visual rebuild. |
| `src/chatgpt.jsx` | Initialize the same domain/review workflow in embedded mode without further connectivity development. |
| `src/chatgpt-bridge.js` | Only contract adaptation if proposal payloads require it; preserve existing host transport. |
| `src/resume-pdf.js` | Consume the selected version/document projection; preserve current export support. |
| `package.json`, `package-lock.json` | Add agreed test/lint tooling and, if chosen, a small IndexedDB helper. |
| `README.md`, `SECURITY_NOTES.md` | Document migration, backups, approval behavior and current validation. |

Proposed new files:

- `src/domain/workspace-schema.js` — profiles, jobs, sources, evidence, versions and proposals.
- `src/data/workspace-repository.js` — transactional local persistence.
- `src/data/workspace-migrations.js` — legacy migration, quarantine and last-good recovery.
- `src/data/workspace-backup.js` — portable JSON backup/restore with validation.
- `src/state/workspace-reducer.js` — stable edit/apply/undo/restore commands.
- `src/services/ai/ollama-client.js` — cancellable provider request adapter.
- `src/services/ai/proposal-validation.js` — evidence and material-change gates.
- `src/features/tailoring/ProposalReview.jsx` — accept/reject review interface.
- `src/features/versions/VersionHistory.jsx` — job/version selection and restoration.
- `src/features/recovery/RecoveryNotice.jsx` — actionable save/migration errors.
- `vitest.config.js`, `eslint.config.js`, `playwright.config.js` — agreed QA configuration.
- `tests/unit/workspace.test.js`, `tests/unit/proposals.test.js`,
  `tests/integration/workspace-recovery.test.js`, `tests/e2e/resume-workflow.spec.js`,
  and synthetic fixtures under `tests/fixtures/`.

`chatgpt/server.mjs` and `chatgpt/oauth.mjs` should stay unchanged unless an essential
document-contract compatibility issue is demonstrated. Do not expand their connectivity.

## 9. Regression tests, acceptance criteria and actual check results

### Tests to introduce in the approved phase

| Area | Required acceptance criterion |
| --- | --- |
| Migration | All valid existing source/JD/document/contact/photo/language/project data survives; malformed records remain recoverable; failed migration leaves the old store intact. |
| Master isolation | Tailoring two different jobs does not alter the master or either other's versions. |
| AI approval | Generation leaves the selected document unchanged until acceptance. Reject changes leaves it unchanged. Accept creates a revision. |
| Evidence | An invented employer, skill, metric or CEFR change cannot enter an approved version without evidence or an explicit recorded user confirmation. |
| Undo/history | Add/edit/delete/reorder and accepted proposals are reversible; reload preserves revisions; restore creates a new revision rather than deleting history. |
| Save/recovery | Quota errors, malformed JSON, interrupted writes and reloads preserve last-good data and show accurate save/recovery status. |
| Async safety | Typing during import, switching jobs/format during AI work, resets and delayed host results cannot overwrite newer intent or export the wrong version. |
| Core regressions | DOCX import, inline editing, roles/projects/education/languages/photo, links, model errors and standalone/embedded entry points continue working. |
| Matching baseline | Score the selected version only; test aliases, Java/JavaScript, negation, URLs/emails, German terms, benefits prose and phrase duplication. Mark currently failing cases explicitly until Phase 2 fixes them. |
| Export | TXT/DOCX/PDF retain selected-version facts/links/Unicode; German date/margin policy is explicit; long-role and multi-page fixtures receive rendered QA. |
| Offline/privacy | Local edit/save/restore/matching/export require no internet; local AI contacts only configured Ollama; research requires separate explicit permission. |

### Phase 0 checks actually executed

| Check | Result |
| --- | --- |
| `npm run build` | Pass. Large lazy-loaded PDF/font chunks produce size warnings. |
| `npm run build:chatgpt` | Pass. Approximately 3.16 MB self-contained widget; two third-party Zod annotation warnings. |
| `npm run` / QA configuration search | No lint script, test script, test suite, lint config, test-runner config or CI setup found. These checks cannot be reported as passing. |
| `npm ls --depth=0` | Pass; installed dependency tree is valid. |
| `node --check` for connector, OAuth and packaging script | Pass. |
| `npm audit --json`, `npm audit --omit=dev` | Zero advisories returned by the public npm registry at assessment time. |
| React render smoke checks | Standalone and embedded components render without throwing. |
| Local services | Vite 200, MCP health 200, Ollama tags available; Vite/MCP loopback bindings confirmed. |
| Synthetic local Ollama request | Valid structured resume; diagnostic score/lists remained 0/empty. No saved user data modified. |
| Matching/schema probes | Reproduced negation/contact false positives, prose pollution, corpus mixing, injection inconsistency and structural acceptance of unsupported facts. These are confirmed defects, not passing product requirements. |
| Cache/export probes | Verified valid cache and TXT/DOCX content paths; reproduced invalid-cache loss and German renderer divergence. |
| Local OAuth probes | Valid locally signed tokens accepted; malformed/expired/wrong-audience/wrong-subject/missing-scope tokens rejected. No provider or public endpoint used. |

Unverified: a real interactive browser workflow, physical printing, visual export
parity, broad multilingual/long-document behavior, recruiter-quality/factual AI
benchmarks, real ChatGPT downloads/login, and formal DIN compliance. No personal
browser cache was opened for this assessment.

## Approval boundary

Phase 0 is complete. Do not begin Phase 1 or change existing application behavior
until the owner approves its scope. Preserve the existing editor and offline path;
make career-data integrity the next milestone, not further MCP connectivity.
