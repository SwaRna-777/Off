import { skillGroups } from './resume-schema.js';

export function buildPdfDefinition(resume, { mode = 'international', paper = 'A4', photo = '', formatPeriod = (value) => value, resolveLink = () => '' } = {}) {
  const german = mode === 'german';
  const heading = (text) => ({ text, style: 'section', headlineLevel: 1 });
  const bullets = (values) => values.length ? [{ ul: values, margin: [0, 5, 0, 0] }] : [];
  const datedBlock = (dates, stack) => german ? { columns: [{ width: 107.72, text: formatPeriod(dates), color: '#64748b', fontSize: 9 }, { width: '*', stack }], columnGap: 14.17, margin: [0, 0, 0, 10] } : { stack: [{ text: dates, alignment: 'right', fontSize: 9, color: '#64748b' }, ...stack], margin: [0, 0, 0, 10] };
  const links = ['linkedin', 'github', 'portfolio'].filter((key) => resolveLink(resume.contact[key])).flatMap((key) => [{ text: key === 'linkedin' ? 'LinkedIn' : key === 'github' ? 'GitHub' : 'Portfolio', link: resolveLink(resume.contact[key]), decoration: 'underline' }, { text: '   ' }]);
  const header = { stack: [
    { text: resume.full_name, fontSize: 23, bold: true },
    { text: resume.target_title, color: '#64748b', margin: [0, 5, 0, 8] },
    { text: [resume.contact.email, resume.contact.phone, resume.contact.location, resume.contact.work_authorization].filter(Boolean).join('  |  '), fontSize: 9 },
    { text: links, fontSize: 9, margin: [0, 5, 0, 0] },
  ], alignment: german ? 'left' : 'center' };
  return {
    pageSize: german ? 'A4' : paper.toUpperCase(),
    pageMargins: german ? [70.87, 70.87, 56.69, 56.69] : [46.8, 46.8, 46.8, 46.8],
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.2, color: '#24343b' },
    styles: { section: { bold: true, fontSize: 11, characterSpacing: 1, margin: [0, 17, 0, 8] } },
    content: [
      german && photo ? { columns: [header, { image: photo, width: 79.37, height: 104.88 }], columnGap: 12 } : header,
      heading(german ? 'KURZPROFIL' : 'PROFESSIONAL SUMMARY'), { text: resume.summary },
      heading(german ? 'TECHNISCHE KENNTNISSE' : 'TECHNICAL SKILLS'),
      ...skillGroups.filter(([key]) => resume.skills_categorized[key].length).map(([key, label]) => ({ text: [{ text: `${label}: `, bold: true }, resume.skills_categorized[key].join(', ')], margin: [0, 0, 0, 4] })),
      heading(german ? 'BERUFSERFAHRUNG' : 'PROFESSIONAL EXPERIENCE'),
      ...resume.experience.map((role) => ({ ...datedBlock(role.period, [{ text: role.role_title, bold: true }, { text: [role.company, role.location].filter(Boolean).join(' · ') }, ...bullets(role.bullets)]), unbreakable: role.bullets.join(' ').split(/\s+/).length < 350 })),
      ...(resume.projects.length ? [heading(german ? 'PROJEKTE / FORSCHUNG' : 'ACADEMIC PROJECTS / RESEARCH'), ...resume.projects.map((project) => ({ stack: [{ text: project.name, bold: true }, { text: project.tools, fontSize: 9, color: '#64748b' }, ...bullets(project.bullets)], margin: [0, 0, 0, 10] }))] : []),
      heading(german ? 'AUSBILDUNG' : 'EDUCATION'),
      ...resume.education.map((entry) => datedBlock(entry.dates, [{ text: entry.degree, bold: true }, { text: entry.institution }, { text: entry.details, fontSize: 9 }])),
      ...(resume.languages.length ? [heading(german ? 'SPRACHKENNTNISSE' : 'LANGUAGES'), ...resume.languages.map((language) => ({ text: `${language.name}: ${[language.proficiency, language.cefr].filter(Boolean).join(' / ')}`, margin: [0, 0, 0, 4] }))] : []),
    ],
  };
}
export async function createResumePdf(resume, options) {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([import('pdfmake/build/pdfmake.min.js'), import('pdfmake/build/vfs_fonts.js')]);
  pdfMake.addVirtualFileSystem(fonts);
  return pdfMake.createPdf(buildPdfDefinition(resume, options)).getBlob();
}
