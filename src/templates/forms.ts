import type { FormOption, FormQuestion, FormTheme, FormsContent, FormsTemplate, QuestionKind } from '../shared/types'
import { uid } from '../shared/types'
import { FORM_THEMES } from '../apps/forms/model'

// ---------- small builders so each template reads as the form you'd actually fill in ----------

function q(kind: QuestionKind, title: string, extra: Partial<FormQuestion> = {}): FormQuestion {
  return { id: uid(), kind, title, ...extra }
}

function opts(...labels: string[]): FormOption[] {
  return labels.map((label) => ({ id: uid(), label }))
}

/** Presets are owned by the forms app; fall back to the first one if a preset is ever renamed. */
function theme(id: string): FormTheme {
  return (FORM_THEMES.find((t) => t.id === id) ?? FORM_THEMES[0]).theme
}

interface Spec {
  description: string
  theme: string
  confirmation: string
  numbered?: boolean
  questions: FormQuestion[]
}

function form(spec: Spec): FormsContent {
  return {
    description: spec.description,
    questions: spec.questions,
    theme: theme(spec.theme),
    responses: [],
    settings: {
      confirmation: spec.confirmation,
      showQuestionNumbers: spec.numbered ?? false,
      showProgress: true,
    },
  }
}

// ---------- 1. Event RSVP ----------

function makeEventRsvp(): FormsContent {
  return form({
    theme: 'violet',
    description:
      'Please reply by [date] so we can confirm numbers with the venue. It takes about a minute — send the response file back and we will do the rest.',
    confirmation:
      'Thanks — you are on the list. Send the response file back to the organiser and joining details will follow by email.',
    questions: [
      q('short', 'Your name', { required: true, placeholder: 'First and last name' }),
      q('email', 'Email address', { required: true, help: 'Where we will send joining details and any changes.' }),
      q('short', 'Organisation or job title', { help: 'Only if you would like it on your badge.' }),
      q('choice', 'Will you be joining us?', {
        required: true,
        options: opts('Yes, I will be there', 'Yes, but only for part of the day', 'Sorry, I cannot make it'),
      }),
      q('number', 'How many people are coming, including you?', {
        min: 1,
        max: 10,
        help: 'Leave this as 1 if you are coming on your own.',
      }),
      q('section', 'Your day', { help: 'Skip this part if you cannot make it.' }),
      q('checkboxes', 'Which sessions will you attend?', {
        options: opts(
          'Registration and coffee — 09:00',
          'Opening keynote — 09:30',
          'Workshop track — 11:00',
          'Lunch and networking — 13:00',
          'Panel discussion — 15:00',
          'Drinks reception — 18:00',
        ),
      }),
      q('choice', 'Dietary requirements', {
        options: opts('None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Halal', 'Kosher'),
        otherOption: true,
      }),
      q('choice', 'How will you get here?', {
        options: opts('Driving — I will need parking', 'Public transport', 'Walking or cycling', 'Not sure yet'),
      }),
      q('paragraph', 'Anything else we should know?', {
        rows: 3,
        help: 'Access requirements, a late arrival, the name of a guest — anything at all.',
      }),
    ],
  })
}

// ---------- 2. Customer feedback ----------

function makeCustomerFeedback(): FormsContent {
  return form({
    theme: 'forest',
    description:
      'We read every response and it genuinely changes what we do next. Nothing here is required except the first question, and you can stay anonymous.',
    confirmation: 'Thank you — this is exactly the kind of thing that helps us improve.',
    questions: [
      q('scale', 'How likely are you to recommend us to a friend or colleague?', {
        required: true,
        scaleMin: 0,
        scaleMax: 10,
        scaleMinLabel: 'Not at all likely',
        scaleMaxLabel: 'Extremely likely',
      }),
      q('choice', 'How would you rate your overall experience?', {
        options: opts('Excellent', 'Good', 'Okay', 'Poor', 'Very poor'),
      }),
      q('dropdown', 'What are you giving feedback on?', {
        options: opts('A product I bought', 'Customer support', 'Delivery or collection', 'The website or app', 'A visit in person'),
      }),
      q('scale', 'How easy was it to get what you needed?', {
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: 'Very difficult',
        scaleMaxLabel: 'Very easy',
      }),
      q('checkboxes', 'What did we do well?', {
        options: opts(
          'Quality of the product',
          'Value for money',
          'Speed of service',
          'Communication',
          'Ease of ordering',
          'Delivery and packaging',
          'The people I dealt with',
        ),
        otherOption: true,
      }),
      q('paragraph', 'What is the one thing we could do better?', {
        rows: 4,
        help: 'Be blunt. A specific annoyance is more useful to us than a general compliment.',
      }),
      q('section', 'A little about you', { help: 'All optional — leave any of it blank.' }),
      q('dropdown', 'How long have you been a customer?', {
        options: opts('This was my first order', 'Less than 6 months', '6–12 months', '1–3 years', 'More than 3 years'),
      }),
      q('choice', 'Would you like a reply?', {
        options: opts('No thanks', 'Yes, please get in touch'),
      }),
      q('email', 'Email address', { help: 'Only needed if you asked for a reply. We will not add you to anything.' }),
    ],
  })
}

