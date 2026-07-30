import type { DocsContent, DocsTemplate } from '../shared/types'

// ---------- small HTML builders (keep every template's markup consistent + valid) ----------

function html(parts: string[]): string {
  return parts.join('')
}

function taskItem(text: string, checked = false): string {
  return `<li data-type="taskItem" data-checked="${checked ? 'true' : 'false'}"><label><input type="checkbox"${
    checked ? ' checked' : ''
  }><span></span></label><div><p>${text}</p></div></li>`
}

function taskList(...items: string[]): string {
  return `<ul data-type="taskList">${items.join('')}</ul>`
}

/** Small uppercase eyebrow line, centered, in the display font. */
function eyebrow(c: string, font: string, text: string): string {
  return `<p style="text-align:center"><span style="color:${c}; font-family:${font}; font-size:12px"><strong>${text}</strong></span></p>`
}

/** Table header cell with a tinted background (simulated with <mark>, since <th> can't take a fill). */
function thTint(c: string, text: string, align?: 'right' | 'center'): string {
  const a = align ? ` style="text-align:${align}"` : ''
  return `<th><p${a}><mark data-color="${c}22" style="background-color:${c}22"><strong>${text}</strong></mark></p></th>`
}

function td(text: string, align?: 'right' | 'center'): string {
  const a = align ? ` style="text-align:${align}"` : ''
  return `<td><p${a}>${text}</p></td>`
}

// ---------- 1. One-page business plan (lean canvas) ----------

function makeBusinessPlan(): DocsContent {
  const c = '#1d4ed8'
  const display = 'Optima'
  const label = (text: string) => `<span style="color:${c}"><strong>${text}</strong></span>`
  return {
    margin: 56,
    html: html([
      eyebrow(c, display, 'ONE-PAGE BUSINESS PLAN'),
      `<h1 style="text-align:center"><span style="color:${c}; font-family:${display}; font-size:32px">[Company Name]</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">[One sentence describing what you do, for whom, and why it matters] · Prepared by [Your Name] · [Month Year]</span></p>`,
      `<hr>`,
      `<p>[A two-sentence snapshot of the opportunity: the market gap you're pursuing and the insight or traction that makes now the right time.]</p>`,
      `<table>`,
      `<tr>`,
      `<td><p>${label('PROBLEM')}<br>[Top 3 problems your target customers face today]<br>1. [Problem one]<br>2. [Problem two]<br>3. [Problem three]</p></td>`,
      `<td><p>${label('SOLUTION')}<br>[How your product solves each problem above]<br>1. [Solution one]<br>2. [Solution two]<br>3. [Solution three]</p></td>`,
      `<td><p>${label('UNIQUE VALUE PROPOSITION')}<br>[A single, clear, compelling reason you're different — e.g. "The only [category] built for [specific audience]."]</p></td>`,
      `</tr>`,
      `<tr>`,
      `<td><p>${label('UNFAIR ADVANTAGE')}<br>[Something competitors can't easily buy or copy — proprietary data, an exclusive partnership, or founder expertise]</p></td>`,
      `<td><p>${label('CUSTOMER SEGMENTS')}<br>[Target customers, ranked by priority]<br>· [Primary segment]<br>· [Secondary segment]<br>· Early adopters: [description]</p></td>`,
      `<td><p>${label('KEY METRICS')}<br>[The numbers that tell you the business is working]<br>· [Metric one — e.g. monthly active users]<br>· [Metric two — e.g. activation rate]</p></td>`,
      `</tr>`,
      `<tr>`,
      `<td><p>${label('CHANNELS')}<br>[How you reach customers]<br>· [Channel one — e.g. content &amp; SEO]<br>· [Channel two — e.g. paid social]<br>· [Channel three — e.g. partnerships]</p></td>`,
      `<td><p>${label('COST STRUCTURE')}<br>[Your biggest fixed and variable costs]<br>· [Cost driver one]<br>· [Cost driver two]</p></td>`,
      `<td><p>${label('REVENUE STREAMS')}<br>[How the business makes money]<br>· [Revenue stream one — e.g. subscription, $[price]/mo]<br>· [Revenue stream two]</p></td>`,
      `</tr>`,
      `</table>`,
      `<h2><span style="color:${c}; font-family:${display}">Milestones</span></h2>`,
      `<table>`,
      `<tr>${thTint(c, 'Milestone')}${thTint(c, 'Target date')}${thTint(c, 'Owner')}</tr>`,
      `<tr>${td('[Launch MVP to first cohort of users]')}${td('[Month Year]')}${td('[Name]')}</tr>`,
      `<tr>${td('[Reach 100 paying customers]')}${td('[Month Year]')}${td('[Name]')}</tr>`,
      `<tr>${td('[Reach break-even on unit economics]')}${td('[Month Year]')}${td('[Name]')}</tr>`,
      `<tr>${td('[Close [seed / Series A] round]')}${td('[Month Year]')}${td('[Name]')}</tr>`,
      `</table>`,
      `<h2><span style="color:${c}; font-family:${display}">Financial snapshot</span></h2>`,
      `<table>`,
      `<tr>${thTint(c, '')}${thTint(c, 'Year 1', 'right')}${thTint(c, 'Year 2', 'right')}${thTint(c, 'Year 3', 'right')}</tr>`,
      `<tr>${td('Revenue')}${td('$[amount]', 'right')}${td('$[amount]', 'right')}${td('$[amount]', 'right')}</tr>`,
      `<tr>${td('Expenses')}${td('$[amount]', 'right')}${td('$[amount]', 'right')}${td('$[amount]', 'right')}</tr>`,
      `<tr>${td('<strong>Net income</strong>')}${td('<strong>$[amount]</strong>', 'right')}${td('<strong>$[amount]</strong>', 'right')}${td('<strong>$[amount]</strong>', 'right')}</tr>`,
      `</table>`,
      `<h2><span style="color:${c}; font-family:${display}">Funding ask</span></h2>`,
      `<p>[We are raising $[amount] in [round type] to fund [primary use of funds — e.g. product development and go-to-market] over the next [12–18] months.]</p>`,
    ]),
  }
}

