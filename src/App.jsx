import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Check, CheckCheck, ChevronDown, Download, FileText, Layers3, LoaderCircle, LockKeyhole, Plus, Printer, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Target, Trash2, Upload, X } from 'lucide-react';
import { resumeSchema, skillGroups, systemPrompt } from './resume-schema.js';

const cacheKeys = ['cached_resume_text', 'cached_jd_text', 'cached_tailored_data'];

function matchesSchema(value, schema) {
  if (schema.type === 'string') return typeof value === 'string';
  if (schema.type === 'integer') return Number.isInteger(value) && value >= schema.minimum && value <= schema.maximum;
  if (schema.type === 'array') return Array.isArray(value) && value.every((entry) => matchesSchema(entry, schema.items));
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && schema.required.every((key) => matchesSchema(value[key], schema.properties[key]))
    && Object.entries(schema.properties).every(([key, property]) => value[key] === undefined || matchesSchema(value[key], property));
}
function emptyResume() {
  return { full_name: '', target_title: '', contact: { email: '', phone: '', location: '', work_authorization: '', linkedin: '', github: '', portfolio: '' }, languages: [], summary: '',
    skills_categorized: Object.fromEntries(skillGroups.map(([key]) => [key, []])), experience: [], projects: [], education: [],
    ats_diagnostics: { match_score: 0, matched_skills: [], missing_skills: [], recruiter_notes: [] } };
}
const hardSkills = [
  'AWS|Amazon Web Services', 'Azure|Microsoft Azure', 'GCP|Google Cloud|Google Cloud Platform',
  'Terraform', 'Kubernetes|K8s', 'Docker', 'Ansible', 'Jenkins', 'CI/CD|CI CD|continuous integration|continuous delivery',
  'GitHub Actions', 'GitLab', 'Git', 'Linux', 'Windows Server', 'Bash|shell scripting', 'PowerShell',
  'Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#', '.NET|dotnet', 'Go|Golang', 'Rust', 'Ruby', 'PHP', 'SQL',
  'React|React.js|ReactJS', 'Node.js|NodeJS', 'Next.js|NextJS', 'Vue|Vue.js', 'Angular', 'Django', 'Flask', 'FastAPI', 'Spring Boot',
  'PostgreSQL|Postgres', 'MySQL', 'MongoDB', 'Redis', 'DynamoDB', 'Snowflake', 'Databricks', 'BigQuery',
  'Pandas', 'NumPy', 'SciPy', 'scikit-learn|sklearn', 'TensorFlow', 'PyTorch', 'Spark|Apache Spark', 'Kafka|Apache Kafka',
  'Airflow', 'dbt', 'ETL', 'Machine Learning', 'Statistical Modeling|Statistical Modelling', 'Regression', 'Anomaly Detection',
  'Power BI|PowerBI', 'Tableau', 'Excel', 'SAP', 'Salesforce', 'ServiceNow', 'Jira',
  'Prometheus', 'Grafana', 'Datadog', 'Splunk', 'Elasticsearch', 'OpenTelemetry', 'CloudFormation', 'Helm', 'Argo CD|ArgoCD',
  'REST|RESTful', 'GraphQL', 'gRPC', 'OAuth', 'SAML', 'TCP/IP', 'DNS', 'VPC', 'IAM', 'S3', 'EC2', 'Lambda', 'Direct Sales',
].map((entry) => entry.split('|'));
const stopWords = new Set('a an and are as at be been being but by can could do for from has have if in into is it its may of on or our should than that the their them these they this those through to under up us using was we were will with within work working would you your years year experience required requirements must preferred good strong excellent knowledge skills skill ability team role company opportunity apply join looking suchen wir und oder mit von für im in der die das ein eine einen einem den des auf aus als ist sind werden wird zu zum zur sie du ihr ihre erfahrung kenntnisse sehr gute sowie bitte nach bei über auch einen job position candidate candidates responsibilities qualifications tools technology technologies'.split(' '));
function normalizedText(value) { return value.toLocaleLowerCase().normalize('NFKC').replace(/\s+/gu, ' ').trim(); }
function keywordCount(content, keyword) {
  const haystack = normalizedText(content);
  const aliases = [...new Set((Array.isArray(keyword) ? keyword : [keyword]).map(normalizedText))].filter(Boolean).sort((first, second) => second.length - first.length);
  const ranges = [];
  for (const needle of aliases) {
    let offset = 0;
    while ((offset = haystack.indexOf(needle, offset)) !== -1) {
      const end = offset + needle.length;
      const before = haystack[offset - 1] || '';
      const after = haystack[end] || '';
      if (!/[\p{L}\p{N}+#]/u.test(before) && !/[\p{L}\p{N}+#]/u.test(after) && !ranges.some(([start, finish]) => offset < finish && end > start)) ranges.push([offset, end]);
      offset = end;
    }
  }
  return ranges.length;
}
function containsSkill(content, keyword) {
  return keywordCount(content, keyword) > 0;
}
function localDiagnostics(source, job) {
  const keywords = hardSkills.filter((aliases) => aliases.some((alias) => containsSkill(job, alias))).map((aliases) => [...aliases]);
  const seen = new Set(keywords.flat().map(normalizedText));
  const coveredTokens = new Set(keywords.flat().flatMap((alias) => normalizedText(alias).match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu) || []));
  const tokens = (normalizedText(job).match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu) || []).map((token) => token.replace(/[.-]+$/g, ''));
  const relevant = (token) => token.length > 2 && !stopWords.has(token) && !coveredTokens.has(token) && !/^\d/.test(token);
  function addKeyword(value) {
    if (!seen.has(value)) { seen.add(value); keywords.push([value]); }
  }
  tokens.filter(relevant).forEach(addKeyword);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (relevant(tokens[index]) && relevant(tokens[index + 1])) {
      const phrase = `${tokens[index]} ${tokens[index + 1]}`;
      if (keywordCount(job, phrase) >= 2) addKeyword(phrase);
    }
  }
  const matched = keywords.filter((aliases) => aliases.some((alias) => containsSkill(source, alias)));
  const missing = keywords.filter((aliases) => !aliases.some((alias) => containsSkill(source, alias)));
  return {
    match_score: keywords.length ? Math.round(matched.length / keywords.length * 100) : 0,
    matched_skills: matched.map(([name]) => name), missing_skills: missing.map(([name]) => name),
    recruiter_notes: [], assessment_source: keywords.length ? 'local' : 'unavailable',
    keyword_density: keywords.map((aliases) => ({ keyword: aliases[0], count: keywordCount(source, aliases) })),
  };
}
function normalizeDiagnostics(parsed, source, job) {
  const nested = parsed?.ats_diagnostics;
  const data = nested && typeof nested === 'object' ? nested : {};
  const rawScore = data.match_score ?? data.ats_score ?? parsed?.match_score ?? parsed?.ats_score ?? 0;
  const numericScore = typeof rawScore === 'string' ? Number(rawScore.replace(/%$/, '').trim()) : rawScore;
  const score = typeof numericScore === 'number' && Number.isFinite(numericScore) ? Math.round(Math.max(0, Math.min(100, numericScore))) : 0;
  const cleanList = (value) => Array.isArray(value) ? [...new Set(value.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))] : [];
  const matched = cleanList(data.matched_skills ?? data.matched_keywords ?? parsed?.matched_skills ?? parsed?.matched_keywords);
  const missing = cleanList(data.missing_skills ?? data.missing_keywords ?? parsed?.missing_skills ?? parsed?.missing_keywords);
  const fallback = localDiagnostics(source, job);
  const useFallback = score === 0 || data.assessment_source === 'local' || data.assessment_source === 'unavailable';
  if (!job.trim()) return { ...fallback, assessment_source: 'unavailable' };
  return {
    match_score: useFallback ? fallback.match_score : score,
    matched_skills: useFallback || !matched.length ? fallback.matched_skills : matched,
    missing_skills: useFallback || !missing.length ? fallback.missing_skills : missing,
    recruiter_notes: cleanList(data.recruiter_notes ?? parsed?.recruiter_notes),
    assessment_source: useFallback ? fallback.assessment_source : 'model',
  };
}
function normalizeResume(parsed, source, job) {
  return parsed && typeof parsed === 'object' ? { ...parsed, contact: { ...emptyResume().contact, ...parsed.contact }, languages: parsed.languages ?? [], projects: parsed.projects ?? [], ats_diagnostics: normalizeDiagnostics(parsed, source, job) } : parsed;
}
function safeLink(value) {
  if (!value?.trim()) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    return ['https:', 'http:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
const contactLabels = { email: 'Email', phone: 'Phone', location: 'Location', work_authorization: 'Work authorization / Visa status', linkedin: 'LinkedIn', github: 'GitHub', portfolio: 'Portfolio / Website' };
function germanPeriod(value) {
  const months = ['jan(?:uary|uar)?', 'feb(?:ruary|ruar)?', 'm(?:ar(?:ch)?|ärz)', 'apr(?:il)?', 'ma[yi]', 'jun(?:e|i)?', 'jul(?:y|i)?', 'aug(?:ust)?', 'sep(?:tember)?', 'o[ck]t(?:ober)?', 'nov(?:ember)?', 'de[cz](?:ember)?'];
  let result = value.replace(/\b(\d{4})[-/.](0?[1-9]|1[0-2])\b/g, (_, year, month) => `${month.padStart(2, '0')}/${year}`).replace(/\b(0?[1-9]|1[0-2])[./](\d{4})\b/g, (_, month, year) => `${month.padStart(2, '0')}/${year}`);
  months.forEach((month, index) => { result = result.replace(new RegExp(`\\b${month}\\.?\\s+(\\d{4})`, 'gi'), (_, year) => `${String(index + 1).padStart(2, '0')}/${year}`); });
  return result.replace(/\b(present|current|heute|ongoing)\b/gi, 'Heute').replace(/\s+[–—-]\s+|\s+to\s+|\s+bis\s+/gi, ' – ').replace(/(\d{2}\/\d{4})\s*[–—-]\s*(?=\d{2}\/\d{4}|Heute)/g, '$1 – ');
}
function resumeContentText(resume) {
  return [resume.full_name, resume.target_title, ...Object.values(resume.contact), resume.summary, ...Object.values(resume.skills_categorized).flat(),
    ...resume.experience.flatMap((role) => [role.role_title, role.company, role.period, role.location, ...role.bullets]),
    ...resume.projects.flatMap((project) => [project.name, project.tools, ...project.bullets]),
    ...resume.education.flatMap((entry) => [entry.degree, entry.institution, entry.dates, entry.details]),
    ...resume.languages.flatMap((language) => [language.name, language.proficiency, language.cefr]),
  ].filter(Boolean).join('\n');
}
function resumeToText(resume, mode = 'international') {
  const period = (value) => mode === 'german' ? germanPeriod(value) : value;
  return [resume.full_name, resume.target_title, ...Object.values(resume.contact).filter(Boolean), '', 'PROFESSIONAL SUMMARY', resume.summary, '', 'TECHNICAL SKILLS',
    ...skillGroups.filter(([key]) => resume.skills_categorized[key].length).map(([key, label]) => `${label}: ${resume.skills_categorized[key].join(', ')}`), '', 'PROFESSIONAL EXPERIENCE',
    ...resume.experience.flatMap((role) => [`${period(role.period)} | ${role.role_title} | ${role.company} | ${role.location}`, ...role.bullets.map((bullet) => `- ${bullet}`), '']),
    ...(resume.projects.length ? ['ACADEMIC PROJECTS / RESEARCH', ...resume.projects.flatMap((project) => [project.name, project.tools, ...project.bullets.map((bullet) => `- ${bullet}`), ''])] : []),
    'EDUCATION', ...resume.education.flatMap((entry) => [entry.degree, `${entry.institution} | ${period(entry.dates)}`, entry.details, '']),
    ...(resume.languages.length ? ['LANGUAGES', ...resume.languages.map((language) => `${language.name}: ${[language.proficiency, language.cefr].filter(Boolean).join(' / ')}`)] : []),
  ].join('\n').trim();
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function loadCache() {
  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }
  try {
    const legacy = readJson('offline-ats-resume-v1');
    const saved = readJson(cacheKeys[2]);
    const source = localStorage.getItem(cacheKeys[0]) ?? legacy?.source;
    const job = localStorage.getItem(cacheKeys[1]) ?? legacy?.job;
    const normalized = normalizeResume(saved?.resume, typeof source === 'string' ? source : '', typeof job === 'string' ? job : '');
    return {
      source: typeof source === 'string' ? source : '', job: typeof job === 'string' ? job : '',
      resume: matchesSchema(normalized, resumeSchema) ? normalized : emptyResume(), hasResume: matchesSchema(normalized, resumeSchema) && Boolean(resumeContentText(normalized).trim()),
      analyzedSource: typeof saved?.analyzedSource === 'string' ? saved.analyzedSource : '',
      analyzedJob: typeof saved?.analyzedJob === 'string' ? saved.analyzedJob : '', edited: Boolean(saved?.edited),
      mode: saved?.mode === 'german' ? 'german' : 'international', photo: typeof saved?.photo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(saved.photo) ? saved.photo : '',
      photoEnabled: Boolean(saved?.photoEnabled), modelEvaluation: saved?.modelEvaluation ?? null,
    };
  } catch { return { source: '', job: '', resume: emptyResume(), hasResume: false, analyzedSource: '', analyzedJob: '', edited: false }; }
}
function wordCount(value) { return value.trim() ? value.trim().split(/\s+/u).length : 0; }
function Metrics({ value }) {
  return <span className="metrics">{wordCount(value).toLocaleString()} words <span>·</span> ~{Math.ceil(value.length / 4).toLocaleString()} tokens</span>;
}
function Editable({ value, label, onSave, as: Tag = 'span', className = '' }) {
  const field = useRef(null);
  useEffect(() => {
    if (field.current && field.current.textContent !== value) field.current.textContent = value;
  }, [value]);
  return <Tag ref={field} className={`editable ${className}`} contentEditable="plaintext-only" suppressContentEditableWarning
    role="textbox" aria-label={label} data-placeholder={label} onInput={(event) => onSave(event.currentTarget.textContent || '')} onBlur={(event) => {
      const updated = event.currentTarget.textContent || '';
      if (updated !== value) onSave(updated);
    }} />;
}
function ResetModal({ onClose, onConfirm, embedded = false }) {
  const modal = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    modal.current.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={modal} className="reset-modal" onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="reset-title" aria-describedby="reset-description">
    <div className="modal-icon"><RotateCcw size={23} /></div><h2 id="reset-title">Start with a clean slate?</h2>
    <p id="reset-description">{embedded ? 'This clears the resume, job description and edits in this editor view. It does not delete messages or files already in your ChatGPT conversation.' : 'This removes your resume, job description, edits and cached analysis from this browser.'} Download your resume first if you want to keep it.</p>
    <div className="modal-actions"><button autoFocus className="btn secondary" onClick={onClose}>Keep working</button><button className="btn danger" onClick={onConfirm}>Clear everything</button></div>
  </dialog>;
}
async function exportWord(resume, paper, mode = 'international', photo = '', download = downloadBlob) {
  resume = structuredClone(resume);
  if (mode === 'german') {
    resume.experience.forEach((role) => { role.period = germanPeriod(role.period); });
    resume.education.forEach((entry) => { entry.dates = germanPeriod(entry.dates); });
  }
  const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, ExternalHyperlink, ImageRun } = await import('docx');
  const paragraph = (value, options = {}) => new Paragraph({ children: [new TextRun(value)], spacing: { after: 100 }, ...options });
  const heading = (value) => paragraph(value.toUpperCase(), { spacing: { before: 240, after: 120 },
    border: { bottom: { color: '334155', style: BorderStyle.SINGLE, size: 4, space: 5 } },
    children: [new TextRun({ text: value.toUpperCase(), bold: true, size: 21 })], keepNext: true });
  const children = [
    paragraph(resume.full_name, { alignment: AlignmentType.CENTER, children: [new TextRun({ text: resume.full_name, bold: true, size: 36 })] }),
    ...(mode === 'german' && photo ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: Uint8Array.from(atob(photo.split(',')[1]), (character) => character.charCodeAt(0)), type: photo.startsWith('data:image/png') ? 'png' : photo.startsWith('data:image/webp') ? 'webp' : 'jpg', transformation: { width: 104, height: 136 } })] })] : []),
    paragraph(resume.target_title, { alignment: AlignmentType.CENTER }), paragraph([resume.contact.email, resume.contact.phone, resume.contact.location, resume.contact.work_authorization].filter(Boolean).join('  |  '), { alignment: AlignmentType.CENTER }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: ['linkedin', 'github', 'portfolio'].filter((key) => safeLink(resume.contact[key])).flatMap((key) => [new ExternalHyperlink({ link: safeLink(resume.contact[key]), children: [new TextRun({ text: contactLabels[key], style: 'Hyperlink' })] }), new TextRun('  ')]) }),
    heading('Professional Summary'), paragraph(resume.summary), heading('Technical Skills'),
    ...skillGroups.filter(([key]) => resume.skills_categorized[key].length).map(([key, label]) => paragraph('', { children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(resume.skills_categorized[key].join(', '))] })),
    heading('Professional Experience'), ...resume.experience.flatMap((role) => [
      paragraph('', { children: [new TextRun({ text: role.role_title, bold: true }), new TextRun({ text: `  |  ${role.period}` })], keepNext: true }),
      paragraph([role.company, role.location].filter(Boolean).join('  |  '), { keepNext: role.bullets.length > 0 }),
      ...role.bullets.map((bullet, index) => paragraph(bullet, { bullet: { level: 0 }, keepLines: true, keepNext: index < role.bullets.length - 1 })),
    ]), ...(resume.projects.length ? [heading('Academic Projects / Research'), ...resume.projects.flatMap((project) => [
      paragraph(project.name, { children: [new TextRun({ text: project.name, bold: true })], keepNext: true }),
      paragraph(project.tools, { keepNext: project.bullets.length > 0 }),
      ...project.bullets.map((bullet, index) => paragraph(bullet, { bullet: { level: 0 }, keepLines: true, keepNext: index < project.bullets.length - 1 })),
    ])] : []), heading('Education'), ...resume.education.flatMap((entry) => [
      paragraph(entry.degree, { children: [new TextRun({ text: entry.degree, bold: true })], keepNext: true }),
      paragraph([entry.institution, entry.dates].filter(Boolean).join('  |  ')), ...(entry.details ? [paragraph(entry.details)] : []),
    ]),
    ...(resume.languages.length ? [heading(mode === 'german' ? 'Sprachkenntnisse / Languages' : 'Languages'), ...resume.languages.map((language) => paragraph(`${language.name}: ${[language.proficiency, language.cefr].filter(Boolean).join(' / ')}`))] : []),
  ];
  const document = new Document({ styles: { default: { document: { run: { font: 'Arial', size: 21 }, paragraph: { spacing: { line: 276 } } } } },
    sections: [{ properties: { page: { size: mode === 'german' || paper === 'A4' ? { width: 11906, height: 16838 } : { width: 12240, height: 15840 }, margin: mode === 'german' ? { top: 1417, bottom: 1134, left: 1417, right: 1134 } : { top: 936, bottom: 936, left: 936, right: 936 } } }, children }] });
  await download(await Packer.toBlob(document), `${resume.full_name.trim().replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 70) || 'Resume'}-Resume.docx`);
}

