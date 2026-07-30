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
// 1. Startup pitch — Orbit (aurora theme)
// ================================================================

function deckStartupPitch(): SlidesContent {
  const th = getTheme('aurora')
  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 244, 100, 6, 'rect', th.accent),
        txt(0, 270, 1280, 130, 'Orbit', {
          fontSize: 88,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: th.titleColor,
          fontFamily: th.titleFont,
        }),
        txt(0, 410, 1280, 50, "Reclaim your team's focus.", {
          fontSize: 26,
          align: 'center',
          valign: 'middle',
          color: th.bodyColor,
          fontFamily: th.bodyFont,
        }),
        txt(100, 60, 500, 30, 'ORBIT · SEED PITCH', {
          fontSize: 15,
          bold: true,
          color: th.accent,
          fontFamily: th.bodyFont,
        }),
      ],
      { notes: "Open with the 30-second hook: teams waste a full day a week context-switching. Introduce yourself and why you're the right team to fix it." },
    ),
    mkSlide(
      [
        txt(100, 70, 700, 80, 'The problem', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(
          100,
          220,
          760,
          360,
          'Teams lose 12+ hours a week to status meetings\nContext is scattered across five different tools\nManagers fly blind between weekly check-ins',
          { fontSize: 26, color: th.bodyColor, bullets: true, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
        shp(860, 330, 340, 340, 'ellipse', th.accent, { opacity: 0.14 }),
      ],
      { notes: 'Ground this in a real customer story if you have one — specifics beat statistics.' },
    ),
    mkSlide([
      txt(100, 70, 700, 80, 'Our solution', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        210,
        480,
        380,
        'One workspace that replaces status meetings with a living, always-current picture of the work.',
        { fontSize: 24, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
      shp(640, 210, 8, 44, 'rect', th.accent),
      txt(670, 204, 500, 56, 'Auto-updating project timelines', { fontSize: 22, color: th.titleColor, fontFamily: th.bodyFont, valign: 'middle' }),
      shp(640, 300, 8, 44, 'rect', th.accent),
      txt(670, 294, 500, 56, 'One inbox for every tool you already use', { fontSize: 22, color: th.titleColor, fontFamily: th.bodyFont, valign: 'middle' }),
      shp(640, 390, 8, 44, 'rect', th.accent),
      txt(670, 384, 500, 56, 'Weekly digest, zero status meetings', { fontSize: 22, color: th.titleColor, fontFamily: th.bodyFont, valign: 'middle' }),
    ]),
    mkSlide([
      txt(100, 70, 700, 80, 'The opportunity', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(100, 240, 340, 110, '$48B', { fontSize: 60, bold: true, align: 'center', color: th.accent, fontFamily: th.titleFont }),
      txt(100, 355, 340, 50, 'Total addressable market', { fontSize: 19, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont, lineHeight: 1.3 }),
      txt(470, 240, 340, 110, '$6.2B', { fontSize: 60, bold: true, align: 'center', color: th.accent, fontFamily: th.titleFont }),
      txt(470, 355, 340, 50, 'Serviceable market', { fontSize: 19, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont, lineHeight: 1.3 }),
      txt(840, 240, 340, 110, '$310M', { fontSize: 60, bold: true, align: 'center', color: th.accent, fontFamily: th.titleFont }),
      txt(840, 355, 340, 50, 'Obtainable in 3 years', { fontSize: 19, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont, lineHeight: 1.3 }),
    ]),
    mkSlide([
      txt(100, 70, 700, 80, 'Inside Orbit', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        210,
        470,
        400,
        'Live project timelines that update themselves\nSmart digest replaces the weekly status meeting\nOne inbox pulling from Slack, email and GitHub',
        { fontSize: 24, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
      shp(620, 190, 560, 410, 'roundRect', th.accent, { opacity: 0.08, stroke: th.accent, strokeWidth: 2 }),
      txt(620, 570, 560, 30, 'Product preview', { fontSize: 16, italic: true, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
    ]),
    mkSlide([
      txt(100, 60, 700, 70, 'The team', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      shp(190, 200, 120, 120, 'ellipse', th.accent, { opacity: 0.25 }),
      txt(100, 340, 300, 40, 'Maya Chen', { fontSize: 22, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
      txt(100, 385, 300, 30, 'CEO — ex-Stripe', { fontSize: 17, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      shp(550, 200, 120, 120, 'ellipse', th.accent, { opacity: 0.25 }),
      txt(460, 340, 300, 40, 'Diego Ruiz', { fontSize: 22, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
      txt(460, 385, 300, 30, 'CTO — ex-Figma', { fontSize: 17, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      shp(910, 200, 120, 120, 'ellipse', th.accent, { opacity: 0.25 }),
      txt(820, 340, 300, 40, 'Priya Anand', { fontSize: 22, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
      txt(820, 385, 300, 30, 'Head of Design — ex-Notion', { fontSize: 17, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
    ]),
    mkSlide(
      [
        txt(140, 220, 1000, 120, 'Join us', { fontSize: 80, bold: true, align: 'center', valign: 'middle', color: '#0b1220', fontFamily: th.titleFont }),
        txt(190, 360, 900, 90, 'Raising $2.5M seed to help 50,000 teams reclaim their focus by 2027.', {
          fontSize: 24,
          align: 'center',
          valign: 'middle',
          color: '#0b1220',
          lineHeight: 1.4,
          fontFamily: th.bodyFont,
        }),
        txt(0, 600, 1280, 40, 'hello@orbit.app   ·   orbit.app', { fontSize: 18, align: 'center', color: '#0b1220', fontFamily: th.bodyFont }),
      ],
      { background: { type: 'solid', color: th.accent }, notes: 'Close with the ask number and timeline stated once, clearly, then stop talking.' },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 2. Marketing plan — Solace (grape theme)
// ================================================================

function deckMarketingPlan(): SlidesContent {
  const th = getTheme('grape')
  const channels: [string, string][] = [
    ['Paid social', 'Instagram & TikTok product demos, 40% of budget'],
    ['Lifecycle email', 'Onboarding and win-back journeys, 25% of budget'],
    ['Content & SEO', 'Long-form guides and organic search, 20% of budget'],
    ['Partnerships', 'Studio and gym co-marketing, 15% of budget'],
  ]
  const chCols = [100, 380, 660, 940]
  const phases: [string, number][] = [
    ['July — Teaser + waitlist', 1],
    ['August — Launch + paid push', 0.6],
    ['September — Optimize + scale', 0.35],
  ]
  const phCols = [100, 470, 840]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 230, 100, 6, 'rect', th.accent),
        txt(0, 260, 1280, 120, 'Solace Marketing Plan', {
          fontSize: 68,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: th.titleColor,
          fontFamily: th.titleFont,
        }),
        txt(0, 390, 1280, 50, 'Q3 2026 · Growth & brand awareness', { fontSize: 24, align: 'center', valign: 'middle', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: "Set the quarter's single top-line goal before diving into tactics." },
    ),
    mkSlide([
      txt(100, 70, 700, 80, 'Goals for the quarter', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(100, 210, 480, 380, 'Grow monthly active users 25%\nCut cost-per-acquisition by 15%\nLaunch in two new metro markets', {
        fontSize: 25,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
      txt(640, 210, 500, 90, '+25%', { fontSize: 52, bold: true, color: th.accent, fontFamily: th.titleFont }),
      txt(640, 295, 500, 34, 'Target MAU growth', { fontSize: 18, color: th.bodyColor, fontFamily: th.bodyFont }),
      txt(640, 345, 500, 90, '-15%', { fontSize: 52, bold: true, color: th.accent, fontFamily: th.titleFont }),
      txt(640, 430, 500, 34, 'Target CPA reduction', { fontSize: 18, color: th.bodyColor, fontFamily: th.bodyFont }),
    ]),
    mkSlide(
      [
        txt(100, 70, 700, 80, "Who we're talking to", { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        shp(100, 210, 510, 400, 'roundRect', th.accent, { opacity: 0.1 }),
        txt(130, 235, 450, 40, 'Primary audience', { fontSize: 24, bold: true, color: th.titleColor, fontFamily: th.bodyFont }),
        txt(130, 285, 450, 300, 'Urban professionals, 25-40\nHealth-conscious, time-poor\nAlready pay for one wellness app', {
          fontSize: 21,
          bullets: true,
          color: th.bodyColor,
          lineHeight: 1.5,
          fontFamily: th.bodyFont,
        }),
        shp(670, 210, 510, 400, 'roundRect', th.accent, { opacity: 0.1 }),
        txt(700, 235, 450, 40, 'Secondary audience', { fontSize: 24, bold: true, color: th.titleColor, fontFamily: th.bodyFont }),
        txt(700, 285, 450, 300, 'HR & benefits managers\nEvaluating perks for teams of 50-500\nDecision window: Q4 renewals', {
          fontSize: 21,
          bullets: true,
          color: th.bodyColor,
          lineHeight: 1.5,
          fontFamily: th.bodyFont,
        }),
      ],
      { notes: 'Read the primary persona out loud — it keeps the room grounded in a real person, not a segment name.' },
    ),
    mkSlide([
      txt(100, 70, 700, 80, "Where we'll show up", { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...channels.flatMap(([name, sub], i) => [
        shp(chCols[i], 260, 240, 220, 'roundRect', th.accent, { opacity: 0.12 }),
        txt(chCols[i], 300, 240, 40, name, { fontSize: 22, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(chCols[i], 350, 240, 110, sub, { fontSize: 16, align: 'center', color: th.bodyColor, lineHeight: 1.4, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 60, 700, 70, '12-week rollout', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      ...phases.flatMap(([label, opacity], i) => [
        shp(phCols[i], 280, 340, 100, 'chevron', th.accent, { opacity }),
        txt(phCols[i], 310, 340, 40, label, { fontSize: 19, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(140, 200, 1000, 110, '$180K quarterly budget', {
          fontSize: 60,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: th.titleColor,
          fontFamily: th.titleFont,
        }),
        txt(190, 330, 900, 80, '40% paid social · 25% lifecycle email · 20% content · 15% partnerships', {
          fontSize: 22,
          align: 'center',
          valign: 'middle',
          color: th.bodyColor,
          lineHeight: 1.4,
          fontFamily: th.bodyFont,
        }),
        txt(0, 540, 1280, 40, "Let's make Q3 the best growth quarter yet.", { fontSize: 26, bold: true, align: 'center', color: th.titleColor, fontFamily: th.titleFont }),
      ],
      {
        background: { type: 'gradient', from: '#4c1d95', to: '#7e22ce', angle: 135 },
        notes: 'Walk through the budget split by channel and tie every dollar back to a goal on slide two.',
      },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 3. Quarterly business review — Northwind Retail (slate theme)
// ================================================================

function deckQBR(): SlidesContent {
  const th = getTheme('slate')
  const highlights: [string, string][] = [
    ['+18%', 'Revenue growth YoY'],
    ['92%', 'Customer retention'],
    ['4.6/5', 'Avg. CSAT score'],
  ]
  const hCols = [100, 470, 840]
  const metricRows: [string, string, number][] = [
    ['Revenue', '$4.2M', 460],
    ['Active users', '128,400', 360],
    ['Net revenue retention', '114%', 410],
    ['Churn', '2.1%', 90],
  ]
  const quarters: [string, string, number][] = [
    ['Q1', '$3.1M', 200],
    ['Q2', '$3.6M', 240],
    ['Q3', '$3.9M', 270],
    ['Q4', '$4.2M', 300],
  ]
  const qCols = [160, 430, 700, 970]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 230, 100, 6, 'rect', th.accent),
        txt(0, 260, 1280, 120, 'Q2 Business Review', { fontSize: 68, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
        txt(0, 390, 1280, 50, 'Northwind Retail · Executive summary', { fontSize: 24, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: 'Two minutes max on this slide — state the headline result and move on.' },
    ),
    mkSlide([
      txt(100, 80, 700, 80, 'Agenda', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 174, 80, 8, 'rect', th.accent),
      txt(100, 220, 900, 380, 'Highlights & headline metrics\nRevenue by quarter\nRisks and watch-outs\nPriorities for Q3', {
        fontSize: 27,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.6,
        fontFamily: th.bodyFont,
      }),
    ]),
    mkSlide([
      txt(100, 70, 700, 80, 'Highlights', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...highlights.flatMap(([value, label], i) => [
        txt(hCols[i], 230, 340, 90, value, { fontSize: 56, bold: true, align: 'center', color: th.accent, fontFamily: th.titleFont }),
        txt(hCols[i], 330, 340, 60, label, { fontSize: 19, align: 'center', color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(100, 70, 700, 80, 'Key metrics', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        ...metricRows.flatMap(([label, value, barW], i) => {
          const y = 220 + i * 100
          return [
            txt(140, y, 340, 50, label, { fontSize: 22, color: th.titleColor, valign: 'middle', fontFamily: th.bodyFont }),
            txt(560, y, 140, 50, value, { fontSize: 24, bold: true, align: 'right', color: th.titleColor, valign: 'middle', fontFamily: th.bodyFont }),
            shp(760, y + 18, barW, 14, 'rect', th.accent, { opacity: 0.85 }),
            shp(140, y + 74, 1000, 1, 'rect', th.bodyColor, { opacity: 0.2 }),
          ]
        }),
      ],
      { notes: 'Pause after this slide for questions before moving into the quarterly trend.' },
    ),
    mkSlide([
      txt(100, 70, 700, 80, 'Revenue by quarter', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      shp(140, 600, 1040, 3, 'rect', th.bodyColor, { opacity: 0.3 }),
      ...quarters.flatMap(([label, value, height], i) => [
        shp(qCols[i], 600 - height, 180, height, 'rect', th.accent, { opacity: 0.3 + i * 0.18 }),
        txt(qCols[i], 600 - height - 40, 180, 32, value, { fontSize: 18, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(qCols[i], 610, 180, 30, label, { fontSize: 18, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(100, 70, 700, 80, 'Risks & watch-outs', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(
          100,
          220,
          980,
          380,
          'Enterprise sales cycle lengthening past 90 days\nHosting costs up 22% with usage growth\nTwo senior engineers rolling off in Q3',
          { fontSize: 26, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'Be candid here — this is the slide that builds trust with the board.' },
    ),
    mkSlide(
      [
        txt(100, 70, 700, 80, 'Priorities for Q3', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(100, 220, 980, 380, 'Close 6 enterprise deals in pipeline\nShip usage-based pricing\nBackfill senior engineering roles', {
          fontSize: 26,
          bullets: true,
          color: th.bodyColor,
          lineHeight: 1.5,
          fontFamily: th.bodyFont,
        }),
      ],
      { background: { type: 'solid', color: '#eef2ff' }, notes: 'End on owners and dates for each priority, not just the list.' },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 4. Product roadmap — Waypoint (ocean theme)
// ================================================================

function deckProductRoadmap(): SlidesContent {
  const th = getTheme('ocean')
  const phases: [string, string, number][] = [
    ['NOW — Q3', 'Custom fields for every project type', 1],
    ['NEXT — Q4', 'Native integrations and automation recipes', 0.55],
    ['LATER — 2027', 'AI summaries and enterprise SSO', 0.3],
  ]
  const pCols = [100, 470, 840]

  const slides: Slide[] = [
    mkSlide([
      shp(590, 230, 100, 6, 'rect', th.accent),
      txt(0, 260, 1280, 120, 'Product Roadmap', { fontSize: 68, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
      txt(0, 390, 1280, 50, 'Waypoint · FY2026 H2', { fontSize: 24, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
    ]),
    mkSlide(
      [
        txt(100, 80, 900, 100, "Where we're headed", { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 190, 80, 8, 'rect', th.accent),
        txt(
          100,
          240,
          900,
          200,
          "Make Waypoint the default way teams plan, ship and celebrate their work — without leaving the flow of building.",
          { fontSize: 28, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'Anchor every roadmap item back to this sentence — cut anything that does not serve it.' },
    ),
    mkSlide([
      txt(100, 60, 700, 70, 'Now · Next · Later', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      ...phases.flatMap(([label, sub, opacity], i) => [
        shp(pCols[i], 260, 340, 110, 'chevron', th.accent, { opacity }),
        txt(pCols[i], 290, 340, 40, label, { fontSize: 22, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(pCols[i], 390, 340, 90, sub, { fontSize: 17, align: 'center', color: th.bodyColor, lineHeight: 1.4, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 70, 700, 80, 'Now — shipping this quarter', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(100, 210, 980, 400, 'Custom fields for every project type\nBulk editing across boards\nDark mode for the mobile app', {
        fontSize: 27,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.55,
        fontFamily: th.bodyFont,
      }),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, 'Next & later', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(100, 210, 480, 40, 'Next — Q4', { fontSize: 26, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(100, 260, 480, 340, 'Native integrations: Linear, Figma, Notion\nAutomation recipes\nTeam capacity view', {
        fontSize: 22,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
      txt(660, 210, 480, 40, 'Later — 2027', { fontSize: 26, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(660, 260, 480, 340, 'AI project summarization\nCustom reporting builder\nEnterprise SSO & audit log', {
        fontSize: 22,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
    ]),
    mkSlide(
      [
        txt(140, 240, 1000, 110, "Roadmaps are a promise, not a plan.", {
          fontSize: 48,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: '#ecfeff',
          fontFamily: th.titleFont,
        }),
        txt(190, 380, 900, 60, 'Questions and feedback → #product-roadmap', { fontSize: 22, align: 'center', color: '#cffafe', fontFamily: th.bodyFont }),
      ],
      {
        background: { type: 'gradient', from: '#0891b2', to: '#164e63', angle: 135 },
        notes: 'Invite async feedback in the team channel rather than debating line items live.',
      },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 5. Lesson plan — Photosynthesis (meadow theme)
// ================================================================

function deckLessonPlan(): SlidesContent {
  const th = getTheme('meadow')
  const agenda: [string, string][] = [
    ['5 min', 'Warm-up: what do plants eat?'],
    ['15 min', 'Mini-lesson: the photosynthesis equation'],
    ['15 min', 'Group activity: build a leaf diagram'],
    ['10 min', 'Exit ticket & wrap-up'],
  ]

  const slides: Slide[] = [
    mkSlide([
      shp(590, 220, 100, 6, 'rect', th.accent),
      txt(0, 250, 1280, 120, 'Photosynthesis', { fontSize: 76, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
      txt(0, 380, 1280, 50, 'Grade 5 Science · 45-minute lesson', { fontSize: 24, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
    ]),
    mkSlide(
      [
        txt(100, 80, 700, 80, 'Learning objectives', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 174, 80, 8, 'rect', th.accent),
        txt(
          100,
          220,
          980,
          380,
          'Explain how plants make their own food\nIdentify the role of sunlight, water and carbon dioxide\nLabel the parts of a leaf involved in photosynthesis',
          { fontSize: 26, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'Read the objectives aloud and have students restate one in their own words before you continue.' },
    ),
    mkSlide([
      txt(100, 70, 700, 80, "Today's agenda", { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...agenda.flatMap(([time, desc], i) => {
        const y = 220 + i * 80
        return [
          shp(100, y, 110, 50, 'roundRect', th.accent, { opacity: 0.18 }),
          txt(100, y, 110, 50, time, { fontSize: 17, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
          txt(230, y, 850, 50, desc, { fontSize: 22, valign: 'middle', color: th.bodyColor, fontFamily: th.bodyFont }),
        ]
      }),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, 'Warm-up (5 min)', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        220,
        980,
        340,
        'Turn to a partner and discuss: where do you think a plant gets its food from? Write your best guess on a sticky note.',
        { fontSize: 28, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
      shp(900, 380, 300, 300, 'ellipse', th.accent, { opacity: 0.14 }),
    ]),
    mkSlide(
      [
        txt(100, 60, 900, 80, 'The photosynthesis equation', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 154, 80, 8, 'rect', th.accent),
        txt(100, 230, 1080, 60, 'Sunlight  +  Water  +  Carbon dioxide     →     Glucose  +  Oxygen', {
          fontSize: 28,
          bold: true,
          align: 'center',
          color: th.titleColor,
          fontFamily: th.bodyFont,
        }),
        txt(
          100,
          320,
          1080,
          260,
          'Chlorophyll in the leaf captures sunlight energy. Roots pull in water, and tiny pores called stomata let carbon dioxide in. The plant combines them to make glucose for energy and releases oxygen as a byproduct.',
          { fontSize: 23, color: th.bodyColor, lineHeight: 1.55, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'Draw the equation on the board as you talk through each term — the visual repetition helps it stick.' },
    ),
    mkSlide([
      txt(100, 70, 900, 80, 'Group activity (15 min)', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        220,
        980,
        380,
        'In groups of 3, label a diagram of a leaf with: sunlight, water uptake, carbon dioxide intake, and oxygen release\nEach group presents one label to the class',
        { fontSize: 26, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide(
      [
        txt(140, 220, 1000, 110, 'Exit ticket & homework', { fontSize: 54, bold: true, align: 'center', valign: 'middle', color: '#f0fdf4', fontFamily: th.titleFont }),
        txt(
          190,
          360,
          900,
          180,
          'Exit ticket: draw and label the photosynthesis equation from memory.\nHomework: find one plant at home and note where it gets the most sunlight.',
          { fontSize: 24, align: 'center', color: '#ecfdf5', lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { background: { type: 'solid', color: th.accent }, notes: 'Collect exit tickets at the door as a quick formative check before students leave.' },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 6. Portfolio — Jordan Ave (noir theme)
// ================================================================

function deckPortfolio(): SlidesContent {
  const th = getTheme('noir')

  const slides: Slide[] = [
    mkSlide([
      txt(100, 210, 1080, 190, 'JORDAN AVE', { fontSize: 84, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 410, 100, 6, 'rect', th.accent),
      txt(100, 440, 900, 60, 'Visual & brand designer', { fontSize: 26, color: th.accent, fontFamily: th.bodyFont }),
    ]),
    mkSlide(
      [
        txt(100, 80, 900, 100, 'About', { fontSize: 58, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 190, 80, 8, 'rect', th.accent),
        txt(
          100,
          240,
          980,
          340,
          'Ten years designing brand systems and digital products for startups and studios across three continents. I care about typography, restraint, and craft.',
          { fontSize: 27, color: th.bodyColor, lineHeight: 1.55, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'Keep the bio to three sentences max — let the work speak for itself.' },
    ),
    mkSlide([
      txt(100, 150, 220, 200, '01', { fontSize: 110, bold: true, color: th.accent, fontFamily: th.titleFont, opacity: 0.7 }),
      shp(360, 250, 60, 6, 'rect', th.accent),
      txt(360, 160, 720, 80, 'Meridian Rebrand', { fontSize: 48, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      txt(
        360,
        270,
        720,
        200,
        'Full brand identity and packaging system for a climate-tech hardware startup — wordmark, color system, and a 40-page brand guideline.',
        { fontSize: 22, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
      txt(360, 500, 720, 40, 'Brand identity · Packaging · Guidelines', { fontSize: 17, color: th.accent, fontFamily: th.bodyFont }),
    ]),
    mkSlide([
      txt(940, 150, 220, 200, '02', { fontSize: 110, bold: true, align: 'right', color: th.accent, fontFamily: th.titleFont, opacity: 0.7 }),
      txt(100, 160, 760, 80, 'Solace App', { fontSize: 48, bold: true, align: 'right', color: th.titleColor, fontFamily: th.titleFont }),
      shp(760, 250, 60, 6, 'rect', th.accent),
      txt(
        100,
        270,
        760,
        200,
        'Product design and a design system for a wellness app — 40+ screens, a token-based component library, and motion guidelines.',
        { fontSize: 22, align: 'right', color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
      txt(100, 500, 760, 40, 'Product design · Design systems · Motion', { fontSize: 17, align: 'right', color: th.accent, fontFamily: th.bodyFont }),
    ]),
    mkSlide([
      txt(100, 80, 700, 80, 'Skills', { fontSize: 58, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 190, 80, 8, 'rect', th.accent),
      txt(100, 240, 320, 40, 'Brand', { fontSize: 24, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(100, 290, 320, 260, 'Identity systems\nTypography\nPackaging design', { fontSize: 20, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont }),
      txt(460, 240, 320, 40, 'Product', { fontSize: 24, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(460, 290, 320, 260, 'Design systems\nInteraction design\nPrototyping', { fontSize: 20, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont }),
      txt(820, 240, 320, 40, 'Tools', { fontSize: 24, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(820, 290, 320, 260, 'Figma\nAfter Effects\nWebflow', { fontSize: 20, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont }),
    ]),
    mkSlide(
      [
        txt(140, 240, 1000, 120, "Let's work together", { fontSize: 60, bold: true, align: 'center', valign: 'middle', color: '#0a0a0a', fontFamily: th.titleFont }),
        txt(190, 380, 900, 60, 'hello@jordanave.design   ·   jordanave.design', { fontSize: 24, align: 'center', color: '#171717', fontFamily: th.bodyFont }),
      ],
      { background: { type: 'solid', color: th.accent }, notes: "End on the single best way to reach you — don't list five channels." },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 7. Project kickoff — Website Relaunch (sunrise theme)
// ================================================================

function deckProjectKickoff(): SlidesContent {
  const th = getTheme('sunrise')
  const phases: [string, string, number][] = [
    ['Discovery', 'Weeks 1-2', 1],
    ['Design', 'Weeks 3-4', 0.75],
    ['Build', 'Weeks 5-6', 0.5],
    ['Launch', 'Weeks 7-8', 0.3],
  ]
  const phCols = [100, 380, 660, 940]
  const team: [string, string][] = [
    ['Priya', 'Project lead'],
    ['Sam', 'Design lead'],
    ['Alex', 'Engineering lead'],
    ['Noor', 'Content & SEO'],
  ]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 220, 100, 6, 'rect', th.accent),
        txt(0, 250, 1280, 120, 'Website Relaunch', { fontSize: 68, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
        txt(0, 380, 1280, 50, 'Project kickoff · July 2026', { fontSize: 24, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: 'Introduce the sponsor and the one-sentence project mission before anything else.' },
    ),
    mkSlide([
      txt(100, 80, 900, 80, 'Project overview', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 174, 80, 8, 'rect', th.accent),
      txt(
        100,
        220,
        980,
        340,
        'A ground-up redesign of the marketing site to improve page speed, refresh the brand, and lift conversion from trial signups.',
        { fontSize: 27, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, 'Goals & objectives', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        210,
        980,
        400,
        'Improve page load time from 4.1s to under 1.5s\nRaise trial signup conversion by 20%\nShip a fully accessible, WCAG 2.1 AA site',
        { fontSize: 26, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide([
      txt(100, 60, 700, 70, '8-week timeline', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      ...phases.flatMap(([label, weeks, opacity], i) => [
        shp(phCols[i], 260, 240, 90, 'chevron', th.accent, { opacity }),
        txt(phCols[i], 285, 240, 40, label, { fontSize: 20, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(phCols[i], 360, 240, 30, weeks, { fontSize: 15, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 70, 700, 80, 'Team & roles', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...team.flatMap(([name, role], i) => {
        const y = 220 + i * 75
        return [
          shp(100, y, 150, 50, 'roundRect', th.accent, { opacity: 0.2 }),
          txt(100, y, 150, 50, name, { fontSize: 19, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
          txt(270, y, 700, 50, role, { fontSize: 22, valign: 'middle', color: th.bodyColor, fontFamily: th.bodyFont }),
        ]
      }),
    ]),
    mkSlide(
      [
        txt(100, 70, 900, 80, 'Risks & success criteria', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(100, 210, 480, 40, 'Risks', { fontSize: 26, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(100, 260, 480, 340, 'Content migration slips past week 5\nBrand approval taking longer than planned', {
          fontSize: 21,
          bullets: true,
          color: th.bodyColor,
          lineHeight: 1.5,
          fontFamily: th.bodyFont,
        }),
        txt(660, 210, 480, 40, 'Success looks like', { fontSize: 26, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(660, 260, 480, 340, 'Site live by week 8\nLighthouse performance score 90+\n20% lift in trial signups within 30 days', {
          fontSize: 21,
          bullets: true,
          color: th.bodyColor,
          lineHeight: 1.5,
          fontFamily: th.bodyFont,
        }),
      ],
      { notes: 'Naming risks out loud at kickoff makes it safe for the team to raise them later.' },
    ),
    mkSlide(
      [
        txt(140, 230, 1000, 110, 'What happens next', { fontSize: 52, bold: true, align: 'center', valign: 'middle', color: '#fffbeb', fontFamily: th.titleFont }),
        txt(190, 370, 900, 200, 'Kickoff notes shared by EOD\nDesign discovery workshop — Thursday 10am\nWeekly standup every Monday, 9:30am', {
          fontSize: 23,
          align: 'center',
          color: '#fef3c7',
          lineHeight: 1.5,
          fontFamily: th.bodyFont,
        }),
      ],
      {
        background: { type: 'gradient', from: '#f59e0b', to: '#d97706', angle: 135 },
        notes: 'Send the recap email within the hour while momentum from the meeting is still high.',
      },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 8. Minimal (paper theme)
// ================================================================

function deckMinimal(): SlidesContent {
  const th = getTheme('paper')

  const slides: Slide[] = [
    mkSlide(
      [
        txt(120, 300, 1040, 120, 'Less, but better.', { fontSize: 72, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(122, 410, 90, 6, 'rect', th.accent),
      ],
      { notes: 'Let the title breathe — pause for three seconds before you start speaking.' },
    ),
    mkSlide([
      txt(120, 120, 400, 30, '01', { fontSize: 18, color: th.accent, bold: true, fontFamily: th.bodyFont }),
      txt(120, 290, 1040, 140, 'Clarity is a design decision, not an accident.', {
        fontSize: 50,
        bold: true,
        color: th.titleColor,
        fontFamily: th.titleFont,
        lineHeight: 1.3,
      }),
    ]),
    mkSlide([
      txt(120, 120, 400, 30, '02', { fontSize: 18, color: th.accent, bold: true, fontFamily: th.bodyFont }),
      txt(120, 290, 1040, 140, 'Every element on the page should earn its place.', {
        fontSize: 50,
        bold: true,
        color: th.titleColor,
        fontFamily: th.titleFont,
        lineHeight: 1.3,
      }),
    ]),
    mkSlide(
      [
        txt(160, 260, 960, 180, '"Simplicity is the ultimate sophistication."', {
          fontSize: 42,
          italic: true,
          align: 'center',
          color: th.titleColor,
          fontFamily: th.titleFont,
          lineHeight: 1.4,
        }),
        txt(160, 450, 960, 40, '— Leonardo da Vinci', { fontSize: 20, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: 'A single well-chosen quote lands better than three mediocre ones — resist adding more.' },
    ),
    mkSlide([
      shp(122, 405, 90, 6, 'rect', th.accent),
      txt(120, 300, 1040, 120, 'Thank you.', { fontSize: 72, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      txt(120, 420, 700, 40, 'yourname@studio.com', { fontSize: 22, color: th.bodyColor, fontFamily: th.bodyFont }),
    ]),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 9. Bold statement deck (ember theme)
// ================================================================

function deckBoldStatement(): SlidesContent {
  const th = getTheme('ember')

  const slides: Slide[] = [
    mkSlide(
      [
        txt(60, 190, 1160, 340, 'THINK\nBIGGER', {
          fontSize: 118,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: th.titleColor,
          fontFamily: th.titleFont,
          lineHeight: 1.05,
        }),
      ],
      { notes: 'This word should fill the room before you say a single sentence — hold the silence.' },
    ),
    mkSlide([
      txt(0, 180, 1280, 220, '10X', { fontSize: 170, bold: true, align: 'center', valign: 'middle', color: th.accent, fontFamily: th.titleFont }),
      txt(0, 420, 1280, 60, 'faster than the industry average', { fontSize: 30, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
    ]),
    mkSlide(
      [
        txt(120, 240, 1040, 220, '"The biggest risk is not taking any risk."', {
          fontSize: 44,
          bold: true,
          italic: true,
          align: 'center',
          valign: 'middle',
          color: th.titleColor,
          fontFamily: th.titleFont,
          lineHeight: 1.35,
        }),
        txt(120, 470, 1040, 40, '— Mark Zuckerberg', { fontSize: 20, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: 'Let this sit in silence for a beat before moving on to the next slide.' },
    ),
    mkSlide([
      txt(80, 150, 700, 140, 'GO', { fontSize: 108, bold: true, align: 'left', color: th.titleColor, fontFamily: th.titleFont }),
      txt(500, 320, 700, 140, 'BOLD', { fontSize: 108, bold: true, align: 'right', color: th.accent, fontFamily: th.titleFont }),
      txt(80, 520, 1120, 60, "Or don't bother.", { fontSize: 26, italic: true, color: th.bodyColor, fontFamily: th.bodyFont }),
    ]),
    mkSlide(
      [
        txt(140, 240, 1000, 120, 'Make the leap.', { fontSize: 68, bold: true, align: 'center', valign: 'middle', color: '#fff7ed', fontFamily: th.titleFont }),
        txt(190, 380, 900, 60, 'letstalk@studio.com', { fontSize: 24, align: 'center', color: '#fed7aa', fontFamily: th.bodyFont }),
      ],
      { background: { type: 'solid', color: '#9a3412' }, notes: "Close on the CTA and stop — don't undercut a bold deck with a weak ending." },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 10. Team intro — Petal & Co. (blush theme)
// ================================================================

function deckTeamIntro(): SlidesContent {
  const th = getTheme('blush')
  const overview: [string, string][] = [
    ['Ana', 'Founder'],
    ['Marcus', 'Operations'],
    ['Lin', 'Design'],
    ['Theo', 'Support'],
  ]
  const ovCols = [100, 380, 660, 940]

  const slides: Slide[] = [
    mkSlide([
      shp(590, 230, 100, 6, 'rect', th.accent),
      txt(0, 260, 1280, 120, 'Meet the team', { fontSize: 68, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
      txt(0, 390, 1280, 50, 'Petal & Co. · The people behind the brand', { fontSize: 24, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
    ]),
    mkSlide([
      txt(100, 70, 700, 80, 'Twelve people, one mission', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...overview.flatMap(([name, role], i) => [
        shp(ovCols[i] + 60, 220, 120, 120, 'ellipse', th.accent, { opacity: 0.22 }),
        txt(ovCols[i], 360, 240, 36, name, { fontSize: 20, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(ovCols[i], 398, 240, 28, role, { fontSize: 15, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      shp(140, 210, 260, 260, 'ellipse', th.accent, { opacity: 0.22 }),
      txt(140, 500, 260, 40, 'Ana Cortez', { fontSize: 26, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
      txt(460, 220, 680, 50, 'Founder & Creative Director', { fontSize: 28, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(
        460,
        290,
        680,
        280,
        '"I started Petal because I wanted flowers that felt like they were picked that morning, not shipped from a warehouse."',
        { fontSize: 22, italic: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide([
      shp(880, 210, 260, 260, 'ellipse', th.accent, { opacity: 0.22 }),
      txt(880, 500, 260, 40, 'Marcus Lee', { fontSize: 26, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
      txt(140, 220, 680, 50, 'Head of Operations', { fontSize: 28, bold: true, align: 'right', color: th.accent, fontFamily: th.bodyFont }),
      txt(
        140,
        290,
        680,
        280,
        '"My job is making sure every order feels as delightful behind the scenes as it does on your doorstep."',
        { fontSize: 22, italic: true, align: 'right', color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide(
      [
        txt(100, 70, 900, 80, 'What we value', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(100, 210, 980, 400, 'Kindness first, always\nCraft over speed\nWe grow together', {
          fontSize: 28,
          bullets: true,
          color: th.bodyColor,
          lineHeight: 1.55,
          fontFamily: th.bodyFont,
        }),
      ],
      { notes: 'Give one concrete example for each value if there is time.' },
    ),
    mkSlide(
      [
        txt(140, 230, 1000, 110, "We're hiring", { fontSize: 60, bold: true, align: 'center', valign: 'middle', color: '#fdf2f8', fontFamily: th.titleFont }),
        txt(190, 370, 900, 80, 'Two open roles on the studio team — see petalandco.com/careers', {
          fontSize: 22,
          align: 'center',
          color: '#fce7f3',
          lineHeight: 1.4,
          fontFamily: th.bodyFont,
        }),
      ],
      { background: { type: 'solid', color: th.accent }, notes: "Point to the specific open roles instead of a generic 'we're hiring' plug." },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// Template registry
// ================================================================

export const slidesTemplates: SlidesTemplate[] = [
  {
    id: 'startup-pitch',
    name: 'Startup pitch',
    description: 'Problem, solution, market, product, team and the ask — a lean seed-round deck.',
    category: 'Business',
    accent: '#38bdf8',
    glyph: '🚀',
    make: deckStartupPitch,
  },
  {
    id: 'marketing-plan',
    name: 'Marketing plan',
    description: 'Quarterly goals, audience, channels, timeline and budget for a growth campaign.',
    category: 'Marketing',
    accent: '#c4b5fd',
    glyph: '📣',
    make: deckMarketingPlan,
  },
  {
    id: 'quarterly-business-review',
    name: 'Quarterly business review',
    description: 'Highlights, key metrics, revenue trend, risks and next-quarter priorities.',
    category: 'Business',
    accent: '#4f46e5',
    glyph: '📊',
    make: deckQBR,
  },
  {
    id: 'product-roadmap',
    name: 'Product roadmap',
    description: 'Vision plus a now/next/later timeline with shape-built chevrons and milestones.',
    category: 'Business',
    accent: '#0891b2',
    glyph: '🗺️',
    make: deckProductRoadmap,
  },
  {
    id: 'lesson-plan',
    name: 'Lesson plan',
    description: 'Friendly classroom deck: objectives, agenda, activities and an exit ticket.',
    category: 'Education',
    accent: '#059669',
    glyph: '🍎',
    make: deckLessonPlan,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Bold typography and dark canvas for showcasing creative work and case studies.',
    category: 'Creative',
    accent: '#eab308',
    glyph: '🎨',
    make: deckPortfolio,
  },
  {
    id: 'project-kickoff',
    name: 'Project kickoff',
    description: 'Overview, goals, timeline, team and risks to align a new project team fast.',
    category: 'Business',
    accent: '#d97706',
    glyph: '🏁',
    make: deckProjectKickoff,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Typography-driven layouts with generous whitespace and almost no ornament.',
    category: 'Creative',
    accent: '#2563eb',
    glyph: '◻️',
    make: deckMinimal,
  },
  {
    id: 'bold-statement',
    name: 'Bold statement',
    description: 'Huge display type and high contrast for a deck that has to grab attention.',
    category: 'Creative',
    accent: '#fdba74',
    glyph: '🔥',
    make: deckBoldStatement,
  },
  {
    id: 'team-intro',
    name: 'Team intro',
    description: 'Warm, friendly deck to introduce your team, values and open roles.',
    category: 'Business',
    accent: '#db2777',
    glyph: '🤝',
    make: deckTeamIntro,
  },
]