// ---------- 2. Project brief ----------

function makeProjectBrief(): DocsContent {
  const c = '#0e7490'
  const display = 'Avenir Next'
  return {
    margin: 56,
    html: html([
      eyebrow(c, display, 'PROJECT BRIEF'),
      `<h1 style="text-align:center"><span style="color:${c}; font-family:${display}; font-size:30px">[Project Name]</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">Owner: [Name] · Sponsor: [Name] · Status: [Not started] · [Month Day, Year]</span></p>`,
      `<hr>`,
      `<h2><span style="color:${c}; font-family:${display}">Background</span></h2>`,
      `<p>[What problem or opportunity prompted this project? Two to three sentences of context a new stakeholder would need to get up to speed.]</p>`,
      `<h2><span style="color:${c}; font-family:${display}">Goals &amp; success metrics</span></h2>`,
      `<table>`,
      `<tr>${thTint(c, 'Goal')}${thTint(c, "How we'll measure it")}</tr>`,
      `<tr>${td('[Primary goal — what this project is meant to achieve]')}${td('[Target metric and value, e.g. reduce checkout time to under 90 seconds]')}</tr>`,
      `<tr>${td('[Secondary goal]')}${td('[Target metric and value]')}</tr>`,
      `<tr>${td('[Secondary goal]')}${td('[Target metric and value]')}</tr>`,
      `</table>`,
      `<h2><span style="color:${c}; font-family:${display}">Scope</span></h2>`,
      `<table>`,
      `<tr>${thTint(c, 'In scope')}${thTint(c, 'Out of scope')}</tr>`,
      `<tr><td><p>· [Deliverable or workstream included]<br>· [Deliverable or workstream included]<br>· [Deliverable or workstream included]</p></td><td><p>· [Explicitly excluded item, to prevent scope creep]<br>· [Explicitly excluded item]</p></td></tr>`,
      `</table>`,
      `<h2><span style="color:${c}; font-family:${display}">Timeline</span></h2>`,
      `<table>`,
      `<tr>${thTint(c, 'Milestone')}${thTint(c, 'Owner')}${thTint(c, 'Target date')}</tr>`,
      `<tr>${td('Kickoff')}${td('[Name]')}${td('[Date]')}</tr>`,
      `<tr>${td('Design review')}${td('[Name]')}${td('[Date]')}</tr>`,
      `<tr>${td('Build complete')}${td('[Name]')}${td('[Date]')}</tr>`,
      `<tr>${td('Launch')}${td('[Name]')}${td('[Date]')}</tr>`,
      `</table>`,
      `<h2><span style="color:${c}; font-family:${display}">Risks &amp; mitigations</span></h2>`,
      `<table>`,
      `<tr>${thTint(c, 'Risk')}${thTint(c, 'Likelihood')}${thTint(c, 'Mitigation')}</tr>`,
      `<tr>${td('[What could go wrong]')}${td('[Low / Medium / High]')}${td("[How you'll reduce or respond to it]")}</tr>`,
      `<tr>${td('[What could go wrong]')}${td('[Low / Medium / High]')}${td("[How you'll reduce or respond to it]")}</tr>`,
      `</table>`,
      `<h2><span style="color:${c}; font-family:${display}">Stakeholders</span></h2>`,
      `<ul><li>[Name] — [Role] — Decision maker</li><li>[Name] — [Role] — Contributor</li><li>[Name] — [Role] — Informed</li></ul>`,
      `<h2><span style="color:${c}; font-family:${display}">Approval</span></h2>`,
      `<table>`,
      `<tr>${thTint(c, 'Approver')}${thTint(c, 'Signature')}${thTint(c, 'Date')}</tr>`,
      `<tr>${td('[Name, Title]')}${td('')}${td('')}</tr>`,
      `<tr>${td('[Name, Title]')}${td('')}${td('')}</tr>`,
      `</table>`,
    ]),
  }
}

