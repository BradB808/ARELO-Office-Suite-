import type { DocsContent, DocsTemplate } from '../shared/types'

// ---------- small HTML builders (keep every template's markup consistent + valid) ----------

function taskItem(text: string, checked = false): string {
  return `<li data-type="taskItem" data-checked="${checked ? 'true' : 'false'}"><label><input type="checkbox"${
    checked ? ' checked' : ''
  }><span></span></label><div><p>${text}</p></div></li>`
}

function taskList(...items: string[]): string {
  return `<ul data-type="taskList">${items.join('')}</ul>`
}

function html(parts: string[]): string {
  return parts.join('')
}

// ---------- 1. Modern resume ----------

function makeResumeModern(): DocsContent {
  const c = '#2563eb'
  return {
    margin: 54,
    html: html([
      `<h1 style="text-align:center"><span style="color:${c}; font-family:Avenir Next; font-size:30px">[Your Name]</span></h1>`,
      `<p style="text-align:center"><span style="color:#4b5160">[City, State] &nbsp;·&nbsp; [(555) 123-4567] &nbsp;·&nbsp; [you@email.com] &nbsp;·&nbsp; [linkedin.com/in/yourname]</span></p>`,
      `<p style="text-align:center"><span style="color:${c}; font-family:Avenir Next">[Product Designer specializing in B2B SaaS]</span></p>`,
      `<hr>`,
      `<h3><span style="color:${c}; font-family:Avenir Next">Summary</span></h3>`,
      `<p>Results-driven [job title] with [X] years of experience in [industry or field]. Skilled at [core strength] and [core strength], with a track record of [key achievement — e.g. "shipping products used by 2M+ people"]. Looking to bring [specific value] to [Company Name].</p>`,
      `<h3><span style="color:${c}; font-family:Avenir Next">Experience</span></h3>`,
      `<p><strong>[Job Title]</strong> — [Company Name], [City, State]<br><em>[Month Year] – Present</em></p>`,
      `<ul><li>Led [project or initiative], resulting in [quantified outcome — e.g. "a 34% increase in conversion"].</li><li>Partnered with [team or stakeholder] to [action], reducing [metric] by [amount].</li><li>Owned [responsibility] end-to-end, shipping [X] releases across [timeframe].</li></ul>`,
      `<p><strong>[Job Title]</strong> — [Previous Company], [City, State]<br><em>[Month Year] – [Month Year]</em></p>`,
      `<ul><li>[Accomplishment with a number: revenue, time saved, users, or percent].</li><li>[Accomplishment that shows ownership or leadership].</li></ul>`,
      `<h3><span style="color:${c}; font-family:Avenir Next">Education</span></h3>`,
      `<p><strong>[Degree, Major]</strong> — [University Name], [City, State] · [Graduation Year]</p>`,
      `<h3><span style="color:${c}; font-family:Avenir Next">Skills</span></h3>`,
      `<table>`,
      `<tr><td><p><mark data-color="${c}22" style="background-color:${c}22">[Skill one]</mark></p></td><td><p><mark data-color="${c}22" style="background-color:${c}22">[Skill two]</mark></p></td><td><p><mark data-color="${c}22" style="background-color:${c}22">[Skill three]</mark></p></td></tr>`,
      `<tr><td><p><mark data-color="${c}22" style="background-color:${c}22">[Skill four]</mark></p></td><td><p><mark data-color="${c}22" style="background-color:${c}22">[Skill five]</mark></p></td><td><p><mark data-color="${c}22" style="background-color:${c}22">[Skill six]</mark></p></td></tr>`,
      `</table>`,
    ]),
  }
}

// ---------- 2. Classic resume ----------

