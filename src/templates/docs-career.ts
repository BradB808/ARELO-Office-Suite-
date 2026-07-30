import type { DocsContent, DocsTemplate } from '../shared/types'

// ---------- small HTML builder (keep every template's markup consistent + valid) ----------

function html(parts: string[]): string {
  return parts.join('')
}

// ---------- 1. Creative resume ----------

function makeResumeCreative(): DocsContent {
  const c = '#4d7c0f'
  const head = 'font-family:Futura'
  const lede = 'font-family:Avenir Next'
  const chip = (t: string) =>
    `<mark data-color="${c}22" style="background-color:${c}22">${t}</mark>`
  return {
    margin: 50,
    html: html([
      `<h1><span style="color:${c}; ${head}; font-size:32px">[Your Name]</span></h1>`,
      `<p><span style="color:${c}; ${lede}"><strong>[Art Director · Brand &amp; Visual Identity]</strong></span></p>`,
      `<p><span style="color:#6b7280">[City, State] &nbsp;·&nbsp; [(555) 123-4567] &nbsp;·&nbsp; [you@email.com] &nbsp;·&nbsp; [yourportfolio.com]</span></p>`,
      `<hr>`,
      `<h3><span style="color:${c}"><strong>PROFILE</strong></span></h3>`,
      `<p><span style="${lede}">[Award-winning] art director with [8] years building brand identities for [industries — e.g. hospitality, fashion, and consumer tech]. Known for turning ambiguous briefs into distinctive visual systems, and for building small design teams that ship fast without losing craft.</span></p>`,
      `<h3><span style="color:${c}"><strong>EXPERIENCE</strong></span></h3>`,
      `<p><strong>[Senior Art Director]</strong> — [Studio Name], [City, State]<br><em>[Month Year] – Present</em></p>`,
      `<ul><li>Led the rebrand for [Client Name], lifting unaided brand recognition by [22%] within [six months] of launch.</li><li>Directed a five-person creative team across [social, web, and packaging] for a roster of [8] active clients.</li><li>Won [Award Name] for the [Campaign Name] campaign, named among [Industry Publication]'s best work of [Year].</li></ul>`,
      `<p><strong>[Art Director]</strong> — [Previous Studio], [City, State]<br><em>[Month Year] – [Month Year]</em></p>`,
      `<ul><li>Designed identity systems for [12] early-stage brands, [3] of which went on to raise [funding round / national distribution].</li><li>Pitched and won [$XXX,000] in new business through concept-driven creative presentations.</li></ul>`,
      `<h3><span style="color:${c}"><strong>SELECTED PROJECTS</strong></span></h3>`,
      `<p><strong>[Project Name]</strong> — [One line on the brief and the result, e.g. "A packaging refresh that grew shelf conversion by 14%."]</p>`,
      `<p><strong>[Project Name]</strong> — [One line on the brief and the result.]</p>`,
      `<h3><span style="color:${c}"><strong>SKILLS</strong></span></h3>`,
      `<table>`,
      `<tr><th><p><strong>Category</strong></p></th><th><p><strong>Highlights</strong></p></th></tr>`,
      `<tr><td><p>Brand &amp; identity</p></td><td><p>${chip('Logo systems')} ${chip('Typography')} ${chip('Art direction')}</p></td></tr>`,
      `<tr><td><p>Tools</p></td><td><p>${chip('Figma')} ${chip('Adobe Creative Suite')} ${chip('After Effects')}</p></td></tr>`,
      `<tr><td><p>Leadership</p></td><td><p>${chip('Team mentoring')} ${chip('Client presentations')} ${chip('Creative reviews')}</p></td></tr>`,
      `</table>`,
      `<h3><span style="color:${c}"><strong>EDUCATION</strong></span></h3>`,
      `<p><strong>[BFA, Graphic Design]</strong> — [University Name], [City, State] · [Year]</p>`,
    ]),
  }
}

// ---------- 2. Executive resume ----------