// ---------- 3. Standard operating procedure ----------

function makeSOP(): DocsContent {
  const c = '#4f46e5'
  const display = 'Gill Sans'
  return {
    margin: 52,
    html: html([
      eyebrow(c, display, 'STANDARD OPERATING PROCEDURE'),
      `<h1 style="text-align:center"><span style="color:${c}; font-family:${display}; font-size:28px">[Procedure Name]</span></h1>`,
      `<table>`,
      `<tr><td><p><strong>Document ID</strong></p></td><td><p>[SOP-000]</p></td><td><p><strong>Version</strong></p></td><td><p>[1.0]</p></td></tr>`,
      `<tr><td><p><strong>Department</strong></p></td><td><p>[Department name]</p></td><td><p><strong>Owner</strong></p></td><td><p>[Name, Title]</p></td></tr>`,
      `<tr><td><p><strong>Effective date</strong></p></td><td><p>[Month Day, Year]</p></td><td><p><strong>Review cycle</strong></p></td><td><p>[Annually]</p></td></tr>`,
      `</table>`,
      `<h3><span style="color:${c}; font-family:${display}">Purpose</span></h3>`,
      `<p>[Explain in one or two sentences why this procedure exists and what outcome it protects — consistency, safety, compliance, or quality.]</p>`,
      `<h3><span style="color:${c}; font-family:${display}">Scope</span></h3>`,
      `<p>[Who must follow this procedure, and under what circumstances it applies. Note any exceptions.]</p>`,
      `<h3><span style="color:${c}; font-family:${display}">Definitions</span></h3>`,
      `<table>`,
      `<tr>${thTint(c, 'Term')}${thTint(c, 'Definition')}</tr>`,
      `<tr>${td('[Term]')}${td('[Plain-language definition as used in this document]')}</tr>`,
      `<tr>${td('[Term]')}${td('[Plain-language definition]')}</tr>`,
      `</table>`,
      `<h3><span style="color:${c}; font-family:${display}">Responsibilities</span></h3>`,
      `<table>`,
      `<tr>${thTint(c, 'Role')}${thTint(c, 'Responsibility')}</tr>`,
      `<tr>${td('[Role / job title]')}${td('[What this role owns in the procedure]')}</tr>`,
      `<tr>${td('[Role / job title]')}${td('[What this role owns in the procedure]')}</tr>`,
      `</table>`,
      `<h3><span style="color:${c}; font-family:${display}">Before you begin</span></h3>`,
      taskList(
        taskItem('Confirm you have the required system access and approvals'),
        taskItem('Verify the request or trigger meets the criteria in the Scope section'),
        taskItem('Have the reference documents in Section [X] on hand'),
      ),
      `<h3><span style="color:${c}; font-family:${display}">Procedure</span></h3>`,
      `<ol>`,
      `<li><strong>Confirm the request.</strong> [Verify the requester's identity and confirm the request meets policy criteria before proceeding.]</li>`,
      `<li><strong>Gather required documentation.</strong> [List the forms, approvals, or records needed to move forward.]</li>`,
      `<li><strong>Route for approval.</strong> [Specify who must sign off and the maximum time allowed at this step.]</li>`,
      `<li><strong>Execute the action.</strong> [Perform the core task — the actual fix, change, transaction, or process step.]</li>`,
      `<li><strong>Record the outcome.</strong> [Log the action taken in [system name] with date, initials, and reference number.]</li>`,
      `<li><strong>Notify stakeholders.</strong> [Who needs to be informed of the outcome, and by which channel.]</li>`,
      `<li><strong>Close and archive.</strong> [File documentation per the retention policy referenced in Section [X].]</li>`,
      `</ol>`,
      `<p><mark data-color="${c}22" style="background-color:${c}22"><strong>Note:</strong> [Flag any safety precaution, compliance requirement, or common point of failure here.]</mark></p>`,
      `<h3><span style="color:${c}; font-family:${display}">Revision history</span></h3>`,
      `<table>`,
      `<tr>${thTint(c, 'Version')}${thTint(c, 'Date')}${thTint(c, 'Author')}${thTint(c, 'Description of change')}</tr>`,
      `<tr>${td('1.0')}${td('[Month Day, Year]')}${td('[Name]')}${td('Initial release')}</tr>`,
      `<tr>${td('[1.1]')}${td('[Month Day, Year]')}${td('[Name]')}${td('[Summary of what changed and why]')}</tr>`,
      `</table>`,
      `<h3><span style="color:${c}; font-family:${display}">Approval</span></h3>`,
      `<table>`,
      `<tr><td><p><strong>Prepared by</strong><br>[Name, Title]</p></td><td><p><strong>Date</strong><br>[Month Day, Year]</p></td></tr>`,
      `<tr><td><p><strong>Approved by</strong><br>[Name, Title]</p></td><td><p><strong>Date</strong><br>[Month Day, Year]</p></td></tr>`,
      `</table>`,
    ]),
  }
}