function makeResumeClassic(): DocsContent {
  const fam = 'font-family:Georgia'
  return {
    margin: 62,
    html: html([
      `<h1 style="text-align:center"><span style="${fam}">[Your Name]</span></h1>`,
      `<p style="text-align:center"><span style="${fam}; color:#4b5160">[Street Address, City, State ZIP] &nbsp;·&nbsp; [(555) 123-4567] &nbsp;·&nbsp; [you@email.com]</span></p>`,
      `<hr>`,
      `<h3 style="text-align:center"><span style="${fam}">Objective</span></h3>`,
      `<p style="text-align:center"><span style="${fam}">To obtain the position of [Job Title] at [Company Name], where I can apply [X] years of experience in [field] to contribute to [goal].</span></p>`,
      `<h3><span style="${fam}">Professional experience</span></h3>`,
      `<p><strong><span style="${fam}">[Job Title]</span></strong><span style="${fam}">, [Company Name] — [City, State]</span></p>`,
      `<p><em><span style="${fam}">[Month Year] – Present</span></em></p>`,
      `<ul><li><span style="${fam}">[Responsibility or achievement, stated plainly and specifically].</span></li><li><span style="${fam}">[Responsibility or achievement].</span></li><li><span style="${fam}">[Responsibility or achievement].</span></li></ul>`,
      `<p><strong><span style="${fam}">[Job Title]</span></strong><span style="${fam}">, [Previous Company] — [City, State]</span></p>`,
      `<p><em><span style="${fam}">[Month Year] – [Month Year]</span></em></p>`,
      `<ul><li><span style="${fam}">[Responsibility or achievement].</span></li><li><span style="${fam}">[Responsibility or achievement].</span></li></ul>`,
      `<h3><span style="${fam}">Education</span></h3>`,
      `<p><span style="${fam}"><strong>[Degree, Major]</strong>, [University Name] — [City, State], [Year]</span></p>`,
      `<h3><span style="${fam}">References</span></h3>`,
      `<p><span style="${fam}">Available upon request.</span></p>`,
    ]),
  }
}

// ---------- 3. Cover letter ----------

function makeCoverLetter(): DocsContent {
  return {
    html: html([
      `<p>[Your Name]<br>[Your Address]<br>[City, State ZIP]<br>[your@email.com] · [(555) 123-4567]</p>`,
      `<p>[Month Day, Year]</p>`,
      `<p>[Hiring Manager's Name]<br>[Company Name]<br>[Company Address]<br>[City, State ZIP]</p>`,
      `<p>Dear [Hiring Manager's Name],</p>`,
      `<p>I'm writing to apply for the [Job Title] position at [Company Name], which I found on [where you saw the listing]. With [X] years of experience in [field or discipline] and a track record of [notable strength], I'm confident I'd be a strong addition to your team.</p>`,
      `<p>In my current role at [Current Company], I [specific accomplishment with a measurable result]. I also [second accomplishment or relevant skill], which I believe aligns closely with what you're looking for in this role. I'm especially drawn to [Company Name] because [specific, genuine reason — a product, mission, or value].</p>`,
      `<p>I'd welcome the opportunity to discuss how my background in [relevant area] could contribute to [team or goal at the company]. Thank you for your time and consideration — I look forward to the possibility of speaking further.</p>`,
      `<p>Sincerely,<br>[Your Name]</p>`,
    ]),
  }
}

// ---------- 4. Business letter ----------

function makeBusinessLetter(): DocsContent {
  const c = '#1e3a8a'
  return {
    html: html([
      `<p><strong><span style="color:${c}; font-size:19px">[Your Company Name]</span></strong><br><span style="color:#4b5160">[Street Address, City, State ZIP] · [Phone] · [Email]</span></p>`,
      `<hr>`,
      `<p>[Month Day, Year]</p>`,
      `<p>[Recipient Name]<br>[Title]<br>[Company Name]<br>[Street Address]<br>[City, State ZIP]</p>`,
      `<p>Dear [Recipient Name],</p>`,
      `<p>I am writing on behalf of [Your Company Name] to [state the purpose of the letter — e.g. propose a partnership, follow up on a meeting, formally request something]. [Add one or two sentences of context or background.]</p>`,
      `<p>[Second paragraph: the main point of the letter, spelled out clearly and specifically. Include dates, figures, or next steps as needed.]</p>`,
      `<p>[Third paragraph: what you would like the recipient to do next, and by when.]</p>`,
      `<p>Please don't hesitate to contact me at [phone or email] with any questions. Thank you for your time and consideration.</p>`,
      `<p>Sincerely,</p>`,
      `<p><strong>[Your Name]</strong><br>[Your Title]<br>[Your Company Name]</p>`,
    ]),
  }
}

// ---------- 5. Project proposal ----------

