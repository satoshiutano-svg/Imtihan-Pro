import 'package:roshan_study/core/models/curriculum_models.dart';

/// Bundled offline starter packs across Grades 9–12 (English medium) and
/// isolated Admission Tests (MDCAT / ETEA Engineering).
///
/// Integrity note:
/// - Practice questions are explicitly tagged [QuestionSourceType.practiceOriginal].
/// - Official past-paper labels are never fabricated.
class StarterPacksSeed {
  const StarterPacksSeed._();

  static const String _distanceTimeGraphSvg = '''
<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="320" height="180" fill="#F7FAF8" rx="8"/>
  <line x1="45" y1="150" x2="295" y2="150" stroke="#161D19" stroke-width="2"/>
  <line x1="45" y1="150" x2="45" y2="20" stroke="#161D19" stroke-width="2"/>
  <line x1="45" y1="150" x2="265" y2="38" stroke="#1B6B46" stroke-width="3"/>
  <line x1="155" y1="94" x2="210" y2="94" stroke="#B4690E" stroke-width="2" stroke-dasharray="4 3"/>
  <line x1="210" y1="94" x2="210" y2="66" stroke="#B4690E" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="150" y="170" font-size="11" fill="#4D5952">Time t (s)</text>
  <text x="12" y="90" font-size="11" fill="#4D5952" transform="rotate(-90 12 90)">Distance s (m)</text>
  <text x="172" y="108" font-size="10" fill="#B4690E">Δt</text>
  <text x="216" y="84" font-size="10" fill="#B4690E">Δs</text>
  <text x="125" y="42" font-size="11" font-weight="bold" fill="#1B6B46">Slope = Speed (Δs/Δt)</text>
</svg>
''';