// ---------- 3. Job application ----------

function makeJobApplication(): FormsContent {
  return form({
    theme: 'graphite',
    numbered: true,
    description:
      'Thanks for your interest in joining [Company]. Every application is read by a person. Take as much or as little space as you need — we care far more about what you have done than how you word it.',
    confirmation:
      'Thanks for applying. Send the response file back to [careers@company.com] and we will confirm receipt within [two working days].',
    questions: [
      q('section', 'About you'),
      q('short', 'Full name', { required: true }),
      q('email', 'Email address', { required: true }),
      q('short', 'Phone number', { placeholder: 'Only used if we need to arrange a call' }),
      q('short', 'Where are you based?', { required: true, placeholder: 'City and country' }),
      q('dropdown', 'Which role are you applying for?', {
        required: true,
        options: opts('[Role one]', '[Role two]', '[Role three]', 'General interest — no specific role'),
      }),
      q('section', 'Your experience'),
      q('number', 'Years of relevant experience', { min: 0, max: 50 }),
      q('paragraph', 'Why this role, and why now?', {
        required: true,
        rows: 5,
        help: 'A few honest sentences beat a page of polish.',
      }),
      q('paragraph', 'Tell us about a piece of work you are proud of', {
        required: true,
        rows: 6,
        help: 'What was the problem, what did you actually do, and how did it turn out? It does not have to be paid work.',
      }),
      q('checkboxes', 'Which of these have you worked with hands-on?', {
        options: opts(
          '[Skill or tool one]',
          '[Skill or tool two]',
          '[Skill or tool three]',
          '[Skill or tool four]',
          'Managing or mentoring other people',
          'Working directly with customers',
        ),
        otherOption: true,
      }),
      q('short', 'A link to your work', { placeholder: 'Portfolio, LinkedIn, GitHub — whatever shows it best' }),
      q('section', 'Practical details'),
      q('date', 'Earliest date you could start'),
      q('choice', 'What arrangement are you looking for?', {
        options: opts('Full-time', 'Part-time', 'Contract', 'Internship or placement'),
      }),
      q('choice', 'Are you able to work in [country] without visa sponsorship?', {
        options: opts('Yes', 'No — I would need sponsorship', 'Not sure'),
      }),
      q('short', 'Salary expectation', { placeholder: 'A range is fine' }),
      q('paragraph', 'Anything else you would like us to know?', {
        rows: 3,
        help: 'Adjustments you need for the interview, a career gap you would rather explain up front, anything.',
      }),
    ],
  })
}

// ---------- 4. Contact / enquiry ----------

function makeContactEnquiry(): FormsContent {
  return form({
    theme: 'ocean',
    description:
      'Send us a message and we will get back to you, usually within [one working day]. Fill this in, send the response file back, and it lands with the right person.',
    confirmation: 'Thanks for getting in touch — send the response file back and we will reply shortly.',
    questions: [
      q('short', 'Your name', { required: true }),
      q('email', 'Email address', { required: true, help: 'We will reply here.' }),
      q('short', 'Company or organisation'),
      q('dropdown', 'What is your enquiry about?', {
        required: true,
        options: opts(
          'Sales and pricing',
          'Technical support',
          'An existing order',
          'Billing or invoices',
          'Partnerships',
          'Press and media',
          'Something else',
        ),
      }),
      q('paragraph', 'How can we help?', {
        required: true,
        rows: 6,
        placeholder: 'The more detail you can give, the better our first reply will be.',
      }),
      q('choice', 'How soon do you need an answer?', {
        options: opts('Whenever you can', 'Within a few days', 'Today if at all possible'),
      }),
      q('choice', 'How would you prefer we reply?', {
        options: opts('Email', 'A phone call', 'Either is fine'),
      }),
      q('short', 'Phone number', { help: 'Only if you would rather we called.' }),
      q('choice', 'How did you hear about us?', {
        options: opts('Search', 'Word of mouth', 'Social media', 'An event or conference', 'An article or review'),
        otherOption: true,
      }),
    ],
  })
}