function makeProjectProposal(): DocsContent {
  const c = '#7c3aed'
  return {
    margin: 60,
    html: html([
      `<h1 style="text-align:center"><span style="color:${c}">[Project Name] Proposal</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">Prepared for [Client / Stakeholder Name] · Prepared by [Your Name or Team] · [Month Day, Year]</span></p>`,
      `<hr>`,
      `<h2><span style="color:${c}">Executive summary</span></h2>`,
      `<p>[One paragraph overview: what you're proposing, why it matters now, and the outcome you expect. Keep it to three to five sentences a busy reader can skim.]</p>`,
      `<h2><span style="color:${c}">Objectives</span></h2>`,
      `<ul><li>[Primary objective — what success looks like].</li><li>[Secondary objective].</li><li>[Secondary objective].</li></ul>`,
      `<h2><span style="color:${c}">Scope of work</span></h2>`,
      `<p>[Describe what is included in this project, and just as importantly, what is not. Be specific about deliverables.]</p>`,
      `<h2><span style="color:${c}">Timeline</span></h2>`,
      `<table>`,
      `<tr><th><p><strong>Phase</strong></p></th><th><p><strong>Deliverable</strong></p></th><th><p><strong>Target date</strong></p></th></tr>`,
      `<tr><td><p>Phase 1 — Discovery</p></td><td><p>[Deliverable]</p></td><td><p>[Date]</p></td></tr>`,
      `<tr><td><p>Phase 2 — Build</p></td><td><p>[Deliverable]</p></td><td><p>[Date]</p></td></tr>`,
      `<tr><td><p>Phase 3 — Launch</p></td><td><p>[Deliverable]</p></td><td><p>[Date]</p></td></tr>`,
      `</table>`,
      `<h2><span style="color:${c}">Budget</span></h2>`,
      `<table>`,
      `<tr><th><p><strong>Item</strong></p></th><th><p style="text-align:right"><strong>Estimated cost</strong></p></th></tr>`,
      `<tr><td><p>[Line item]</p></td><td><p style="text-align:right">$[amount]</p></td></tr>`,
      `<tr><td><p>[Line item]</p></td><td><p style="text-align:right">$[amount]</p></td></tr>`,
      `<tr><td><p><strong>Total</strong></p></td><td><p style="text-align:right"><strong>$[total]</strong></p></td></tr>`,
      `</table>`,
      `<h2><span style="color:${c}">Next steps</span></h2>`,
      `<p>[What you need from the reader to move forward — approval, signature, or a follow-up meeting — and by when.]</p>`,
    ]),
  }
}

// ---------- 6. Report ----------

function makeReport(): DocsContent {
  const c = '#0f766e'
  return {
    margin: 60,
    html: html([
      `<h1 style="text-align:center"><span style="color:${c}">[Report Title]</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">[Subtitle, or a one-line description of the report]</span></p>`,
      `<p style="text-align:center"><span style="color:#6b7280">Prepared by [Your Name] · [Department or Team] · [Month Day, Year]</span></p>`,
      `<hr>`,
      `<h2><span style="color:${c}">Executive summary</span></h2>`,
      `<p>[Summarize the report's purpose, key findings, and recommendation in a short paragraph — often the only section busy readers will read in full.]</p>`,
      `<h2><span style="color:${c}">Background</span></h2>`,
      `<p>[Context the reader needs: what prompted this report, what question it answers, and any relevant history.]</p>`,
      `<h2><span style="color:${c}">Findings</span></h2>`,
      `<p>[Present your findings, one idea per paragraph. Use the table below for supporting data.]</p>`,
      `<table>`,
      `<tr><th><p><strong>Metric</strong></p></th><th><p><strong>Previous period</strong></p></th><th><p><strong>Current period</strong></p></th><th><p><strong>Change</strong></p></th></tr>`,
      `<tr><td><p>[Metric one]</p></td><td><p>[Value]</p></td><td><p>[Value]</p></td><td><p>[+/- %]</p></td></tr>`,
      `<tr><td><p>[Metric two]</p></td><td><p>[Value]</p></td><td><p>[Value]</p></td><td><p>[+/- %]</p></td></tr>`,
      `<tr><td><p>[Metric three]</p></td><td><p>[Value]</p></td><td><p>[Value]</p></td><td><p>[+/- %]</p></td></tr>`,
      `</table>`,
      `<h2><span style="color:${c}">Recommendations</span></h2>`,
      `<ul><li>[Recommendation one, with the reasoning behind it].</li><li>[Recommendation two].</li><li>[Recommendation three].</li></ul>`,
      `<h2><span style="color:${c}">Conclusion</span></h2>`,
      `<p>[Close with a brief restatement of the key takeaway and the recommended next step.]</p>`,
    ]),
  }
}

