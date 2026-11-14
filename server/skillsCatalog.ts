import type { AgentRoleId, AgentSkillSpec } from '../src/types/cms.ts';

export interface SpecialistRoleDefinition {
  id: AgentRoleId;
  title: string;
  phase: number;
  track: 'authoring' | 'verification' | 'coordination' | 'publishing';
  description: string;
}

export const SPECIALIST_ROLES_30: SpecialistRoleDefinition[] = [
  { id: 'project_manager', title: 'Project Manager Agent', phase: 1, track: 'coordination', description: 'Schedules chapter/book jobs, assigns scoped tasks, enforces retry limits.' },
  { id: 'curriculum_architect', title: 'Curriculum Architect Agent', phase: 1, track: 'coordination', description: 'Aligns content to KPK BISE 8-board SLO boundaries and grade level.' },
  { id: 'textbook_researcher', title: 'Textbook Researcher Agent', phase: 2, track: 'authoring', description: 'Maps textbook sections, page numbers, and KPECTB chapter citations.' },
  { id: 'pdf_extraction', title: 'PDF Extraction Specialist', phase: 2, track: 'authoring', description: 'Cleans page text extracts and inspects scanned/formula-dense pages.' },
  { id: 'chapter_structure', title: 'Chapter Structure Architect', phase: 3, track: 'authoring', description: 'Defines chapter intro, prerequisites, learning outcomes, and topic tree.' },
  { id: 'topic_mapping', title: 'Topic Mapping Agent', phase: 3, track: 'authoring', description: 'Links concepts, formulas, examples, and question banks to topicIds.' },
  { id: 'concept_writer', title: 'Concept Writer Agent', phase: 4, track: 'authoring', description: 'Writes learning objectives, simple & detailed explanations, and definitions.' },
  { id: 'explanation_writer', title: 'Explanation Writer Agent', phase: 4, track: 'authoring', description: 'Writes clear, misconception-free Pakistani English student explanations.' },
  { id: 'simplification_specialist', title: 'Simplification Specialist', phase: 4, track: 'authoring', description: 'Converts dense paragraphs into Duolingo-style progressive microCards.' },
  { id: 'notes_generator', title: 'Notes Generator Agent', phase: 4, track: 'authoring', description: 'Produces high-yield summaries, flashcards, and 1-tap Urdu vocabulary hints.' },
  { id: 'example_generator', title: 'Example Generator Agent', phase: 4, track: 'authoring', description: 'Authors solved worked examples grounded in KPECTB page citations.' },
  { id: 'diagram_visualization', title: 'Diagram & Motion Agent', phase: 4, track: 'authoring', description: 'Authors offline $0 MotionGraphicSpec animations and Math GraphSpecs.' },
  { id: 'question_generator', title: 'Question Generator Agent', phase: 4, track: 'authoring', description: 'Coordinates balanced question coverage across difficulty levels 1-7.' },
  { id: 'mcq_specialist', title: 'MCQ Specialist Agent', phase: 4, track: 'authoring', description: 'Writes 4-option KPK BISE MCQs, multi-select, true/false, and misconceptions.' },
  { id: 'short_question_specialist', title: 'Short Question Specialist', phase: 4, track: 'authoring', description: 'Authors KPK Section B short questions with weighted marking points.' },
  { id: 'long_question_specialist', title: 'Long Question Specialist', phase: 4, track: 'authoring', description: 'Authors KPK Section C derivations and structured essay questions.' },
  { id: 'numerical_specialist', title: 'Numerical Problem Specialist', phase: 4, track: 'authoring', description: 'Solves numericals using the exact 6-Step KPK Board Method with SI units.' },
  { id: 'practice_designer', title: 'Practice Sequence Designer', phase: 5, track: 'authoring', description: 'Structures interactive Understand -> Recall -> Practise -> Apply flow.' },
  { id: 'quiz_creator', title: 'Quiz Creator Agent', phase: 5, track: 'authoring', description: 'Builds rapid topic check quizzes and interactive matching/fill-in items.' },
  { id: 'board_paper_specialist', title: 'Board Paper Specialist', phase: 8, track: 'authoring', description: 'Constructs KPK Section A/B/C model exams respecting board blueprints.' },
  { id: 'answer_key_specialist', title: 'Answer Key Specialist', phase: 5, track: 'authoring', description: 'Verifies exact verbatim MCQ matches, multi-select arrays, and units.' },
  { id: 'marking_scheme_specialist', title: 'Marking Scheme Specialist', phase: 5, track: 'authoring', description: 'Assigns step-by-step mark breakdowns for written board questions.' },
  { id: 'math_verification', title: 'Math Verification Specialist', phase: 6, track: 'verification', description: 'Independent verifier checking algebraic derivations and balanced KaTeX.' },
  { id: 'science_verification', title: 'Science Verification Specialist', phase: 6, track: 'verification', description: 'Independent verifier checking Physics/Chemistry/Biology laws & SI units.' },
  { id: 'language_editor', title: 'Language Clarity Editor', phase: 6, track: 'verification', description: 'Independent verifier ensuring Grade 9-12 Pakistani English clarity.' },
  { id: 'pedagogy_reviewer', title: 'Pedagogy & Engagement Reviewer', phase: 6, track: 'verification', description: 'Independent verifier scoring Duolingo+Brilliant intuition & microCards.' },
  { id: 'duplicate_detection', title: 'Duplicate Detection Verifier', phase: 6, track: 'verification', description: 'Scans cross-chapter catalog to eliminate duplicate question stems.' },
  { id: 'formatting_specialist', title: 'Formatting & KaTeX Verifier', phase: 6, track: 'verification', description: 'Audits KaTeX syntax, graph bounds, and 0..100 visual coordinates.' },
  { id: 'final_quality_auditor', title: 'Final Quality Auditor', phase: 6, track: 'verification', description: 'Enforces independent worker sign-off before human approval inbox.' },
  { id: 'revision_material', title: 'Revision Material Specialist', phase: 7, track: 'publishing', description: 'Builds flashcards, cram notes, and weak-topic revision packs for approval.' },
];