// ---------- 4. Simple services agreement ----------

function makeServicesAgreement(): DocsContent {
  const c = '#334155'
  const display = 'Baskerville'
  const clause = (n: number, title: string, body: string) =>
    `<h4><span style="color:${c}; font-family:${display}">${n}. ${title}</span></h4><p>${body}</p>`
  return {
    margin: 64,
    html: html([
      eyebrow(c, display, 'SERVICES AGREEMENT'),
      `<h1 style="text-align:center"><span style="font-family:${display}; font-size:28px">Services Agreement</span></h1>`,
      `<p>This Services Agreement ("Agreement") is entered into as of [Month Day, Year] (the "Effective Date") by and between [Service Provider Name], with a principal address at [Address] ("Provider"), and [Client Name], with a principal address at [Address] ("Client"). Provider and Client may each be referred to individually as a "Party" and collectively as the "Parties."</p>`,
      `<hr>`,
      clause(
        1,
        'Services',
        'Provider shall perform [description of services] (the "Services") as further described in Exhibit A, attached hereto and incorporated by reference.',
      ),
      clause(
        2,
        'Term',
        'This Agreement begins on the Effective Date and continues until [end date / completion of Services], unless terminated earlier as provided in Section 7.',
      ),
      clause(
        3,
        'Compensation',
        'Client shall pay Provider $[amount] [per hour / per project / per month], payable [upon receipt of invoice / net 30 days]. [Describe any deposit, milestone payments, or expense reimbursement terms.]',
      ),
      clause(
        4,
        'Independent contractor',
        'Provider is an independent contractor, not an employee, agent, or partner of Client. Provider is solely responsible for its own taxes, insurance, and benefits.',
      ),
      clause(
        5,
        'Confidentiality',
        'Each Party agrees to keep confidential any non-public information disclosed by the other Party in connection with this Agreement, and not to disclose it to third parties without prior written consent.',
      ),
      clause(
        6,
        'Ownership of work product',
        "Upon full payment, all deliverables created under this Agreement become the exclusive property of Client, except for Provider's pre-existing tools, methods, and materials, which Provider retains.",
      ),
      clause(
        7,
        'Termination',
        "Either Party may terminate this Agreement with [14 / 30] days' written notice. Client shall pay for all Services performed through the termination date.",
      ),
      clause(
        8,
        'Limitation of liability',
        "Neither Party shall be liable for indirect, incidental, or consequential damages arising from this Agreement. Provider's total liability shall not exceed the fees paid under this Agreement in the preceding [3] months.",
      ),
      clause(
        9,
        'Governing law',
        'This Agreement shall be governed by the laws of the State of [State], without regard to its conflict of laws principles.',
      ),
      clause(
        10,
        'Entire agreement',
        'This Agreement constitutes the entire understanding between the Parties and supersedes all prior discussions or agreements relating to the Services.',
      ),
      `<hr>`,
      `<p>IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.</p>`,
      `<table>`,
      `<tr><td><p><strong>Provider</strong></p></td><td><p><strong>Client</strong></p></td></tr>`,
      `<tr><td><p>Signature: _____________________</p></td><td><p>Signature: _____________________</p></td></tr>`,
      `<tr><td><p>Name: [Name]</p></td><td><p>Name: [Name]</p></td></tr>`,
      `<tr><td><p>Title: [Title]</p></td><td><p>Title: [Title]</p></td></tr>`,
      `<tr><td><p>Date: [Month Day, Year]</p></td><td><p>Date: [Month Day, Year]</p></td></tr>`,
      `</table>`,
    ]),
  }
}