function makeResumeExecutive(): DocsContent {
  const c = '#7f1d1d'
  const head = 'font-family:Didot'
  const lede = 'font-family:Baskerville'
  return {
    margin: 64,
    html: html([
      `<h1 style="text-align:center"><span style="color:${c}; ${head}; font-size:30px">[Your Name]</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">[Chief Operating Officer] &nbsp;·&nbsp; [City, State] &nbsp;·&nbsp; [(555) 123-4567] &nbsp;·&nbsp; [you@email.com]</span></p>`,
      `<hr>`,
      `<p style="text-align:center"><em><span style="${lede}">[A two-sentence executive summary: the scope you operate at, the industries you've led in, and the outcome you're known for delivering.]</span></em></p>`,
      `<h3><span style="color:${c}"><strong>EXECUTIVE EXPERIENCE</strong></span></h3>`,
      `<p><strong>[Chief Operating Officer]</strong> — [Company Name], [City, State]<br><em>[Month Year] – Present</em></p>`,
      `<ul><li>Scaled operations from [$40M] to [$110M] in annual revenue over [three years], while improving EBITDA margin by [4] points.</li><li>Built and led an executive team of [7] direct reports across [operations, finance, and people], reducing leadership attrition by [30%].</li><li>Directed the integration following the acquisition of [Company Name], delivering [$2.1M] in run-rate synergies ahead of the [12-month] target.</li></ul>`,
      `<p><strong>[Vice President, Operations]</strong> — [Previous Company], [City, State]<br><em>[Month Year] – [Month Year]</em></p>`,
      `<ul><li>Redesigned the supply chain organization, cutting fulfillment costs by [$1.8M] annually.</li><li>Launched [initiative], expanding into [2] new markets within [18 months].</li></ul>`,
      `<h3><span style="color:${c}"><strong>BOARD &amp; ADVISORY</strong></span></h3>`,
      `<ul><li>[Board Member], [Organization Name] — [Year] – Present</li><li>[Advisor], [Company or Nonprofit Name] — [Year] – Present</li></ul>`,
      `<h3><span style="color:${c}"><strong>KEY ACHIEVEMENTS</strong></span></h3>`,
      `<table>`,
      `<tr><th><p><strong>Metric</strong></p></th><th><p><strong>Result</strong></p></th></tr>`,
      `<tr><td><p>Revenue growth</p></td><td><p>[+38% over 3 years]</p></td></tr>`,
      `<tr><td><p>Cost reduction</p></td><td><p>[$4.2M annualized]</p></td></tr>`,
      `<tr><td><p>Team scaled</p></td><td><p>[12 to 65 employees]</p></td></tr>`,
      `</table>`,
      `<h3><span style="color:${c}"><strong>EDUCATION</strong></span></h3>`,
      `<p><strong>[MBA]</strong>, [Business School Name] · [Year]<br><strong>[BA, Economics]</strong>, [University Name] · [Year]</p>`,
    ]),
  }
}

// ---------- 3. Academic CV ----------

