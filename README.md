# Offline ATS Resume Builder

To use the existing visual editor inside ChatGPT, see [CHATGPT_SETUP.md](CHATGPT_SETUP.md).
The standalone Ollama workflow below remains available separately.
Current security controls and remaining dependency advisories are documented in
[SECURITY_NOTES.md](SECURITY_NOTES.md).

Requires Node.js 22.12+ and Ollama with the `llama3.2` model.

```sh
launchctl setenv OLLAMA_ORIGINS "http://localhost:3000,http://127.0.0.1:3000"
```

Restart Ollama after setting its environment. If using the CLI directly, run
`OLLAMA_ORIGINS='http://localhost:3000,http://127.0.0.1:3000' ollama serve`.
Keep the local browser allowlist explicit rather than permitting every origin.
The launchctl environment is session-scoped. This machine also sets it on login
using `~/Library/LaunchAgents/local.ollama.cors.plist`, with the same command in
`~/.zshrc` for interactive shells. Restart Ollama if it starts before the login
agent sets the environment.

```sh
ollama pull llama3.2
npm install
npm run dev
```

Open http://localhost:3000. Import a `.docx` or paste resume text, optionally add a
job description, and generate. Choose an installed model in the header (default:
`llama3.2`), then use Re-Analyze Match to run again with the current inputs.

The document supports live inline editing and local auto-save, adding/deleting roles,
projects, education, languages and bullets, and moving roles up or down. Master Resume
controls manage name, email, phone, location, confirmed work authorization and LinkedIn,
GitHub and portfolio links. The preview renders safe HTTP(S) links with compact labels.
The diagnostics calculate unique JD keyword overlap locally on every edit, including
technical aliases, non-stopword tokens and recurring bigrams. The score is matched /
total unique keywords × 100. Density counts and missing-keyword buttons update live.
A positive Ollama evaluation can override the baseline for its exact resume/JD revision;
any edit immediately restores the live baseline. Zero/invalid model results and connection
failures retain client scoring. No overlap can correctly score zero; no keywords shows
an unavailable gauge. These estimates are not validated ATS ratings or hiring predictions.
Click a missing skill to add it to a skills category or a selected role's new bullet;
include only skills you can substantiate. The readiness checklist checks links, location,
three numbered achievement bullets and explicitly entered CEFR language levels.
Async analysis results never overwrite edits made while a request is running.
Word export creates a genuine `.docx` locally. Print / PDF uses the selected A4 or
Letter page size with 0.65-inch margins and keeps experience blocks together where
they fit on a page. Longer documents paginate naturally; review the print preview.
Export Clean Text downloads UTF-8 `.txt` and attempts to copy it to the clipboard,
retaining complete URLs for application portals. Clipboard denial does not prevent download.

German Lebenslauf print/PDF uses A4 with 25 mm top/left and 20 mm bottom/right
margins, a 38 mm date column and a 5 mm gap before role details. These margins
also apply to German Word exports. International mode retains its paper selector
and 0.65-inch margins.
German Lebenslauf mode uses a structured date column, languages with CEFR controls,
and an optional top-right photo. Uploaded images stay local and are converted to a
compact JPEG portrait for print and Word. Known month/year dates become MM/YYYY;
year-only dates are preserved until you supply the actual month. No visa status,
language rating or missing date is inferred. This is a German-style layout, not a
DIN 5008 certification. Photo requirements vary by employer and industry; consult
the [official application guidance](https://www.make-it-in-germany.com/en/working-in-germany/job/application).

Inputs are cached under `cached_resume_text` and `cached_jd_text`; the document,
diagnostics, layout settings, photo and analysis snapshot use `cached_tailored_data`.
Reset / Clear All asks for confirmation, cancels active analysis and removes this
application's four cache keys, including the legacy cache. Other same-origin browser
storage is preserved. Legacy source text is retained on upgrade.
Generation uses only http://localhost:11434/api/chat.
No external fonts or hosted services are required at runtime after installation
and the initial model download. Keep the local Vite server running to use the app.

`npm run build` creates `dist/`; `npm run preview` serves that production build.