// ---------- 5. Marketing one-pager ----------

function makeMarketingOnePager(): DocsContent {
  const c = '#c026d3'
  const display = 'Futura'
  return {
    margin: 56,
    html: html([
      eyebrow(c, display, 'CAMPAIGN ONE-PAGER'),
      `<h1 style="text-align:center"><span style="color:${c}; font-family:${display}; font-size:32px">[Campaign Name]</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">[One tagline that captures the campaign's big idea]</span></p>`,
      `<hr>`,
      `<h2><span style="color:${c}; font-family:${display}">Overview</span></h2>`,
      `<p>[What is this campaign, why now, and what does success look like? Two to three sentences a stakeholder can skim.]</p>`,
      `<h2><span style="color:${c}; font-family:${display}">Target audience</span></h2>`,
      `<table>`,
      `<tr>${thTint(c, 'Persona')}${thTint(c, 'Description')}${thTint(c, 'Key motivation')}</tr>`,
      `<tr>${td('[Primary persona]')}${td('[Who they are, demographics or role]')}${td('[What drives their decision]')}</tr>`,
      `<tr>${td('[Secondary persona]')}${td('[Who they are]')}${td('[What drives their decision]')}</tr>`,
      `</table>`,
      `<h2><span style="color:${c}; font-family:${display}">Key messages</span></h2>`,
      `<ul><li>[The single most important thing the audience should take away]</li><li>[Supporting message — proof point, benefit, or differentiator]</li><li>[Supporting message]</li></ul>`,
      `<h2><span style="color:${c}; font-family:${display}">Channels &amp; budget</span></h2>`,
      `<table>`,
      `<tr>${thTint(c, 'Channel')}${thTint(c, 'Tactic')}${thTint(c, 'Budget', 'right')}${thTint(c, 'Owner')}</tr>`,
      `<tr>${td('Paid social')}${td('[e.g. Instagram + LinkedIn ads]')}${td('$[amount]', 'right')}${td('[Name]')}</tr>`,
      `<tr>${td('Email')}${td('[e.g. 3-part nurture sequence]')}${td('$[amount]', 'right')}${td('[Name]')}</tr>`,
      `<tr>${td('Content &amp; SEO')}${td('[e.g. launch blog post + landing page]')}${td('$[amount]', 'right')}${td('[Name]')}</tr>`,
      `<tr>${td('Events')}${td('[e.g. webinar or trade show]')}${td('$[amount]', 'right')}${td('[Name]')}</tr>`,
      `<tr><td><p><strong>Total</strong></p></td><td><p></p></td><td><p style="text-align:right"><strong>$[amount]</strong></p></td><td><p></p></td></tr>`,
      `</table>`,
      `<h2><span style="color:${c}; font-family:${display}">Timeline</span></h2>`,
      `<table>`,
      `<tr>${thTint(c, 'Milestone')}${thTint(c, 'Date')}</tr>`,
      `<tr>${td('Campaign kickoff')}${td('[Date]')}</tr>`,
      `<tr>${td('Creative finalized')}${td('[Date]')}</tr>`,
      `<tr>${td('Launch')}${td('[Date]')}</tr>`,
      `<tr>${td('Mid-campaign check-in')}${td('[Date]')}</tr>`,
      `<tr>${td('Wrap-up &amp; report')}${td('[Date]')}</tr>`,
      `</table>`,
      `<h2><span style="color:${c}; font-family:${display}">Success metrics</span></h2>`,
      `<ul><li>[Metric, e.g. click-through rate] — target <mark data-color="${c}22" style="background-color:${c}22">[value]</mark></li><li>[Metric, e.g. leads generated] — target <mark data-color="${c}22" style="background-color:${c}22">[value]</mark></li><li>[Metric, e.g. cost per acquisition] — target <mark data-color="${c}22" style="background-color:${c}22">[value]</mark></li></ul>`,
      `<h2><span style="color:${c}; font-family:${display}">Launch checklist</span></h2>`,
      taskList(
        taskItem('Creative assets approved by brand team'),
        taskItem("Landing page built and QA'd"),
        taskItem('Tracking links and UTM parameters set up'),
        taskItem('Budget confirmed with finance'),
      ),
      `<h2><span style="color:${c}; font-family:${display}">Call to action</span></h2>`,
      `<p>[What you want the reader or approver to do next — approve the budget, greenlight the creative, or sign off on launch.]</p>`,
    ]),
  }
}