function makeCvAcademic(): DocsContent {
  const c = '#44403c'
  const head = 'font-family:Hoefler Text'
  const lede = 'font-family:Georgia'
  return {
    margin: 56,
    html: html([
      `<h1 style="text-align:center"><span style="color:${c}; ${head}; font-size:28px">[Your Name], Ph.D.</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">[Department of Sociology], [University Name] &nbsp;·&nbsp; [you@university.edu] &nbsp;·&nbsp; [City, State]</span></p>`,
      `<hr>`,
      `<h3><span style="color:${c}"><strong>RESEARCH INTERESTS</strong></span></h3>`,
      `<p><span style="${lede}">[Your primary research interests, written as a concise phrase list — e.g., computational social science, network analysis, political behavior, and inequality.]</span></p>`,
      `<h3><span style="color:${c}"><strong>EDUCATION</strong></span></h3>`,
      `<p><strong>Ph.D., [Field]</strong>, [University Name] — [Year]<br>Dissertation: "[Dissertation Title]," advised by [Advisor Name]</p>`,
      `<p><strong>M.A., [Field]</strong>, [University Name] — [Year]</p>`,
      `<p><strong>B.A., [Field]</strong>, [University Name] — [Year]</p>`,
      `<h3><span style="color:${c}"><strong>ACADEMIC APPOINTMENTS</strong></span></h3>`,
      `<p><strong>[Assistant Professor]</strong>, [Department Name], [University Name] — [Year] – Present</p>`,
      `<p><strong>[Postdoctoral Fellow]</strong>, [Institute Name] — [Year] – [Year]</p>`,
      `<h3><span style="color:${c}"><strong>PUBLICATIONS</strong></span></h3>`,
      `<p><strong>Peer-reviewed journal articles</strong></p>`,
      `<ol><li>[Last Name, Initials]. ([Year]). [Article title, in sentence case]. <em>[Journal Name]</em>, [Volume(Issue)], [page range].</li><li>[Last Name, Initials]. ([Year]). [Article title]. <em>[Journal Name]</em>, [Volume(Issue)], [page range].</li></ol>`,
      `<p><strong>Book chapters</strong></p>`,
      `<ul><li>[Last Name, Initials]. ([Year]). [Chapter title]. In [Editor Name] (Ed.), <em>[Book Title]</em> (pp. [range]). [Publisher].</li></ul>`,
      `<h3><span style="color:${c}"><strong>TEACHING EXPERIENCE</strong></span></h3>`,
      `<table>`,
      `<tr><th><p><strong>Course</strong></p></th><th><p><strong>Role</strong></p></th><th><p><strong>Term</strong></p></th></tr>`,
      `<tr><td><p>[Course Name &amp; Number]</p></td><td><p>Instructor of Record</p></td><td><p>[Term Year]</p></td></tr>`,
      `<tr><td><p>[Course Name &amp; Number]</p></td><td><p>Teaching Assistant</p></td><td><p>[Term Year]</p></td></tr>`,
      `</table>`,
      `<h3><span style="color:${c}"><strong>GRANTS &amp; FELLOWSHIPS</strong></span></h3>`,
      `<table>`,
      `<tr><th><p><strong>Award</strong></p></th><th><p><strong>Funder</strong></p></th><th><p><strong>Amount / Year</strong></p></th></tr>`,
      `<tr><td><p>[Fellowship Name]</p></td><td><p>[Funding Body]</p></td><td><p>[$Amount, Year]</p></td></tr>`,
      `<tr><td><p>[Grant Name]</p></td><td><p>[Funding Body]</p></td><td><p>[$Amount, Year]</p></td></tr>`,
      `</table>`,
      `<h3><span style="color:${c}"><strong>CONFERENCE PRESENTATIONS</strong></span></h3>`,
      `<ol><li>[Last Name, Initials]. ([Year, Month]). "[Paper title]." Paper presented at [Conference Name], [City].</li><li>[Last Name, Initials]. ([Year, Month]). "[Paper title]." Paper presented at [Conference Name], [City].</li></ol>`,
      `<h3><span style="color:${c}"><strong>SERVICE &amp; COMMITTEES</strong></span></h3>`,
      `<ul><li>[Role], [Committee or Organization Name] — [Year] – Present</li><li>Peer reviewer, <em>[Journal Name]</em> — [Year] – Present</li></ul>`,
      `<h3><span style="color:${c}"><strong>REFERENCES</strong></span></h3>`,
      `<p>Available upon request.</p>`,
    ]),
  }
}

// ---------- 4. Cover letter — modern ----------

function makeCoverLetterModern(): DocsContent {
  const c = '#4f46e5'
  const head = 'font-family:Gill Sans'
  const lede = 'font-family:Seravek'
  return {
    html: html([
      `<h2><span style="color:${c}; ${head}; font-size:22px">[Your Name]</span></h2>`,
      `<p><span style="color:#6b7280">[Product Marketing Manager] &nbsp;·&nbsp; [you@email.com] &nbsp;·&nbsp; [(555) 123-4567] &nbsp;·&nbsp; [linkedin.com/in/yourname]</span></p>`,
      `<hr>`,
      `<p style="text-align:right">[Month Day, Year]</p>`,
      `<p>[Hiring Manager's Name]<br>[Company Name]<br>[City, State]</p>`,
      `<p>Dear [Hiring Manager's Name],</p>`,
      `<p><span style="${lede}">I'm writing to apply for the [Job Title] role at [Company Name], which [a mutual contact / your careers page / a recent product launch] pointed me toward. I've spent the last [X] years [doing what you do — e.g. "turning early-stage products into category leaders through positioning and growth experiments"], and I'd love to bring that focus to your team.</span></p>`,
      `<p>In my current role, I <mark data-color="${c}22" style="background-color:${c}22">[grew paid acquisition 3x while cutting cost-per-lead by 40%]</mark> — a result I'm eager to replicate at [Company Name]. I also [second accomplishment or relevant skill], which maps closely to what you've described in this posting.</p>`,
      `<p>What draws me to [Company Name] specifically is [a genuine, specific reason — a product decision, a mission statement, a piece of writing from the team]. I think the way you [specific thing they do] is exactly the kind of work I want to keep doing.</p>`,
      `<p>I'd welcome the chance to talk through how my background in [relevant area] could contribute to [team or goal]. Thank you for considering my application.</p>`,
      `<p>Best,<br>[Your Name]</p>`,
    ]),
  }
}

// ---------- 5. Resignation letter ----------