// ---------- 7. Essay (MLA style) ----------

function makeEssayMLA(): DocsContent {
  const fam = 'font-family:Times New Roman'
  return {
    margin: 96,
    html: html([
      `<p><span style="${fam}">[Your Name]<br>[Instructor's Name]<br>[Course Name and Number]<br>[Day Month Year]</span></p>`,
      `<h1 style="text-align:center"><span style="${fam}; font-size:16px">[Essay Title]</span></h1>`,
      `<p><span style="${fam}">[Opening paragraph: introduce your topic, provide necessary context, and end with a clear thesis statement that previews the argument or points the essay will make.]</span></p>`,
      `<p><span style="${fam}">[Body paragraph one: state the first supporting point, back it up with evidence or examples, and explain how it supports your thesis. Cite sources in parenthetical form (Author 12) as needed.]</span></p>`,
      `<p><span style="${fam}">[Body paragraph two: introduce your second point, following the same structure — claim, evidence, explanation.]</span></p>`,
      `<p><span style="${fam}">[Body paragraph three, if needed: address a counterargument or add a final supporting point before moving to the conclusion.]</span></p>`,
      `<p><span style="${fam}">[Concluding paragraph: restate the thesis in new words, synthesize the main points, and leave the reader with a final thought on why the argument matters.]</span></p>`,
      `<h2 style="text-align:center"><span style="${fam}; font-size:14px">Works Cited</span></h2>`,
      `<p><span style="${fam}">[Author Last Name, First Name. </span><em><span style="${fam}">Title of Source</span></em><span style="${fam}">. Publisher, Year.]</span></p>`,
      `<p><span style="${fam}">[Author Last Name, First Name. "Title of Article." </span><em><span style="${fam}">Title of Journal</span></em><span style="${fam}">, vol. #, no. #, Year, pp. ##-##.]</span></p>`,
    ]),
  }
}

// ---------- 8. Meeting notes ----------

function makeMeetingNotes(): DocsContent {
  const c = '#0891b2'
  return {
    margin: 48,
    html: html([
      `<h1><span style="color:${c}">[Meeting Title]</span></h1>`,
      `<table>`,
      `<tr><td><p><strong>Date</strong></p></td><td><p>[Month Day, Year]</p></td><td><p><strong>Time</strong></p></td><td><p>[Start – End]</p></td></tr>`,
      `<tr><td><p><strong>Location</strong></p></td><td><p>[Room / video link]</p></td><td><p><strong>Facilitator</strong></p></td><td><p>[Name]</p></td></tr>`,
      `</table>`,
      `<h3><span style="color:${c}">Attendees</span></h3>`,
      `<ul><li>[Name] — [Role]</li><li>[Name] — [Role]</li><li>[Name] — [Role]</li></ul>`,
      `<h3><span style="color:${c}">Agenda</span></h3>`,
      `<ol><li>[Agenda item one]</li><li>[Agenda item two]</li><li>[Agenda item three]</li></ol>`,
      `<h3><span style="color:${c}">Discussion notes</span></h3>`,
      `<p>[Summarize the discussion for each agenda item — decisions made, concerns raised, and any context worth remembering later.]</p>`,
      `<h3><span style="color:${c}">Action items</span></h3>`,
      taskList(
        taskItem('[Action item] — owner: [Name], due [date]'),
        taskItem('[Action item] — owner: [Name], due [date]'),
        taskItem('[Completed item, kept for reference]', true),
      ),
      `<h3><span style="color:${c}">Next meeting</span></h3>`,
      `<p>[Date and time of the next check-in, if one is scheduled.]</p>`,
    ]),
  }
}

// ---------- 9. Invoice ----------