export const AGENT_SKILLS_CATALOG: AgentSkillSpec[] = [
  {
    id: 'skill_curriculum_research',
    name: 'Curriculum Research & SLO Mapping',
    category: 'Curriculum & Planning',
    primaryRoles: ['curriculum_architect', 'curriculum_research'],
    summary: 'Map chapter topics strictly to KPK BISE Grades 9-12 SLOs with SSC/HSSC isolation.',
    inputSchema: { grade: '9|10|11|12', subjectName: 'string', chapterTitle: 'string', bookSource: 'string' },
    outputSchema: { learningOutcomes: 'string[]', prerequisites: 'string[]', programmeId: 'ssc_hssc' },
    qualityRules: [
      'Never assign groupId="admission" on ssc_hssc chapters.',
      'Reference KPECTB English-medium syllabus boundaries only.',
    ],
    exampleSnippet: '{"programmeId":"ssc_hssc","grade":9,"groupId":"ssc_science","learningOutcomes":["Apply F = ma in SI units."]}',
  },
  {
    id: 'skill_textbook_extraction',
    name: 'PDF & Textbook Source Extraction',
    category: 'Source Processing',
    primaryRoles: ['pdf_extraction', 'source_processing', 'textbook_researcher'],
    summary: 'Download PDF source via /api/agent/books/:id/source, extract clean equations and page numbers.',
    inputSchema: { bookId: 'string', pageRange: 'string' },
    outputSchema: { pageAnchors: 'string[]', cleanExtract: 'string', formulasDetected: 'string[]' },
    qualityRules: [
      'Cite exact KPECTB book title and page reference on every concept.',
      'Flag scanned/image-only pages cleanly rather than guessing text.',
    ],
    exampleSnippet: '{"sourceBook":"KPECTB Physics Grade 9","sourcePage":"Ch. 3, pp. 56-62"}',
  },
  {
    id: 'skill_chapter_architecture',
    name: 'Chapter Tree & Topic Blueprinting',
    category: 'Curriculum & Planning',
    primaryRoles: ['chapter_structure', 'chapter_architect', 'topic_mapping'],
    summary: 'Design chapter intro, prerequisite bridge, ordered topics, and concept IDs.',
    inputSchema: { learningOutcomes: 'string[]', cleanExtract: 'string' },
    outputSchema: { chapterId: 'string', topicTree: 'Topic[]', conceptOrder: 'string[]' },
    qualityRules: ['Use deterministic slug IDs (e.g. phy_9_ch3_t1).', 'Sequence concepts from concrete intuition to formulas.'],
    exampleSnippet: '{"chapterIntro":"Dynamics explains why objects start, stop, or turn.","prerequisites":["Speed and acceleration"]}',
  },
  {
    id: 'skill_concept_writing',
    name: 'Structured 12-Part Concept Authoring',
    category: 'Lesson Authoring',
    primaryRoles: ['concept_writer', 'explanation_writer'],
    summary: 'Write clear simpleExplanation, detailedExplanation, learningObjectives, definitions, and applications.',
    inputSchema: { topicId: 'string', sourceExtract: 'string' },
    outputSchema: { title: 'string', learningObjectives: 'string[]', simpleExplanation: 'string', detailedExplanation: 'string' },
    qualityRules: ['Keep simpleExplanation crisp for fast mobile reading.', 'Use balanced KaTeX $...$ math delimiters everywhere.'],
    exampleSnippet: '{"title":"Newton\'s Second Law","simpleExplanation":"Acceleration grows with force: $a = F/m$."}',
  },
  {
    id: 'skill_duolingo_microcards',
    name: 'Interactive Duolingo + Brilliant Micro-Cards',
    category: 'Lesson Authoring',
    primaryRoles: ['simplification_specialist', 'pedagogy_reviewer'],
    summary: 'Break concepts into 3-4 bite-size intuition cards with 1-tap inline quick checks.',
    inputSchema: { conceptTitle: 'string', coreIdea: 'string' },
    outputSchema: { microCards: 'MicroLessonCard[] (with quickCheckQuestion, quickCheckOptions[3], quickCheckAnswer)' },
    qualityRules: ['Each micro-card covers one focused idea (<= 35 words).', 'quickCheckAnswer must match one quickCheckOptions item verbatim.'],
    exampleSnippet: '{"stageTitle":"01. Push Test","body":"Same force on lighter mass gives greater acceleration.","quickCheckOptions":["Lighter","Heavier","Same"],"quickCheckAnswer":"Lighter"}',
  },
  {
    id: 'skill_notes_flashcards_urdu',
    name: 'Revision Notes, Flashcards & Urdu Hints',
    category: 'Revision & Retention',
    primaryRoles: ['notes_generator', 'revision_material'],
    summary: 'Produce cram points, front/back flashcards, common board mistakes, and 1-tap Urdu term hints.',
    inputSchema: { conceptTitle: 'string', formulas: 'Formula[]' },
    outputSchema: { quickRevisionSummary: 'string[]', flashcards: '{front,back}[]', glossaryHints: 'GlossaryHintItem[]' },
    qualityRules: ['Always pair commonMistake with commonMistakeCorrection.', 'Keep Urdu meanings concise and accurate.'],
    exampleSnippet: '{"flashcards":[{"front":"SI unit of force?","back":"Newton ($1\\\\text{ N} = 1\\\\text{ kg}\\\\cdot\\\\text{m/s}^2$)"}]}',
  },
  {
    id: 'skill_worked_examples',
    name: 'Board Worked Example Generation',
    category: 'Lesson Authoring',
    primaryRoles: ['example_generator'],
    summary: 'Create textbook-faithful solved examples showing every intermediate unit conversion.',
    inputSchema: { formula: 'string', context: 'string' },
    outputSchema: { workedExamplePrompt: 'string', workedExampleSteps: 'string[]', workedExampleAnswer: 'string' },
    qualityRules: ['Show unit conversions explicitly before substituting into formula.'],
    exampleSnippet: '{"workedExamplePrompt":"Find force on 2 kg at 5 m/s².","workedExampleSteps":["Given: m=2 kg, a=5 m/s²","F=ma = 10 N"],"workedExampleAnswer":"10 N"}',
  },
  {
    id: 'skill_motion_graphics',
    name: 'Zero-Cost Interactive Motion Graphic Specs',
    category: 'Visual & STEM Media',
    primaryRoles: ['diagram_visualization'],
    summary: 'Author declarative 0..100 SVG MotionGraphicSpec scenes (kinematics, vectors, waves, orbits, reactions).',
    inputSchema: { conceptTitle: 'string', physicalLaw: 'string' },
    outputSchema: { motionGraphics: 'MotionGraphicSpec[]' },
    qualityRules: ['All actor coordinates must be finite numbers in [0, 100].', 'Stages require atPercent 0..100, label, callout, and balanced KaTeX.'],
    exampleSnippet: '{"sceneType":"kinematics_track","durationSec":5,"actors":[{"id":"b1","label":"2 kg","shape":"box","colorToken":"primary","startX":15,"startY":55,"endX":82,"endY":55}]}',
  },
  {
    id: 'skill_math_graphs',
    name: 'Interactive Quantitative Graph Specs',
    category: 'Visual & STEM Media',
    primaryRoles: ['diagram_visualization'],
    summary: 'Author labeled coordinate GraphSpec plots with highlight milestones.',
    inputSchema: { equation: 'string', xRange: '[number, number]' },
    outputSchema: { graphs: 'GraphSpec[]' },
    qualityRules: ['xMax > xMin and yMax > yMin strictly.', 'Each series must contain >= 2 finite (x,y) points.'],
    exampleSnippet: '{"xLabel":"a (m/s²)","yLabel":"F (N)","xMin":0,"xMax":5,"yMin":0,"yMax":12,"series":[{"name":"F=2a","colorToken":"primary","points":[{"x":0,"y":0},{"x":5,"y":10}]}]}',
  },
  {
    id: 'skill_mcq_authoring',
    name: 'KPK BISE Objective Questions (MCQ / Multi-Select / T-F / Match)',
    category: 'Assessment Authoring',
    primaryRoles: ['mcq_specialist', 'question_generator'],
    summary: 'Generate 4-option MCQs with optionMisconceptions, plus multi_select, true_false, fill_in, and matching items.',
    inputSchema: { conceptId: 'string', difficultyRange: '[1,7]' },
    outputSchema: { questions: 'CmsQuestion[]' },
    qualityRules: [
      'MCQ requires 4 distinct options and exact verbatim correctAnswer.',
      'True/False requires options=["True","False"].',
      'Multi-select requires multiSelectAnswers subset of options.',
      'Matching requires >= 2 matchingPairs {left,right}.',
    ],
    exampleSnippet: '{"questionType":"true_false","options":["True","False"],"correctAnswer":"True","marks":1}',
  },
  {
    id: 'skill_numerical_6step',
    name: '6-Step KPK Board Method Numericals',
    category: 'Assessment Authoring',
    primaryRoles: ['numerical_specialist'],
    summary: 'Author Physics/Chemistry/Math numericals strictly in 6-step KPK BISE rubric format.',
    inputSchema: { formula: 'string', difficulty: '1..7' },
    outputSchema: { numericalSteps: 'NumericalSteps', correctAnswer: 'string (equal to answerWithUnit)' },
    qualityRules: [
      'All 6 keys required: given[], required, formula, substitution, calculation, answerWithUnit.',
      'correctAnswer must match answerWithUnit cleanly with SI units.',
    ],
    exampleSnippet: '{"numericalSteps":{"given":["m = 2 kg","a = 5 m/s²"],"required":"Force (F)","formula":"$F = ma$","substitution":"$F = 2 \\\\times 5$","calculation":"$F = 10$","answerWithUnit":"10 N"}}',
  },
  {
    id: 'skill_written_marking_schemes',
    name: 'Short & Long Questions with Marking Schemes',
    category: 'Assessment Authoring',
    primaryRoles: ['short_question_specialist', 'long_question_specialist', 'marking_scheme_specialist'],
    summary: 'Produce Section B/C board questions with explicit point-by-point mark allocation.',
    inputSchema: { questionType: 'short_answer|long_answer', conceptTitle: 'string' },
    outputSchema: { statement: 'string', markingPoints: 'string[]', correctAnswer: 'string', marks: 'number' },
    qualityRules: ['Sum of marking point weights should reflect total marks.', 'State sourceType="practice_original" unless past paper board & year are verified.'],
    exampleSnippet: '{"questionType":"short_answer","marks":3,"markingPoints":["State Newton 2nd Law (1 mark)","Write F=ma (1 mark)","Define 1 Newton (1 mark)"]}',
  },
  {
    id: 'skill_practice_scaffolding',
    name: 'Interactive Practice Flow Scaffolding',
    category: 'Pedagogy & Sequencing',
    primaryRoles: ['practice_designer', 'quiz_creator'],
    summary: 'Organize lesson practice across Understand -> Recall -> Practise -> Apply -> Test.',
    inputSchema: { concepts: 'CmsConcept[]', questions: 'CmsQuestion[]' },
    outputSchema: { scaffoldedQuestions: 'CmsQuestion[]', topicQuiz: 'ExamBlueprint' },
    qualityRules: ['Order items from Level 1 recall to Level 5+ application.', 'Attach concise progressive hints to every non-trivial question.'],
    exampleSnippet: '{"topicId":"phy_9_ch3_t1","hints":["Write down mass in kg first."]}',
  },
  {
    id: 'skill_board_exam_blueprint',
    name: 'KPK BISE Section A/B/C Exam Blueprinting',
    category: 'Assessment Authoring',
    primaryRoles: ['board_paper_specialist', 'examination_builder'],
    summary: 'Assemble timed Chapter Tests, Subject Tests, and Full Mock Exams following KPK BISE sections.',
    inputSchema: { chapterId: 'string', questionIdsByType: 'Record<string,string[]>' },
    outputSchema: { examBlueprint: 'ExamBlueprint' },
    qualityRules: ['Never mix admission questions into ssc_hssc board exams.', 'Compute totalMarks strictly from section marksEach * questionIds.length.'],
    exampleSnippet: '{"examKind":"board_model_exam","durationMinutes":45,"sections":[{"label":"Section A","questionType":"mcq","marksEach":1}]}',
  },
  {
    id: 'skill_independent_stem_verification',
    name: 'Independent Math & Science Re-Verification',
    category: 'Independent QA',
    primaryRoles: ['math_verification', 'science_verification', 'independent_answer_validator', 'answer_key_specialist'],
    summary: 'Independently re-solve calculations and check SI units WITHOUT trusting author worker.',
    inputSchema: { chapter: 'CmsChapter', authorWorkerId: 'string' },
    outputSchema: { validatorResult: '{ passed, score, findings, flaggedItemIds }' },
    qualityRules: [
      'Verifier workerId MUST be different from authorWorkerId.',
      'Re-compute numerical answers from given inputs independently.',
    ],
    exampleSnippet: '{"validatorResult":{"passed":true,"score":98,"findings":[],"flaggedItemIds":[]}}',
  },
  {
    id: 'skill_katex_formatting_audit',
    name: 'KaTeX Syntax & Language Clarity Audit',
    category: 'Independent QA',
    primaryRoles: ['formatting_specialist', 'language_editor'],
    summary: 'Verify balanced $...$ math delimiters, clean units, and friendly Grade 9-12 English.',
    inputSchema: { chapter: 'CmsChapter' },
    outputSchema: { validatorResult: '{ passed, score, findings, flaggedItemIds }' },
    qualityRules: ['Zero unmatched $ or $$ delimiters.', 'Avoid overly academic jargon without a glossary hint.'],
    exampleSnippet: '{"validatorResult":{"passed":true,"score":96,"findings":["All KaTeX blocks balanced."]}}',
  },
  {
    id: 'skill_duplicate_provenance_audit',
    name: 'Cross-Catalog Duplicate & Provenance Audit',
    category: 'Independent QA',
    primaryRoles: ['duplicate_detection', 'curriculum_validator', 'final_quality_auditor'],
    summary: 'Verify zero duplicate questions across catalog and enforce honest past-paper provenance.',
    inputSchema: { chapter: 'CmsChapter' },
    outputSchema: { validatorResult: '{ passed, score, findings, flaggedItemIds }' },
    qualityRules: ['Reject official_past_paper claims lacking sourceBoardId and sourceYear.', 'Flag stem collisions immediately.'],
    exampleSnippet: '{"validatorResult":{"passed":true,"score":100,"findings":[]}}',
  },
  {
    id: 'skill_feedback_revision_loop',
    name: 'Correction Feedback & Targeted Retry',
    category: 'Quality Recovery',
    primaryRoles: ['project_manager', 'final_quality_auditor'],
    summary: 'Return exact failing findings to author queue (max 2 retries) before human escalation.',
    inputSchema: { taskId: 'string', findings: 'string[]', retryCount: 'number' },
    outputSchema: { requeued: 'boolean', escalated: 'boolean', feedbackNotes: 'string' },
    qualityRules: ['Include exact item IDs and correction hint in feedbackNotes.', 'Escalate immediately once retryCount >= maxRetries (2).'],
    exampleSnippet: '{"failed":true,"errorMessage":"Numerical q_2 missing SI unit m/s^2 in answerWithUnit."}',
  },
];

export function mapLogicalRoleToCanonicalQueueRole(role: AgentRoleId): AgentRoleId {
  switch (role) {
    case 'curriculum_architect':
      return 'curriculum_research';
    case 'pdf_extraction':
    case 'textbook_researcher':
      return 'source_processing';
    case 'chapter_structure':
    case 'topic_mapping':
      return 'chapter_architect';
    case 'explanation_writer':
    case 'simplification_specialist':
    case 'example_generator':
      return 'concept_writer';
    case 'revision_material':
      return 'notes_generator';
    case 'mcq_specialist':
    case 'short_question_specialist':
    case 'long_question_specialist':
      return 'question_generator';
    case 'quiz_creator':
    case 'answer_key_specialist':
    case 'marking_scheme_specialist':
      return 'practice_designer';
    case 'board_paper_specialist':
      return 'examination_builder';
    case 'math_verification':
    case 'science_verification':
      return 'independent_answer_validator';
    case 'formatting_specialist':
      return 'language_editor';
    case 'final_quality_auditor':
      return 'quality_assurance';
    default:
      return role;
  }
}