// ---------- 5. Course feedback ----------

function makeCourseFeedback(): FormsContent {
  return form({
    theme: 'forest',
    description:
      'Your feedback on [Course name] shapes how it runs next time. Responses are anonymous unless you choose to add your name at the end.',
    confirmation: 'Thank you — feedback like this is what makes the next run of the course better.',
    questions: [
      q('dropdown', 'Which run of the course is this?', {
        options: opts('[Term / cohort one]', '[Term / cohort two]', '[Term / cohort three]'),
      }),
      q('scale', 'Overall, how would you rate this course?', {
        required: true,
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: 'Poor',
        scaleMaxLabel: 'Excellent',
      }),
      q('section', 'How it went', { help: 'Rate how much you agree with each statement.' }),
      q('scale', 'The learning objectives were clear from the start', {
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: 'Strongly disagree',
        scaleMaxLabel: 'Strongly agree',
      }),
      q('scale', 'The pace suited me', {
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: 'Far too slow',
        scaleMaxLabel: 'Far too fast',
        help: 'The middle of the scale means the pace was about right.',
      }),
      q('scale', 'The materials — slides, readings, exercises — were useful', {
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: 'Not useful',
        scaleMaxLabel: 'Very useful',
      }),
      q('scale', 'Explanations were clear and questions were answered well', {
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: 'Strongly disagree',
        scaleMaxLabel: 'Strongly agree',
      }),
      q('choice', 'How much of the course did you attend?', {
        options: opts('All of it', 'Most of it', 'About half', 'A few sessions'),
      }),
      q('number', 'Roughly how many hours a week did you spend outside class?', { min: 0, max: 40 }),
      q('checkboxes', 'Which parts helped you learn the most?', {
        options: opts(
          'Lectures',
          'Practical exercises',
          'Group work',
          'Readings',
          'Assignments and projects',
          'Office hours and one-to-one help',
          'Discussion with other students',
        ),
        otherOption: true,
      }),
      q('section', 'In your own words'),
      q('paragraph', 'What was the most useful thing you learned?', { rows: 3 }),
      q('paragraph', 'What one change would improve the course?', {
        rows: 4,
        help: 'Something concrete we could actually do differently next time.',
      }),
      q('choice', 'Would you recommend this course to another student?', {
        options: opts('Yes', 'Probably', 'Probably not', 'No'),
      }),
      q('short', 'Your name', { help: 'Optional. Leave blank to stay anonymous.' }),
    ],
  })
}

// ---------- 6. Quiz — multiple choice ----------

function makeQuiz(): FormsContent {
  return form({
    theme: 'sunset',
    numbered: true,
    description:
      'Ten questions, one point each, and a tiebreaker at the end. Swap in your own questions — the answers land in the responses table where you can mark them side by side.',
    confirmation: 'Answers locked in. Send the response file back to the quizmaster — no changing your mind now.',
    questions: [
      q('short', 'Your name or team name', { required: true }),
      q('section', 'Round one — science and nature'),
      q('choice', 'What is the chemical symbol for potassium?', {
        required: true,
        options: opts('K', 'P', 'Po', 'Pt'),
      }),
      q('choice', 'Which gas makes up about 78% of the air we breathe?', {
        required: true,
        options: opts('Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon'),
      }),
      q('checkboxes', 'Which of these are noble gases? Select all that apply.', {
        required: true,
        options: opts('Helium', 'Nitrogen', 'Argon', 'Neon', 'Hydrogen'),
      }),
      q('number', 'How many bones are there in the adult human body?', { required: true, min: 0, max: 500 }),
      q('section', 'Round two — the world'),
      q('choice', 'Mount Kilimanjaro stands in which country?', {
        required: true,
        options: opts('Kenya', 'Tanzania', 'Uganda', 'Ethiopia'),
      }),
      q('choice', 'Which is the longest river in South America?', {
        required: true,
        options: opts('The Amazon', 'The Paraná', 'The Orinoco', 'The Magdalena'),
      }),
      q('short', 'What is the capital city of Australia?', { required: true }),
      q('dropdown', 'In which year did the Berlin Wall come down?', {
        required: true,
        options: opts('1987', '1988', '1989', '1990'),
      }),
      q('section', 'Round three — anything goes'),
      q('choice', 'Who painted The Starry Night?', {
        required: true,
        options: opts('Vincent van Gogh', 'Claude Monet', 'Paul Cézanne', 'Edvard Munch'),
      }),
      q('paragraph', 'Name as many of the seven continents as you can', {
        required: true,
        rows: 3,
        help: 'One point for the full set, no half marks.',
      }),
      q('number', 'Tiebreaker: how many member states does the United Nations have?', {
        min: 0,
        max: 300,
        help: 'Closest answer wins if there is a tie at the top.',
      }),
    ],
  })
}