// ---------- 6. Case study ----------

function makeCaseStudy(): DocsContent {
  const c = '#0d9488'
  const display = 'Seravek'
  const stat = (value: string, caption: string) =>
    `<td><p style="text-align:center"><span style="color:${c}; font-family:${display}; font-size:26px"><strong>${value}</strong></span><br><span style="color:#6b7280">${caption}</span></p></td>`
  return {
    margin: 60,
    html: html([
      eyebrow(c, display, 'CASE STUDY'),
      `<h1 style="text-align:center"><span style="color:${c}; font-family:${display}; font-size:28px">How [Client Name] achieved [headline result] with [Your Company Name]</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">Industry: [Industry] · Company size: [Employee count] · Location: [City, Country]</span></p>`,
      `<hr>`,
      `<h2><span style="color:${c}; font-family:${display}">The challenge</span></h2>`,
      `<p>[Describe the problem the client faced before working with you — be specific about the pain, the cost of inaction, or what they'd already tried that didn't work.]</p>`,
      `<h2><span style="color:${c}; font-family:${display}">The solution</span></h2>`,
      `<p>[Describe what you implemented and why. Focus on the approach and the decisions made, not just the feature list.]</p>`,
      `<ul><li>[Key part of the solution]</li><li>[Key part of the solution]</li><li>[Key part of the solution]</li></ul>`,
      `<h2><span style="color:${c}; font-family:${display}">The results</span></h2>`,
      `<table>`,
      `<tr>${stat('[+42%]', '[Increase in conversion rate]')}${stat('[3.5x]', '[Return on investment]')}${stat('[6 wks]', '[Time to full rollout]')}</tr>`,
      `</table>`,
      `<blockquote><p>"[A specific, enthusiastic quote from the client describing the impact in their own words — the more concrete, the better.]"</p><p>— [Name], [Title], [Client Company]</p></blockquote>`,
      `<h2><span style="color:${c}; font-family:${display}">Looking ahead</span></h2>`,
      `<p>[Close with what's next for the client relationship, or a broader takeaway other readers can apply to their own situation.]</p>`,
      `<hr>`,
      `<p style="text-align:center"><span style="color:#9ca3af">[Your Company Name] helps [target audience] [core value proposition]. Learn more at [website].</span></p>`,
    ]),
  }
}

