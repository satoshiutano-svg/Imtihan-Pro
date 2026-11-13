import 'dart:ui';

enum ProgrammeId {
  sscHssc('ssc_hssc', 'KPK Board (SSC / HSSC)'),
  mdcat('mdcat', 'MDCAT Admission'),
  eteaEng('etea_eng', 'ETEA Engineering'),
  uniEntrance('uni_entrance', 'University Admission');

  const ProgrammeId(this.id, this.label);
  final String id;
  final String label;

  static ProgrammeId fromId(String id) {
    return values.firstWhere((p) => p.id == id, orElse: () => sscHssc);
  }
}

enum QuestionType {
  mcq('mcq', 'Multiple Choice'),
  conceptual('conceptual', 'Conceptual'),
  recall('recall', 'Concept Recall'),
  fillIn('fill_in', 'Fill in the Blank'),
  numerical('numerical', 'Numerical Problem'),
  shortAnswer('short_answer', 'Short Answer'),
  longAnswer('long_answer', 'Long / Derivation'),
  diagramBased('diagram_based', 'Diagram-Based'),
  application('application', 'Application');

  const QuestionType(this.id, this.label);
  final String id;
  final String label;

  static QuestionType fromId(String id) {
    return values.firstWhere((t) => t.id == id, orElse: () => mcq);
  }
}

enum QuestionSourceType {
  officialPastPaper('official_past_paper', 'Official Past Paper'),
  officialModelPaper('official_model_paper', 'Official Model Paper'),
  practiceOriginal('practice_original', 'Practice Question');

  const QuestionSourceType(this.id, this.label);
  final String id;
  final String label;

  static QuestionSourceType fromId(String id) {
    return values.firstWhere((s) => s.id == id, orElse: () => practiceOriginal);
  }
}

class SubjectDefinition {
  const SubjectDefinition({
    required this.id,
    required this.code,
    required this.name,
    required this.grade,
    required this.groupIds,
    required this.isCompulsory,
    this.programmeId = ProgrammeId.sscHssc,
    this.electiveSlot,
    this.textDirection = TextDirection.ltr,
    this.note,
  });

  final String id;
  final String code;
  final String name;
  final int grade;
  final List<String> groupIds;
  final bool isCompulsory;
  final ProgrammeId programmeId;
  final String? electiveSlot;
  final TextDirection textDirection;
  final String? note;
}

class ConceptDefinitionItem {
  const ConceptDefinitionItem({required this.term, required this.definition});
  final String term;
  final String definition;
}

class FormulaItem {
  const FormulaItem({
    required this.expression,
    required this.description,
    this.unit,
  });
  final String expression;
  final String description;
  final String? unit;
}

class DiagramItem {
  const DiagramItem({
    required this.id,
    required this.caption,
    this.svgMarkup,
  });
  final String id;
  final String caption;
  final String? svgMarkup;
}

class WorkedExampleItem {
  const WorkedExampleItem({
    required this.prompt,
    required this.steps,
    required this.finalAnswer,
  });
  final String prompt;
  final List<String> steps;
  final String finalAnswer;
}

class CommonMistakeItem {
  const CommonMistakeItem({
    required this.mistake,
    required this.correction,
  });
  final String mistake;
  final String correction;
}

/// Curated external YouTube explanation link (zero video hosting cost).
class VideoLinkItem {
  const VideoLinkItem({
    required this.title,
    required this.channelName,
    required this.youtubeUrl,
    required this.durationLabel,
    this.language = 'ur',
  });

  final String title;
  final String channelName;
  final String youtubeUrl;
  final String durationLabel;
  final String language;
}

/// 1-tap Urdu meaning hint inside English-medium concepts.
class GlossaryHintItem {
  const GlossaryHintItem({
    required this.term,
    required this.urduMeaning,
    required this.simpleHint,
  });

  final String term;
  final String urduMeaning;
  final String simpleHint;
}

/// Duolingo-style 5-minute bite-sized interactive learning step.
class MicroLessonCard {
  const MicroLessonCard({
    required this.stageTitle,
    required this.body,
    this.quickCheckQuestion,
    this.quickCheckOptions = const [],
    this.quickCheckAnswer,
  });

  final String stageTitle;
  final String body;
  final String? quickCheckQuestion;
  final List<String> quickCheckOptions;
  final String? quickCheckAnswer;
}

class ConceptItem {
  const ConceptItem({
    required this.id,
    required this.chapterId,
    required this.topicId,
    required this.orderIndex,
    required this.title,
    required this.simpleExplanation,
    this.definitions = const [],
    this.importantPoints = const [],
    this.formulas = const [],
    this.diagrams = const [],
    this.workedExamples = const [],
    this.applications = const [],
    this.commonMistakes = const [],
    this.quickRevisionSummary = const [],
    this.relatedQuestionIds = const [],
    this.videoLinks = const [],
    this.glossaryHints = const [],
    this.microCards = const [],
    required this.sourceBook,
    required this.sourcePage,
    this.textDirection = TextDirection.ltr,
  });