// ---------- 7. Party invitation RSVP ----------

function makePartyRsvp(): FormsContent {
  return form({
    theme: 'rose',
    description:
      'You are invited! [Saturday 14th, from 7pm, at ours.] Let us know if you can make it by [date] so we know how much food to buy.',
    confirmation: 'Amazing — see you there. Send the file back so we know to expect you.',
    questions: [
      q('short', 'Who is replying?', { required: true, placeholder: 'Your name' }),
      q('choice', 'Can you make it?', {
        required: true,
        options: opts('Yes — would not miss it', 'Yes, but I will be late', 'Only for a bit', 'Sadly not this time'),
      }),
      q('number', 'How many of you are coming, including you?', { min: 0, max: 8 }),
      q('short', 'Names of anyone you are bringing'),
      q('time', 'Roughly what time will you arrive?', { help: 'No need to be exact — it just helps with the food.' }),
      q('checkboxes', 'Bringing anything?', {
        options: opts(
          'Something to drink',
          'A dish to share',
          'Dessert',
          'Snacks',
          'A playlist',
          'Games',
          'Just myself',
        ),
        otherOption: true,
      }),
      q('choice', 'Anything you do not eat?', {
        options: opts('I eat everything', 'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut allergy'),
        otherOption: true,
      }),
      q('short', 'One song that has to go on', { placeholder: 'Artist — track' }),
      q('choice', 'Will you need somewhere to crash?', {
        options: opts('No, heading home', 'Maybe — I will let you know', 'Yes please, if there is room'),
      }),
      q('paragraph', 'Message for the host', { rows: 3 }),
    ],
  })
}

// ---------- 8. Volunteer signup ----------

function makeVolunteerSignup(): FormsContent {
  return form({
    theme: 'sunset',
    description:
      'Thank you for offering to help with [event or cause]. Tell us when you are free and what you fancy doing, and we will send a rota back with your slots on it.',
    confirmation:
      'Thank you — send the response file back and we will be in touch with your slots and where to turn up.',
    questions: [
      q('section', 'About you'),
      q('short', 'Full name', { required: true }),
      q('email', 'Email address', { required: true }),
      q('short', 'Mobile number', { help: 'For coordination on the day only.' }),
      q('choice', 'Are you 18 or over?', {
        required: true,
        options: opts('Yes', 'No — I will bring a signed consent form from a parent or guardian'),
      }),
      q('section', 'When you can help'),
      q('checkboxes', 'Which shifts can you cover?', {
        required: true,
        options: opts(
          'Friday evening — setup',
          'Saturday morning',
          'Saturday afternoon',
          'Saturday evening',
          'Sunday morning',
          'Sunday afternoon',
          'Sunday evening — pack down',
        ),
      }),
      q('dropdown', 'How many hours can you give in total?', {
        options: opts('Up to 2', '2–4', '4–8', 'A full day', 'The whole weekend'),
      }),
      q('date', 'If you can only do one date, which?'),
      q('section', 'What you would like to do'),
      q('checkboxes', 'Which roles appeal to you?', {
        required: true,
        options: opts(
          'Setup and pack down',
          'Welcome desk and registration',
          'Food and drinks',
          'Activities for children',
          'Driving and deliveries',
          'Photography',
          'Litter picking and tidying',
          'First aid',
          'Happy to go wherever I am needed',
        ),
      }),
      q('paragraph', 'Any relevant experience or training?', {
        rows: 3,
        help: 'First aid, food hygiene, DBS check, working with children, a van — anything useful.',
      }),
      q('choice', 'Can you drive and do you have a vehicle?', {
        options: opts('Yes to both', 'I can drive but have no vehicle', 'No'),
      }),
      q('short', 'Emergency contact — name and number', { required: true }),
      q('paragraph', 'Anything we should know to make this work for you?', {
        rows: 3,
        help: 'Access needs, a time you have to leave by, someone you would rather be paired with.',
      }),
    ],
  })
}

