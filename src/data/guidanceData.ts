export interface GuidanceStep {
  title: string;
  detail: string;
}

export interface GuidanceModule {
  id: string;
  kicker: string;
  title: string;
  summary: string;
  steps: GuidanceStep[];
  tip: string;
}

export interface PaperTimePreset {
  id: string;
  label: string;
  tier: 'SSC (Grades 9–10)' | 'HSSC (Grades 11–12)';
  totalMarks: number;
  totalMinutes: number;
  sectionA: { marks: number; minutes: number; note: string };
  sectionB: { marks: number; minutes: number; note: string };
  sectionC: { marks: number; minutes: number; note: string };
  reviewMinutes: number;
}

export interface GroupRoadmapItem {
  tier: string;
  groupName: string;
  coreSubjects: string;
  boardFocus: string;
  entrancePath: string;
}

export const PAPER_TIME_PRESETS: PaperTimePreset[] = [
  {
    id: 'ssc_60',
    label: 'SSC Physics / Chem / Bio (60 Marks · 2h 30m)',
    tier: 'SSC (Grades 9–10)',
    totalMarks: 60,
    totalMinutes: 150,
    sectionA: { marks: 12, minutes: 20, note: '12 MCQs on OMR sheet — fill bubbles carefully once sure.' },
    sectionB: { marks: 32, minutes: 65, note: 'Attempt 8 short Qs / numericals (~8 min each with formula).' },
    sectionC: { marks: 16, minutes: 50, note: '2 long questions (parts a & b) with labeled diagrams.' },
    reviewMinutes: 15,
  },
  {
    id: 'ssc_75',
    label: 'SSC Mathematics / English (75 Marks · 3h 00m)',
    tier: 'SSC (Grades 9–10)',
    totalMarks: 75,
    totalMinutes: 180,
    sectionA: { marks: 15, minutes: 20, note: '15 MCQs — eliminate wrong choices before bubbling.' },
    sectionB: { marks: 36, minutes: 80, note: '9 short solutions (~8–9 min each, show intermediate steps).' },
    sectionC: { marks: 24, minutes: 65, note: '3 structured long proofs / theorems / essays (~21 min each).' },
    reviewMinutes: 15,
  },
  {
    id: 'hssc_85',
    label: 'HSSC Physics / Chem / Bio (85 Marks · 3h 00m)',
    tier: 'HSSC (Grades 11–12)',
    totalMarks: 85,
    totalMinutes: 180,
    sectionA: { marks: 17, minutes: 20, note: '17 SLO-based MCQs — watch SI unit conversions closely.' },
    sectionB: { marks: 44, minutes: 80, note: '11 short answers & 6-step numericals (~7 min each).' },
    sectionC: { marks: 24, minutes: 65, note: '3 detailed derivations/cycles with clear headings.' },
    reviewMinutes: 15,
  },
  {
    id: 'hssc_100',
    label: 'HSSC Mathematics / English (100 Marks · 3h 00m)',
    tier: 'HSSC (Grades 11–12)',
    totalMarks: 100,
    totalMinutes: 180,
    sectionA: { marks: 20, minutes: 25, note: '20 MCQs — verify signs, domains, and grammar precision.' },
    sectionB: { marks: 50, minutes: 80, note: '10 short questions (~8 min each, underline final result).' },
    sectionC: { marks: 30, minutes: 60, note: '3 extended questions (~20 min each) + clean formatting.' },
    reviewMinutes: 15,
  },
];