function makeInvoice(): DocsContent {
  const c = '#ca8a04'
  return {
    margin: 48,
    html: html([
      `<h1><span style="color:${c}">Invoice</span></h1>`,
      `<table>`,
      `<tr><td><p><strong>[Your Company Name]</strong><br>[Your Address]<br>[City, State ZIP]<br>[email@example.com]</p></td><td><p style="text-align:right"><strong>Invoice #</strong> [0001]<br><strong>Date</strong> [Month Day, Year]<br><strong>Due date</strong> [Month Day, Year]</p></td></tr>`,
      `</table>`,
      `<h3><span style="color:${c}">Bill to</span></h3>`,
      `<p>[Client Name]<br>[Client Company]<br>[Client Address]<br>[City, State ZIP]</p>`,
      `<table>`,
      `<tr><th><p><strong>Description</strong></p></th><th><p style="text-align:center"><strong>Qty</strong></p></th><th><p style="text-align:right"><strong>Rate</strong></p></th><th><p style="text-align:right"><strong>Amount</strong></p></th></tr>`,
      `<tr><td><p>[Service or product description]</p></td><td><p style="text-align:center">[1]</p></td><td><p style="text-align:right">$[0.00]</p></td><td><p style="text-align:right">$[0.00]</p></td></tr>`,
      `<tr><td><p>[Service or product description]</p></td><td><p style="text-align:center">[1]</p></td><td><p style="text-align:right">$[0.00]</p></td><td><p style="text-align:right">$[0.00]</p></td></tr>`,
      `<tr><td><p>[Service or product description]</p></td><td><p style="text-align:center">[1]</p></td><td><p style="text-align:right">$[0.00]</p></td><td><p style="text-align:right">$[0.00]</p></td></tr>`,
      `<tr><td><p></p></td><td><p></p></td><td><p style="text-align:right">Subtotal</p></td><td><p style="text-align:right">$[0.00]</p></td></tr>`,
      `<tr><td><p></p></td><td><p></p></td><td><p style="text-align:right">Tax ([0]%)</p></td><td><p style="text-align:right">$[0.00]</p></td></tr>`,
      `<tr><td><p></p></td><td><p></p></td><td><p style="text-align:right"><strong>Total due</strong></p></td><td><p style="text-align:right"><mark data-color="#fef08a" style="background-color:#fef08a"><strong>$[0.00]</strong></mark></p></td></tr>`,
      `</table>`,
      `<h3><span style="color:${c}">Payment terms</span></h3>`,
      `<p>Payment is due within [30] days of the invoice date. Please make payment to [payment details — bank transfer, check, or online link] and reference invoice #[0001]. Thank you for your business!</p>`,
    ]),
  }
}

// ---------- 10. Newsletter ----------

function makeNewsletter(): DocsContent {
  const c = '#ea580c'
  return {
    margin: 56,
    html: html([
      `<h1 style="text-align:center"><span style="color:${c}; font-family:Futura">[Newsletter Name]</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">Issue #[1] · [Month Year] · A note for [our community]</span></p>`,
      `<hr>`,
      `<h2><span style="color:${c}">From the editor</span></h2>`,
      `<p>[A short, warm welcome note. Mention what's inside this issue and why readers should care.]</p>`,
      `<h2><span style="color:${c}">This month's highlights</span></h2>`,
      `<p><strong>[Headline for story one]</strong><br>[A two-to-three sentence summary of the story — what happened, why it matters.]</p>`,
      `<p><strong>[Headline for story two]</strong><br>[A two-to-three sentence summary of the story.]</p>`,
      `<p><strong>[Headline for story three]</strong><br>[A two-to-three sentence summary of the story.]</p>`,
      `<h2><span style="color:${c}">Upcoming events</span></h2>`,
      `<ul><li>[Event name] — [Date], [Location]</li><li>[Event name] — [Date], [Location]</li></ul>`,
      `<h2><span style="color:${c}">Shout-outs</span></h2>`,
      `<p>[Celebrate a win, a new team member, or an anniversary — whatever brings a personal touch to the newsletter.]</p>`,
      `<hr>`,
      `<p style="text-align:center"><span style="color:#9ca3af">You're receiving this because you're part of [organization or community]. Questions? Reply to [email@example.com].</span></p>`,
    ]),
  }
}

// ---------- 11. Weekly to-do ----------