// ---------- 7. Lesson plan ----------

function makeLessonPlan(): DocsContent {
  const c = '#16a34a'
  const display = 'American Typewriter'
  return {
    margin: 54,
    html: html([
      eyebrow(c, display, 'LESSON PLAN'),
      `<h1 style="text-align:center"><span style="color:${c}; font-family:${display}; font-size:26px">[Lesson Title]</span></h1>`,
      `<table>`,
      `<tr><td><p><strong>Subject</strong></p></td><td><p>[Subject]</p></td><td><p><strong>Grade level</strong></p></td><td><p>[Grade]</p></td></tr>`,
      `<tr><td><p><strong>Duration</strong></p></td><td><p>[45 min]</p></td><td><p><strong>Date</strong></p></td><td><p>[Month Day, Year]</p></td></tr>`,
      `</table>`,
      `<h3><span style="color:${c}; font-family:${display}">Learning objectives</span></h3>`,
      `<p>By the end of this lesson, students will be able to:</p>`,
      `<ul><li>[Objective one — start with an action verb, e.g. "explain," "calculate," "compare"]</li><li>[Objective two]</li><li>[Objective three]</li></ul>`,
      `<h3><span style="color:${c}; font-family:${display}">Standards alignment</span></h3>`,
      `<p>[Reference the curriculum standard(s) this lesson addresses, e.g. state standard code and description.]</p>`,
      `<h3><span style="color:${c}; font-family:${display}">Materials needed</span></h3>`,
      `<ul><li>[Material or handout]</li><li>[Material or handout]</li><li>[Technology or equipment needed]</li></ul>`,
      `<h3><span style="color:${c}; font-family:${display}">Lesson timeline</span></h3>`,
      `<table>`,
      `<tr>${thTint(c, 'Time')}${thTint(c, 'Activity')}${thTint(c, 'Description')}</tr>`,
      `<tr>${td('[5 min]')}${td('Warm-up')}${td('[Hook question, quick review, or bell-ringer activity]')}</tr>`,
      `<tr>${td('[15 min]')}${td('Direct instruction')}${td('[New concept explained, with an example worked through together]')}</tr>`,
      `<tr>${td('[15 min]')}${td('Guided practice')}${td('[Students practice with teacher support, in pairs or small groups]')}</tr>`,
      `<tr>${td('[8 min]')}${td('Independent practice')}${td('[Students apply the concept on their own]')}</tr>`,
      `<tr>${td('[2 min]')}${td('Wrap-up')}${td('[Exit ticket or quick recap of the key takeaway]')}</tr>`,
      `</table>`,
      `<h3><span style="color:${c}; font-family:${display}">Assessment</span></h3>`,
      `<p>[How you'll check for understanding — exit ticket, cold call questions, a short quiz, or observation during practice.]</p>`,
      `<h3><span style="color:${c}; font-family:${display}">Differentiation</span></h3>`,
      `<ul><li>Support: [Scaffold or accommodation for students who need more support]</li><li>Extension: [Challenge activity for students who finish early]</li></ul>`,
      `<h3><span style="color:${c}; font-family:${display}">Homework / extension</span></h3>`,
      `<p>[Assignment or activity for students to continue outside of class, if any.]</p>`,
    ]),
  }
}