export const STUDENT_GUIDANCE_MODULES: GuidanceModule[] = [
  {
    id: 'bise_pattern',
    kicker: 'KPK BISE Board Strategy',
    title: 'How KPK Board Papers Award Marks (Sections A, B & C)',
    summary:
      'All 8 KPK BISE boards (Peshawar, Mardan, Swat, Malakand, Abbottabad, Kohat, Bannu, D.I. Khan) follow SLO-aligned papers split into objective MCQs, short structured answers, and extended questions.',
    steps: [
      {
        title: 'Section A — Objective MCQs (20% Marks)',
        detail:
          'Never leave an MCQ blank (there is no negative marking in BISE exams). Read units and negations ("not", "except") twice before filling the OMR bubble cleanly.',
      },
      {
        title: 'Section B — Short Questions & Numericals (~50% Marks)',
        detail:
          'Answer strictly what is asked in 3–5 clear lines plus one formula, example, or SI unit. Attempting extra sub-parts should only happen after Section C is complete.',
      },
      {
        title: 'Section C — Long Questions & Derivations (~30% Marks)',
        detail:
          'Structure answers with Statement / Definition, Labeled Diagram, Mathematical Derivation, and Conclusion. Examiners award marks per sub-heading.',
      },
      {
        title: '40% Passing & SLO Concept Rule',
        detail:
          'Modern KPK papers test understanding rather than word-for-word memorization. Explain definitions in clear textbook terminology and back them up with units or examples.',
      },
    ],
    tip: 'Keep the final 15 minutes reserved to check units, question numbers, and unattempted MCQ bubbles.',
  },
  {
    id: 'six_step_numericals',
    kicker: 'Full-Marks Numerical Rubric',
    title: 'The 6-Step Method Board Examiners Expect',
    summary:
      'In KPK BISE Physics and Chemistry, skipping intermediate steps costs marks even when the final number is right. Writing all 6 steps guarantees partial credit too.',
    steps: [
      {
        title: '1. Given Data (with SI Conversion)',
        detail:
          'List every quantity with its symbol and convert km/h to m/s, cm to m, or g to kg immediately at the top.',
      },
      {
        title: '2. To Find (Required)',
        detail:
          'Write the exact unknown symbol and target unit clearly (e.g., S = ? in metres).',
      },
      {
        title: '3. Formula',
        detail:
          'State the symbolic equation before plugging in any numbers (e.g., S = vi·t + 1/2 a·t^2).',
      },
      {
        title: '4. Substitution',
        detail:
          'Substitute converted SI values carefully with parentheses so signs and exponents stay accurate.',
      },
      {
        title: '5. Calculation',
        detail:
          'Show one clean intermediate arithmetic simplification step to make checking easy.',
      },
      {
        title: '6. Result with Unit',
        detail:
          'Box or underline the final value together with its exact SI unit (e.g., S = 54 m). Missing units typically lose 0.5–1 mark.',
      },
    ],
    tip: 'Always double-check whether deceleration ("comes to rest") makes acceleration negative.',
  },
  {
    id: 'study_method',
    kicker: 'Learning Science & Habits',
    title: 'From Concept Reading to Exam Mastery (Without Burnout)',
    summary:
      'Roshan Study follows a 6-stage learning loop built for self-study, offline access, and real Pakistani electricity/load-shedding schedules.',
    steps: [
      {
        title: '1. Understand → Remember (5-Min Guided Cards)',
        detail:
          'Start with the 5-minute guided steps and 1-tap Urdu meaning hints whenever an English term feels unfamiliar, then check the quick summary.',
      },
      {
        title: '2. Practise → Apply (Levels 1 to 7)',
        detail:
          'Begin with Level 1–2 recall and gradually climb to Level 4–7 numericals and application questions. Use progressive hints before giving up.',
      },
      {
        title: '3. Test → Improve (1d → 3d → 7d Spaced Revision)',
        detail:
          'Mistakes automatically schedule a 1-day review while mastered concepts space out to 3 days and 7 days, so you revise weak chapters before exams.',
      },
      {
        title: '4. Forgiving 2-Day Grace Freeze',
        detail:
          'Two automatic grace freezes protect your study streak during power outages, travel, or school tests—consistency beats perfection.',
      },
    ],
    tip: 'Download your active grade chapters once on Wi-Fi so you can revise completely offline.',
  },
  {
    id: 'board_vs_entrance',
    kicker: 'Score Isolation Principle',
    title: 'Grades 9–12 Board Prep vs MDCAT / ETEA Entrance Tracks',
    summary:
      'Board examinations test written explanations, diagrams, and step-by-step numericals, whereas MDCAT/ETEA test rapid negative-marked or speed-timed MCQs.',
    steps: [
      {
        title: 'Keep Board Accuracy Clean',
        detail:
          'Roshan Study keeps your SSC/HSSC board accuracy strictly isolated from MDCAT and ETEA entrance attempts so weak entrance guesses never distort board readiness.',
      },
      {
        title: 'Respect Verified Past Paper Labels',
        detail:
          'Only questions with verified BISE board + year metadata carry an official past-paper tag; practice questions are labeled clearly so you never rely on fake "guess papers".',
      },
    ],
    tip: 'Master KPECTB textbook concepts first—over 85% of both BISE and MDCAT/ETEA items trace back to textbook fundamentals.',
  },
];