function dayBlock(color: string, day: string): string {
  return (
    `<h3><span style="color:${color}">${day}</span></h3>` +
    taskList(taskItem('[Task]'), taskItem('[Task]'), taskItem('[Task]'))
  )
}

function makeWeeklyTodo(): DocsContent {
  const c = '#db2777'
  return {
    margin: 48,
    html: html([
      `<h1 style="text-align:center"><span style="color:${c}">Week of [Month Day]</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">[Your top priority this week, in one sentence]</span></p>`,
      `<hr>`,
      dayBlock(c, 'Monday'),
      dayBlock(c, 'Tuesday'),
      dayBlock(c, 'Wednesday'),
      dayBlock(c, 'Thursday'),
      dayBlock(c, 'Friday'),
      dayBlock(c, 'Weekend'),
    ]),
  }
}

// ---------- 12. Journal ----------

function makeJournal(): DocsContent {
  const c = '#92400e'
  const fam = 'font-family:Georgia'
  return {
    margin: 64,
    html: html([
      `<h1 style="text-align:center"><span style="color:${c}; ${fam}">[Month Day, Year]</span></h1>`,
      `<p style="text-align:center"><span style="color:#9ca3af; ${fam}">How I'm feeling today: [ 🙂 😐 🙁 ]</span></p>`,
      `<hr>`,
      `<h3><span style="color:${c}; ${fam}">Grateful for</span></h3>`,
      `<p><span style="${fam}">[One]</span></p>`,
      `<p><span style="${fam}">[Two]</span></p>`,
      `<p><span style="${fam}">[Three]</span></p>`,
      `<h3><span style="color:${c}; ${fam}">Today's highlight</span></h3>`,
      `<p><span style="${fam}">[What made today good, or worth remembering?]</span></p>`,
      `<h3><span style="color:${c}; ${fam}">On my mind</span></h3>`,
      `<p><span style="${fam}">[Anything you're working through, excited about, or want to remember thinking.]</span></p>`,
      `<h3><span style="color:${c}; ${fam}">Tomorrow, I want to</span></h3>`,
      taskList(taskItem('[Intention]'), taskItem('[Intention]')),
    ]),
  }
}

// ---------- 13. Recipe ----------

function makeRecipe(): DocsContent {
  const c = '#dc2626'
  return {
    margin: 56,
    html: html([
      `<h1 style="text-align:center"><span style="color:${c}">[Recipe Name]</span></h1>`,
      `<p style="text-align:center"><em>[A one-sentence description of the dish — what makes it special or when to make it.]</em></p>`,
      `<table>`,
      `<tr><td><p style="text-align:center"><strong>Prep time</strong><br>[15 min]</p></td><td><p style="text-align:center"><strong>Cook time</strong><br>[30 min]</p></td><td><p style="text-align:center"><strong>Serves</strong><br>[4]</p></td></tr>`,
      `</table>`,
      `<h3><span style="color:${c}">Ingredients</span></h3>`,
      `<ul><li>[Quantity] [ingredient]</li><li>[Quantity] [ingredient]</li><li>[Quantity] [ingredient]</li><li>[Quantity] [ingredient]</li><li>[Quantity] [ingredient]</li></ul>`,
      `<h3><span style="color:${c}">Instructions</span></h3>`,
      `<ol><li>[First step — be specific about heat, time, and technique.]</li><li>[Second step.]</li><li>[Third step.]</li><li>[Fourth step.]</li></ol>`,
      `<h3><span style="color:${c}">Notes</span></h3>`,
      `<p>[Substitutions, storage tips, or serving suggestions.]</p>`,
    ]),
  }
}

// ---------- 14. Press release ----------

