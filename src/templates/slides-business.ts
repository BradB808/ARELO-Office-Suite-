import type {
  ShapeElement,
  ShapeKind,
  Slide,
  SlideBackground,
  SlideElement,
  SlidesContent,
  SlidesTemplate,
  TextElement,
} from '../shared/types'
import { uid } from '../shared/types'
import { getTheme } from '../apps/slides/themes'

// ---------- small element builders ----------

function mkSlide(elements: SlideElement[], opts: { background?: SlideBackground; notes?: string } = {}): Slide {
  return { id: uid(), elements, background: opts.background, notes: opts.notes }
}

function txt(x: number, y: number, w: number, h: number, text: string, extra: Partial<TextElement> = {}): TextElement {
  return { id: uid(), kind: 'text', x, y, w, h, text, lineHeight: 1.4, ...extra }
}

function shp(
  x: number,
  y: number,
  w: number,
  h: number,
  shape: ShapeKind,
  fill: string,
  extra: Partial<ShapeElement> = {},
): ShapeElement {
  return { id: uid(), kind: 'shape', x, y, w, h, shape, fill, ...extra }
}

// ================================================================
// 1. Sales proposal — Meridian Consulting (slate theme)
// ================================================================

function deckSalesProposal(): SlidesContent {
  const th = getTheme('slate')
  const plans: [string, string, string, string][] = [
    ['Starter', '$2,400/mo', 'For small teams getting started', 'Core platform access\nEmail support\nMonthly reporting'],
    ['Growth', '$5,800/mo', 'Our most popular plan', "Everything in Starter\nDedicated success manager\nQuarterly strategy reviews"],
    ['Enterprise', 'Custom pricing', 'For complex, multi-team rollouts', 'Everything in Growth\nCustom integrations\nSLA-backed support'],
  ]
  const pCols = [100, 470, 840]
  const stats: [string, string][] = [
    ['15+', 'Years of enterprise consulting'],
    ['240', 'Clients served across 12 industries'],
    ['4.9/5', 'Average client satisfaction score'],
  ]
  const sCols = [100, 470, 840]
  const phases: [string, string, number][] = [
    ['Kickoff', 'Week 1', 1],
    ['Discovery', 'Weeks 2-3', 0.75],
    ['Build', 'Weeks 4-8', 0.5],
    ['Launch', 'Week 9', 0.3],
  ]
  const phCols = [100, 380, 660, 940]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 230, 100, 6, 'rect', th.accent),
        txt(40, 260, 1200, 110, 'Partnership Proposal', { fontSize: 64, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
        txt(40, 380, 1200, 50, 'Prepared for [Client Company] · [Month Year]', { fontSize: 24, align: 'center', valign: 'middle', color: th.bodyColor, fontFamily: th.bodyFont }),
        txt(100, 60, 500, 30, 'MERIDIAN CONSULTING', { fontSize: 15, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      ],
      { notes: "Thank them for the time before diving in, and restate the outcome they told you they want in their own words." },
    ),
    mkSlide(
      [
        txt(100, 70, 900, 80, 'The challenge', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(
          100,
          220,
          980,
          380,
          'Manual processes are eating [X] hours a week across the team\nDisconnected tools make it hard to see the full picture\nGrowth has stalled at [current metric] for the last two quarters',
          { fontSize: 26, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'Ground each bullet in something the client told you directly — specifics build trust faster than a generic pain-point list.' },
    ),
    mkSlide([
      txt(100, 70, 900, 80, 'Our approach', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(100, 210, 480, 40, 'Discovery & audit', { fontSize: 24, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(
        100,
        260,
        480,
        300,
        'Two-week deep dive into your current workflows, tools and data\nStakeholder interviews across every affected team\nA prioritized findings report with quick wins flagged',
        { fontSize: 19, bullets: true, color: th.bodyColor, lineHeight: 1.45, fontFamily: th.bodyFont },
      ),
      txt(660, 210, 480, 40, 'Build & implement', { fontSize: 24, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(
        660,
        260,
        480,
        300,
        "Custom rollout plan matched to your team's pace\nWeekly check-ins with a named project lead\nTraining and documentation built for your team",
        { fontSize: 19, bullets: true, color: th.bodyColor, lineHeight: 1.45, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide(
      [
        txt(100, 60, 900, 70, 'Investment', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 150, 80, 8, 'rect', th.accent),
        ...plans.flatMap(([name, price, tagline, features], i) => [
          shp(pCols[i], 210, 340, 430, 'roundRect', th.accent, { opacity: i === 1 ? 0.14 : 0.08 }),
          txt(pCols[i] + 20, 235, 300, 40, name, { fontSize: 24, bold: true, color: th.titleColor, fontFamily: th.bodyFont }),
          txt(pCols[i] + 20, 280, 300, 50, price, { fontSize: 27, bold: true, color: th.accent, fontFamily: th.titleFont }),
          txt(pCols[i] + 20, 340, 300, 50, tagline, { fontSize: 14, italic: true, color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
          txt(pCols[i] + 20, 400, 300, 220, features, { fontSize: 16, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont }),
        ]),
      ],
      { notes: 'Walk the room through the middle tier first — most clients anchor on the plan you present second.' },
    ),
    mkSlide([
      txt(100, 70, 900, 80, 'Why partner with us', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...stats.flatMap(([value, label], i) => [
        txt(sCols[i], 240, 340, 90, value, { fontSize: 54, bold: true, align: 'center', color: th.accent, fontFamily: th.titleFont }),
        txt(sCols[i], 335, 340, 60, label, { fontSize: 18, align: 'center', color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 60, 700, 70, '90-day rollout', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      ...phases.flatMap(([label, sub, opacity], i) => [
        shp(phCols[i], 260, 240, 90, 'chevron', th.accent, { opacity }),
        txt(phCols[i], 285, 240, 40, label, { fontSize: 20, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(phCols[i], 360, 240, 30, sub, { fontSize: 15, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(40, 230, 1200, 110, 'Ready to get started?', { fontSize: 56, bold: true, align: 'center', valign: 'middle', color: '#eef2ff', fontFamily: th.titleFont }),
        txt(
          40,
          360,
          1200,
          140,
          "Sign the proposal and we'll schedule your kickoff call within 5 business days.\nQuestions? [your.email@meridianconsulting.com]",
          { fontSize: 22, align: 'center', color: '#e0e7ff', lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { background: { type: 'solid', color: th.accent }, notes: 'Close by naming the exact next action and date — a vague "let us know" loses momentum.' },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 2. Company all-hands (aurora theme)
// ================================================================

function deckCompanyAllHands(): SlidesContent {
  const th = getTheme('aurora')
  const stats: [string, string][] = [
    ['$4.8M', 'Quarterly revenue, up 22% YoY'],
    ['1,240', 'Active customers across 40 countries'],
    ['96%', 'Employee eNPS this quarter'],
  ]
  const sCols = [100, 470, 840]
  const phases: [string, string, number][] = [
    ['NOW', 'Ship [Feature] to every plan', 1],
    ['NEXT', 'Expand into [New Market]', 0.6],
    ['LATER', 'Explore [Future Bet]', 0.35],
  ]
  const pCols = [100, 470, 840]
  const shoutouts: [string, string, string][] = [
    ['JK', 'Jordan Kim', 'Shipped the new onboarding flow solo'],
    ['AM', 'Ava Martinez', 'Closed the [Client] enterprise deal'],
    ['RP', 'Raj Patel', 'Kept uptime at 99.99% all quarter'],
    ['SO', 'Sofia Ortiz', 'Onboarded 12 new teammates seamlessly'],
  ]
  const shCols = [100, 380, 660, 940]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 230, 100, 6, 'rect', th.accent),
        txt(40, 260, 1200, 110, 'Q3 All-Hands', { fontSize: 68, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
        txt(40, 380, 1200, 50, '[Company Name] · [Month] 2026', { fontSize: 24, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: 'Open with energy — a one-line reminder of the mission before diving into numbers.' },
    ),
    mkSlide([
      txt(100, 80, 700, 80, 'Agenda', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 174, 80, 8, 'rect', th.accent),
      ...['Wins from the quarter', 'The numbers that matter', "What's next on the roadmap", 'Team shoutouts'].flatMap((item, i) => {
        const y = 230 + i * 90
        return [
          shp(100, y, 60, 60, 'roundRect', th.accent, { opacity: 0.22 }),
          txt(100, y, 60, 60, String(i + 1), { fontSize: 24, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
          txt(190, y, 900, 60, item, { fontSize: 25, valign: 'middle', color: th.bodyColor, fontFamily: th.bodyFont }),
        ]
      }),
    ]),
    mkSlide(
      [
        txt(100, 70, 900, 80, 'Wins worth celebrating', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(
          100,
          220,
          980,
          400,
          'Shipped [Feature Name] to 100% of customers\nClosed our largest enterprise deal to date\nHit [X] consecutive weeks of on-time releases\nGrew the team by [N] incredible new hires',
          { fontSize: 25, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'Invite the room to add their own wins in the chat before moving on — this list is never complete.' },
    ),
    mkSlide([
      txt(100, 70, 900, 80, 'By the numbers', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...stats.flatMap(([value, label], i) => [
        txt(sCols[i], 240, 340, 90, value, { fontSize: 52, bold: true, align: 'center', color: th.accent, fontFamily: th.titleFont }),
        txt(sCols[i], 335, 340, 60, label, { fontSize: 18, align: 'center', color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 60, 700, 70, 'Roadmap ahead', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      ...phases.flatMap(([label, sub, opacity], i) => [
        shp(pCols[i], 260, 340, 110, 'chevron', th.accent, { opacity }),
        txt(pCols[i], 290, 340, 40, label, { fontSize: 22, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(pCols[i], 390, 340, 90, sub, { fontSize: 17, align: 'center', color: th.bodyColor, lineHeight: 1.4, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(100, 60, 700, 70, 'Shoutouts', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 150, 80, 8, 'rect', th.accent),
        ...shoutouts.flatMap(([initials, name, blurb], i) => [
          shp(shCols[i] + 75, 220, 90, 90, 'ellipse', th.accent, { opacity: 0.25 }),
          txt(shCols[i], 220, 240, 90, initials, { fontSize: 26, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
          txt(shCols[i], 330, 240, 36, name, { fontSize: 19, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
          txt(shCols[i], 370, 240, 90, blurb, { fontSize: 15, align: 'center', color: th.bodyColor, lineHeight: 1.4, fontFamily: th.bodyFont }),
        ]),
      ],
      { notes: 'Read each shoutout out loud and pause — let the applause happen before moving to the next.' },
    ),
    mkSlide(
      [
        txt(40, 230, 1200, 110, 'Questions?', { fontSize: 64, bold: true, align: 'center', valign: 'middle', color: '#0b1220', fontFamily: th.titleFont }),
        txt(40, 360, 1200, 90, 'Drop them in the chat or find us after the meeting. Thank you for an incredible quarter.', {
          fontSize: 24,
          align: 'center',
          color: '#0b1220',
          lineHeight: 1.4,
          fontFamily: th.bodyFont,
        }),
      ],
      { background: { type: 'solid', color: th.accent }, notes: 'Leave five minutes for live questions before closing out the call.' },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 3. Client case study (ocean theme)
// ================================================================

function deckClientCaseStudy(): SlidesContent {
  const th = getTheme('ocean')
  const results: [string, string][] = [
    ['60%', 'Faster time to first value'],
    ['-31 pts', 'Drop in setup-related tickets'],
    ['91%', 'Customers activated in month one'],
  ]
  const rCols = [100, 470, 840]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 230, 100, 6, 'rect', th.accent),
        txt(40, 250, 1200, 130, 'How [Client Company] Cut Onboarding\nTime by 60%', {
          fontSize: 50,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: th.titleColor,
          fontFamily: th.titleFont,
          lineHeight: 1.2,
        }),
        txt(40, 400, 1200, 50, 'A [Your Company] case study', { fontSize: 22, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: "Open by naming the client's industry and size before the big number — context makes the result credible." },
    ),
    mkSlide(
      [
        txt(100, 70, 900, 80, 'The challenge', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(
          100,
          220,
          980,
          380,
          'The client was losing new customers during a 6-week onboarding process\nSupport tickets for setup issues made up 40% of ticket volume\nThe team had no visibility into where customers dropped off',
          { fontSize: 25, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'This is where the reader decides whether to keep reading — make the pain specific and quantified.' },
    ),
    mkSlide([
      txt(100, 70, 900, 80, 'The solution', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(100, 210, 480, 40, 'What we built', { fontSize: 23, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(
        100,
        260,
        480,
        300,
        'A guided, in-product setup wizard\nAutomated data migration from their old system\nA real-time onboarding health dashboard',
        { fontSize: 19, bullets: true, color: th.bodyColor, lineHeight: 1.45, fontFamily: th.bodyFont },
      ),
      txt(660, 210, 480, 40, 'How we rolled it out', { fontSize: 23, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(
        660,
        260,
        480,
        300,
        'Piloted with 50 accounts over two weeks\nTrained their CS team on the new flow\nRolled out to 100% of new signups in 30 days',
        { fontSize: 19, bullets: true, color: th.bodyColor, lineHeight: 1.45, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, 'Before vs. after', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      shp(100, 210, 510, 400, 'roundRect', th.bodyColor, { opacity: 0.08 }),
      txt(130, 235, 450, 40, 'Before', { fontSize: 24, bold: true, color: th.titleColor, fontFamily: th.bodyFont }),
      txt(130, 290, 450, 300, '6-week onboarding timeline\n40% of tickets were setup related\n62% activation rate in month one', {
        fontSize: 19,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
      shp(670, 210, 510, 400, 'roundRect', th.accent, { opacity: 0.14 }),
      txt(700, 235, 450, 40, 'After', { fontSize: 24, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(700, 290, 450, 300, '11-day onboarding timeline\n9% of tickets are setup related\n91% activation rate in month one', {
        fontSize: 19,
        bullets: true,
        color: th.titleColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, 'The results', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...results.flatMap(([value, label], i) => [
        txt(rCols[i], 240, 340, 90, value, { fontSize: 52, bold: true, align: 'center', color: th.accent, fontFamily: th.titleFont }),
        txt(rCols[i], 335, 340, 60, label, { fontSize: 18, align: 'center', color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        shp(590, 150, 100, 100, 'ellipse', th.accent, { opacity: 0.22 }),
        txt(590, 150, 100, 100, 'JT', { fontSize: 30, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(
          160,
          290,
          960,
          180,
          '"[Your Company] didn\'t just fix our onboarding problem — they gave us a system we can keep improving on our own."',
          { fontSize: 30, italic: true, align: 'center', color: th.titleColor, lineHeight: 1.4, fontFamily: th.titleFont },
        ),
        txt(160, 490, 960, 50, 'Jamie Torres, VP of Customer Success, [Client Company]', { fontSize: 18, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: 'Let the quote breathe on screen for a few seconds before you paraphrase it — the exact words carry more weight.' },
    ),
    mkSlide(
      [
        txt(40, 230, 1200, 110, 'Ready for results like these?', { fontSize: 52, bold: true, align: 'center', valign: 'middle', color: '#ecfeff', fontFamily: th.titleFont }),
        txt(40, 360, 1200, 90, "Let's talk about what [Your Company] could do for your team.\n[your.email@yourcompany.com]", {
          fontSize: 22,
          align: 'center',
          color: '#cffafe',
          lineHeight: 1.4,
          fontFamily: th.bodyFont,
        }),
      ],
      {
        background: { type: 'gradient', from: '#0891b2', to: '#164e63', angle: 135 },
        notes: 'Close with a specific next step — offer to book a call right there rather than leaving it open-ended.',
      },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 4. OKR quarterly review (meadow theme)
// ================================================================

function krRow(
  y: number,
  label: string,
  pct: number,
  color: string,
  bodyColor: string,
  titleColor: string,
  bodyFont: string,
): SlideElement[] {
  const barW = 850
  return [
    txt(140, y, 760, 36, label, { fontSize: 19, color: titleColor, valign: 'middle', fontFamily: bodyFont }),
    txt(940, y, 150, 36, Math.round(pct * 100) + '%', { fontSize: 20, bold: true, align: 'right', color, valign: 'middle', fontFamily: bodyFont }),
    shp(140, y + 44, barW, 14, 'rect', bodyColor, { opacity: 0.18 }),
    shp(140, y + 44, barW * pct, 14, 'rect', color, { opacity: 0.9 }),
  ]
}

function deckOkrReview(): SlidesContent {
  const th = getTheme('meadow')

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 220, 100, 6, 'rect', th.accent),
        txt(40, 250, 1200, 110, 'Q3 OKR Review', { fontSize: 62, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
        txt(40, 370, 1200, 50, '[Company Name] · Objectives & Key Results', { fontSize: 22, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: 'Frame the review as a working session, not a report card — the goal is honest scoring, not perfect scores.' },
    ),
    mkSlide([
      txt(100, 70, 900, 80, 'Q3 objectives at a glance', { fontSize: 46, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        220,
        980,
        380,
        'Grow revenue predictably — Owner: [Sales Lead]\nDelight and retain customers — Owner: [CS Lead]\nBuild a resilient platform — Owner: [Eng Lead]',
        { fontSize: 25, bullets: true, color: th.bodyColor, lineHeight: 1.55, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide([
      txt(100, 60, 300, 30, 'OBJECTIVE 1', { fontSize: 16, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(100, 95, 800, 70, 'Grow revenue predictably', { fontSize: 40, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 175, 80, 8, 'rect', th.accent),
      shp(940, 55, 200, 35, 'roundRect', th.accent, { opacity: 0.16 }),
      txt(940, 55, 200, 35, 'AT RISK', { fontSize: 14, bold: true, align: 'center', valign: 'middle', color: th.accent, fontFamily: th.bodyFont }),
      ...krRow(210, 'Increase net-new ARR to $2.4M', 0.82, th.accent, th.bodyColor, th.titleColor, th.bodyFont),
      ...krRow(320, 'Expand into 3 new verticals', 0.67, th.accent, th.bodyColor, th.titleColor, th.bodyFont),
      ...krRow(430, 'Lift average deal size by 15%', 0.45, th.accent, th.bodyColor, th.titleColor, th.bodyFont),
    ]),
    mkSlide(
      [
        txt(100, 60, 300, 30, 'OBJECTIVE 2', { fontSize: 16, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(100, 95, 800, 70, 'Delight and retain customers', { fontSize: 40, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 175, 80, 8, 'rect', th.accent),
        shp(940, 55, 200, 35, 'roundRect', th.accent, { opacity: 0.16 }),
        txt(940, 55, 200, 35, 'ON TRACK', { fontSize: 14, bold: true, align: 'center', valign: 'middle', color: th.accent, fontFamily: th.bodyFont }),
        ...krRow(210, 'Raise NPS from 42 to 55', 0.9, th.accent, th.bodyColor, th.titleColor, th.bodyFont),
        ...krRow(320, 'Cut churn to under 3% monthly', 0.58, th.accent, th.bodyColor, th.titleColor, th.bodyFont),
        ...krRow(430, 'Launch proactive customer health scoring', 1.0, th.accent, th.bodyColor, th.titleColor, th.bodyFont),
      ],
      { notes: 'The health-scoring key result is done — celebrate it before moving to the ones still in flight.' },
    ),
    mkSlide([
      txt(100, 60, 300, 30, 'OBJECTIVE 3', { fontSize: 16, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(100, 95, 800, 70, 'Build a resilient platform', { fontSize: 40, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 175, 80, 8, 'rect', th.accent),
      shp(940, 55, 200, 35, 'roundRect', th.accent, { opacity: 0.16 }),
      txt(940, 55, 200, 35, 'ON TRACK', { fontSize: 14, bold: true, align: 'center', valign: 'middle', color: th.accent, fontFamily: th.bodyFont }),
      ...krRow(210, 'Achieve 99.95% uptime', 0.95, th.accent, th.bodyColor, th.titleColor, th.bodyFont),
      ...krRow(320, 'Cut P1 incident response time to under 15 min', 0.7, th.accent, th.bodyColor, th.titleColor, th.bodyFont),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, 'Wins & risks', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(100, 210, 480, 40, 'Wins', { fontSize: 23, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(100, 260, 480, 320, "Closed the quarter's largest deal at $310K\nNPS crossed 50 for the first time\nZero P1 incidents in the last 6 weeks", {
        fontSize: 19,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
      txt(660, 210, 480, 40, 'Risks', { fontSize: 23, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(660, 260, 480, 320, 'Vertical expansion is 2 weeks behind schedule\nChurn reduction work is under-resourced\nHealth scoring launch needs QA sign-off', {
        fontSize: 19,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
    ]),
    mkSlide(
      [
        txt(40, 220, 1200, 90, 'Focus for Q4', { fontSize: 50, bold: true, align: 'center', color: '#f0fdf4', fontFamily: th.titleFont }),
        txt(
          40,
          330,
          1200,
          200,
          'Close the gap on vertical expansion\nStaff up the retention pod\nHarden the platform ahead of peak season',
          { fontSize: 24, align: 'center', bullets: true, color: '#ecfdf5', lineHeight: 1.6, fontFamily: th.bodyFont },
        ),
      ],
      { background: { type: 'solid', color: th.accent }, notes: 'Assign a single owner and date to each Q4 focus area before the room disperses.' },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 5. Product launch plan (sunrise theme)
// ================================================================

function deckProductLaunchPlan(): SlidesContent {
  const th = getTheme('sunrise')
  const phases: [string, string, number][] = [
    ['TEASE', '2 weeks out', 1],
    ['LAUNCH', 'Launch week', 0.7],
    ['AMPLIFY', 'Weeks 2-4', 0.45],
    ['SCALE', 'Month 2+', 0.25],
  ]
  const phCols = [100, 380, 660, 940]
  const channels: [string, string][] = [
    ['Email', 'Waitlist nurture sequence and launch-day blast'],
    ['Social', 'Teaser countdown across Instagram and X'],
    ['Press', 'Embargoed briefings with 10 target outlets'],
    ['Paid ads', 'Retargeting campaign for waitlist non-converters'],
  ]
  const chCols = [100, 380, 660, 940]
  const pillars: [string, string][] = [
    ['Faster', 'Get to your first result in under 5 minutes'],
    ['Simpler', 'No setup, no training, no learning curve'],
    ['Trusted', 'Built with the security your team already expects'],
  ]
  const plCols = [100, 470, 840]
  const targets: [string, string][] = [
    ['5,000', 'Waitlist signups pre-launch'],
    ['25', 'Press mentions in launch week'],
    ['8%', 'Waitlist-to-paid conversion'],
  ]
  const tCols = [100, 470, 840]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 220, 100, 6, 'rect', th.accent),
        txt(40, 250, 1200, 110, '[Product Name] Launch Plan', { fontSize: 58, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
        txt(40, 370, 1200, 50, 'Go-to-market plan · [Launch Quarter]', { fontSize: 22, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: 'State the launch date once, up front, and refer back to it as the anchor for every timeline slide.' },
    ),
    mkSlide(
      [
        txt(100, 70, 900, 80, 'What success looks like', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(
          100,
          220,
          980,
          380,
          'Drive 5,000 waitlist signups before launch day\nGenerate 25 pieces of earned press coverage\nConvert 8% of waitlist to paying customers in week one',
          { fontSize: 25, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'Tie every tactic in this deck back to one of these three numbers.' },
    ),
    mkSlide([
      txt(100, 60, 700, 70, 'Timeline', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      ...phases.flatMap(([label, sub, opacity], i) => [
        shp(phCols[i], 260, 240, 90, 'chevron', th.accent, { opacity }),
        txt(phCols[i], 285, 240, 40, label, { fontSize: 19, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(phCols[i], 360, 240, 30, sub, { fontSize: 15, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 70, 700, 80, 'Channel plan', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...channels.flatMap(([name, sub], i) => [
        shp(chCols[i], 260, 240, 220, 'roundRect', th.accent, { opacity: 0.14 }),
        txt(chCols[i], 300, 240, 40, name, { fontSize: 22, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(chCols[i], 350, 240, 110, sub, { fontSize: 15, align: 'center', color: th.bodyColor, lineHeight: 1.4, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 70, 700, 80, 'Messaging pillars', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...pillars.flatMap(([name, sub], i) => [
        shp(plCols[i], 260, 60, 6, 'rect', th.accent),
        txt(plCols[i], 290, 300, 90, String(i + 1).padStart(2, '0'), { fontSize: 40, bold: true, color: th.accent, fontFamily: th.titleFont, opacity: 0.5 }),
        txt(plCols[i], 380, 300, 60, name, { fontSize: 32, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        txt(plCols[i], 445, 300, 150, sub, { fontSize: 17, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, 'Targets', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...targets.flatMap(([value, label], i) => [
        txt(tCols[i], 240, 340, 90, value, { fontSize: 54, bold: true, align: 'center', color: th.accent, fontFamily: th.titleFont }),
        txt(tCols[i], 335, 340, 60, label, { fontSize: 18, align: 'center', color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(40, 220, 1200, 100, 'Ready, set, launch.', { fontSize: 56, bold: true, align: 'center', valign: 'middle', color: '#78350f', fontFamily: th.titleFont }),
        txt(
          40,
          330,
          1200,
          220,
          'Freeze scope one week before launch day\nDry-run the launch-day sequence with the full team\nHave a rollback plan ready before you ship',
          { fontSize: 23, align: 'center', bullets: true, color: '#92400e', lineHeight: 1.55, fontFamily: th.bodyFont },
        ),
      ],
      {
        background: { type: 'gradient', from: '#fef3c7', to: '#fde68a', angle: 120 },
        notes: 'Walk through the launch-day runbook and confirm every owner by name before you close the meeting.',
      },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 6. Webinar deck (grape theme)
// ================================================================

function deckWebinar(): SlidesContent {
  const th = getTheme('grape')
  const hosts: [string, string, string][] = [
    ['AC', 'Aisha Cole', 'Head of Customer Success, [Your Company]'],
    ['MD', 'Marco Diaz', 'Senior Product Manager, [Your Company]'],
  ]
  const hCols = [140, 660]
  const agenda: [string, string][] = [
    ['5 min', 'Welcome & introductions'],
    ['15 min', 'The scaling chaos framework'],
    ['20 min', 'Case study walkthrough'],
    ['10 min', 'Live Q&A'],
  ]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 220, 100, 6, 'rect', th.accent),
        txt(40, 240, 1200, 120, 'Scaling Without the Chaos:\nA Playbook for Growing Teams', {
          fontSize: 44,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: th.titleColor,
          fontFamily: th.titleFont,
          lineHeight: 1.25,
        }),
        txt(40, 375, 1200, 50, '[Date] · [Time] [Timezone] · Hosted by [Your Company]', { fontSize: 19, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: 'Start recording, confirm audio with a co-host, and open the doors two minutes before the stated start time.' },
    ),
    mkSlide([
      txt(100, 70, 900, 70, 'Meet your hosts', { fontSize: 48, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 160, 80, 8, 'rect', th.accent),
      ...hosts.flatMap(([initials, name, role], i) => [
        shp(hCols[i] + 190, 190, 100, 100, 'ellipse', th.accent, { opacity: 0.25 }),
        txt(hCols[i], 190, 480, 100, initials, { fontSize: 30, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(hCols[i], 310, 480, 40, name, { fontSize: 24, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(hCols[i], 355, 480, 60, role, { fontSize: 16, align: 'center', color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, "What you'll learn", { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        220,
        980,
        380,
        'How to spot the 3 warning signs of scaling chaos\nA repeatable framework for structuring growing teams\nReal examples from companies that scaled past 100 people',
        { fontSize: 25, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide(
      [
        txt(100, 70, 700, 80, 'Agenda', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        ...agenda.flatMap(([time, desc], i) => {
          const y = 220 + i * 80
          return [
            shp(100, y, 110, 50, 'roundRect', th.accent, { opacity: 0.22 }),
            txt(100, y, 110, 50, time, { fontSize: 16, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
            txt(230, y, 850, 50, desc, { fontSize: 22, valign: 'middle', color: th.bodyColor, fontFamily: th.bodyFont }),
          ]
        }),
      ],
      { notes: 'Post the agenda in the chat as well so latecomers can orient themselves without interrupting.' },
    ),
    mkSlide([
      txt(
        40,
        260,
        1200,
        160,
        "Structure isn't bureaucracy —\nit's what lets teams move fast without breaking.",
        { fontSize: 40, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont, lineHeight: 1.3 },
      ),
    ]),
    mkSlide(
      [
        txt(100, 70, 700, 80, 'Live Q&A', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(
          100,
          220,
          980,
          400,
          "Drop your questions in the chat any time — we'll pull the best ones\nCan't stay for the whole thing? We're recording and will send the replay\nStick around after for informal networking",
          { fontSize: 23, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: "Have a co-host actively monitoring the chat throughout so no question gets missed by the time Q&A opens." },
    ),
    mkSlide(
      [
        txt(40, 230, 1200, 110, 'See you there!', { fontSize: 56, bold: true, align: 'center', valign: 'middle', color: '#f5f3ff', fontFamily: th.titleFont }),
        txt(40, 360, 1200, 90, "Save your spot: [registration link]\nCan't make it live? Register anyway for the replay.", {
          fontSize: 22,
          align: 'center',
          color: '#ddd6fe',
          lineHeight: 1.4,
          fontFamily: th.bodyFont,
        }),
      ],
      { background: { type: 'gradient', from: th.bg.from ?? th.accent, to: th.bg.to ?? th.titleColor, angle: 300 } },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 7. Consulting recommendation (noir theme)
// ================================================================

function deckConsultingRecommendation(): SlidesContent {
  const th = getTheme('noir')
  const options: [string, string, string, string][] = [
    ['A', 'Optimize in place', 'Keep 3 centers, upgrade routing software', 'Low cost, low upside'],
    ['B', 'Consolidate to one hub', 'Merge into a single automated center', 'Highest savings, 6-month transition'],
    ['C', 'Outsource fulfillment', 'Hand off to a third-party logistics partner', 'Fast to launch, less control'],
  ]
  const oCols = [100, 470, 840]
  const phases: [string, string, number][] = [
    ['Q1', 'Finalize site & vendor', 1],
    ['Q2', 'Build-out & migration', 0.7],
    ['Q3', 'Phased cutover', 0.45],
    ['Q4', 'Full consolidation', 0.25],
  ]
  const phCols = [100, 380, 660, 940]

  const slides: Slide[] = [
    mkSlide(
      [
        txt(100, 200, 1080, 140, 'Strategic Recommendation', { fontSize: 68, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 360, 100, 6, 'rect', th.accent),
        txt(100, 390, 1080, 60, 'Prepared for [Client Company] by [Your Firm]', { fontSize: 22, color: th.accent, fontFamily: th.bodyFont }),
      ],
      { notes: 'State the recommendation in one sentence before you show a single slide of supporting analysis.' },
    ),
    mkSlide(
      [
        txt(100, 80, 900, 100, 'Executive summary', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 190, 80, 8, 'rect', th.accent),
        txt(
          100,
          240,
          980,
          340,
          "After a six-week review of [Client Company]'s operations, we recommend consolidating three regional fulfillment centers into one automated hub — cutting shipping costs 18% while improving delivery speed.",
          { fontSize: 25, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'This single sentence should be memorable enough that a stakeholder can repeat it in the hallway afterward.' },
    ),
    mkSlide(
      [
        txt(100, 70, 900, 80, 'Key findings', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(
          100,
          220,
          980,
          380,
          'Three fulfillment centers operate at just 61% average capacity\nCross-regional shipping adds [X] days to average delivery time\nWarehouse labor costs rose 34% since [Year] without a matching output gain',
          { fontSize: 24, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'Lead with the finding that surprised the client most in your working sessions — it earns attention for the rest.' },
    ),
    mkSlide([
      txt(100, 60, 900, 70, 'Options we considered', { fontSize: 46, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      ...options.flatMap(([letter, name, desc, tradeoff], i) => [
        shp(oCols[i], 210, 340, 420, 'roundRect', i === 1 ? th.accent : th.bodyColor, { opacity: i === 1 ? 0.16 : 0.06 }),
        txt(oCols[i] + 20, 230, 300, 30, 'OPTION ' + letter, { fontSize: 15, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(oCols[i] + 20, 268, 300, 70, name, { fontSize: 22, bold: true, color: th.titleColor, fontFamily: th.titleFont, lineHeight: 1.2 }),
        txt(oCols[i] + 20, 350, 300, 110, desc, { fontSize: 15, color: th.bodyColor, lineHeight: 1.4, fontFamily: th.bodyFont }),
        txt(oCols[i] + 20, 480, 300, 100, tradeoff, { fontSize: 14, italic: true, color: i === 1 ? th.accent : th.bodyColor, lineHeight: 1.4, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(40, 240, 1200, 180, 'Consolidate to a single, automated\nfulfillment hub within two quarters.', {
        fontSize: 46,
        bold: true,
        align: 'center',
        valign: 'middle',
        color: th.titleColor,
        fontFamily: th.titleFont,
        lineHeight: 1.3,
      }),
      txt(40, 440, 1200, 50, 'Option B delivers the highest long-term savings for a manageable transition cost.', {
        fontSize: 20,
        align: 'center',
        color: th.accent,
        fontFamily: th.bodyFont,
      }),
    ]),
    mkSlide([
      txt(100, 60, 700, 70, 'Implementation roadmap', { fontSize: 46, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      ...phases.flatMap(([label, sub, opacity], i) => [
        shp(phCols[i], 260, 240, 90, 'chevron', th.accent, { opacity }),
        txt(phCols[i], 285, 240, 40, label, { fontSize: 19, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(phCols[i], 360, 240, 40, sub, { fontSize: 14, align: 'center', color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(40, 230, 1200, 110, 'Next steps', { fontSize: 54, bold: true, align: 'center', valign: 'middle', color: '#0a0a0a', fontFamily: th.titleFont }),
        txt(40, 360, 1200, 120, "Approve the site selection budget by [Date]\nWe'll deliver a detailed transition plan within 10 business days", {
          fontSize: 22,
          align: 'center',
          color: '#171717',
          lineHeight: 1.4,
          fontFamily: th.bodyFont,
        }),
      ],
      { background: { type: 'solid', color: th.accent }, notes: 'Ask for the approval decision directly rather than ending on an open-ended "any questions?"' },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// Template registry
// ================================================================

export const slidesBusinessTemplates: SlidesTemplate[] = [
  {
    id: 'sales-proposal',
    name: 'Sales proposal',
    description: 'A persuasive sales deck that walks a prospect from problem to pricing to signed deal.',
    category: 'Business',
    accent: '#4f46e5',
    glyph: '💼',
    make: deckSalesProposal,
  },
  {
    id: 'company-all-hands',
    name: 'Company all-hands',
    description: "A ready-to-run all-hands deck for sharing wins, metrics and what's next with the whole company.",
    category: 'Business',
    accent: '#38bdf8',
    glyph: '📣',
    make: deckCompanyAllHands,
  },
  {
    id: 'client-case-study',
    name: 'Client case study',
    description: 'Turn a happy customer into your best sales asset with a before-and-after case study deck.',
    category: 'Marketing',
    accent: '#0891b2',
    glyph: '📊',
    make: deckClientCaseStudy,
  },
  {
    id: 'okr-quarterly-review',
    name: 'OKR quarterly review',
    description: 'Score objectives and key results with built-in progress bars for a focused quarterly review.',
    category: 'Business',
    accent: '#059669',
    glyph: '🎯',
    make: deckOkrReview,
  },
  {
    id: 'product-launch-plan',
    name: 'Product launch plan',
    description: 'Plan and pitch a product launch with a clear timeline, channel mix and target metrics.',
    category: 'Marketing',
    accent: '#d97706',
    glyph: '🚀',
    make: deckProductLaunchPlan,
  },
  {
    id: 'webinar-deck',
    name: 'Webinar deck',
    description: 'A polished webinar deck with host intros, a timed agenda and a strong call to action.',
    category: 'Marketing',
    accent: '#c4b5fd',
    glyph: '🎥',
    make: deckWebinar,
  },
  {
    id: 'consulting-recommendation',
    name: 'Consulting recommendation',
    description: 'Present findings, compare options and land a clear recommendation like a strategy consultant.',
    category: 'Business',
    accent: '#eab308',
    glyph: '🧭',
    make: deckConsultingRecommendation,
  },
]