export const GROUP_ROADMAPS: GroupRoadmapItem[] = [
  {
    tier: 'Grades 9–10 (SSC)',
    groupName: 'Science Group',
    coreSubjects: 'Physics, Chemistry, Biology or Computer Science, Mathematics, English, Urdu, Islamiat, Pak Studies',
    boardFocus: '6-step Physics/Maths numericals, neat Biology diagrams, and MCQ unit precision.',
    entrancePath: 'Opens Pre-Medical, Pre-Engineering, and Computer Science in Grade 11.',
  },
  {
    tier: 'Grades 9–10 (SSC)',
    groupName: 'Humanities & Social Sciences',
    coreSubjects: 'General Science, General Mathematics, Civics / Economics / Islamiat Elective, Compulsory Subjects',
    boardFocus: 'Structured headings, accurate definitions, and concise historical/civic examples.',
    entrancePath: 'Leads to FA, Commerce (I.Com), Arts, Education, and Law pathways.',
  },
  {
    tier: 'Grades 11–12 (HSSC)',
    groupName: 'Pre-Medical',
    coreSubjects: 'Biology, Chemistry, Physics, English, Urdu, Islamiat / Pak Studies',
    boardFocus: 'Detailed biochemical cycles, labeled physiology diagrams, and Physics derivations.',
    entrancePath: 'Primary pathway for MDCAT (MBBS, BDS, Allied Health Sciences).',
  },
  {
    tier: 'Grades 11–12 (HSSC)',
    groupName: 'Pre-Engineering',
    coreSubjects: 'Mathematics, Physics, Chemistry, English, Urdu, Islamiat / Pak Studies',
    boardFocus: 'Calculus/conics proofs, 6-step mechanics & electromagnetism numericals.',
    entrancePath: 'Primary pathway for ETEA Engineering, UET Peshawar, NUST, and GIKI.',
  },
  {
    tier: 'Grades 11–12 (HSSC)',
    groupName: 'General / Computer Science (ICS)',
    coreSubjects: 'Computer Science, Mathematics, Physics or Statistics/Economics, Compulsory Subjects',
    boardFocus: 'Logic/programming trace accuracy, database normalization, and Mathematics problem-solving.',
    entrancePath: 'Leads to BS Computer Science, Software Engineering, AI, and Data Science.',
  },
];

export const ADMIN_GUIDANCE_MODULES: GuidanceModule[] = [
  {
    id: 'admin_upload',
    kicker: 'Step 1 · Book Uploader',
    title: 'Import KPECTB Textbook Notes Without Coding',
    summary:
      'Teachers and non-technical admins can create structured chapter drafts in under two minutes using plain text or ChapterPack JSON files.',
    steps: [
      {
        title: 'Choose Grade & Verify Source Permission',
        detail:
          'Select Grade 9–12, verify your subject name and chapter number, and tick the text-only summary or copyright permission box before importing.',
      },
      {
        title: 'Use Simple Line Prefixes',
        detail:
          'Format pasted notes with # Heading, Formula:, Q:, Options: A | B | C | D, Answer:, and Explanation: to generate both a concept card and an interactive practice item.',
      },
      {
        title: 'Test Instantly With Sample Packs',
        detail:
          'Click "Load Sample Test Packs" to populate Grade 9 Biology, Grade 11 Mathematics, and Grade 12 Physics test chapters immediately.',
      },
    ],
    tip: 'Always keep chapters as Draft until a subject teacher verifies formulas and page citations.',
  },
  {
    id: 'admin_ai_generator',
    kicker: 'Step 2 · Smart Question Generator',
    title: 'Generate Ready-Made Cloud Questions ($0 Student AI Cost)',
    summary:
      'Gemini runs once on the server during admin authoring to generate KPK BISE MCQs, 6-step numericals, and mark-allocated schemes into static cloud packs.',
    steps: [
      {
        title: 'Paste 40–15,000 Characters From KPECTB Text',
        detail:
          'Include definitions, equations, and boundary conditions (e.g., initial rest vi = 0) so generated numericals stay faithful to the textbook.',
      },
      {
        title: 'Request Specific KPK BISE Formats',
        detail:
          'Set counts for MCQs (includes wrong-option misconceptions), 6-step numericals, and Section B/C marking-scheme questions across difficulty Levels 1–7.',
      },
      {
        title: 'Review, Edit & Sign Off Before Saving',
        detail:
          'Check every generated answer and unit inline, add your Human Reviewer Sign-off name, and save approved items into the chapter pack.',
      },
    ],
    tip: 'Never tag AI-generated items as official BISE past papers—keep them under practice_original.',
  },
  {
    id: 'admin_publish_gate',
    kicker: 'Step 3 · Content Studio & Publish Gate',
    title: 'Quality Checklist Before Publishing Offline Packs',
    summary:
      'Every chapter must pass schema, citation, and human-review checks before students can download it.',
    steps: [
      {
        title: '1. Textbook Source & Page Citation',
        detail:
          'Every concept requires non-empty Source Book and Source Page references.',
      },
      {
        title: '2. Complete MCQ & 6-Step Numerical Fields',
        detail:
          'MCQs require at least 2 options matching the correct answer; numericals require Given, Required, Formula, Substitution, Calculation, and Answer with Unit.',
      },
      {
        title: '3. Human Reviewer Sign-Off',
        detail:
          'Long-answer questions, official BISE past papers, and AI-generated drafts block publication until signed off by a human reviewer.',
      },
    ],
    tip: 'Export updated packs as versioned JSON backups anytime using the "Export Pack" button.',
  },
];