function makePressRelease(): DocsContent {
  const c = '#1e293b'
  return {
    html: html([
      `<p><strong>FOR IMMEDIATE RELEASE</strong></p>`,
      `<h1><span style="color:${c}">[Headline: Company Announces Something Newsworthy]</span></h1>`,
      `<p><em>[Subheadline that adds one more layer of detail, or the "so what."]</em></p>`,
      `<p>[CITY, State] — [Month Day, Year] — [Opening paragraph: who, what, when, where, and why, in that order. This should stand alone if it's the only paragraph anyone reads.]</p>`,
      `<p>[Second paragraph: additional detail — background, context, or the problem this addresses.]</p>`,
      `<p>"[A quote from a company spokesperson that adds perspective or emotion — not just a repeat of the facts]," said [Name], [Title] at [Company Name].</p>`,
      `<p>[Third paragraph: further detail, data, or availability information — pricing, dates, where to learn more.]</p>`,
      `<h3><span style="color:${c}">About [Company Name]</span></h3>`,
      `<p>[Company Name] is a [one-sentence description of what the company does]. Founded in [Year], [Company Name] is headquartered in [City, State]. Learn more at [company website].</p>`,
      `<p><strong>Media contact:</strong><br>[Name]<br>[Title]<br>[email@example.com]<br>[Phone number]</p>`,
      `<p style="text-align:center">###</p>`,
    ]),
  }
}

// ---------- Template registry ----------

export const docsTemplates: DocsTemplate[] = [
  {
    id: 'resume-modern',
    name: 'Modern resume',
    description: 'A clean, color-accented resume that puts skills and impact front and center.',
    category: 'Career',
    accent: '#2563eb',
    glyph: '💼',
    make: makeResumeModern,
  },
  {
    id: 'resume-classic',
    name: 'Classic resume',
    description: 'A timeless serif resume with traditional structure — ideal for formal industries.',
    category: 'Career',
    accent: '#111827',
    glyph: '📄',
    make: makeResumeClassic,
  },
  {
    id: 'cover-letter',
    name: 'Cover letter',
    description: 'A courteous, well-structured letter to accompany your resume.',
    category: 'Career',
    accent: '#0ea5e9',
    glyph: '✉️',
    make: makeCoverLetter,
  },
  {
    id: 'business-letter',
    name: 'Business letter',
    description: 'A formal block-style letter for official correspondence.',
    category: 'Letters',
    accent: '#1e3a8a',
    glyph: '🏢',
    make: makeBusinessLetter,
  },
  {
    id: 'project-proposal',
    name: 'Project proposal',
    description: 'A persuasive proposal with objectives, a timeline, and a budget table.',
    category: 'Business',
    accent: '#7c3aed',
    glyph: '📈',
    make: makeProjectProposal,
  },
  {
    id: 'report',
    name: 'Report',
    description: 'A structured report with a title block, executive summary, and clear sections.',
    category: 'Business',
    accent: '#0f766e',
    glyph: '📊',
    make: makeReport,
  },
  {
    id: 'essay-mla',
    name: 'Essay (MLA style)',
    description: 'An MLA-formatted essay with a proper header block and Works Cited page.',
    category: 'Education',
    accent: '#4b5563',
    glyph: '🎓',
    make: makeEssayMLA,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting notes',
    description: 'Capture attendees, discussion, and action items in one clean layout.',
    category: 'Business',
    accent: '#0891b2',
    glyph: '📝',
    make: makeMeetingNotes,
  },
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'A clean, professional invoice with itemized totals.',
    category: 'Finance',
    accent: '#ca8a04',
    glyph: '🧾',
    make: makeInvoice,
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'A friendly multi-story newsletter layout with a masthead and highlights.',
    category: 'Marketing',
    accent: '#ea580c',
    glyph: '📰',
    make: makeNewsletter,
  },
  {
    id: 'weekly-todo',
    name: 'Weekly to-do',
    description: 'A day-by-day task list to plan out your whole week.',
    category: 'Personal',
    accent: '#db2777',
    glyph: '📅',
    make: makeWeeklyTodo,
  },
  {
    id: 'journal',
    name: 'Journal',
    description: 'A guided daily journal page with gratitude and reflection prompts.',
    category: 'Personal',
    accent: '#92400e',
    glyph: '📔',
    make: makeJournal,
  },
  {
    id: 'recipe',
    name: 'Recipe',
    description: 'A tidy recipe card with ingredients, steps, and cook-time details.',
    category: 'Personal',
    accent: '#dc2626',
    glyph: '🍳',
    make: makeRecipe,
  },
  {
    id: 'press-release',
    name: 'Press release',
    description: 'A newsroom-ready announcement with a dateline and boilerplate.',
    category: 'Marketing',
    accent: '#1e293b',
    glyph: '📢',
    make: makePressRelease,
  },
]