// ---------- 9. Product research survey ----------

function makeProductResearch(): FormsContent {
  return form({
    theme: 'violet',
    description:
      'We are working on something new for [problem area] and would rather hear from you before we build it than after. Ten questions, about five minutes, and no sales follow-up unless you ask for one.',
    confirmation: 'Thank you — this genuinely shapes what we build next.',
    questions: [
      q('section', 'How you work today'),
      q('choice', 'How often do you [do the thing this product would help with]?', {
        required: true,
        options: opts('Several times a day', 'Daily', 'A few times a week', 'Weekly', 'Monthly or less', 'Never'),
      }),
      q('checkboxes', 'What do you use for this at the moment?', {
        options: opts('[Competitor one]', '[Competitor two]', '[Competitor three]', 'Spreadsheets', 'Pen and paper', 'Nothing in particular'),
        otherOption: true,
      }),
      q('scale', 'How well does your current approach work?', {
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: 'Badly',
        scaleMaxLabel: 'Very well',
      }),
      q('paragraph', 'What is the most frustrating part of how you do this today?', {
        required: true,
        rows: 4,
        help: 'The last time it annoyed you — what happened?',
      }),
      q('section', 'What would actually help'),
      q('checkboxes', 'Which of these would be genuinely valuable to you?', {
        options: opts(
          '[Capability one]',
          '[Capability two]',
          '[Capability three]',
          '[Capability four]',
          'Works offline',
          'Nothing here — none of this solves my problem',
        ),
      }),
      q('choice', 'If it did all of that, what would you expect to pay per month?', {
        options: opts('Nothing — I would only use a free tool', 'Under [$10]', '[$10–25]', '[$25–50]', '[$50–100]', 'More than [$100]'),
      }),
      q('choice', 'Who decides on purchases like this?', {
        options: opts(
          'I do',
          'I recommend, someone else approves',
          'My manager decides',
          'A central procurement team',
          'Not applicable — this is for personal use',
        ),
      }),
      q('section', 'About you'),
      q('short', 'What is your role?', { placeholder: 'Job title, or how you would describe what you do' }),
      q('dropdown', 'How many people work at your organisation?', {
        options: opts('Just me', '2–10', '11–50', '51–200', '201–1,000', 'More than 1,000'),
      }),
      q('choice', 'Would you be willing to try an early version and tell us what you think?', {
        options: opts('Yes', 'Maybe — tell me more first', 'No thanks'),
      }),
      q('email', 'Email address', { help: 'Only if you said yes or maybe above. Used for this research and nothing else.' }),
    ],
  })
}

// ---------- 10. Confidential tip submission ----------

function makeConfidentialTip(): FormsContent {
  return form({
    theme: 'graphite',
    description:
      'This page is a single file that runs entirely on your own device. It has no connection to us and no code that could send anything anywhere — disconnect from the internet and it still works exactly the same. When you press submit, a file is written to your device and nothing else happens. You decide whether, when and how to send it.',
    confirmation:
      'Your response file has been created on this device. Nothing has been sent anywhere. Send it whichever way you trust, and delete the file afterwards if this computer is not yours alone.',
    questions: [
      q('section', 'Before you start', {
        help: 'We do not ask who you are and you should not tell us unless you want to. If you are using a work computer or a work network, consider finishing this on a personal device instead.',
      }),
      q('paragraph', 'What happened?', {
        required: true,
        rows: 10,
        help: 'In your own words, in whatever order it comes out. Dates, places, documents and the names of organisations are more useful to us than adjectives.',
      }),
      q('date', 'When did this happen?', {
        help: 'Approximate is fine. Leave it blank if narrowing the date would point back at you.',
      }),
      q('short', 'Where did this happen?', {
        help: 'An organisation, a site, a department — as specific or as vague as you are comfortable being.',
      }),
      q('choice', 'Is it still happening?', {
        options: opts('Yes, as far as I know', 'No, it has stopped', 'I do not know'),
      }),
      q('choice', 'How do you know about this?', {
        options: opts(
          'I saw it myself',
          'It happened to me',
          'Someone involved told me',
          'I came across it in documents',
          'Prefer not to say',
        ),
      }),
      q('checkboxes', 'What evidence exists, if any?', {
        help: 'Just tell us what exists — do not attach or copy anything into this form.',
        options: opts(
          'Documents or records',
          'Emails or messages',
          'Photographs or video',
          'Financial records',
          'People who would speak to us',
          'Nothing — this is what I saw or was told',
        ),
      }),
      q('choice', 'Has anyone else been told?', {
        options: opts(
          'No, this is the first time I have told anyone',
          'Yes, inside the organisation',
          'Yes, a regulator or the police',
          'Yes, another journalist',
          'Prefer not to say',
        ),
      }),
      q('section', 'Risk and contact'),
      q('choice', 'Could anyone be put at risk by this being published?', {
        required: true,
        options: opts(
          'I do not think so',
          'Possibly — please talk to me before publishing',
          'Yes — read the note below before doing anything',
        ),
      }),
      q('paragraph', 'Anything we must avoid doing?', {
        rows: 4,
        help: 'Details that would identify you, people who must not be approached, timing that would put someone at risk.',
      }),
      q('choice', 'Are you willing to be contacted?', {
        required: true,
        options: opts(
          'No — this is everything I want to share',
          'Yes, but only through a method I choose',
          'Yes, and I have left a way to reach me below',
        ),
      }),
      q('short', 'A way to reach you', {
        help: 'Leave this blank to stay anonymous. If you do fill it in, a throwaway address or a Signal number is safer than a work email or a work phone.',
      }),
      q('section', 'Before you send', {
        help: 'Save the response file somewhere only you can reach. If you are on a shared or work computer, delete the download once you have sent it, and empty the trash. Send it in a way you trust — you are in control of that step, not us.',
      }),
    ],
  })
}