// ---------- 8. Cornell study notes ----------

function makeCornellNotes(): DocsContent {
  const c = '#a16207'
  const display = 'Rockwell'
  const row = () =>
    `<tr><td><p>[Cue or question]</p></td><td><p>[Notes — key facts, definitions, or examples from this section]</p></td></tr>`
  return {
    margin: 48,
    html: html([
      eyebrow(c, display, 'CORNELL NOTES'),
      `<h1 style="text-align:center"><span style="color:${c}; font-family:${display}; font-size:26px">[Topic / Lecture Title]</span></h1>`,
      `<p style="text-align:center"><span style="color:#6b7280">Class: [Course name] · Date: [Month Day, Year] · Page [1 of 1]</span></p>`,
      `<hr>`,
      `<table>`,
      `<tr>${thTint(c, 'Cues &amp; questions')}${thTint(c, 'Notes')}</tr>`,
      row(),
      row(),
      row(),
      row(),
      row(),
      `</table>`,
      `<h3><span style="color:${c}; font-family:${display}">Summary</span></h3>`,
      `<p><mark data-color="${c}22" style="background-color:${c}22">[In 2–3 sentences, summarize the main ideas from this page in your own words — writing the summary yourself is what actually builds memory.]</mark></p>`,
    ]),
  }
}

// ---------- Template registry ----------

export const docsBusinessTemplates: DocsTemplate[] = [
  {
    id: 'business-plan-one-page',
    name: 'One-page business plan',
    description: 'A lean-canvas layout that maps your whole business model onto a single page.',
    category: 'Business',
    accent: '#1d4ed8',
    glyph: '🧭',
    make: makeBusinessPlan,
  },
  {
    id: 'project-brief',
    name: 'Project brief',
    description: 'Align stakeholders fast with clear goals, scope, timeline, and risks in one document.',
    category: 'Business',
    accent: '#0e7490',
    glyph: '🗂️',
    make: makeProjectBrief,
  },
  {
    id: 'standard-operating-procedure',
    name: 'Standard operating procedure',
    description: 'Document a repeatable process step by step so anyone on the team can follow it consistently.',
    category: 'Business',
    accent: '#4f46e5',
    glyph: '📋',
    make: makeSOP,
  },
  {
    id: 'services-agreement',
    name: 'Simple services agreement',
    description: 'A plain-language contract covering scope, payment, and terms for freelance or consulting work.',
    category: 'Business',
    accent: '#334155',
    glyph: '🖋️',
    make: makeServicesAgreement,
  },
  {
    id: 'marketing-one-pager',
    name: 'Marketing one-pager',
    description: 'Brief stakeholders on a campaign — audience, channels, budget, and success metrics at a glance.',
    category: 'Marketing',
    accent: '#c026d3',
    glyph: '📣',
    make: makeMarketingOnePager,
  },
  {
    id: 'case-study',
    name: 'Case study',
    description: 'Turn a customer win into a persuasive story with a challenge, solution, and results you can prove.',
    category: 'Marketing',
    accent: '#0d9488',
    glyph: '📈',
    make: makeCaseStudy,
  },
  {
    id: 'lesson-plan-outline',
    name: 'Lesson plan',
    description: 'Plan a class period with objectives, materials, a timed activity table, and an assessment.',
    category: 'Education',
    accent: '#16a34a',
    glyph: '🍎',
    make: makeLessonPlan,
  },
  {
    id: 'cornell-notes',
    name: 'Cornell study notes',
    description: 'The classic cue-and-notes layout that turns lecture notes into an active study tool.',
    category: 'Education',
    accent: '#a16207',
    glyph: '✏️',
    make: makeCornellNotes,
  },
]