  final String id;
  final String chapterId;
  final String topicId;
  final int orderIndex;
  final String title;
  final String simpleExplanation;
  final List<ConceptDefinitionItem> definitions;
  final List<String> importantPoints;
  final List<FormulaItem> formulas;
  final List<DiagramItem> diagrams;
  final List<WorkedExampleItem> workedExamples;
  final List<String> applications;
  final List<CommonMistakeItem> commonMistakes;
  final List<String> quickRevisionSummary;
  final List<String> relatedQuestionIds;
  final List<VideoLinkItem> videoLinks;
  final List<GlossaryHintItem> glossaryHints;
  final List<MicroLessonCard> microCards;
  final String sourceBook;
  final String sourcePage;
  final TextDirection textDirection;
}

class NumericalSteps {
  const NumericalSteps({
    required this.given,
    required this.required,
    required this.formula,
    required this.substitution,
    required this.calculation,
    required this.answerWithUnit,
  });

  final List<String> given;
  final String required;
  final String formula;
  final String substitution;
  final String calculation;
  final String answerWithUnit;
}

class QuestionItem {
  const QuestionItem({
    required this.id,
    required this.programmeId,
    required this.grade,
    required this.subjectId,
    required this.chapterId,
    required this.topicId,
    required this.conceptId,
    required this.type,
    required this.difficulty,
    required this.statement,
    this.options = const [],
    this.optionMisconceptions = const {},
    this.hints = const [],
    this.numericalSteps,
    this.markingPoints = const [],
    required this.correctAnswer,
    required this.explanation,
    this.marks = 1,
    this.sourceType = QuestionSourceType.practiceOriginal,
    this.sourceBoardName,
    this.sourceYear,
    this.sourcePaperRef,
    this.diagramSvg,
    this.textDirection = TextDirection.ltr,
  });

  final String id;
  final ProgrammeId programmeId;
  final int grade;
  final String subjectId;
  final String chapterId;
  final String topicId;
  final String conceptId;
  final QuestionType type;
  final int difficulty;
  final String statement;
  final List<String> options;
  final Map<String, String> optionMisconceptions;
  final List<String> hints;
  final NumericalSteps? numericalSteps;
  final List<String> markingPoints;
  final String correctAnswer;
  final String explanation;
  final int marks;
  final QuestionSourceType sourceType;
  final String? sourceBoardName;
  final int? sourceYear;
  final String? sourcePaperRef;
  final String? diagramSvg;
  final TextDirection textDirection;

  bool get isSelfCheckedWritten =>
      type == QuestionType.shortAnswer || type == QuestionType.longAnswer;

  String get difficultyLabel {
    return switch (difficulty) {
      1 => 'L1: Basic Understanding',
      2 => 'L2: Concept Recall',
      3 => 'L3: Application',
      4 => 'L4: Guided Problem-Solving',
      5 => 'L5: Independent Solving',
      6 => 'L6: Board-Style',
      7 => 'L7: Advanced Application',
      _ => 'Level $difficulty',
    };
  }
}

class TopicItem {
  const TopicItem({
    required this.id,
    required this.chapterId,
    required this.orderIndex,
    required this.title,
  });

  final String id;
  final String chapterId;
  final int orderIndex;
  final String title;
}

class ChapterPack {
  const ChapterPack({
    required this.chapterId,
    required this.programmeId,
    required this.grade,
    required this.subjectId,
    required this.chapterNumber,
    required this.title,
    required this.packVersion,
    required this.estimatedSizeKb,
    required this.learningOutcomes,
    required this.topics,
    required this.concepts,
    required this.questions,
    this.isBundledStarter = false,
  });

  final String chapterId;
  final ProgrammeId programmeId;
  final int grade;
  final String subjectId;
  final int chapterNumber;
  final String title;
  final int packVersion;
  final int estimatedSizeKb;
  final List<String> learningOutcomes;
  final List<TopicItem> topics;
  final List<ConceptItem> concepts;
  final List<QuestionItem> questions;
  final bool isBundledStarter;
}

class MockExamDefinition {
  const MockExamDefinition({
    required this.id,
    required this.programmeId,
    required this.grade,
    required this.subjectId,
    required this.title,
    required this.durationMinutes,
    required this.totalMarks,
    required this.sourceType,
    required this.paperStructureNote,
    required this.questionIds,
    this.negativeMarkingPenalty = 0.0,
  });

  final String id;
  final ProgrammeId programmeId;
  final int grade;
  final String subjectId;
  final String title;
  final int durationMinutes;
  final int totalMarks;
  final QuestionSourceType sourceType;
  final String paperStructureNote;
  final List<String> questionIds;
  final double negativeMarkingPenalty;
}