  static const List<ChapterPack> starterPacks = [
    // ================= GRADE 9 PHYSICS — CHAPTER 2: KINEMATICS ==============
    ChapterPack(
      chapterId: 'phy_9_ch2',
      programmeId: ProgrammeId.sscHssc,
      grade: 9,
      subjectId: 'phy_9',
      chapterNumber: 2,
      title: 'Kinematics',
      packVersion: 1,
      estimatedSizeKb: 240,
      isBundledStarter: true,
      learningOutcomes: [
        'Distinguish between scalar and vector quantities with examples.',
        'Differentiate speed and velocity, distance and displacement.',
        'Interpret distance-time graphs for uniform speed.',
        'Apply the three equations of uniformly accelerated motion.',
      ],
      topics: [
        TopicItem(
          id: 'phy_9_ch2_t1',
          chapterId: 'phy_9_ch2',
          orderIndex: 1,
          title: 'Speed, Velocity & Acceleration',
        ),
        TopicItem(
          id: 'phy_9_ch2_t2',
          chapterId: 'phy_9_ch2',
          orderIndex: 2,
          title: 'Equations of Motion',
        ),
      ],
      concepts: [
        ConceptItem(
          id: 'c_phy_9_2_1',
          chapterId: 'phy_9_ch2',
          topicId: 'phy_9_ch2_t1',
          orderIndex: 1,
          title: 'Speed, Velocity and Acceleration',
          simpleExplanation:
              'Speed measures how fast an object covers distance regardless of direction. Velocity measures how fast displacement changes in a specific direction. Acceleration measures how quickly velocity changes with time.',
          definitions: [
            ConceptDefinitionItem(
              term: 'Speed',
              definition:
                  'Distance covered by a body per unit time (scalar quantity).',
            ),
            ConceptDefinitionItem(
              term: 'Velocity',
              definition:
                  'Rate of change of displacement with respect to time (vector quantity).',
            ),
            ConceptDefinitionItem(
              term: 'Acceleration',
              definition:
                  'Rate of change of velocity per unit time (vector quantity).',
            ),
          ],
          importantPoints: [
            'SI unit of speed and velocity is metre per second (m s⁻¹).',
            'SI unit of acceleration is metre per second squared (m s⁻²).',
            'A car moving in a circle at constant speed still has acceleration because its direction changes.',
          ],
          formulas: [
            FormulaItem(
              expression: 'v = s / t',
              description: 'Average speed (s = distance, t = time)',
              unit: 'm s⁻¹',
            ),
            FormulaItem(
              expression: 'a = (vf - vi) / t',
              description: 'Uniform acceleration',
              unit: 'm s⁻²',
            ),
          ],
          diagrams: [
            DiagramItem(
              id: 'diag_phy_9_2_1',
              caption:
                  'Distance-Time graph: a straight inclined line shows uniform speed equal to the slope Δs / Δt.',
              svgMarkup: _distanceTimeGraphSvg,
            ),
          ],
          workedExamples: [
            WorkedExampleItem(
              prompt:
                  'A bus starts from rest and reaches a velocity of 20 m/s in 10 s. Calculate its acceleration.',
              steps: [
                'Given: vi = 0 m/s, vf = 20 m/s, t = 10 s',
                'Formula: a = (vf - vi) / t',
                'Substitution: a = (20 - 0) / 10 = 20 / 10',
              ],
              finalAnswer: '2 m s⁻²',
            ),
          ],
          applications: [
            'Speedometers in vehicles measure instantaneous speed.',
            'Traffic braking distance depends strongly on initial velocity and deceleration.',
          ],
          commonMistakes: [
            CommonMistakeItem(
              mistake: 'Treating speed and velocity as identical.',
              correction:
                  'Velocity requires direction; returning to the starting point makes net displacement (and average velocity) zero even if speed was non-zero.',
            ),
            CommonMistakeItem(
              mistake: 'Writing m/s instead of m/s² for acceleration.',
              correction: 'Always divide velocity (m/s) by time (s) to get m/s².',
            ),
          ],
          quickRevisionSummary: [
            'Speed = distance / time (scalar, m/s).',
            'Velocity = displacement / time (vector, m/s).',
            'Slope of distance-time graph gives speed.',
          ],
          relatedQuestionIds: ['q_phy_9_2_1', 'q_phy_9_2_2', 'q_phy_9_2_3'],
          videoLinks: [
            VideoLinkItem(
              title: 'Speed, Velocity & Acceleration Explained Simply',
              channelName: 'Curated KPK Physics Playlist (Admin Verified)',
              youtubeUrl: 'https://www.youtube.com/results?search_query=class+9+physics+kinematics+speed+velocity+urdu',
              durationLabel: '8 min',
              language: 'ur',
            ),
          ],
          glossaryHints: [
            GlossaryHintItem(
              term: 'Displacement',
              urduMeaning: 'ہٹاؤ (مختصر ترین سیدھا فاصلہ)',
              simpleHint: 'Shortest straight-line distance with direction from start to end.',
            ),
            GlossaryHintItem(
              term: 'Scalar vs Vector',
              urduMeaning: 'اسکیلر بمقابلہ ویکٹر مقدار',
              simpleHint: 'Scalar = size only (50 km/h). Vector = size + direction (50 km/h North).',
            ),
          ],
          microCards: [
            MicroLessonCard(
              stageTitle: '1. Real-Life Intuition',
              body:
                  'A Peshawar BRT bus travels 400 m around a circular turnaround and stops at the exact same gate. Its odometer shows 400 m distance, but its displacement from start to end is 0 m!',
            ),
            MicroLessonCard(
              stageTitle: '2. Quick Tap Check',
              body: 'Test your intuition before moving on:',
              quickCheckQuestion:
                  'If you walk 50 m East and then 50 m West back home, what is your net displacement?',
              quickCheckOptions: ['100 m', '0 m', '50 m East'],
              quickCheckAnswer: '0 m',
            ),
            MicroLessonCard(
              stageTitle: '3. Formula & Unit Rule',
              body:
                  'Velocity = Displacement / Time (m/s). Acceleration = Change in Velocity / Time (m/s²). Always check the squared second on acceleration!',
            ),
          ],
          sourceBook: 'KPECTB Physics Grade 9 (English Medium — verify exact page for current edition)',
          sourcePage: 'Ch. 2, Kinematics',
        ),
        ConceptItem(
          id: 'c_phy_9_2_2',
          chapterId: 'phy_9_ch2',
          topicId: 'phy_9_ch2_t2',
          orderIndex: 2,
          title: 'Three Equations of Uniformly Accelerated Motion',
          simpleExplanation:
              'When an object moves in a straight line with constant acceleration, three standard equations connect initial velocity (vi), final velocity (vf), acceleration (a), time (t), and distance (S).',
          definitions: [
            ConceptDefinitionItem(
              term: 'Uniform Acceleration',
              definition:
                  'Equal changes in velocity occur in equal intervals of time, however small.',
            ),
          ],
          importantPoints: [
            'If a body starts from rest, take vi = 0.',
            'If a body stops, take vf = 0 and expect negative acceleration (retardation).',
          ],
          formulas: [
            FormulaItem(
              expression: 'vf = vi + at',
              description: 'First equation of motion (no S)',
              unit: 'm s⁻¹',
            ),
            FormulaItem(
              expression: 'S = vi·t + ½ a t²',
              description: 'Second equation of motion (no vf)',
              unit: 'm',
            ),
            FormulaItem(
              expression: '2aS = vf² - vi²',
              description: 'Third equation of motion (no t)',
              unit: 'm² s⁻²',
            ),
          ],
          workedExamples: [
            WorkedExampleItem(
              prompt:
                  'A train moving at 10 m/s accelerates at 2 m/s² for 5 s. Find the distance covered.',
              steps: [
                'Given: vi = 10 m/s, a = 2 m/s², t = 5 s',
                'Formula: S = vi·t + ½ a t²',
                'S = (10)(5) + 0.5(2)(25) = 50 + 25',
              ],
              finalAnswer: '75 m',
            ),
          ],
          applications: [
            'Calculating runway takeoff distance for aircraft.',
            'Estimating free-fall motion near Earth by replacing a with g ≈ 9.8 m/s².',
          ],
          commonMistakes: [
            CommonMistakeItem(
              mistake: 'Forgetting to square t in ½ a t².',
              correction: 'Square time first before multiplying by ½ a.',
            ),
          ],
          quickRevisionSummary: [
            '1st: vf = vi + at',
            '2nd: S = vi·t + ½at²',
            '3rd: 2aS = vf² - vi²',
          ],
          relatedQuestionIds: ['q_phy_9_2_4', 'q_phy_9_2_5', 'q_phy_9_2_6'],
          sourceBook: 'KPECTB Physics Grade 9 (English Medium — verify exact page for current edition)',
          sourcePage: 'Ch. 2, Equations of Motion',
        ),
      ],
      questions: [
        QuestionItem(
          id: 'q_phy_9_2_1',
          programmeId: ProgrammeId.sscHssc,
          grade: 9,
          subjectId: 'phy_9',
          chapterId: 'phy_9_ch2',
          topicId: 'phy_9_ch2_t1',
          conceptId: 'c_phy_9_2_1',
          type: QuestionType.mcq,
          difficulty: 1,
          statement: 'Which of the following is a vector quantity?',
          options: ['Speed', 'Distance', 'Velocity', 'Time'],
          optionMisconceptions: {
            'Speed': 'Speed has magnitude only, so it is a scalar.',
            'Distance': 'Distance is total path length without direction (scalar).',
            'Time': 'Time has no spatial direction.',
          },
          hints: ['A vector quantity requires both magnitude and direction.'],
          correctAnswer: 'Velocity',
          explanation:
              'Velocity is displacement per unit time, so it has both magnitude and direction.',
          marks: 1,
        ),
        QuestionItem(
          id: 'q_phy_9_2_2',
          programmeId: ProgrammeId.sscHssc,
          grade: 9,
          subjectId: 'phy_9',
          chapterId: 'phy_9_ch2',
          topicId: 'phy_9_ch2_t1',
          conceptId: 'c_phy_9_2_1',
          type: QuestionType.fillIn,
          difficulty: 2,
          statement:
              'The slope of a distance-time graph represents the ________ of the moving object.',
          hints: ['Slope = vertical change (distance) divided by horizontal change (time).'],
          correctAnswer: 'speed',
          explanation: 'Slope = Δs / Δt, which is the definition of speed.',
          marks: 1,
        ),
        QuestionItem(
          id: 'q_phy_9_2_3',
          programmeId: ProgrammeId.sscHssc,
          grade: 9,
          subjectId: 'phy_9',
          chapterId: 'phy_9_ch2',
          topicId: 'phy_9_ch2_t1',
          conceptId: 'c_phy_9_2_1',
          type: QuestionType.conceptual,
          difficulty: 3,
          statement:
              'A cyclist completes one full round of a 400 m circular track in 40 s. What is the cyclist\'s average velocity?',
          options: ['10 m/s', '0 m/s', '40 m/s', '16 m/s'],
          optionMisconceptions: {
            '10 m/s': '10 m/s is the average SPEED (400 m / 40 s), not average velocity.',
            '40 m/s': '40 s is the time taken, not velocity.',
            '16 m/s': 'Check displacement over total time.',
          },
          hints: [
            'Average velocity = Total displacement / Total time.',
            'When you return to the starting point, what is your net displacement?',
          ],
          correctAnswer: '0 m/s',
          explanation:
              'Returning to the starting point makes net displacement 0 m, so average velocity = 0 / 40 = 0 m/s.',
          marks: 1,
        ),
        QuestionItem(
          id: 'q_phy_9_2_4',
          programmeId: ProgrammeId.sscHssc,
          grade: 9,
          subjectId: 'phy_9',
          chapterId: 'phy_9_ch2',
          topicId: 'phy_9_ch2_t2',
          conceptId: 'c_phy_9_2_2',
          type: QuestionType.numerical,
          difficulty: 4,
          statement:
              'A motorcyclist starts from rest and accelerates uniformly at 3 m/s² for 6 s. Find the distance covered.',
          hints: [
            'Starting from rest means vi = 0 m/s.',
            'Choose the equation connecting S, vi, a, and t.',
          ],
          numericalSteps: NumericalSteps(
            given: ['vi = 0 m/s', 'a = 3 m/s²', 't = 6 s'],
            required: 'Distance covered (S)',
            formula: 'S = vi·t + ½ a t²',
            substitution: 'S = (0)(6) + ½ (3)(6)²',
            calculation: 'S = 0 + 0.5 × 3 × 36 = 54',
            answerWithUnit: '54 m',
          ),
          correctAnswer: '54 m',
          explanation: 'Using S = vi·t + ½at² gives S = 0 + 0.5 × 3 × 36 = 54 m.',
          marks: 4,
        ),
        QuestionItem(
          id: 'q_phy_9_2_5',
          programmeId: ProgrammeId.sscHssc,
          grade: 9,
          subjectId: 'phy_9',
          chapterId: 'phy_9_ch2',
          topicId: 'phy_9_ch2_t2',
          conceptId: 'c_phy_9_2_2',
          type: QuestionType.shortAnswer,
          difficulty: 6,
          statement:
              'State why a body moving with uniform speed in a circular path still has acceleration.',
          markingPoints: [
            'Acceleration is the rate of change of velocity (a vector quantity). (1 mark)',
            'In circular motion, the direction of motion changes continuously at every point. (1 mark)',
            'Because velocity direction changes, velocity changes and therefore acceleration (centripetal) is present. (1 mark)',
          ],
          correctAnswer:
              'Even when speed is constant in circular motion, the direction of velocity changes continuously. Since velocity is a vector, any change in direction produces acceleration.',
          explanation:
              'Board short questions reward clear mention of vector nature of velocity and continuous change of direction.',
          marks: 3,
        ),
        QuestionItem(
          id: 'q_phy_9_2_6',
          programmeId: ProgrammeId.sscHssc,
          grade: 9,
          subjectId: 'phy_9',
          chapterId: 'phy_9_ch2',
          topicId: 'phy_9_ch2_t2',
          conceptId: 'c_phy_9_2_2',
          type: QuestionType.longAnswer,
          difficulty: 6,
          statement:
              'Derive the second equation of motion S = vi·t + ½ a t² using a speed-time graph.',
          markingPoints: [
            'Draw and label speed-time graph from vi to vf over time t. (2 marks)',
            'State that total distance S equals total area under the speed-time line. (1 mark)',
            'Split area into rectangle (vi × t) and triangle (½ × t × (vf - vi)). (2 marks)',
            'Substitute (vf - vi) = at from first equation to obtain S = vi·t + ½at². (2 marks)',
          ],
          correctAnswer:
              'Area under speed-time graph = Area of rectangle (vi·t) + Area of triangle (½·t·(vf - vi)). Substituting vf - vi = at yields S = vi·t + ½at².',
          explanation:
              'Long derivation questions require a clear diagram, area decomposition, and substitution of vf - vi = at.',
          marks: 7,
        ),
      ],
    ),

    // ================= GRADE 10 CHEMISTRY — CHEMICAL EQUILIBRIUM ============
    ChapterPack(
      chapterId: 'chem_10_ch9',
      programmeId: ProgrammeId.sscHssc,
      grade: 10,
      subjectId: 'chem_10',
      chapterNumber: 9,
      title: 'Chemical Equilibrium',
      packVersion: 1,
      estimatedSizeKb: 165,
      isBundledStarter: true,
      learningOutcomes: [
        'Differentiate irreversible and reversible chemical reactions.',
        'Define dynamic equilibrium in terms of forward and reverse rates.',
        'Write equilibrium constant (Kc) expressions and determine units.',
      ],
      topics: [
        TopicItem(
          id: 'chem_10_ch9_t1',
          chapterId: 'chem_10_ch9',
          orderIndex: 1,
          title: 'Reversible Reactions & Kc',
        ),
      ],
      concepts: [
        ConceptItem(
          id: 'c_chem_10_9_1',
          chapterId: 'chem_10_ch9',
          topicId: 'chem_10_ch9_t1',
          orderIndex: 1,
          title: 'Dynamic Equilibrium and Equilibrium Constant (Kc)',
          simpleExplanation:
              'In a reversible reaction inside a closed container, products recombine to form reactants. Dynamic equilibrium is reached when the forward reaction rate equals the reverse reaction rate, so concentrations remain constant.',
          definitions: [
            ConceptDefinitionItem(
              term: 'Dynamic Equilibrium',
              definition:
                  'State in a reversible reaction where forward and reverse rates are equal and macroscopic properties stay constant.',
            ),
          ],
          importantPoints: [
            'Equilibrium occurs only in a closed system.',
            'Reactions do NOT stop at equilibrium; both proceed at equal rates.',
          ],
          formulas: [
            FormulaItem(
              expression: 'Kc = [C]^c [D]^d / ([A]^a [B]^b)',
              description: 'For reaction aA + bB ⇌ cC + dD',
              unit: 'Depends on Δn (mol dm⁻³)^Δn',
            ),
          ],
          workedExamples: [
            WorkedExampleItem(
              prompt: 'Write Kc and its unit for N₂(g) + 3H₂(g) ⇌ 2NH₃(g).',
              steps: [
                'Kc = [NH₃]² / ([N₂][H₂]³)',
                'Moles on product side = 2; reactant side = 1 + 3 = 4',
                'Net unit = (mol dm⁻³)² / (mol dm⁻³)⁴ = mol⁻² dm⁶',
              ],
              finalAnswer: 'Kc = [NH₃]² / ([N₂][H₂]³), unit: mol⁻² dm⁶',
            ),
          ],
          commonMistakes: [
            CommonMistakeItem(
              mistake: 'Assuming reactant and product concentrations are equal at equilibrium.',
              correction:
                  'Rates are equal, while concentrations remain constant (not necessarily equal).',
            ),
          ],
          quickRevisionSummary: [
            'Forward rate = Reverse rate at dynamic equilibrium.',
            'Kc has no unit when total reactant moles equal total product moles.',
          ],
          relatedQuestionIds: ['q_chem_10_9_1', 'q_chem_10_9_2'],
          sourceBook: 'KPECTB Chemistry Grade 10 (English Medium — verify exact page for current edition)',
          sourcePage: 'Ch. 9, Chemical Equilibrium',
        ),
      ],
      questions: [
        QuestionItem(
          id: 'q_chem_10_9_1',
          programmeId: ProgrammeId.sscHssc,
          grade: 10,
          subjectId: 'chem_10',
          chapterId: 'chem_10_ch9',
          topicId: 'chem_10_ch9_t1',
          conceptId: 'c_chem_10_9_1',
          type: QuestionType.mcq,
          difficulty: 2,
          statement: 'At dynamic equilibrium, which statement is always true?',
          options: [
            'Rate of forward reaction equals rate of reverse reaction',
            'Concentrations of reactants and products are equal',
            'Both forward and reverse reactions stop completely',
            'Kc is always equal to 1',
          ],
          optionMisconceptions: {
            'Concentrations of reactants and products are equal':
                'Concentrations are constant, not necessarily equal.',
            'Both forward and reverse reactions stop completely':
                'Static systems stop; dynamic equilibrium keeps both reactions running at equal rates.',
          },
          hints: ['Think about what "dynamic" means in rates vs amounts.'],
          correctAnswer: 'Rate of forward reaction equals rate of reverse reaction',
          explanation:
              'Dynamic equilibrium is defined by equal forward and reverse reaction rates.',
          marks: 1,
        ),
        QuestionItem(
          id: 'q_chem_10_9_2',
          programmeId: ProgrammeId.sscHssc,
          grade: 10,
          subjectId: 'chem_10',
          chapterId: 'chem_10_ch9',
          topicId: 'chem_10_ch9_t1',
          conceptId: 'c_chem_10_9_1',
          type: QuestionType.mcq,
          difficulty: 3,
          statement:
              'For H₂(g) + I₂(g) ⇌ 2HI(g), what are the units of Kc?',
          options: ['mol dm⁻³', 'mol⁻¹ dm³', 'No units', 'mol² dm⁻⁶'],
          hints: ['Compare total moles on left (1 + 1) vs right (2).'],
          correctAnswer: 'No units',
          explanation:
              'Numerator has (mol dm⁻³)² and denominator has (mol dm⁻³)²; units cancel out.',
          marks: 1,
        ),
      ],
    ),

    // ================= GRADE 11 MATHEMATICS — VECTORS =======================
    ChapterPack(
      chapterId: 'math_11_ch2',
      programmeId: ProgrammeId.sscHssc,
      grade: 11,
      subjectId: 'math_11',
      chapterNumber: 2,
      title: 'Vectors',
      packVersion: 1,
      estimatedSizeKb: 140,
      isBundledStarter: true,
      learningOutcomes: [
        'Compute magnitude and unit vector in 3D Cartesian form.',
        'Calculate dot product and angle between two vectors.',
      ],
      topics: [
        TopicItem(
          id: 'math_11_ch2_t1',
          chapterId: 'math_11_ch2',
          orderIndex: 1,
          title: 'Unit Vectors & Dot Product',
        ),
      ],
      concepts: [
        ConceptItem(
          id: 'c_math_11_2_1',
          chapterId: 'math_11_ch2',
          topicId: 'math_11_ch2_t1',
          orderIndex: 1,
          title: 'Magnitude and Unit Vector',
          simpleExplanation:
              'A unit vector has magnitude 1 and points purely in the direction of a given non-zero vector.',
          formulas: [
            FormulaItem(
              expression: '|v| = √(x² + y² + z²)',
              description: 'Magnitude of v = xi + yj + zk',
            ),
            FormulaItem(
              expression: 'v̂ = v / |v|',
              description: 'Unit vector in direction of v',
            ),
          ],
          quickRevisionSummary: [
            'Two non-zero vectors are perpendicular if and only if u · v = 0.',
          ],
          relatedQuestionIds: ['q_math_11_2_1'],
          sourceBook: 'KPECTB Mathematics Grade 11 (English Medium — verify exact page)',
          sourcePage: 'Ch. 2, Vectors',
        ),
      ],
      questions: [
        QuestionItem(
          id: 'q_math_11_2_1',
          programmeId: ProgrammeId.sscHssc,
          grade: 11,
          subjectId: 'math_11',
          chapterId: 'math_11_ch2',
          topicId: 'math_11_ch2_t1',
          conceptId: 'c_math_11_2_1',
          type: QuestionType.numerical,
          difficulty: 4,
          statement: 'Find the magnitude of vector v = 3i - 4j + 12k.',
          hints: ['Use |v| = √(x² + y² + z²).'],
          numericalSteps: NumericalSteps(
            given: ['x = 3', 'y = -4', 'z = 12'],
            required: 'Magnitude |v|',
            formula: '|v| = √(x² + y² + z²)',
            substitution: '|v| = √(3² + (-4)² + 12²)',
            calculation: '|v| = √(9 + 16 + 144) = √169 = 13',
            answerWithUnit: '13 units',
          ),
          correctAnswer: '13 units',
          explanation: '√(9 + 16 + 144) = √169 = 13.',
          marks: 3,
        ),
      ],
    ),

    // ================= GRADE 12 PHYSICS — ELECTROSTATICS ====================
    ChapterPack(
      chapterId: 'phy_12_ch12',
      programmeId: ProgrammeId.sscHssc,
      grade: 12,
      subjectId: 'phy_12',
      chapterNumber: 12,
      title: 'Electrostatics',
      packVersion: 1,
      estimatedSizeKb: 150,
      isBundledStarter: true,
      learningOutcomes: [
        'State Coulomb\'s Law and identify dependence on medium permittivity.',
        'Calculate electric field intensity due to a point charge.',
      ],
      topics: [
        TopicItem(
          id: 'phy_12_ch12_t1',
          chapterId: 'phy_12_ch12',
          orderIndex: 1,
          title: 'Coulomb\'s Law & Electric Field',
        ),
      ],
      concepts: [
        ConceptItem(
          id: 'c_phy_12_12_1',
          chapterId: 'phy_12_ch12',
          topicId: 'phy_12_ch12_t1',
          orderIndex: 1,
          title: 'Coulomb\'s Law',
          simpleExplanation:
              'The electrostatic force between two point charges is directly proportional to the product of their magnitudes and inversely proportional to the square of the distance between them.',
          formulas: [
            FormulaItem(
              expression: 'F = k (q₁ q₂) / r²',
              description: 'k = 1 / (4πε₀) ≈ 9 × 10⁹ N·m²/C² in vacuum',
              unit: 'N',
            ),
          ],
          quickRevisionSummary: [
            'Doubling separation r reduces force F to one-fourth (F/4).',
          ],
          relatedQuestionIds: ['q_phy_12_12_1'],
          sourceBook: 'KPECTB Physics Grade 12 (English Medium — verify exact page)',
          sourcePage: 'Ch. 12, Electrostatics',
        ),
      ],
      questions: [
        QuestionItem(
          id: 'q_phy_12_12_1',
          programmeId: ProgrammeId.sscHssc,
          grade: 12,
          subjectId: 'phy_12',
          chapterId: 'phy_12_ch12',
          topicId: 'phy_12_ch12_t1',
          conceptId: 'c_phy_12_12_1',
          type: QuestionType.mcq,
          difficulty: 3,
          statement:
              'If the distance between two point charges is doubled, the electrostatic force between them becomes:',
          options: ['Half', 'One-fourth', 'Double', 'Four times'],
          hints: ['Force is inversely proportional to r².'],
          correctAnswer: 'One-fourth',
          explanation: 'Since F ∝ 1/r², replacing r with 2r gives F\' = F / 2² = F / 4.',
          marks: 1,
        ),
      ],
    ),

    // ================= ISOLATED ADMISSION PACKS (Phase 10) ==================
    ChapterPack(
      chapterId: 'mdcat_bio_cell',
      programmeId: ProgrammeId.mdcat,
      grade: 12,
      subjectId: 'mdcat_bio',
      chapterNumber: 1,
      title: 'Cell Structure & Organelles (MDCAT Track)',
      packVersion: 1,
      estimatedSizeKb: 95,
      isBundledStarter: true,
      learningOutcomes: ['Compare prokaryotic and eukaryotic organelle structure for timed MCQs.'],
      topics: [
        TopicItem(
          id: 'mdcat_bio_cell_t1',
          chapterId: 'mdcat_bio_cell',
          orderIndex: 1,
          title: 'Organelles & Ribosomes',
        ),
      ],
      concepts: [
        ConceptItem(
          id: 'c_mdcat_bio_1',
          chapterId: 'mdcat_bio_cell',
          topicId: 'mdcat_bio_cell_t1',
          orderIndex: 1,
          title: 'Prokaryotic vs Eukaryotic Ribosomes',
          simpleExplanation:
              'Prokaryotic cells contain 70S ribosomes (50S + 30S), whereas eukaryotic cytoplasmic ribosomes are 80S (60S + 40S). Mitochondria and chloroplasts also contain 70S ribosomes.',
          quickRevisionSummary: ['Prokaryotic = 70S', 'Eukaryotic cytoplasm = 80S'],
          relatedQuestionIds: ['q_mdcat_bio_1'],
          sourceBook: 'PMDC MDCAT Biology Syllabus Reference (isolated entrance track)',
          sourcePage: 'Cell Biology',
        ),
      ],
      questions: [
        QuestionItem(
          id: 'q_mdcat_bio_1',
          programmeId: ProgrammeId.mdcat,
          grade: 12,
          subjectId: 'mdcat_bio',
          chapterId: 'mdcat_bio_cell',
          topicId: 'mdcat_bio_cell_t1',
          conceptId: 'c_mdcat_bio_1',
          type: QuestionType.mcq,
          difficulty: 5,
          statement: 'Which ribosome type is found inside eukaryotic mitochondria?',
          options: ['70S', '80S', '90S', '55S only in plants'],
          hints: ['Recall the endosymbiotic origin of mitochondria.'],
          correctAnswer: '70S',
          explanation:
              'Mitochondria and chloroplasts possess 70S ribosomes similar to prokaryotes.',
          marks: 1,
        ),
      ],
    ),
    ChapterPack(
      chapterId: 'etea_phy_motion',
      programmeId: ProgrammeId.eteaEng,
      grade: 12,
      subjectId: 'etea_phy',
      chapterNumber: 1,
      title: 'Projectile & Motion Shortcuts (ETEA Track)',
      packVersion: 1,
      estimatedSizeKb: 90,
      isBundledStarter: true,
      learningOutcomes: ['Solve timed ETEA-style kinematics & projectile ratio MCQs.'],
      topics: [
        TopicItem(
          id: 'etea_phy_motion_t1',
          chapterId: 'etea_phy_motion',
          orderIndex: 1,
          title: 'Projectile Range & Angle',
        ),
      ],
      concepts: [
        ConceptItem(
          id: 'c_etea_phy_1',
          chapterId: 'etea_phy_motion',
          topicId: 'etea_phy_motion_t1',
          orderIndex: 1,
          title: 'Horizontal Range of a Projectile',
          simpleExplanation:
              'Two projectiles launched at complementary angles (θ and 90° - θ) with the same initial speed achieve equal horizontal range.',
          formulas: [
            FormulaItem(
              expression: 'R = vᵢ² sin(2θ) / g',
              description: 'Maximum range occurs at θ = 45°',
              unit: 'm',
            ),
          ],
          quickRevisionSummary: ['30° and 60° give equal horizontal range at same speed.'],
          relatedQuestionIds: ['q_etea_phy_1'],
          sourceBook: 'ETEA Engineering Entrance Physics Syllabus Reference',
          sourcePage: 'Mechanics',
        ),
      ],
      questions: [
        QuestionItem(
          id: 'q_etea_phy_1',
          programmeId: ProgrammeId.eteaEng,
          grade: 12,
          subjectId: 'etea_phy',
          chapterId: 'etea_phy_motion',
          topicId: 'etea_phy_motion_t1',
          conceptId: 'c_etea_phy_1',
          type: QuestionType.mcq,
          difficulty: 6,
          statement:
              'At what pair of launch angles (with equal initial speed) is horizontal range identical?',
          options: ['30° and 60°', '30° and 45°', '15° and 60°', '45° and 90°'],
          hints: ['Angles must sum to 90°.'],
          correctAnswer: '30° and 60°',
          explanation: 'sin(2×30°) = sin(60°) and sin(2×60°) = sin(120°) = sin(60°).',
          marks: 1,
        ),
      ],
    ),
  ];

