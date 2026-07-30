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

// ---------- small element builders (mirrors src/templates/slides.ts conventions) ----------

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
// 1. Portfolio showcase — Maren Cole (grape theme)
// ================================================================

function deckPortfolioShowcase(): SlidesContent {
  const th = getTheme('grape')

  const projects: [string, string, string, string][] = [
    [
      '01',
      'Lumen Rebrand',
      'Full visual identity for a solar-tech startup — wordmark, motion logo, and a 60-page brand guideline used across product and retail.',
      'Brand identity · Motion · Guidelines',
    ],
    [
      '02',
      'Northfield Type Foundry',
      'A custom variable typeface and specimen site for an independent type foundry, released across three weights and two optical axes.',
      'Type design · Web · Specimen',
    ],
  ]

  const phases: [string, string][] = [
    ['Discover', 'Research & audit'],
    ['Define', 'Strategy & concept'],
    ['Design', 'Iterate & refine'],
    ['Deliver', 'Launch & handoff'],
  ]
  const pCols = [100, 380, 660, 940]

  const skillGroups: [string, string][] = [
    ['Brand', 'Identity systems\nTypography\nPackaging design'],
    ['Digital', 'Web design\nMotion design\nPrototyping'],
    ['Tools', 'Figma\nAfter Effects\nCinema 4D'],
  ]
  const sCols = [100, 460, 820]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(950, -110, 420, 420, 'ellipse', th.accent, { opacity: 0.14 }),
        txt(100, 90, 500, 30, 'PORTFOLIO · 2026', { fontSize: 15, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(100, 200, 1080, 130, 'MAREN COLE', { fontSize: 88, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 344, 110, 8, 'rect', th.accent),
        txt(100, 382, 900, 60, 'Visual designer & art director crafting bold, unmistakable brand identities.', {
          fontSize: 24,
          color: th.bodyColor,
          fontFamily: th.bodyFont,
        }),
      ],
      { notes: 'Open by naming the thread across your work — the one idea every project on this deck proves.' },
    ),
    mkSlide([
      txt(100, 70, 700, 80, 'What I make', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        220,
        760,
        300,
        'Design that stops the scroll and survives contact with a real audience — identity systems, editorial layouts, and campaign visuals built to hold up at any size, on any screen.',
        { fontSize: 26, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
      shp(980, 260, 360, 360, 'ellipse', th.accent, { opacity: 0.16 }),
    ]),
    mkSlide(
      [
        txt(100, 130, 220, 180, projects[0][0], { fontSize: 120, bold: true, color: th.accent, fontFamily: th.titleFont, opacity: 0.55 }),
        shp(360, 270, 60, 6, 'rect', th.accent),
        txt(360, 160, 760, 80, projects[0][1], { fontSize: 44, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        txt(360, 300, 760, 170, projects[0][2], { fontSize: 21, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont }),
        txt(360, 500, 760, 36, projects[0][3], { fontSize: 16, color: th.accent, fontFamily: th.bodyFont }),
      ],
      { notes: 'Walk through the brief in one sentence before showing the work — context makes the craft land.' },
    ),
    mkSlide([
      txt(950, 130, 220, 180, projects[1][0], { fontSize: 120, bold: true, align: 'right', color: th.accent, fontFamily: th.titleFont, opacity: 0.55 }),
      shp(760, 270, 60, 6, 'rect', th.accent),
      txt(180, 160, 760, 80, projects[1][1], { fontSize: 40, bold: true, align: 'right', color: th.titleColor, fontFamily: th.titleFont }),
      txt(180, 300, 760, 170, projects[1][2], { fontSize: 21, align: 'right', color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont }),
      txt(180, 500, 760, 36, projects[1][3], { fontSize: 16, align: 'right', color: th.accent, fontFamily: th.bodyFont }),
    ]),
    mkSlide([
      txt(100, 60, 700, 70, 'How I work', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      ...phases.flatMap(([label, sub], i) => [
        shp(pCols[i], 250, 220, 90, 'chevron', th.accent, { opacity: 0.35 + i * 0.15 }),
        txt(pCols[i], 278, 220, 40, label, { fontSize: 20, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(pCols[i], 360, 220, 60, sub, { fontSize: 15, align: 'center', color: th.bodyColor, lineHeight: 1.35, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 80, 700, 80, 'Tools & skills', { fontSize: 56, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 190, 80, 8, 'rect', th.accent),
      ...skillGroups.flatMap(([heading, list], i) => [
        txt(sCols[i], 240, 320, 40, heading, { fontSize: 24, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(sCols[i], 290, 320, 260, list, { fontSize: 20, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(140, 240, 1000, 120, "Let's build something bold.", {
          fontSize: 56,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: '#f5f3ff',
          fontFamily: th.titleFont,
        }),
        txt(190, 390, 900, 60, 'hello@marencole.design   ·   marencole.design', { fontSize: 22, align: 'center', color: '#ddd6fe', fontFamily: th.bodyFont }),
      ],
      { background: { type: 'solid', color: '#3b0764' }, notes: 'Close with a single clear next step — a call, a proposal, or a portfolio walkthrough.' },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 2. Mood board — Meridian Coffee Co. (paper theme)
// ================================================================

function deckMoodBoard(): SlidesContent {
  const th = getTheme('paper')

  const swatches: [string, string][] = [
    ['#F5EDE3', 'Oat cream'],
    ['#C98A54', 'Toasted caramel'],
    ['#6B4226', 'Espresso bark'],
    ['#3F4B3B', 'Fern shade'],
    ['#1A1A1A', 'Charcoal roast'],
  ]
  const swCols = [100, 308, 516, 724, 932]

  const slides: Slide[] = [
    mkSlide(
      [
        txt(100, 70, 600, 30, 'MOOD BOARD · Q3 BRAND REFRESH', { fontSize: 14, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(100, 140, 1080, 140, 'Meridian Coffee Co.', { fontSize: 72, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 300, 100, 8, 'rect', th.accent),
        txt(100, 336, 900, 80, 'A visual direction for the Meridian rebrand — warm, handcrafted, unhurried.', {
          fontSize: 24,
          color: th.bodyColor,
          fontFamily: th.bodyFont,
          lineHeight: 1.4,
        }),
      ],
      { notes: 'Present the mood board as a direction to react to, not a finished decision — invite specific feedback on what feels off.' },
    ),
    mkSlide([
      txt(100, 70, 700, 70, 'The mood', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 152, 80, 8, 'rect', th.accent),
      txt(100, 210, 1080, 100, 'WARM', { fontSize: 84, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      txt(100, 322, 1080, 80, 'HANDCRAFTED', { fontSize: 60, bold: true, color: th.accent, fontFamily: th.titleFont }),
      txt(100, 412, 1080, 70, 'UNHURRIED', { fontSize: 52, bold: true, color: th.bodyColor, fontFamily: th.titleFont }),
    ]),
    mkSlide(
      [
        txt(100, 70, 700, 70, 'Color palette', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 152, 80, 8, 'rect', th.accent),
        ...swatches.flatMap(([hex, name], i) => [
          shp(swCols[i], 210, 190, 190, 'rect', hex, { stroke: '#e5e7eb', strokeWidth: 1 }),
          txt(swCols[i], 414, 190, 26, hex, { fontSize: 14, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
          txt(swCols[i], 442, 190, 28, name, { fontSize: 14, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
        ]),
      ],
      { notes: 'Print physical swatches if you can — screen color rarely matches the final printed or dyed material.' },
    ),
    mkSlide([
      txt(100, 70, 700, 70, 'Type & texture', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 152, 80, 8, 'rect', th.accent),
      txt(100, 210, 480, 110, 'Meridian', { fontSize: 64, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      txt(100, 330, 480, 140, 'Display serif for headlines, paired with a clean grotesque for body copy and UI.', {
        fontSize: 20,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
      shp(660, 200, 8, 300, 'rect', th.accent, { opacity: 0.3 }),
      txt(700, 210, 480, 40, 'Texture references', { fontSize: 22, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(700, 260, 480, 260, 'Sun-bleached café signage\nHand-thrown ceramic mugs\nKraft paper packaging\nBrushed brass fittings', {
        fontSize: 19,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
    ]),
    mkSlide([
      txt(100, 70, 900, 70, 'Direction guardrails', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 152, 80, 8, 'rect', th.accent),
      shp(100, 210, 505, 380, 'roundRect', th.accent, { opacity: 0.08 }),
      txt(130, 235, 445, 40, 'Lean into', { fontSize: 24, bold: true, color: th.titleColor, fontFamily: th.bodyFont }),
      txt(130, 285, 445, 280, 'Earthy, matte textures\nHand-drawn or hand-lettered accents\nNatural light and soft shadows', {
        fontSize: 20,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
      shp(635, 210, 505, 380, 'roundRect', th.accent, { opacity: 0.08 }),
      txt(665, 235, 445, 40, 'Avoid', { fontSize: 24, bold: true, color: th.titleColor, fontFamily: th.bodyFont }),
      txt(665, 285, 445, 280, 'Glossy or plasticky finishes\nNeon or saturated color\nStock photo clichés', {
        fontSize: 20,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
    ]),
    mkSlide(
      [
        txt(140, 250, 1000, 110, 'Approved direction moves into full brand guidelines next.', {
          fontSize: 44,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: th.titleColor,
          fontFamily: th.titleFont,
          lineHeight: 1.3,
        }),
        txt(190, 390, 900, 50, 'Feedback due Friday · Final palette locks next week', { fontSize: 20, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      {
        background: { type: 'solid', color: '#eff6ff' },
        notes: 'Set a concrete feedback deadline in the room — vague timelines are how mood boards stall for weeks.',
      },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 3. Event program — Horizon Summit (ocean theme)
// ================================================================

function deckEventProgram(): SlidesContent {
  const th = getTheme('ocean')

  const morning: [string, string][] = [
    ['8:30', 'Registration & coffee'],
    ['9:15', 'Opening keynote — The next decade of product'],
    ['10:15', 'Breakout sessions (3 tracks)'],
    ['11:30', 'Panel: Design at scale'],
  ]
  const afternoon: [string, string][] = [
    ['1:00', 'Lunch & sponsor expo'],
    ['2:00', 'Workshop: From insight to roadmap'],
    ['3:15', 'Fireside chat: Scaling design teams'],
    ['4:15', 'Closing remarks & networking reception'],
  ]
  const speakers: [string, string, string][] = [
    ['DW', 'Dana Whitfield', 'VP Product, Solstice'],
    ['MA', 'Marcus Ade', 'Head of Design, Fernway'],
    ['PR', 'Priya Rao', 'CTO, Northlight Labs'],
  ]
  const spCols = [100, 460, 820]

  const scheduleRows = (rows: [string, string][]) =>
    rows.flatMap(([time, desc], i) => {
      const y = 210 + i * 90
      return [
        shp(100, y, 120, 54, 'roundRect', th.accent, { opacity: 0.16 }),
        txt(100, y, 120, 54, time, { fontSize: 17, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(250, y, 830, 54, desc, { fontSize: 21, valign: 'middle', color: th.bodyColor, fontFamily: th.bodyFont }),
      ]
    })

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 222, 100, 6, 'rect', th.accent),
        txt(100, 252, 1080, 110, 'Horizon Summit 2026', { fontSize: 60, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
        txt(100, 372, 1080, 50, 'A one-day gathering for product & design leaders · Sept 12 · Bellwood Hall', {
          fontSize: 21,
          align: 'center',
          color: th.bodyColor,
          fontFamily: th.bodyFont,
        }),
      ],
      { notes: 'Welcome attendees and thank the sponsors by name before diving into the schedule.' },
    ),
    mkSlide([
      txt(100, 70, 900, 80, 'Welcome to Horizon', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        210,
        980,
        300,
        'Three hundred product, design and engineering leaders — one day of talks, workshops and conversations on building things people actually want.',
        { fontSize: 26, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide(
      [
        txt(100, 60, 700, 70, 'Morning schedule', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 148, 80, 8, 'rect', th.accent),
        ...scheduleRows(morning),
      ],
      { notes: 'Morning keynote runs long some years — build a 10-minute buffer before the first breakout.' },
    ),
    mkSlide([
      txt(100, 60, 700, 70, 'Afternoon schedule', { fontSize: 50, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 148, 80, 8, 'rect', th.accent),
      ...scheduleRows(afternoon),
    ]),
    mkSlide(
      [
        txt(100, 70, 700, 80, 'Featured speakers', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        ...speakers.flatMap(([initials, name, role], i) => [
          shp(spCols[i] + 80, 220, 140, 140, 'ellipse', th.accent, { opacity: 0.22 }),
          txt(spCols[i] + 80, 220, 140, 140, initials, { fontSize: 40, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
          txt(spCols[i], 378, 300, 34, name, { fontSize: 20, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
          txt(spCols[i], 416, 300, 48, role, { fontSize: 15, align: 'center', color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
        ]),
      ],
      { notes: 'Speaker order may shift — check the app for the final lineup morning-of.' },
    ),
    mkSlide([
      shp(140, 210, 260, 260, 'ellipse', th.accent, { opacity: 0.22 }),
      txt(140, 210, 260, 260, 'DW', { fontSize: 72, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
      txt(140, 500, 260, 40, 'Dana Whitfield', { fontSize: 24, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
      txt(460, 220, 680, 50, 'VP of Product, Solstice', { fontSize: 26, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(
        460,
        290,
        680,
        240,
        '"The best roadmaps are the ones your engineering team helps you cut down, not the ones they help you build."',
        { fontSize: 22, italic: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, 'Venue & need-to-know', { fontSize: 48, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(100, 210, 480, 40, 'Getting there', { fontSize: 24, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(100, 260, 480, 300, 'Bellwood Hall, 220 Harbor St\nDoors open 8:00am\nParking validated with badge scan', {
        fontSize: 20,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
      txt(660, 210, 480, 40, "While you're here", { fontSize: 24, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(660, 260, 480, 300, 'Wifi: HORIZON2026 / summit26\nSlides posted same day at horizonsummit.io\nTag us #HorizonSummit', {
        fontSize: 20,
        bullets: true,
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
    ]),
    mkSlide(
      [
        txt(140, 240, 1000, 110, 'See you at Horizon.', { fontSize: 56, bold: true, align: 'center', valign: 'middle', color: '#ecfeff', fontFamily: th.titleFont }),
        txt(190, 380, 900, 60, 'Thank you to our sponsors, speakers and every attendee who showed up curious.', {
          fontSize: 22,
          align: 'center',
          color: '#cffafe',
          lineHeight: 1.4,
          fontFamily: th.bodyFont,
        }),
      ],
      {
        background: { type: 'gradient', from: '#0891b2', to: '#164e63', angle: 135 },
        notes: "Close by pointing people to next year's save-the-date if you have one ready.",
      },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 4. Trivia night — Thursday Trivia Throwdown (ember theme)
// ================================================================

function deckTriviaNight(): SlidesContent {
  const th = getTheme('ember')

  const slides: Slide[] = [
    mkSlide(
      [
        shp(950, -100, 380, 380, 'star', th.accent, { opacity: 0.16 }),
        txt(100, 90, 500, 30, 'THURSDAY NIGHT', { fontSize: 15, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(100, 150, 1080, 150, 'Trivia Throwdown', { fontSize: 80, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 314, 110, 8, 'rect', th.accent),
        txt(100, 350, 900, 60, 'Six rounds. Five categories. One team walks home with the trophy.', {
          fontSize: 24,
          color: th.bodyColor,
          fontFamily: th.bodyFont,
        }),
      ],
      { notes: 'Open with the house rules slide right after this — set expectations before the first question.' },
    ),
    mkSlide([
      txt(100, 70, 700, 80, 'How it works', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        220,
        980,
        380,
        'Teams of up to 6, no phones on the table\n6 rounds of 5 questions, one point each\nWager double points on the final question of each round\nHighest score after Round 6 takes the trophy',
        { fontSize: 25, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide(
      [
        shp(-60, 500, 260, 260, 'triangle', th.accent, { opacity: 0.16 }),
        shp(1080, -60, 260, 260, 'star', th.accent, { opacity: 0.16 }),
        txt(100, 270, 1080, 60, 'ROUND ONE', { fontSize: 28, bold: true, align: 'center', color: th.accent, fontFamily: th.bodyFont }),
        txt(100, 330, 1080, 120, 'Movies & TV', { fontSize: 72, bold: true, align: 'center', color: '#fff7ed', fontFamily: th.titleFont }),
      ],
      {
        background: { type: 'solid', color: '#9a3412' },
        notes: "Give teams 10 seconds to guess the category theme before you reveal it — it warms up the room.",
      },
    ),
    mkSlide([
      txt(100, 80, 300, 36, 'ROUND 1 · Q1', { fontSize: 16, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(900, 80, 280, 36, 'WORTH 1 POINT', { fontSize: 16, bold: true, align: 'right', color: th.accent, fontFamily: th.bodyFont }),
      shp(100, 140, 80, 8, 'rect', th.accent),
      txt(100, 220, 1080, 240, 'What 1994 film features a character who says, "Life is like a box of chocolates"?', {
        fontSize: 40,
        bold: true,
        color: th.titleColor,
        lineHeight: 1.4,
        fontFamily: th.titleFont,
      }),
    ]),
    mkSlide(
      [
        txt(100, 80, 1080, 36, 'ANSWER', { fontSize: 18, bold: true, align: 'center', color: th.accent, fontFamily: th.bodyFont }),
        shp(590, 130, 100, 8, 'rect', th.accent),
        txt(100, 220, 1080, 140, 'Forrest Gump', { fontSize: 64, bold: true, align: 'center', color: th.titleColor, fontFamily: th.titleFont }),
        shp(460, 400, 60, 60, 'star', th.accent, { opacity: 0.5 }),
        shp(560, 400, 60, 60, 'star', th.accent, { opacity: 0.5 }),
        shp(660, 400, 60, 60, 'star', th.accent, { opacity: 0.5 }),
        txt(100, 460, 1080, 50, '1 point for every team that got it right', { fontSize: 20, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: "Pause here for groans and celebration before moving to the next question — it's half the fun." },
    ),
    mkSlide([
      txt(100, 80, 300, 36, 'ROUND 3 · Q4', { fontSize: 16, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(900, 80, 280, 36, 'WORTH 2 POINTS', { fontSize: 16, bold: true, align: 'right', color: th.accent, fontFamily: th.bodyFont }),
      shp(100, 140, 80, 8, 'rect', th.accent),
      txt(100, 220, 1080, 240, 'Which planet in our solar system has the most confirmed moons as of 2026?', {
        fontSize: 40,
        bold: true,
        color: th.titleColor,
        lineHeight: 1.4,
        fontFamily: th.titleFont,
      }),
    ]),
    mkSlide([
      txt(100, 80, 1080, 36, 'ANSWER', { fontSize: 18, bold: true, align: 'center', color: th.accent, fontFamily: th.bodyFont }),
      shp(590, 130, 100, 8, 'rect', th.accent),
      txt(100, 220, 1080, 140, 'Saturn', { fontSize: 64, bold: true, align: 'center', color: th.titleColor, fontFamily: th.titleFont }),
      txt(100, 460, 1080, 50, '2 points — no half credit for "Jupiter, probably"', { fontSize: 20, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
    ]),
    mkSlide(
      [
        txt(140, 220, 1000, 110, 'Final scores & prizes', { fontSize: 52, bold: true, align: 'center', valign: 'middle', color: '#431407', fontFamily: th.titleFont }),
        txt(190, 360, 900, 140, '1st place: bar tab + trophy\n2nd place: round of shots\n3rd place: bragging rights only', {
          fontSize: 22,
          align: 'center',
          color: '#7c2d12',
          lineHeight: 1.6,
          fontFamily: th.bodyFont,
        }),
      ],
      {
        background: { type: 'solid', color: th.accent },
        notes: 'Announce third place first, building up to the winning team — always end on the winners.',
      },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 5. Year in review — 2026 personal recap (aurora theme)
// ================================================================

function deckYearInReview(): SlidesContent {
  const th = getTheme('aurora')

  const statsA: [string, string][] = [
    ['27', 'Books finished'],
    ['14,200', 'Miles traveled'],
    ['186', 'Days at the gym'],
  ]
  const statsB: [string, string][] = [
    ['3', 'Cities moved between'],
    ['52', 'Weekly journal entries'],
    ['1', 'New language started'],
  ]
  const statCols = [100, 470, 840]

  const timeline: [string, string][] = [
    ['JAN – APR', 'New job, new city, first solo trip'],
    ['MAY – AUG', 'Ran a half marathon, started painting'],
    ['SEP – DEC', 'Reunited with old friends, planned 2027'],
  ]
  const tCols = [100, 470, 840]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(950, -110, 420, 420, 'ellipse', th.accent, { opacity: 0.14 }),
        txt(100, 90, 500, 30, 'MY YEAR IN NUMBERS', { fontSize: 15, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(100, 160, 1080, 140, '2026 in Review', { fontSize: 80, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 320, 110, 8, 'rect', th.accent),
        txt(100, 356, 900, 60, 'A look back at the year — the wins, the lessons, and everything in between.', {
          fontSize: 24,
          color: th.bodyColor,
          fontFamily: th.bodyFont,
        }),
      ],
      { notes: "Start with the number that surprised you most — it earns the room's attention fastest." },
    ),
    mkSlide([
      txt(100, 70, 700, 80, 'By the numbers', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...statsA.flatMap(([value, label], i) => [
        txt(statCols[i], 230, 340, 90, value, { fontSize: 56, bold: true, align: 'center', color: th.accent, fontFamily: th.titleFont }),
        txt(statCols[i], 330, 340, 60, label, { fontSize: 19, align: 'center', color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide([
      txt(100, 70, 700, 80, 'Beyond the numbers', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...statsB.flatMap(([value, label], i) => {
        const y = 240 + i * 108
        return [
          shp(100, y + 14, 14, 14, 'ellipse', th.accent),
          txt(140, y, 220, 60, value, { fontSize: 42, bold: true, valign: 'middle', color: th.accent, fontFamily: th.titleFont }),
          txt(400, y, 780, 60, label, { fontSize: 24, valign: 'middle', color: th.bodyColor, fontFamily: th.bodyFont }),
          shp(140, y + 82, 1040, 1, 'rect', th.bodyColor, { opacity: 0.25 }),
        ]
      }),
    ]),
    mkSlide([
      txt(100, 60, 700, 70, 'The year at a glance', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 150, 80, 8, 'rect', th.accent),
      ...timeline.flatMap(([label, desc], i) => [
        shp(tCols[i], 250, 340, 90, 'chevron', th.accent, { opacity: 0.4 + i * 0.2 }),
        txt(tCols[i], 278, 340, 40, label, { fontSize: 19, bold: true, align: 'center', valign: 'middle', color: '#0b1220', fontFamily: th.bodyFont }),
        txt(tCols[i], 360, 340, 90, desc, { fontSize: 16, align: 'center', color: th.bodyColor, lineHeight: 1.4, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(160, 240, 960, 200, '"The best year isn\'t the easiest one — it\'s the one where you surprised yourself the most."', {
          fontSize: 38,
          italic: true,
          align: 'center',
          color: th.titleColor,
          fontFamily: th.titleFont,
          lineHeight: 1.4,
        }),
        txt(160, 460, 960, 40, '— from my January 1st journal entry', { fontSize: 18, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: "If you're presenting this to others, pause here — a quote slide works best with a few seconds of silence." },
    ),
    mkSlide([
      txt(100, 70, 700, 80, 'Lessons learned', { fontSize: 54, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        220,
        980,
        380,
        'Rest is productive, not a reward you earn later\nThe hard conversation is always easier than the silence\nSaying no to good things makes room for great ones',
        { fontSize: 25, bullets: true, color: th.bodyColor, lineHeight: 1.55, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide(
      [
        txt(140, 240, 1000, 120, 'Onward to 2027.', { fontSize: 60, bold: true, align: 'center', valign: 'middle', color: '#f0f9ff', fontFamily: th.titleFont }),
        txt(190, 380, 900, 80, 'Next year: run a marathon, learn to sail, finally visit Lisbon.', {
          fontSize: 24,
          align: 'center',
          color: '#bae6fd',
          fontFamily: th.bodyFont,
        }),
      ],
      {
        background: { type: 'gradient', from: '#1e3a8a', to: '#0f172a', angle: 135 },
        notes: "Write these goals somewhere you'll actually see them again — a slide deck alone rarely survives to March.",
      },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 6. Thesis defense — Adaptive microgrid scheduling (slate theme)
// ================================================================

function deckThesisDefense(): SlidesContent {
  const th = getTheme('slate')

  const methodCols: [string, string][] = [
    ['Data', '18 months of generation and load data\nfrom 6 microgrid sites\nHeld out final 3 months for testing'],
    ['Approach', 'Deep Q-network scheduler trained per site\nBenchmarked against rule-based baseline\nEvaluated on curtailment rate and cost'],
  ]
  const mCols = [100, 660]

  const stats: [string, string][] = [
    ['-47%', 'Curtailment vs. baseline'],
    ['$210K', 'Estimated annual savings'],
    ['92%', 'Forecast accuracy at 1hr horizon'],
  ]
  const statCols = [100, 470, 840]

  const siteRows: [string, string, number][] = [
    ['Site A', '−52%', 420],
    ['Site B', '−41%', 330],
    ['Site C', '−49%', 390],
    ['Site D', '−38%', 300],
  ]

  const slides: Slide[] = [
    mkSlide(
      [
        txt(100, 80, 500, 30, 'DOCTORAL DISSERTATION DEFENSE', { fontSize: 14, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(100, 140, 1080, 180, 'Adaptive Scheduling for Distributed Renewable Microgrids', {
          fontSize: 46,
          bold: true,
          color: th.titleColor,
          fontFamily: th.titleFont,
          lineHeight: 1.25,
        }),
        shp(100, 340, 100, 8, 'rect', th.accent),
        txt(100, 376, 900, 70, 'Elena Marsh · Department of Electrical Engineering · July 2026', { fontSize: 20, color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: 'Thank your committee by name and acknowledge your advisor before starting the content.' },
    ),
    mkSlide([
      txt(100, 70, 900, 80, 'Research question', { fontSize: 48, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        220,
        980,
        260,
        'Can a reinforcement-learning scheduler cut curtailed renewable energy in half across a distributed microgrid network without new hardware?',
        { fontSize: 27, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, 'Why this matters', { fontSize: 48, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      txt(
        100,
        220,
        980,
        380,
        'Curtailment wastes 8-15% of generated renewable power today\nExisting schedulers assume centralized, single-site control\nNo prior work tests reinforcement learning across multi-site microgrids in the field',
        { fontSize: 24, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide([
      txt(100, 70, 900, 80, 'Methodology', { fontSize: 48, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...methodCols.flatMap(([heading, list], i) => [
        txt(mCols[i], 220, 480, 40, heading, { fontSize: 24, bold: true, color: th.accent, fontFamily: th.bodyFont }),
        txt(mCols[i], 270, 480, 300, list, { fontSize: 20, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(100, 70, 700, 80, 'Findings', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        ...stats.flatMap(([value, label], i) => [
          txt(statCols[i], 230, 340, 90, value, { fontSize: 56, bold: true, align: 'center', color: th.accent, fontFamily: th.titleFont }),
          txt(statCols[i], 330, 340, 60, label, { fontSize: 19, align: 'center', color: th.bodyColor, lineHeight: 1.3, fontFamily: th.bodyFont }),
        ]),
      ],
      { notes: 'Have the p-values and confidence intervals ready on a backup slide in case the committee asks.' },
    ),
    mkSlide([
      txt(100, 70, 900, 80, 'Curtailment by site', { fontSize: 48, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...siteRows.flatMap(([label, value, barW], i) => {
        const y = 220 + i * 90
        return [
          txt(140, y, 300, 50, label, { fontSize: 21, color: th.titleColor, valign: 'middle', fontFamily: th.bodyFont }),
          txt(480, y, 140, 50, value, { fontSize: 22, bold: true, align: 'right', color: th.titleColor, valign: 'middle', fontFamily: th.bodyFont }),
          shp(680, y + 18, barW, 14, 'rect', th.accent, { opacity: 0.85 }),
          shp(140, y + 74, 1000, 1, 'rect', th.bodyColor, { opacity: 0.2 }),
        ]
      }),
    ]),
    mkSlide(
      [
        txt(100, 70, 900, 80, 'Limitations & future work', { fontSize: 46, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(
          100,
          220,
          980,
          380,
          'Trained and tested on temperate-climate sites only\nDoes not yet model battery degradation costs\nNext: extend to hybrid solar-wind sites and test in production',
          { fontSize: 24, bullets: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
        ),
      ],
      { notes: 'Own the limitations before the committee raises them — it signals rigor, not weakness.' },
    ),
    mkSlide([
      txt(100, 60, 900, 70, 'Selected references', { fontSize: 44, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 144, 80, 8, 'rect', th.accent),
      txt(
        100,
        180,
        1080,
        300,
        'Mnih, V. et al. (2015). Human-level control through deep reinforcement learning. Nature.\nLund, H. (2020). Renewable Energy Systems. Academic Press.\nZhou, K. & Yang, S. (2022). Microgrid scheduling: a survey. IEEE Trans. Smart Grid.',
        { fontSize: 18, color: th.bodyColor, lineHeight: 1.6, fontFamily: th.bodyFont },
      ),
      shp(100, 520, 80, 8, 'rect', th.accent),
      txt(100, 556, 900, 60, 'Thank you — questions welcome.', { fontSize: 28, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
    ]),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// 7. Team introduction — Fieldnote Creative (sunrise theme)
// ================================================================

function deckTeamIntroduction(): SlidesContent {
  const th = getTheme('sunrise')

  const team: [string, string, string][] = [
    ['JE', 'Jo Ellis', 'Founder & strategist'],
    ['KB', 'Kai Bloom', 'Lead designer'],
    ['SO', 'Sam Okafor', 'Developer'],
    ['RV', 'Ren Vance', 'Producer'],
  ]
  const tCols = [100, 380, 660, 940]

  const facts: [string, string][] = [
    ['JE', 'Ran a bakery before this'],
    ['KB', 'Has climbed 3 of the 7 summits'],
    ['SO', 'Builds mechanical keyboards'],
    ['RV', "Once dubbed a kids' cartoon"],
  ]

  const slides: Slide[] = [
    mkSlide(
      [
        shp(590, 222, 100, 6, 'rect', th.accent),
        txt(100, 252, 1080, 110, 'Meet Fieldnote Creative', { fontSize: 56, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
        txt(100, 372, 1080, 50, 'The four people behind the studio', { fontSize: 22, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ],
      { notes: "Say each name out loud as their slide comes up — it's a small thing that makes people feel introduced, not just displayed." },
    ),
    mkSlide([
      txt(100, 70, 700, 80, 'The team', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
      shp(100, 164, 80, 8, 'rect', th.accent),
      ...team.flatMap(([initials, name, role], i) => [
        shp(tCols[i] + 60, 220, 120, 120, 'ellipse', th.accent, { opacity: 0.28 }),
        txt(tCols[i] + 60, 220, 120, 120, initials, { fontSize: 36, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
        txt(tCols[i], 360, 240, 36, name, { fontSize: 19, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
        txt(tCols[i], 398, 240, 28, role, { fontSize: 14, align: 'center', color: th.bodyColor, fontFamily: th.bodyFont }),
      ]),
    ]),
    mkSlide(
      [
        txt(100, 70, 900, 80, 'Fun facts', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        ...facts.flatMap(([initials, fact], i) => [
          shp(tCols[i], 220, 64, 64, 'ellipse', th.accent, { opacity: 0.28 }),
          txt(tCols[i], 220, 64, 64, initials, { fontSize: 20, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
          txt(tCols[i], 300, 240, 140, fact, { fontSize: 17, color: th.bodyColor, lineHeight: 1.4, fontFamily: th.bodyFont }),
        ]),
      ],
      { notes: 'Read one fun fact per person out loud before the meeting starts — great icebreaker for new clients.' },
    ),
    mkSlide([
      shp(140, 210, 260, 260, 'ellipse', th.accent, { opacity: 0.28 }),
      txt(140, 210, 260, 260, 'JE', { fontSize: 80, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
      txt(140, 500, 260, 40, 'Jo Ellis', { fontSize: 24, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
      txt(460, 220, 680, 50, 'Founder & strategist', { fontSize: 26, bold: true, color: th.accent, fontFamily: th.bodyFont }),
      txt(
        460,
        290,
        680,
        240,
        '"I started Fieldnote because the best creative work happens when strategy and craft sit at the same table from day one."',
        { fontSize: 22, italic: true, color: th.bodyColor, lineHeight: 1.5, fontFamily: th.bodyFont },
      ),
    ]),
    mkSlide([
      shp(880, 210, 260, 260, 'ellipse', th.accent, { opacity: 0.28 }),
      txt(880, 210, 260, 260, 'KB', { fontSize: 80, bold: true, align: 'center', valign: 'middle', color: th.titleColor, fontFamily: th.titleFont }),
      txt(880, 500, 260, 40, 'Kai Bloom', { fontSize: 24, bold: true, align: 'center', color: th.titleColor, fontFamily: th.bodyFont }),
      txt(140, 220, 680, 50, 'Lead designer', { fontSize: 26, bold: true, align: 'right', color: th.accent, fontFamily: th.bodyFont }),
      txt(140, 290, 680, 240, '"Good design is mostly editing — knowing what to leave out is the actual skill."', {
        fontSize: 22,
        italic: true,
        align: 'right',
        color: th.bodyColor,
        lineHeight: 1.5,
        fontFamily: th.bodyFont,
      }),
    ]),
    mkSlide(
      [
        txt(100, 70, 900, 80, 'What we value', { fontSize: 52, bold: true, color: th.titleColor, fontFamily: th.titleFont }),
        shp(100, 164, 80, 8, 'rect', th.accent),
        txt(100, 220, 980, 380, 'Curiosity over certainty\nCraft that holds up under scrutiny\nWe show our work, warts and all', {
          fontSize: 27,
          bullets: true,
          color: th.bodyColor,
          lineHeight: 1.55,
          fontFamily: th.bodyFont,
        }),
      ],
      { notes: 'Ask new hires to add their own value to this list in their first month — it keeps it honest.' },
    ),
    mkSlide(
      [
        txt(140, 240, 1000, 110, "Let's make something together.", {
          fontSize: 52,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: '#fef3c7',
          fontFamily: th.titleFont,
        }),
        txt(190, 380, 900, 60, 'hello@fieldnotecreative.co   ·   fieldnotecreative.co', { fontSize: 22, align: 'center', color: '#fde68a', fontFamily: th.bodyFont }),
      ],
      { background: { type: 'solid', color: '#78350f' } },
    ),
  ]
  return { themeId: th.id, slides }
}

// ================================================================
// Template registry
// ================================================================

export const slidesCreativeTemplates: SlidesTemplate[] = [
  {
    id: 'portfolio-showcase',
    name: 'Portfolio showcase',
    description: 'Bold typography and big index numbers make your best creative work impossible to scroll past.',
    category: 'Creative',
    accent: '#8b5cf6',
    glyph: '🖼️',
    make: deckPortfolioShowcase,
  },
  {
    id: 'mood-board',
    name: 'Mood board',
    description: 'A client-ready color palette, keywords and do/don\'t guardrails to align on a visual direction fast.',
    category: 'Creative',
    accent: '#b45309',
    glyph: '🎨',
    make: deckMoodBoard,
  },
  {
    id: 'event-program',
    name: 'Event program',
    description: 'A polished one-day program with schedule blocks, speaker spotlights and venue logistics ready to send.',
    category: 'Events',
    accent: '#0891b2',
    glyph: '🎟️',
    make: deckEventProgram,
  },
  {
    id: 'trivia-night',
    name: 'Trivia night',
    description: 'A ready-to-host trivia deck with round dividers and built-in question and answer reveals.',
    category: 'Events',
    accent: '#ea580c',
    glyph: '🧠',
    make: deckTriviaNight,
  },
  {
    id: 'year-in-review',
    name: 'Year in review',
    description: 'A personal year-in-review deck with big stat numbers, a highlights timeline and lessons learned.',
    category: 'Personal',
    accent: '#38bdf8',
    glyph: '✨',
    make: deckYearInReview,
  },
  {
    id: 'thesis-defense',
    name: 'Thesis defense',
    description: 'A committee-ready defense deck covering your research question, method, findings and citations.',
    category: 'Education',
    accent: '#4f46e5',
    glyph: '🎓',
    make: deckThesisDefense,
  },
  {
    id: 'team-introduction',
    name: 'Team introduction',
    description: 'A warm team-introduction deck with avatar initials, fun facts and individual spotlights.',
    category: 'Personal',
    accent: '#d97706',
    glyph: '👋',
    make: deckTeamIntroduction,
  },
]