function makeResignationLetter(): DocsContent {
  const c = '#475569'
  const head = 'font-family:Optima'
  const lede = 'font-family:Helvetica Neue'
  return {
    html: html([
      `<p>[Your Name]<br>[Your Address]<br>[City, State ZIP]<br>[you@email.com]</p>`,
      `<p>[Month Day, Year]</p>`,
      `<p>[Manager's Name]<br>[Title]<br>[Company Name]<br>[Company Address]</p>`,
      `<h3><span style="color:${c}; ${head}">Letter of Resignation</span></h3>`,
      `<p>Dear [Manager's Name],</p>`,
      `<p><span style="${lede}">I am writing to formally resign from my position as [Job Title] at [Company Name], effective [Last Working Day]. This letter serves as my [two weeks' / one month's] notice, in line with my employment agreement.</span></p>`,
      `<table>`,
      `<tr><td><p><strong>Position</strong></p></td><td><p>[Job Title]</p></td></tr>`,
      `<tr><td><p><strong>Last day of employment</strong></p></td><td><p>[Month Day, Year]</p></td></tr>`,
      `<tr><td><p><strong>Notice given</strong></p></td><td><p>[Number] weeks</p></td></tr>`,
      `</table>`,
      `<p>I'm committed to a smooth handoff and am glad to help [train my replacement / document my current projects / wrap up outstanding work] during my remaining time. Please let me know how I can best support the transition.</p>`,
      `<p>I'm grateful for the opportunities I've had at [Company Name], particularly [specific project, experience, or mentorship]. Thank you for [specific support — your guidance, the chance to lead X, the trust you placed in me].</p>`,
      `<p>Please let me know if there's anything further you need from me before my last day. I wish you and the team continued success.</p>`,
      `<p>Sincerely,<br>[Your Name]</p>`,
    ]),
  }
}

// ---------- 6. Letter of recommendation ----------

function makeLetterOfRecommendation(): DocsContent {
  const c = '#15803d'
  const head = 'font-family:Palatino'
  const lede = 'font-family:Times New Roman'
  return {
    html: html([
      `<p><strong>[Recommender's Name]</strong><br>[Title], [Organization or Company]<br>[Email] &nbsp;·&nbsp; [Phone]</p>`,
      `<p>[Month Day, Year]</p>`,
      `<h3><span style="color:${c}; ${head}">Letter of Recommendation</span></h3>`,
      `<p>To Whom It May Concern,</p>`,
      `<p><span style="${lede}">It is my pleasure to recommend [Candidate's Name] for [the position, program, or opportunity]. I have known [Candidate's Name] for [duration] as their [manager / professor / colleague] at [Organization or Institution], and I can speak confidently to their [key qualities — e.g. rigor, creativity, and reliability].</span></p>`,
      `<p>During their time on my team, [Candidate's Name] [specific accomplishment, described with detail and outcome — e.g. "redesigned our onboarding flow, cutting new-user drop-off by 18%"]. What stood out most was [a specific quality — e.g. their ability to turn ambiguous problems into clear, actionable plans].</p>`,
      `<p>[Candidate's Name] also [a second example demonstrating a different strength — collaboration, leadership, or resilience under pressure]. They consistently [specific behavior], which made them someone the entire team could rely on.</p>`,
      `<p>I recommend [Candidate's Name] without reservation and am confident they will bring the same [qualities] to [Company Name or Program]. Please don't hesitate to contact me at [email] or [phone] if I can provide any further detail.</p>`,
      `<p>Sincerely,<br>[Recommender's Name]<br>[Title], [Organization]</p>`,
    ]),
  }
}

// ---------- 7. Thank-you letter (post-interview) ----------

function makeThankYouLetterInterview(): DocsContent {
  const c = '#b45309'
  const head = 'font-family:American Typewriter'
  const lede = 'font-family:Georgia'
  return {
    html: html([
      `<p>[Your Name]<br>[you@email.com] &nbsp;·&nbsp; [(555) 123-4567]</p>`,
      `<p>[Month Day, Year]</p>`,
      `<h3><span style="color:${c}; ${head}">Thank You</span></h3>`,
      `<p>Dear [Interviewer's Name],</p>`,
      `<p><span style="${lede}">Thank you for taking the time to meet with me [yesterday / this week] to discuss the [Job Title] role at [Company Name]. I enjoyed learning more about [specific topic discussed — the team's roadmap, a current project, the company's approach to X], and I left even more excited about the opportunity.</span></p>`,
      `<p>Our conversation about [specific point discussed] reinforced how well my background in [relevant skill or experience] could contribute to [a specific goal or challenge the team is facing]. I'd be glad to bring that experience to your team.</p>`,
      `<p>If it would help move things forward, I'm happy to provide [a reference, a work sample, or any additional information]. Please don't hesitate to reach out with questions in the meantime.</p>`,
      `<p>Thank you again for your time and consideration — I look forward to hearing about next steps.</p>`,
      `<p>Warm regards,<br>[Your Name]</p>`,
    ]),
  }
}