export default function App({ host = null }) {
  const [cached] = useState(() => host ? { source: '', job: '', resume: emptyResume(), hasResume: false, analyzedSource: '', analyzedJob: '', edited: false } : loadCache());
  const [source, setSource] = useState(cached.source);
  const [job, setJob] = useState(cached.job);
  const [resume, setResume] = useState(cached.resume);
  const [hasResume, setHasResume] = useState(cached.hasResume);
  const [analyzedSource, setAnalyzedSource] = useState(cached.analyzedSource);
  const [analyzedJob, setAnalyzedJob] = useState(cached.analyzedJob);
  const [edited, setEdited] = useState(cached.edited);
  const [model, setModel] = useState('llama3.2');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [inputTab, setInputTab] = useState('resume');
  const [skillTab, setSkillTab] = useState('missing');
  const [paper, setPaper] = useState('A4');
  const [skillDestination, setSkillDestination] = useState('skills');
  const [activeCategory, setActiveCategory] = useState('monitoring_tools');
  const [mode, setMode] = useState(cached.mode || 'international');
  const [photo, setPhoto] = useState(cached.photo || '');
  const [photoEnabled, setPhotoEnabled] = useState(cached.photoEnabled || false);
  const [modelEvaluation, setModelEvaluation] = useState(cached.modelEvaluation || null);
  const activeRequest = useRef(null);
  const importVersion = useRef(0);
  const fileInput = useRef(null);
  const editVersion = useRef(0);
  const receivedHostData = useRef(false);
  const pendingHostRequest = useRef(null);
  useEffect(() => {
    if (!host) return;
    return host.subscribe((payload) => {
      const pending = pendingHostRequest.current;
      if (receivedHostData.current && (!pending || pending.id !== payload.request_id)) return;
      if ((pending && pending.version !== editVersion.current) || (!receivedHostData.current && editVersion.current > 0)) { setStatus('ChatGPT returned an update. Your newer edits are preserved; use the new editor card in the conversation.'); return; }
      const sourceText = typeof payload.resume_text === 'string' ? payload.resume_text : '';
      const jobText = typeof payload.jd_text === 'string' ? payload.jd_text : '';
      const generated = payload.resume ? normalizeResume(payload.resume, sourceText, jobText) : null;
      if (payload.resume && !matchesSchema(generated, resumeSchema)) { setError('ChatGPT returned an incomplete resume. Ask it to call present_resume with every required field.'); return; }
      receivedHostData.current = true;
      pendingHostRequest.current = null;
      setBusy(false); setError('');
      setSource(sourceText); setJob(jobText); setMode(payload.format === 'german' ? 'german' : 'international');
      if (payload.resume) {
        setResume(generated); setHasResume(true); setAnalyzedSource(sourceText); setAnalyzedJob(jobText); setEdited(false); setModelEvaluation(null);
        setStatus('Resume received from ChatGPT. Review and edit any field before exporting.');
      }
    });
  }, [host]);
  useEffect(() => {
    if (host) return;
    try {
      if (source) localStorage.setItem(cacheKeys[0], source); else localStorage.removeItem(cacheKeys[0]);
      if (job) localStorage.setItem(cacheKeys[1], job); else localStorage.removeItem(cacheKeys[1]);
      if (hasResume || mode !== 'international' || photoEnabled || photo) localStorage.setItem(cacheKeys[2], JSON.stringify({ resume, analyzedSource, analyzedJob, edited, mode, photo, photoEnabled, modelEvaluation })); else localStorage.removeItem(cacheKeys[2]);
    } catch { setError('Browser storage is unavailable. Export your work to keep it.'); }
  }, [host, source, job, resume, hasResume, analyzedSource, analyzedJob, edited, mode, photo, photoEnabled, modelEvaluation]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  function updateResume(change) {
    editVersion.current += 1;
    setResume((previous) => { const next = structuredClone(previous); change(next); return next; });
    setHasResume(true); setEdited(true);
  }
  function saveField(path, value) {
    updateResume((next) => { const parent = path.slice(0, -1).reduce((entry, key) => entry[key], next); parent[path[path.length - 1]] = value; });
  }
  function field(path, value, label, className = '', as = 'span') {
    return <Editable value={value} label={label} className={className} as={as} onSave={(value) => saveField(path, value)} />;
  }
  function resetAll() {
    editVersion.current += 1; pendingHostRequest.current = null; receivedHostData.current = true;
    activeRequest.current?.abort(); activeRequest.current = null; importVersion.current += 1;
    setSource(''); setJob(''); setResume(emptyResume()); setHasResume(false); setAnalyzedSource(''); setAnalyzedJob('');
    setEdited(false); setBusy(false); setImporting(false); setModel('llama3.2'); setPaper('A4'); setSkillTab('missing'); setInputTab('resume'); setSkillDestination('skills');
    setMode('international'); setPhoto(''); setPhotoEnabled(false); setModelEvaluation(null); setActiveCategory('monitoring_tools');
    setError(''); setStatus('Workspace and local cache cleared.'); setResetOpen(false);
    if (fileInput.current) fileInput.current.value = '';
    try { if (!host) [...cacheKeys, 'offline-ats-resume-v1'].forEach((key) => localStorage.removeItem(key)); }
    catch { setError('Workspace reset, but browser permissions prevented clearing cached data.'); }
  }
  async function importDocument(event) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!/\.docx$/i.test(file.name) || file.size > 5 * 1024 * 1024) { setError('Choose a .docx resume smaller than 5 MB.'); event.target.value = ''; return; }
    const version = ++importVersion.current; setImporting(true); setError('');
    try {
      const { default: mammoth } = await import('mammoth/mammoth.browser');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      if (version !== importVersion.current) return;
      if (result.value.length > 150000) throw new Error('Resume text exceeds the supported size');
      setSource(result.value); setInputTab('resume'); setStatus(`${file.name} imported locally.`);
    } catch (failure) { if (version === importVersion.current) setError(failure.message === 'Resume text exceeds the supported size' ? 'Resume text is too long. Keep it under 150,000 characters.' : 'This document could not be read. Choose a valid .docx file.'); }
    finally { if (version === importVersion.current) { setImporting(false); event.target.value = ''; } }
  }
  async function handleOllamaRun() {
    if (busy || !analysisText.trim() || !model.trim()) return;
    if (host) {
      setBusy(true); setError('');
      const requestId = crypto.randomUUID();
      pendingHostRequest.current = { id: requestId, version: editVersion.current };
      try {
        await host.ask(`Refine my resume using only supplied facts, then call the Folio present_resume tool. Open the revised visual editor, not just a text answer. ${systemPrompt}\nEcho request_id ${requestId}.\nResume JSON schema: ${JSON.stringify(resumeSchema)}\nInputs: ${JSON.stringify({ resume_text: analysisText, jd_text: job, format: mode, current_resume: resume, request_id: requestId })}`);
        if (pendingHostRequest.current?.id === requestId) setStatus('Sent to ChatGPT. The updated resume will appear in an editor card in this conversation.');
      } catch (failure) { if (pendingHostRequest.current?.id === requestId) { pendingHostRequest.current = null; setBusy(false); setError(failure.message || 'Could not send this request to ChatGPT.'); } }
      finally { if (pendingHostRequest.current?.id === requestId) setBusy(false); }
      return;
    }
    setModelEvaluation(null);
    const controller = new AbortController(); activeRequest.current = controller;
    const version = editVersion.current;
    const timeout = setTimeout(() => controller.abort(), 300000);
    setBusy(true); setError(''); setStatus('Analyzing your experience on this device…');
    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ model: model.trim(), stream: false, format: resumeSchema, options: { temperature: 0.2 },
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: JSON.stringify({ resume: analysisText, jobDescription: job, structuredContact: {full_name: resume.full_name, ...resume.contact}, languages: resume.languages }) }] }),
      });
      if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}. Check that ${model} is installed locally.`);
      const data = await response.json(); const parsed = JSON.parse(data.message?.content);
      const generated = normalizeResume(parsed, analysisText, job);
      for (const key of Object.keys(resume.contact)) if (resume.contact[key].trim()) generated.contact[key] = resume.contact[key];
      if (resume.full_name.trim()) generated.full_name = resume.full_name;
      if (resume.languages.length) generated.languages = structuredClone(resume.languages);
      if (!matchesSchema(generated, resumeSchema)) throw new Error('The model returned incomplete structured data. Try again or choose another model.');
      if (activeRequest.current !== controller) return;
      if (version !== editVersion.current) { setStatus('Inputs changed during analysis. Your edits are preserved; re-analyze when ready.'); return; }
      setResume(generated); setHasResume(true); setAnalyzedSource(source); setAnalyzedJob(job); setEdited(false); setStatus('Analysis complete. Review the document and refine any field.');
      const rawScore = parsed.ats_diagnostics?.match_score ?? parsed.ats_diagnostics?.ats_score ?? parsed.match_score ?? parsed.ats_score;
      const modelScore = typeof rawScore === 'string' ? Number(rawScore.replace(/%$/, '')) : rawScore;
      setModelEvaluation(typeof modelScore === 'number' && Number.isFinite(modelScore) && modelScore > 0 && modelScore <= 100 ? { score: Math.round(modelScore), text: resumeContentText(generated), job } : null);
    } catch (failure) {
      if (activeRequest.current !== controller) return;
      setModelEvaluation(null);
      setStatus(''); setError(controller.signal.aborted ? 'Analysis timed out. Try a shorter input or another model.' : failure instanceof TypeError ? 'Cannot connect to Ollama. Check port 11434 and browser CORS configuration.' : failure.message);
    } finally { clearTimeout(timeout); if (activeRequest.current === controller) { activeRequest.current = null; setBusy(false); } }
  }
  async function downloadWord() {
    setExporting(true); setError('');
    try { await exportWord(resume, paper, mode, photoEnabled ? photo : '', host ? host.download : downloadBlob); setStatus('Word document exported.'); }
    catch { setError('Word export failed. Please try again, or use Print / PDF.'); }
    finally { setExporting(false); }
  }
  const documentText = resumeContentText(resume);
  const analysisText = hasResume && (source === analyzedSource || !source.trim()) ? documentText : [source, documentText].filter(Boolean).join('\n');
  const baseline = localDiagnostics(analysisText, job);
  const modelIsCurrent = Number.isInteger(modelEvaluation?.score) && modelEvaluation.score >= 0 && modelEvaluation.score <= 100 && modelEvaluation?.text === documentText && modelEvaluation?.job === job && source === analyzedSource;
  const diagnostics = { ...baseline, match_score: modelIsCurrent ? modelEvaluation.score : baseline.match_score, recruiter_notes: resume.ats_diagnostics.recruiter_notes, assessment_source: modelIsCurrent ? 'model' : baseline.assessment_source };
  const hasAnalysis = Boolean(analysisText.trim()) && Boolean(job.trim());
  const canScore = hasAnalysis && Boolean(job.trim()) && diagnostics.assessment_source !== 'unavailable';
  const stale = hasAnalysis && (edited || source !== analyzedSource || job !== analyzedJob);
  const score = diagnostics.match_score;
  const grade = score >= 85 ? ['emerald', 'Exceptional Match'] : score >= 65 ? ['amber', 'Good Alignment'] : ['rose', 'High Risk Gaps'];
  const softPattern = /leadership|communication|collaborat|mentor|stakeholder|teamwork|problem.solv|adaptab|people management|team management|project management|negotiat|decision.mak|ownership|strategic/i;
  const leadership = [...diagnostics.matched_skills, ...diagnostics.missing_skills].filter((skill) => softPattern.test(skill));
  const missing = diagnostics.missing_skills.filter((skill) => !softPattern.test(skill));
  const allSkills = Object.values(resume.skills_categorized).flat();
  const measurableBullets = [...resume.experience.flatMap((role) => role.bullets), ...resume.projects.flatMap((project) => project.bullets)].filter((bullet) => /\d/.test(bullet)).length;
  const readiness = [
    [Boolean(safeLink(resume.contact.linkedin) && safeLink(resume.contact.portfolio)), 'Clickable LinkedIn & Portfolio links'],
    [Boolean(resume.contact.location.trim()), 'Current location specified'],
    [measurableBullets >= 3, `Measurable achievements (${measurableBullets}/3 bullets)`],
    [resume.languages.length > 0 && resume.languages.every((language) => language.name.trim() && /^[ABC][12]$/.test(language.cefr)), 'Languages completed with CEFR levels'],
  ];
  const feedback = [...diagnostics.recruiter_notes];
  resume.experience.forEach((role, roleIndex) => role.bullets.forEach((bullet, bulletIndex) => {
    if (bullet.trim() && !/\d/.test(bullet) && feedback.length < 6) feedback.push(`${role.role_title || `Role ${roleIndex + 1}`} · Bullet ${bulletIndex + 1}: quantify the impact with a verified metric, scope or outcome.`);
  }));
  function skillAdded(skill) {
    return allSkills.some((entry) => entry.toLowerCase() === skill.toLowerCase()) || resume.experience.some((role) => role.bullets.some((bullet) => bullet.toLowerCase().includes(skill.toLowerCase())));
  }
  function addSkill(skill) {
    if (skillAdded(skill)) return;
    updateResume((next) => {
      if (skillDestination.startsWith('role:') && next.experience[Number(skillDestination.split(':')[1])]) next.experience[Number(skillDestination.split(':')[1])].bullets.push(skill);
      else next.skills_categorized[activeCategory].push(skill);
    });
    setStatus(`${skill} added. Review and describe your actual experience before exporting.`);
  }
  function moveRole(index, direction) {
    updateResume((next) => { const destination = index + direction; [next.experience[index], next.experience[destination]] = [next.experience[destination], next.experience[index]]; });
  }
  async function uploadPhoto(event) {
    const file = event.target.files?.[0]; if (!file) return;
    const version = importVersion.current;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1000000) { setError('Choose a JPEG, PNG or WebP photo smaller than 1 MB.'); return; }
    try {
      const image = await createImageBitmap(file);
      const canvas = document.createElement('canvas'); canvas.width = 312; canvas.height = 408;
      const context = canvas.getContext('2d');
      if (!context) { image.close(); throw new Error('Image conversion unavailable'); }
      const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, (canvas.width - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale);
      image.close();
      const value = canvas.toDataURL('image/jpeg', 0.9);
      if (version === importVersion.current) { setPhoto(value); setPhotoEnabled(true); }
    } catch { setError('Could not read this photo. Please choose another image.'); }
    event.target.value = '';
  }
  async function exportText() {
    const value = resumeToText(resume, mode);
    try { await (host ? host.download : downloadBlob)(new Blob([value], { type: 'text/plain;charset=utf-8' }), 'Resume.txt'); }
    catch (failure) { setError(failure.message || 'Text download failed.'); return; }
    try { await navigator.clipboard.writeText(value); setStatus('Clean text downloaded and copied to clipboard.'); }
    catch { setStatus('Clean text downloaded. Clipboard access was unavailable; copy from the text file.'); }
  }
  async function printResume() {
    if (!host) { window.print(); return; }
    setExporting(true); setError('');
    try {
      const { createResumePdf } = await import('./resume-pdf.js');
      const blob = await createResumePdf(resume, { mode, paper, photo: photoEnabled ? photo : '', formatPeriod: germanPeriod, resolveLink: safeLink });
      await host.download(blob, 'Resume.pdf'); setStatus('Searchable PDF exported.');
    } catch (failure) { setError(failure.message || 'PDF export failed. Please try Word export.'); }
    finally { setExporting(false); }
  }

  return <div className={`app-shell ${host ? 'chatgpt-embedded' : ''}`}>
    <style>{`@media print { @page international { size: ${paper}; margin: 0.65in; } }`}</style>
    <header className="topbar no-print">
      <a className="brand" href="#"><span className="brand-mark"><Layers3 size={21} /></span>folio<span className="brand-period">.</span><span className="workspace-badge">{host ? 'CHATGPT STUDIO' : 'LOCAL STUDIO'}</span></a>
      <div className="header-actions">
        <label className="mode-select"><span className="sr-only">Resume format</span><select aria-label="Resume format" value={mode} onChange={(event) => { setMode(event.target.value); if (event.target.value === 'german') setPaper('A4'); }}><option value="international">International ATS (Single Column)</option><option value="german">German Lebenslauf (Structured Standard)</option></select></label>
        {host ? <><span className="model-control"><Sparkles size={13} /> Powered by ChatGPT</span><button className="btn secondary" onClick={() => host.expand().catch(() => setError('Fullscreen is unavailable in this ChatGPT host.'))}>Expand editor</button></> : <label className="model-control"><span className="status-dot" /><span className="sr-only">Ollama model</span><input aria-label="Ollama model" list="local-models" value={model} onChange={(event) => setModel(event.target.value)} disabled={busy} /><ChevronDown size={13} /><datalist id="local-models"><option value="llama3.2" /><option value="qwen3:4b" /></datalist></label>}
        <button className="btn ghost" onClick={() => setResetOpen(true)}><RotateCcw size={15} /> Reset / Clear All</button>
        <button className="btn primary" onClick={handleOllamaRun} disabled={busy || importing || !analysisText.trim() || !model.trim()}>{busy ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}{busy ? 'Analyzing…' : 'Re-Analyze Match'}</button>
      </div>
    </header>
    <div className="header-metrics no-print"><span><FileText size={12} /> Active resume <Metrics value={analysisText} /></span><span><Target size={12} /> Job description <Metrics value={job} /></span><span className="token-note">Token counts are estimates</span></div>
    <main className="workspace">
      <div className="workspace-intro no-print"><div><div className="eyebrow">YOUR NEXT CHAPTER</div><h1>Make your experience <em>stand out.</em></h1><p>Shape your story. Close the gaps. Move forward with confidence.</p></div><span className="privacy-note"><LockKeyhole size={14} /> {host ? 'Your editor, inside ChatGPT.' : 'Private by design. Powered locally.'}</span></div>
      <div className="workspace-grid">
        <aside className="input-panel panel no-print">
          <div className="panel-heading"><span className="step-number">01</span><h2>The foundation</h2><FileText size={16} className="muted" /></div><p className="panel-description">Great resumes start with your story.</p>
          <div className="input-tabs" role="tablist" aria-label="Source documents">{[['resume', 'Your resume', source], ['job', 'Job description', job]].map(([key, label, value]) => <button key={key} role="tab" aria-selected={inputTab === key} aria-controls="source-editor" id={`${key}-tab`} onClick={() => setInputTab(key)}>{label}{value && <span className="tiny-dot" />}</button>)}</div>
          <div id="source-editor" role="tabpanel" aria-labelledby={`${inputTab}-tab`}>
            {inputTab === 'resume' && <>
              <details className="master-contact" open><summary>Master Resume · Personal details</summary><label>Full name<input value={resume.full_name} onChange={(event) => saveField(['full_name'], event.target.value)} /></label>{Object.entries(contactLabels).map(([key, label]) => <label key={key}>{label}<input type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} placeholder={key === 'location' ? 'Berlin, Germany' : key === 'work_authorization' ? 'Your confirmed status (optional)' : ['linkedin', 'github', 'portfolio'].includes(key) ? 'https://…' : ''} value={resume.contact[key]} onChange={(event) => saveField(['contact', key], event.target.value)} /></label>)}</details>
              {mode === 'german' && <div className="photo-settings"><label><input type="checkbox" checked={photoEnabled} onChange={(event) => setPhotoEnabled(event.target.checked)} /> Bewerbungsfoto (optional)</label>{photoEnabled && <><input aria-label="Upload application photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} /><small>JPEG, PNG or WebP · under 1 MB · stored only here</small>{photo && <button className="btn ghost" onClick={() => setPhoto('')}>Remove photo</button>}</>}</div>}
              <label className="upload-zone"><Upload size={20} /><strong>{importing ? 'Reading your document…' : 'Upload your resume'}</strong><span>Word document (.docx) · stays on your device</span><input ref={fileInput} type="file" accept=".docx" onChange={importDocument} disabled={importing || busy} /></label>
            </>}
            <div className="editor-label"><label htmlFor="source-text">{inputTab === 'resume' ? 'OR PASTE YOUR EXPERIENCE' : 'PASTE THE OPPORTUNITY'}</label><span>{inputTab === 'job' ? 'Optional' : 'Required'}</span></div>
            <textarea id="source-text" maxLength={inputTab === 'resume' ? 150000 : 100000} value={inputTab === 'resume' ? source : job} onChange={(event) => { editVersion.current += 1; if (inputTab === 'resume') setSource(event.target.value); else setJob(event.target.value); }} placeholder={inputTab === 'resume' ? 'Your name, experience, achievements, skills and education…' : 'Paste a job description to uncover the skills and experience that matter most…'} />
            <div className="editor-metrics"><Metrics value={inputTab === 'resume' ? source : job} /><CheckCheck size={13} /></div>
          </div>
          <div className="input-summary"><div><span>Resume</span><Metrics value={source} /></div><div><span>Job description</span><Metrics value={job} /></div></div>
          <button className="btn primary analyze-button" onClick={handleOllamaRun} disabled={busy || importing || !analysisText.trim() || !model.trim()}>{busy ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}{busy ? 'Crafting your resume…' : hasResume ? 'Refine my resume' : 'Build my resume'}{!busy && <ArrowUpRight size={16} />}</button>
          <div className="local-notice"><ShieldCheck size={16} /><p>{host ? 'Build and Re-Analyze send your resume and job description to this ChatGPT conversation. Edits stay in this view until you send or export them.' : 'Your documents stay here. No accounts, no uploads to the cloud.'}</p></div>
        </aside>
        <section className="document-workspace" aria-label="Resume preview">
          <div className="document-toolbar no-print"><div className="document-title"><span className="step-number">02</span><h2>Your resume</h2><span className="live-badge">LIVE EDITOR</span></div><label className="paper-select"><span className="sr-only">Paper size</span><select aria-label="Paper size" value={mode === 'german' ? 'A4' : paper} disabled={mode === 'german'} title={mode === 'german' ? 'German print layout uses A4' : 'Paper size'} onChange={(event) => setPaper(event.target.value)}><option>A4</option><option>Letter</option></select></label></div>
          {mode === 'german' && <p className="german-guidance no-print">German standard requires MM/YYYY format to avoid gap queries. Dates: MM/YYYY – MM/YYYY or MM/YYYY – Heute. Complete missing months from your records; year-only dates are never guessed. Photo is optional.</p>}
          <div className="document-canvas"><article id="printable-resume" className={`resume-sheet ${paper === 'Letter' ? 'letter' : ''} ${mode === 'german' ? 'lebenslauf' : ''}`} aria-label="Editable resume document">
            <header className={`resume-header ${mode === 'german' && photoEnabled ? 'with-photo' : ''}`}>{field(['full_name'], resume.full_name, 'Your full name', 'resume-name', 'h1')}{field(['target_title'], resume.target_title, 'Your professional title', 'resume-target', 'p')}
              <div className="contact-line">{['email', 'phone', 'location', 'work_authorization'].filter((key) => resume.contact[key]).map((key) => <span key={key}>{key === 'email' || key === 'phone' ? <a href={key === 'email' ? `mailto:${resume.contact[key]}` : `tel:${resume.contact[key].replace(/[^+\d]/g, '')}`}>{resume.contact[key]}</a> : resume.contact[key]}</span>)}{['linkedin', 'github', 'portfolio'].filter((key) => safeLink(resume.contact[key])).map((key) => <span key={key}><a href={safeLink(resume.contact[key])} target="_blank" rel="noreferrer">{contactLabels[key]}<ArrowUpRight size={9} /></a></span>)}</div>
              <details className="preview-contact-edit no-print"><summary>Edit contact & links</summary>{Object.entries(contactLabels).map(([key, label]) => <label key={key}>{label}{field(['contact', key], resume.contact[key], label)}</label>)}</details>
              {mode === 'german' && photoEnabled && <div className="application-photo">{photo ? <img src={photo} alt="Application portrait" /> : <span className="no-print">Bewerbungsfoto<br />Upload in Master Resume</span>}</div>}
            </header>
            <section className="resume-section"><div className="section-heading"><h2>{mode === 'german' ? 'Kurzprofil / Professional Summary' : 'Professional Summary'}</h2><span className="edit-hint no-print">Click to edit</span></div>{field(['summary'], resume.summary, 'A concise overview of your experience, strengths and professional impact.', '', 'p')}</section>
            <section className="resume-section"><div className="section-heading"><h2>Technical Skills</h2><span className="edit-hint no-print">Click to edit</span></div>{skillGroups.map(([key, label]) => <p className="skill-row" key={key}><strong>{label}: </strong><Editable label="Add skills, separated by commas" value={resume.skills_categorized[key].join(', ')} onSave={(value) => saveField(['skills_categorized', key], value.split(',').map((skill) => skill.trim()).filter(Boolean))} /></p>)}</section>
            <section className="resume-section"><div className="section-heading"><h2>{mode === 'german' ? 'Berufserfahrung / Experience' : 'Professional Experience'}</h2><button className="section-action no-print" onClick={() => updateResume((next) => next.experience.push({ role_title: '', company: '', period: '', location: '', bullets: [''] }))}><Plus size={12} /> Add role</button></div>
              {resume.experience.length === 0 && <div className="document-empty no-print"><span>Your career, thoughtfully presented.</span><p>Build your resume to bring your experience into focus, or add a role to start writing.</p></div>}
              {resume.experience.map((role, index) => <section className="experience-block" key={index}>
                <div className="block-tools no-print"><button aria-label={`Move role ${index + 1} up`} disabled={index === 0} onClick={() => moveRole(index, -1)}><ArrowUp size={13} /></button><button aria-label={`Move role ${index + 1} down`} disabled={index === resume.experience.length - 1} onClick={() => moveRole(index, 1)}><ArrowDown size={13} /></button><button aria-label={`Delete role ${index + 1}`} onClick={() => updateResume((next) => { next.experience.splice(index, 1); })}><Trash2 size={13} /></button></div>
                <div className="role-line">{field(['experience', index, 'role_title'], role.role_title, 'Role title', 'role-title', 'h3')}{field(['experience', index, 'period'], mode === 'german' ? germanPeriod(role.period) : role.period, mode === 'german' ? 'MM/YYYY – MM/YYYY' : 'Dates', 'role-meta period-field')}</div>
                <div className="role-line company-line">{field(['experience', index, 'company'], role.company, 'Company')}{field(['experience', index, 'location'], role.location, 'Location', 'role-meta')}</div>
                <ul className="resume-bullets">{role.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{field(['experience', index, 'bullets', bulletIndex], bullet, 'Describe your action, scope and verified impact')}<button className="bullet-delete no-print" aria-label={`Delete role ${index + 1} bullet ${bulletIndex + 1}`} onClick={() => updateResume((next) => { next.experience[index].bullets.splice(bulletIndex, 1); })}><X size={11} /></button></li>)}</ul>
                <button className="section-action add-bullet no-print" onClick={() => updateResume((next) => next.experience[index].bullets.push(''))}><Plus size={12} /> Add bullet</button>
              </section>)}
            </section>
            <section className={`resume-section ${resume.projects.length ? '' : 'no-print'}`}><div className="section-heading"><h2>Academic Projects / Research</h2><button className="section-action no-print" onClick={() => updateResume((next) => next.projects.push({ name: '', tools: '', bullets: [''] }))}><Plus size={12} /> Add project</button></div>
              {resume.projects.length === 0 && <p className="education-placeholder no-print">Applied projects, academic research and independent work.</p>}
              {resume.projects.map((project, index) => <section className="experience-block" key={index}>
                <div className="block-tools no-print"><button aria-label={`Delete project ${index + 1}`} onClick={() => updateResume((next) => { next.projects.splice(index, 1); })}><Trash2 size={13} /></button></div>
                {field(['projects', index, 'name'], project.name, 'Project or research name', 'role-title', 'h3')}
                {field(['projects', index, 'tools'], project.tools, 'Tools and research methods', 'education-details', 'p')}
                <ul className="resume-bullets">{project.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{field(['projects', index, 'bullets', bulletIndex], bullet, 'Describe the project, methods and supported outcomes')}<button className="bullet-delete no-print" aria-label={`Delete project ${index + 1} bullet ${bulletIndex + 1}`} onClick={() => updateResume((next) => { next.projects[index].bullets.splice(bulletIndex, 1); })}><X size={11} /></button></li>)}</ul>
                <button className="section-action add-bullet no-print" onClick={() => updateResume((next) => next.projects[index].bullets.push(''))}><Plus size={12} /> Add project bullet</button>
              </section>)}
            </section>
            <section className="resume-section"><div className="section-heading"><h2>{mode === 'german' ? 'Ausbildung / Education' : 'Education'}</h2><button className="section-action no-print" onClick={() => updateResume((next) => next.education.push({ degree: '', institution: '', dates: '', details: '' }))}><Plus size={12} /> Add education</button></div>
              {resume.education.length === 0 && <p className="education-placeholder no-print">Your education and continued learning.</p>}
              {resume.education.map((entry, index) => <section className="education-block" key={index}><div className="block-tools no-print"><button aria-label={`Delete education ${index + 1}`} onClick={() => updateResume((next) => { next.education.splice(index, 1); })}><Trash2 size={13} /></button></div><div className="role-line">{field(['education', index, 'degree'], entry.degree, 'Degree or qualification', 'role-title', 'h3')}{field(['education', index, 'dates'], mode === 'german' ? germanPeriod(entry.dates) : entry.dates, mode === 'german' ? 'MM/YYYY – MM/YYYY' : 'Dates or status', 'role-meta period-field')}</div>{field(['education', index, 'institution'], entry.institution, 'Institution', '', 'p')}{field(['education', index, 'details'], entry.details, 'Honors, coursework or additional details', 'education-details', 'p')}</section>)}
            </section>
            <section className={`resume-section ${mode !== 'german' && !resume.languages.length ? 'no-print' : ''}`}><div className="section-heading"><h2>{mode === 'german' ? 'Sprachkenntnisse / Languages' : 'Languages'}</h2><button className="section-action no-print" onClick={() => updateResume((next) => next.languages.push({name: '', proficiency: '', cefr: ''}))}><Plus size={12} /> Add language</button></div>
              {resume.languages.map((language, index) => <div className="language-row" key={index}>{field(['languages', index, 'name'], language.name, 'Language')}{field(['languages', index, 'proficiency'], language.proficiency, 'Proficiency')}<label className="no-print"><span className="sr-only">CEFR level for language {index + 1}</span><select aria-label={`CEFR level for language ${index + 1}`} value={language.cefr} onChange={(event) => saveField(['languages', index, 'cefr'], event.target.value)}><option value="">CEFR level</option>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => <option key={level}>{level}</option>)}</select></label><span className="print-only cefr-badge">{language.cefr}</span><button className="no-print language-delete" aria-label={`Delete language ${index + 1}`} onClick={() => updateResume((next) => { next.languages.splice(index, 1); })}><X size={12} /></button></div>)}
              {!resume.languages.length && <p className="education-placeholder no-print">Add languages and your confirmed CEFR levels.</p>}
            </section>
          </article></div>
          <div className="document-footer no-print"><span><CheckCheck size={14} /> {host ? 'Edits kept in this view · export to retain' : 'Saved locally · live analysis'}</span><span>{mode === 'german' ? 'Structured Lebenslauf' : 'Single-column ATS format'}</span></div>
          <div className="export-bar no-print"><span><Download size={16} /><strong>Ready for your next opportunity.</strong></span><div><button className="btn secondary" onClick={exportText} disabled={!hasResume || exporting}>Export Clean Text (.txt)</button><button className="btn secondary" onClick={downloadWord} disabled={!hasResume || exporting}>{exporting ? <LoaderCircle size={14} className="spin" /> : <FileText size={14} />} Download Word (.docx)</button><button className="btn primary" onClick={printResume} disabled={!hasResume || exporting}><Printer size={14} /> {host ? 'Download PDF' : 'Print / Save PDF'}</button></div></div>
        </section>
        <aside className="diagnostics-panel no-print">
          <div className="panel diagnostic-card"><div className="panel-heading"><span className="step-number">03</span><h2>The match intelligence</h2><Target size={16} className="muted" /></div>
            <div className={`match-gauge ${canScore ? grade[0] : 'neutral'}`} role="progressbar" aria-label="Estimated ATS keyword match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={canScore ? score : 0}>
              <svg viewBox="0 0 160 160" aria-hidden="true"><circle className="gauge-track" cx="80" cy="80" r="68" /><circle className="gauge-value" cx="80" cy="80" r="68" strokeDasharray="427.26" strokeDashoffset={427.26 * (1 - (canScore ? score : 0) / 100)} /></svg><div><strong>{canScore ? score : '—'}<small>{canScore ? '%' : ''}</small></strong><span>ATS MATCH</span></div>
            </div>
            <div className={`match-verdict ${canScore ? grade[0] : 'neutral'}`}>{!hasAnalysis ? 'Your potential, uncovered.' : !job.trim() ? 'Add a job to compare' : !canScore ? 'No recognizable hard skills found' : grade[1]}</div>
            <p className="gauge-caption">{!hasAnalysis ? 'Add your resume and a job description to see where you stand.' : `${diagnostics.assessment_source === 'model' ? 'Ollama evaluation for this revision. ' : 'Live keyword overlap. '}Estimated alignment, not a validated ATS rating or hiring prediction.`}</p>
            {stale && <p className="stale-notice"><RefreshCw size={12} /> Changes made. Re-analyze to refresh insights.</p>}
            <div className="diagnostic-rule" /><div className="mini-heading"><h3>{skillTab === 'missing' ? 'Keywords Missing in Resume' : 'Skill intelligence'}</h3><Target size={14} /></div>
            <div className="skill-tabs" role="tablist" aria-label="Skill diagnostics">{[['matched', 'Matched', diagnostics.matched_skills.length], ['missing', 'Gaps', missing.length], ['leadership', 'Leadership', leadership.length]].map(([key, label, count]) => <button key={key} id={`skill-${key}`} role="tab" aria-selected={skillTab === key} aria-controls="skill-matrix" onClick={() => setSkillTab(key)}>{label}<span>{count}</span></button>)}</div>
            <div id="skill-matrix" className="skill-matrix" role="tabpanel" aria-labelledby={`skill-${skillTab}`}>
              {skillTab === 'matched' && (diagnostics.matched_skills.length ? diagnostics.matched_skills.map((skill, index) => <span className="skill-chip matched" key={index}><Check size={12} />{skill}</span>) : <p className="matrix-empty">Your shared keywords will appear here after analysis.</p>)}
              {skillTab === 'missing' && <>{missing.length ? missing.map((skill, index) => <button className={`skill-chip gap ${skillAdded(skill) ? 'added' : ''}`} key={index} disabled={skillAdded(skill)} onClick={() => addSkill(skill)} title={`Add ${skill} to ${skillDestination === 'skills' ? 'skills' : 'selected role'}`}>{skillAdded(skill) ? <Check size={12} /> : <Plus size={12} />}{skill}</button>) : <p className="matrix-empty">{hasAnalysis ? 'No hard skill gaps identified.' : 'Find the requirements that need your attention.'}</p>}
                <label className="destination-label">Add selected gap to<select aria-label="Missing skill destination" value={skillDestination} onChange={(event) => setSkillDestination(event.target.value)}><option value="skills">Active technical skills category</option>{resume.experience.map((role, index) => <option key={index} value={`role:${index}`}>{role.role_title || `Role ${index + 1}`} · new bullet</option>)}</select></label>{skillDestination === 'skills' && <label className="destination-label">Active category<select aria-label="Active technical skills category" value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)}>{skillGroups.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}<p className="matrix-note">Add only skills you can support with experience. Refine added bullets before export.</p></>}
              {skillTab === 'leadership' && (leadership.length ? [...new Set(leadership)].map((skill) => <span className={`skill-chip ${diagnostics.matched_skills.includes(skill) ? 'matched' : 'gap'}`} key={skill}>{diagnostics.matched_skills.includes(skill) ? <Check size={12} /> : <Plus size={12} />}{skill}</span>) : <p className="matrix-empty">Leadership and collaboration competencies will appear here when identified.</p>)}
            </div>
            <div className="diagnostic-rule" /><div className="mini-heading"><h3>Keyword Density</h3><Target size={14} /></div><p className="matrix-note">Occurrences in the active resume · {diagnostics.matched_skills.length}/{baseline.keyword_density.length} JD keywords matched · baseline {baseline.match_score}%</p>
            <div className="density-list">{baseline.keyword_density.map(({keyword, count}) => <div key={keyword}><span>{keyword}</span><strong>{count}×</strong><meter min="0" max={Math.max(5, count)} value={count} aria-label={`${keyword} occurrences`} /></div>)}{!baseline.keyword_density.length && <p className="matrix-empty">Paste a job description to see keyword frequency.</p>}</div>
          </div>
          <div className="panel readiness-card"><div className="mini-heading"><ShieldCheck size={16} /><h3>Recruiter Readiness Checklist</h3></div><ul>{readiness.map(([ready, label]) => <li key={label} className={ready ? 'ready' : ''}>{ready ? <Check size={14} /> : <span className="check-pending" />}<span>{label}</span></li>)}</ul></div>
          <div className="panel recruiter-card"><div className="mini-heading"><span className="feedback-icon"><Sparkles size={15} /></span><h3>A recruiter's perspective</h3></div><p className="feedback-intro">Small refinements. Stronger first impressions.</p>{feedback.length ? <ol className="feedback-list">{feedback.slice(0, 6).map((note, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span><p>{note}</p></li>)}</ol> : <div className="feedback-empty"><Target size={23} /><p>Your personalized recommendations will appear after analysis.</p></div>}</div>
          <div className="quiet-note"><ShieldCheck size={17} /><div><strong>Your career. Your data.</strong><p>{host ? 'ChatGPT writes; the editor handles layout and local keyword checks. The connector does not store your documents.' : 'Runs on Ollama, right on your machine. You stay in control.'}</p></div></div>
        </aside>
      </div>
      <div className="status-area no-print" aria-live="polite">{busy && <LoaderCircle size={14} className="spin" />}{status}</div>
      {error && <div role="alert" className="error-banner no-print"><p>{error}</p><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
      <footer className="app-footer no-print"><span>FOLIO STUDIO <span> / </span> YOUR EXPERIENCE, WITH INTENTION.</span><span><LockKeyhole size={11} /> {host ? 'Made with ChatGPT.' : 'Crafted locally. Always.'}</span></footer>
    </main>
    {resetOpen && <ResetModal embedded={Boolean(host)} onClose={() => setResetOpen(false)} onConfirm={resetAll} />}
  </div>;
}