export const formsTemplates: FormsTemplate[] = [
  {
    id: 'form-event-rsvp',
    name: 'Event RSVP',
    description: 'Collect attendance, numbers, session choices and dietary needs before an event.',
    category: 'Events',
    accent: '#7c3aed',
    glyph: '🎟️',
    make: makeEventRsvp,
  },
  {
    id: 'form-customer-feedback',
    name: 'Customer feedback',
    description: 'A short satisfaction survey with a recommendation score and one honest open question.',
    category: 'Business',
    accent: '#0d9488',
    glyph: '💬',
    make: makeCustomerFeedback,
  },
  {
    id: 'form-job-application',
    name: 'Job application',
    description: 'Structured application covering experience, work samples, availability and salary.',
    category: 'Career',
    accent: '#475569',
    glyph: '💼',
    make: makeJobApplication,
  },
  {
    id: 'form-contact-enquiry',
    name: 'Contact / enquiry form',
    description: 'A general enquiry form that routes itself: topic, urgency and how to reply.',
    category: 'Business',
    accent: '#0284c7',
    glyph: '📮',
    make: makeContactEnquiry,
  },
  {
    id: 'form-course-feedback',
    name: 'Course feedback',
    description: 'Anonymous end-of-course evaluation with rating scales and two open questions.',
    category: 'Education',
    accent: '#047857',
    glyph: '🎓',
    make: makeCourseFeedback,
  },
  {
    id: 'form-quiz',
    name: 'Quiz — multiple choice',
    description: 'A ten-question quiz with rounds, mixed answer types and a tiebreaker.',
    category: 'Education',
    accent: '#d97706',
    glyph: '🧠',
    make: makeQuiz,
  },
  {
    id: 'form-party-rsvp',
    name: 'Party invitation RSVP',
    description: 'A warm, informal RSVP: who is coming, what they are bringing and a song request.',
    category: 'Personal',
    accent: '#db2777',
    glyph: '🎉',
    make: makePartyRsvp,
  },
  {
    id: 'form-volunteer-signup',
    name: 'Volunteer signup',
    description: 'Shift availability, preferred roles, experience and emergency contact in one pass.',
    category: 'Personal',
    accent: '#ea580c',
    glyph: '🙌',
    make: makeVolunteerSignup,
  },
  {
    id: 'form-product-research',
    name: 'Product research survey',
    description: 'Validate an idea before building it: current habits, frustrations, pricing and buying power.',
    category: 'Marketing',
    accent: '#6d28d9',
    glyph: '🔍',
    make: makeProductResearch,
  },
  {
    id: 'form-confidential-tip',
    name: 'Confidential tip submission',
    description: 'For taking anonymous tips: nothing is uploaded, and it asks nothing identifying unless offered.',
    category: 'Business',
    accent: '#334155',
    glyph: '🔒',
    make: makeConfidentialTip,
  },
]