// ---------- 8. Personal bio one-pager ----------

function makePersonalBio(): DocsContent {
  const c = '#a21caf'
  const head = 'font-family:Trebuchet MS'
  const lede = 'font-family:Verdana'
  return {
    margin: 56,
    html: html([
      `<h1 style="text-align:center"><span style="color:${c}; ${head}; font-size:32px">[Your Name]</span></h1>`,
      `<p style="text-align:center"><span style="color:${c}"><strong>[Writer, Speaker, and Product Strategist]</strong></span></p>`,
      `<hr>`,
      `<p><span style="${lede}">[Your Name] is a [role or title] based in [City, State], known for [what you're known for — a specialty, a body of work, a point of view]. [Two more sentences: your current focus — company, project, or platform — and one detail that makes your story distinct, like a career pivot, a signature project, or an unusual background.]</span></p>`,
      `<h3><span style="color:${c}"><strong>HIGHLIGHTS</strong></span></h3>`,
      `<ul><li>Featured in [Publication Name] for [topic or body of work].</li><li>Speaker at [Conference Name], [Year].</li><li>Author of [Book, Newsletter, or Project Name], reaching [X readers / subscribers].</li><li>Built [notable project or company], now used by [X people / organizations].</li></ul>`,
      `<blockquote><p>"[A short quote — a personal motto, or a line others often use to describe your work.]"</p></blockquote>`,
      `<h3><span style="color:${c}"><strong>CONTACT</strong></span></h3>`,
      `<table>`,
      `<tr><td><p><strong>Email</strong></p></td><td><p>[you@email.com]</p></td></tr>`,
      `<tr><td><p><strong>Website</strong></p></td><td><p>[yourwebsite.com]</p></td></tr>`,
      `<tr><td><p><strong>Social</strong></p></td><td><p>[@yourhandle on Platform]</p></td></tr>`,
      `</table>`,
    ]),
  }
}

// ---------- Template registry ----------

export const docsCareerTemplates: DocsTemplate[] = [
  {
    id: 'resume-creative',
    name: 'Creative resume',
    description: 'A bold, color-forward resume with a skills matrix that stands out in creative fields.',
    category: 'Career',
    accent: '#4d7c0f',
    glyph: '🎨',
    make: makeResumeCreative,
  },
  {
    id: 'resume-executive',
    name: 'Executive resume',
    description: 'An understated, serif-led resume built for senior leadership and board roles.',
    category: 'Career',
    accent: '#7f1d1d',
    glyph: '🎩',
    make: makeResumeExecutive,
  },
  {
    id: 'cv-academic',
    name: 'Academic CV',
    description: 'A full academic CV with publications, teaching, grants, and service sections.',
    category: 'Education',
    accent: '#44403c',
    glyph: '📚',
    make: makeCvAcademic,
  },
  {
    id: 'cover-letter-modern',
    name: 'Cover letter — modern',
    description: 'A contemporary cover letter with a masthead header and a highlighted achievement.',
    category: 'Letters',
    accent: '#4f46e5',
    glyph: '📨',
    make: makeCoverLetterModern,
  },
  {
    id: 'resignation-letter',
    name: 'Resignation letter',
    description: 'A clear, gracious resignation letter with a key-details table for the record.',
    category: 'Letters',
    accent: '#475569',
    glyph: '🚪',
    make: makeResignationLetter,
  },
  {
    id: 'letter-of-recommendation',
    name: 'Letter of recommendation',
    description: 'A strong, specific endorsement letter that backs up its claims with real examples.',
    category: 'Letters',
    accent: '#15803d',
    glyph: '🤝',
    make: makeLetterOfRecommendation,
  },
  {
    id: 'thank-you-letter-interview',
    name: 'Thank-you letter (post-interview)',
    description: 'A warm, specific follow-up note to send after an interview.',
    category: 'Letters',
    accent: '#b45309',
    glyph: '🙏',
    make: makeThankYouLetterInterview,
  },
  {
    id: 'personal-bio',
    name: 'Personal bio one-pager',
    description: 'A short professional bio with highlights and a contact block, ready to share.',
    category: 'Personal',
    accent: '#a21caf',
    glyph: '🌟',
    make: makePersonalBio,
  },
]