  static const List<MockExamDefinition> starterMocks = [
    MockExamDefinition(
      id: 'mock_phy_9_ch2',
      programmeId: ProgrammeId.sscHssc,
      grade: 9,
      subjectId: 'phy_9',
      title: 'Grade 9 Physics — Ch. 2 Chapter Test (Practice)',
      durationMinutes: 25,
      totalMarks: 17,
      sourceType: QuestionSourceType.practiceOriginal,
      paperStructureNote:
          'Practice chapter test modeled on KPK BISE Section A (MCQs), Section B (Short), and Numerical/Long format. Not a guaranteed exam paper.',
      questionIds: [
        'q_phy_9_2_1',
        'q_phy_9_2_2',
        'q_phy_9_2_3',
        'q_phy_9_2_4',
        'q_phy_9_2_5',
        'q_phy_9_2_6',
      ],
    ),
    MockExamDefinition(
      id: 'mock_mdcat_sample',
      programmeId: ProgrammeId.mdcat,
      grade: 12,
      subjectId: 'mdcat_bio',
      title: 'MDCAT Sample Timed Drill (Isolated)',
      durationMinutes: 10,
      totalMarks: 1,
      sourceType: QuestionSourceType.practiceOriginal,
      paperStructureNote:
          'Isolated MDCAT entrance practice bank. Kept strictly separate from HSSC Board progress.',
      questionIds: ['q_mdcat_bio_1'],
    ),
    MockExamDefinition(
      id: 'mock_etea_sample',
      programmeId: ProgrammeId.eteaEng,
      grade: 12,
      subjectId: 'etea_phy',
      title: 'ETEA Engineering Timed Drill (Isolated)',
      durationMinutes: 10,
      totalMarks: 1,
      sourceType: QuestionSourceType.practiceOriginal,
      paperStructureNote:
          'Isolated ETEA entrance practice bank with optional negative-marking awareness.',
      questionIds: ['q_etea_phy_1'],
      negativeMarkingPenalty: 0.25,
    ),
  ];
}
