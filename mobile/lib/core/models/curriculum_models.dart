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
  multiSelect('multi_select', 'Multi-Select'),
  trueFalse('true_false', 'True / False'),
  matching('matching', 'Matching'),
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

enum VisualColorToken {
  primary('primary'),
  secondary('secondary'),
  warning('warning'),
  danger('danger');

  const VisualColorToken(this.id);
  final String id;

  static VisualColorToken fromId(String? id) {
    return values.firstWhere((v) => v.id == id, orElse: () => primary);
  }
}

class MotionActor {
  const MotionActor({
    required this.id,
    required this.label,
    required this.shape,
    required this.colorToken,
    required this.startX,
    required this.startY,
    required this.endX,
    required this.endY,
    this.size = 14,
  });

  factory MotionActor.fromJson(Map<String, dynamic> json) {
    return MotionActor(
      id: (json['id'] ?? '').toString(),
      label: (json['label'] ?? '').toString(),
      shape: (json['shape'] ?? 'box').toString(),
      colorToken: VisualColorToken.fromId(json['colorToken']?.toString()),
      startX: (json['startX'] as num?)?.toDouble() ?? 15.0,
      startY: (json['startY'] as num?)?.toDouble() ?? 50.0,
      endX: (json['endX'] as num?)?.toDouble() ?? 85.0,
      endY: (json['endY'] as num?)?.toDouble() ?? 50.0,
      size: (json['size'] as num?)?.toDouble() ?? 14.0,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'shape': shape,
        'colorToken': colorToken.id,
        'startX': startX,
        'startY': startY,
        'endX': endX,
        'endY': endY,
        'size': size,
      };

  final String id;
  final String label;
  final String shape;
  final VisualColorToken colorToken;
  final double startX;
  final double startY;
  final double endX;
  final double endY;
  final double size;
}

class MotionStage {
  const MotionStage({
    required this.atPercent,
    required this.label,
    this.formulaLatex,
    required this.callout,
  });

  factory MotionStage.fromJson(Map<String, dynamic> json) {
    return MotionStage(
      atPercent: (json['atPercent'] as num?)?.toDouble() ?? 0.0,
      label: (json['label'] ?? '').toString(),
      formulaLatex: json['formulaLatex']?.toString(),
      callout: (json['callout'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'atPercent': atPercent,
        'label': label,
        if (formulaLatex != null) 'formulaLatex': formulaLatex,
        'callout': callout,
      };

  final double atPercent;
  final String label;
  final String? formulaLatex;
  final String callout;
}

class MotionGraphicSpec {
  const MotionGraphicSpec({
    required this.id,
    required this.title,
    required this.caption,
    required this.durationSec,
    required this.sceneType,
    required this.actors,
    required this.stages,
  });

  factory MotionGraphicSpec.fromJson(Map<String, dynamic> json) {
    final rawActors = (json['actors'] as List?) ?? const [];
    final rawStages = (json['stages'] as List?) ?? const [];
    return MotionGraphicSpec(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      caption: (json['caption'] ?? '').toString(),
      durationSec: (json['durationSec'] as num?)?.toDouble() ?? 5.0,
      sceneType: (json['sceneType'] ?? 'kinematics_track').toString(),
      actors: rawActors
          .whereType<Map<String, dynamic>>()
          .map(MotionActor.fromJson)
          .toList(growable: false),
      stages: rawStages
          .whereType<Map<String, dynamic>>()
          .map(MotionStage.fromJson)
          .toList(growable: false),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'caption': caption,
        'durationSec': durationSec,
        'sceneType': sceneType,
        'actors': actors.map((a) => a.toJson()).toList(growable: false),
        'stages': stages.map((s) => s.toJson()).toList(growable: false),
      };

  final String id;
  final String title;
  final String caption;
  final double durationSec;
  final String sceneType;
  final List<MotionActor> actors;
  final List<MotionStage> stages;
}

class GraphPoint {
  const GraphPoint({required this.x, required this.y});

  factory GraphPoint.fromJson(Map<String, dynamic> json) {
    return GraphPoint(
      x: (json['x'] as num?)?.toDouble() ?? 0.0,
      y: (json['y'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() => {'x': x, 'y': y};

  final double x;
  final double y;
}

class GraphSeries {
  const GraphSeries({
    required this.name,
    required this.colorToken,
    required this.points,
    this.showArea = false,
  });

  factory GraphSeries.fromJson(Map<String, dynamic> json) {
    final rawPts = (json['points'] as List?) ?? const [];
    return GraphSeries(
      name: (json['name'] ?? '').toString(),
      colorToken: VisualColorToken.fromId(json['colorToken']?.toString()),
      showArea: json['showArea'] == true,
      points: rawPts
          .whereType<Map<String, dynamic>>()
          .map(GraphPoint.fromJson)
          .toList(growable: false),
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'colorToken': colorToken.id,
        'showArea': showArea,
        'points': points.map((p) => p.toJson()).toList(growable: false),
      };

  final String name;
  final VisualColorToken colorToken;
  final List<GraphPoint> points;
  final bool showArea;
}

class GraphHighlight {
  const GraphHighlight({
    required this.x,
    required this.y,
    required this.label,
  });

  factory GraphHighlight.fromJson(Map<String, dynamic> json) {
    return GraphHighlight(
      x: (json['x'] as num?)?.toDouble() ?? 0.0,
      y: (json['y'] as num?)?.toDouble() ?? 0.0,
      label: (json['label'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {'x': x, 'y': y, 'label': label};

  final double x;
  final double y;
  final String label;
}

class GraphSpec {
  const GraphSpec({
    required this.id,
    required this.title,
    required this.caption,
    required this.xLabel,
    required this.yLabel,
    required this.xMin,
    required this.xMax,
    required this.yMin,
    required this.yMax,
    required this.series,
    this.highlights = const [],
  });

  factory GraphSpec.fromJson(Map<String, dynamic> json) {
    final rawSeries = (json['series'] as List?) ?? const [];
    final rawHighlights = (json['highlights'] as List?) ?? const [];
    return GraphSpec(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      caption: (json['caption'] ?? '').toString(),
      xLabel: (json['xLabel'] ?? 'x').toString(),
      yLabel: (json['yLabel'] ?? 'y').toString(),
      xMin: (json['xMin'] as num?)?.toDouble() ?? 0.0,
      xMax: (json['xMax'] as num?)?.toDouble() ?? 10.0,
      yMin: (json['yMin'] as num?)?.toDouble() ?? 0.0,
      yMax: (json['yMax'] as num?)?.toDouble() ?? 10.0,
      series: rawSeries
          .whereType<Map<String, dynamic>>()
          .map(GraphSeries.fromJson)
          .toList(growable: false),
      highlights: rawHighlights
          .whereType<Map<String, dynamic>>()
          .map(GraphHighlight.fromJson)
          .toList(growable: false),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'caption': caption,
        'xLabel': xLabel,
        'yLabel': yLabel,
        'xMin': xMin,
        'xMax': xMax,
        'yMin': yMin,
        'yMax': yMax,
        'series': series.map((s) => s.toJson()).toList(growable: false),
        'highlights': highlights.map((h) => h.toJson()).toList(growable: false),
      };

  final String id;
  final String title;
  final String caption;
  final String xLabel;
  final String yLabel;
  final double xMin;
  final double xMax;
  final double yMin;
  final double yMax;
  final List<GraphSeries> series;
  final List<GraphHighlight> highlights;
}

class ChapterAdConfig {
  const ChapterAdConfig({
    this.placement = 'respectful_default',
    this.showCatalogBanner = true,
    this.showPostSessionInterstitial = true,
    this.suppressDuringReadingAndExam = true,
  });

  factory ChapterAdConfig.fromJson(Map<String, dynamic> json) {
    return ChapterAdConfig(
      placement: (json['placement'] ?? 'respectful_default').toString(),
      showCatalogBanner: json['showCatalogBanner'] != false,
      showPostSessionInterstitial: json['showPostSessionInterstitial'] != false,
      suppressDuringReadingAndExam:
          json['suppressDuringReadingAndExam'] != false,
    );
  }

  Map<String, dynamic> toJson() => {
        'placement': placement,
        'showCatalogBanner': showCatalogBanner,
        'showPostSessionInterstitial': showPostSessionInterstitial,
        'suppressDuringReadingAndExam': suppressDuringReadingAndExam,
      };

  final String placement;
  final bool showCatalogBanner;
  final bool showPostSessionInterstitial;
  final bool suppressDuringReadingAndExam;
}

class CatalogChapterSummary {
  const CatalogChapterSummary({
    required this.chapterId,
    required this.programmeId,
    required this.grade,
    required this.subjectId,
    required this.subjectName,
    required this.chapterNumber,
    required this.title,
    required this.packVersion,
    required this.conceptCount,
    required this.questionCount,
    required this.hasMotionGraphics,
    required this.hasGraphs,
    required this.checksumSha256,
  });

  factory CatalogChapterSummary.fromJson(Map<String, dynamic> json) {
    return CatalogChapterSummary(
      chapterId: (json['chapterId'] ?? '').toString(),
      programmeId: ProgrammeId.fromId((json['programmeId'] ?? '').toString()),
      grade: (json['grade'] as num?)?.toInt() ?? 9,
      subjectId: (json['subjectId'] ?? '').toString(),
      subjectName: (json['subjectName'] ?? '').toString(),
      chapterNumber: (json['chapterNumber'] as num?)?.toInt() ?? 1,
      title: (json['title'] ?? '').toString(),
      packVersion: (json['packVersion'] as num?)?.toInt() ?? 1,
      conceptCount: (json['conceptCount'] as num?)?.toInt() ?? 0,
      questionCount: (json['questionCount'] as num?)?.toInt() ?? 0,
      hasMotionGraphics: json['hasMotionGraphics'] == true,
      hasGraphs: json['hasGraphs'] == true,
      checksumSha256: (json['checksumSha256'] ?? '').toString(),
    );
  }

  final String chapterId;
  final ProgrammeId programmeId;
  final int grade;
  final String subjectId;
  final String subjectName;
  final int chapterNumber;
  final String title;
  final int packVersion;
  final int conceptCount;
  final int questionCount;
  final bool hasMotionGraphics;
  final bool hasGraphs;
  final String checksumSha256;
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

  factory ConceptDefinitionItem.fromJson(Map<String, dynamic> json) {
    return ConceptDefinitionItem(
      term: (json['term'] ?? '').toString(),
      definition: (json['definition'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {'term': term, 'definition': definition};

  final String term;
  final String definition;
}

class FormulaItem {
  const FormulaItem({
    required this.expression,
    required this.description,
    this.unit,
  });

  factory FormulaItem.fromJson(Map<String, dynamic> json) {
    return FormulaItem(
      expression: (json['expression'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      unit: json['unit']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'expression': expression,
        'description': description,
        if (unit != null) 'unit': unit,
      };

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

  factory VideoLinkItem.fromJson(Map<String, dynamic> json) {
    return VideoLinkItem(
      title: (json['title'] ?? '').toString(),
      channelName: (json['channelName'] ?? '').toString(),
      youtubeUrl: (json['youtubeUrl'] ?? '').toString(),
      durationLabel: (json['durationLabel'] ?? '').toString(),
      language: (json['language'] ?? 'ur').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'title': title,
        'channelName': channelName,
        'youtubeUrl': youtubeUrl,
        'durationLabel': durationLabel,
        'language': language,
      };

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

  factory GlossaryHintItem.fromJson(Map<String, dynamic> json) {
    return GlossaryHintItem(
      term: (json['term'] ?? '').toString(),
      urduMeaning: (json['urduMeaning'] ?? '').toString(),
      simpleHint: (json['simpleHint'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'term': term,
        'urduMeaning': urduMeaning,
        'simpleHint': simpleHint,
      };

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

  factory MicroLessonCard.fromJson(Map<String, dynamic> json) {
    return MicroLessonCard(
      stageTitle: (json['stageTitle'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
      quickCheckQuestion: json['quickCheckQuestion']?.toString(),
      quickCheckOptions: ((json['quickCheckOptions'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(growable: false),
      quickCheckAnswer: json['quickCheckAnswer']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'stageTitle': stageTitle,
        'body': body,
        if (quickCheckQuestion != null)
          'quickCheckQuestion': quickCheckQuestion,
        'quickCheckOptions': quickCheckOptions,
        if (quickCheckAnswer != null) 'quickCheckAnswer': quickCheckAnswer,
      };

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
    this.motionGraphics = const [],
    this.graphs = const [],
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

  factory ConceptItem.fromJson(Map<String, dynamic> json) {
    final workedPrompt = (json['workedExamplePrompt'] ?? '').toString();
    final workedSteps = ((json['workedExampleSteps'] as List?) ?? const [])
        .map((e) => e.toString())
        .toList(growable: false);
    final workedAnswer = (json['workedExampleAnswer'] ?? '').toString();
    final commonMistake = (json['commonMistake'] ?? '').toString();
    final commonCorrection = (json['commonMistakeCorrection'] ?? '').toString();
    final diagramSvg = (json['diagramSvg'] ?? '').toString();
    final diagramCaption = (json['diagramCaption'] ?? '').toString();

    return ConceptItem(
      id: (json['id'] ?? '').toString(),
      chapterId: (json['chapterId'] ?? '').toString(),
      topicId: (json['topicId'] ?? '').toString(),
      orderIndex: (json['orderIndex'] as num?)?.toInt() ?? 1,
      title: (json['title'] ?? '').toString(),
      simpleExplanation: (json['simpleExplanation'] ?? '').toString(),
      definitions: ((json['definitions'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ConceptDefinitionItem.fromJson)
          .toList(growable: false),
      importantPoints: ((json['importantPoints'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(growable: false),
      formulas: ((json['formulas'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(FormulaItem.fromJson)
          .toList(growable: false),
      diagrams: diagramSvg.isNotEmpty
          ? [
              DiagramItem(
                id: 'diag_${json['id'] ?? '1'}',
                caption: diagramCaption,
                svgMarkup: diagramSvg,
              ),
            ]
          : const [],
      motionGraphics: ((json['motionGraphics'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MotionGraphicSpec.fromJson)
          .toList(growable: false),
      graphs: ((json['graphs'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(GraphSpec.fromJson)
          .toList(growable: false),
      workedExamples: workedPrompt.isNotEmpty
          ? [
              WorkedExampleItem(
                prompt: workedPrompt,
                steps: workedSteps,
                finalAnswer: workedAnswer,
              ),
            ]
          : const [],
      applications: ((json['applications'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(growable: false),
      commonMistakes: commonMistake.isNotEmpty
          ? [
              CommonMistakeItem(
                mistake: commonMistake,
                correction: commonCorrection,
              ),
            ]
          : const [],
      quickRevisionSummary:
          ((json['quickRevisionSummary'] as List?) ?? const [])
              .map((e) => e.toString())
              .toList(growable: false),
      videoLinks: ((json['videoLinks'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(VideoLinkItem.fromJson)
          .toList(growable: false),
      glossaryHints: ((json['glossaryHints'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(GlossaryHintItem.fromJson)
          .toList(growable: false),
      microCards: ((json['microCards'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MicroLessonCard.fromJson)
          .toList(growable: false),
      sourceBook: (json['sourceBook'] ?? '').toString(),
      sourcePage: (json['sourcePage'] ?? '').toString(),
      textDirection:
          json['textDirection'] == 'rtl' ? TextDirection.rtl : TextDirection.ltr,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'chapterId': chapterId,
        'topicId': topicId,
        'orderIndex': orderIndex,
        'title': title,
        'locale': textDirection == TextDirection.rtl ? 'ur' : 'en',
        'textDirection': textDirection == TextDirection.rtl ? 'rtl' : 'ltr',
        'simpleExplanation': simpleExplanation,
        'definitions': definitions.map((d) => d.toJson()).toList(growable: false),
        'importantPoints': importantPoints,
        'formulas': formulas.map((f) => f.toJson()).toList(growable: false),
        'diagramCaption': diagrams.isNotEmpty ? diagrams.first.caption : '',
        'diagramSvg': diagrams.isNotEmpty ? (diagrams.first.svgMarkup ?? '') : '',
        'motionGraphics':
            motionGraphics.map((m) => m.toJson()).toList(growable: false),
        'graphs': graphs.map((g) => g.toJson()).toList(growable: false),
        'workedExamplePrompt':
            workedExamples.isNotEmpty ? workedExamples.first.prompt : '',
        'workedExampleSteps':
            workedExamples.isNotEmpty ? workedExamples.first.steps : const [],
        'workedExampleAnswer':
            workedExamples.isNotEmpty ? workedExamples.first.finalAnswer : '',
        'applications': applications,
        'commonMistake':
            commonMistakes.isNotEmpty ? commonMistakes.first.mistake : '',
        'commonMistakeCorrection':
            commonMistakes.isNotEmpty ? commonMistakes.first.correction : '',
        'quickRevisionSummary': quickRevisionSummary,
        'videoLinks': videoLinks.map((v) => v.toJson()).toList(growable: false),
        'glossaryHints':
            glossaryHints.map((g) => g.toJson()).toList(growable: false),
        'microCards': microCards.map((m) => m.toJson()).toList(growable: false),
        'sourceBook': sourceBook,
        'sourcePage': sourcePage,
      };

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
  final List<MotionGraphicSpec> motionGraphics;
  final List<GraphSpec> graphs;
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

  factory NumericalSteps.fromJson(Map<String, dynamic> json) {
    return NumericalSteps(
      given: ((json['given'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(growable: false),
      required: (json['required'] ?? '').toString(),
      formula: (json['formula'] ?? '').toString(),
      substitution: (json['substitution'] ?? '').toString(),
      calculation: (json['calculation'] ?? '').toString(),
      answerWithUnit: (json['answerWithUnit'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'given': given,
        'required': required,
        'formula': formula,
        'substitution': substitution,
        'calculation': calculation,
        'answerWithUnit': answerWithUnit,
      };

  final List<String> given;
  final String required;
  final String formula;
  final String substitution;
  final String calculation;
  final String answerWithUnit;
}

class MatchingPairItem {
  const MatchingPairItem({
    required this.left,
    required this.right,
  });

  factory MatchingPairItem.fromJson(Map<String, dynamic> json) {
    return MatchingPairItem(
      left: (json['left'] ?? '').toString(),
      right: (json['right'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'left': left,
        'right': right,
      };

  final String left;
  final String right;
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
    this.multiSelectAnswers = const [],
    this.matchingPairs = const [],
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

  factory QuestionItem.fromJson(Map<String, dynamic> json) {
    final rawMisc = json['optionMisconceptions'];
    final miscMap = <String, String>{};
    if (rawMisc is Map) {
      rawMisc.forEach((k, v) {
        miscMap[k.toString()] = v.toString();
      });
    }
    return QuestionItem(
      id: (json['id'] ?? '').toString(),
      programmeId: ProgrammeId.fromId((json['programmeId'] ?? '').toString()),
      grade: (json['grade'] as num?)?.toInt() ?? 9,
      subjectId: (json['subjectId'] ?? '').toString(),
      chapterId: (json['chapterId'] ?? '').toString(),
      topicId: (json['topicId'] ?? '').toString(),
      conceptId: (json['conceptId'] ?? '').toString(),
      type: QuestionType.fromId((json['questionType'] ?? '').toString()),
      difficulty: (json['difficulty'] as num?)?.toInt() ?? 1,
      statement: (json['statement'] ?? '').toString(),
      options: ((json['options'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(growable: false),
      multiSelectAnswers: ((json['multiSelectAnswers'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(growable: false),
      matchingPairs: ((json['matchingPairs'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MatchingPairItem.fromJson)
          .toList(growable: false),
      optionMisconceptions: miscMap,
      hints: ((json['hints'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(growable: false),
      numericalSteps: json['numericalSteps'] is Map<String, dynamic>
          ? NumericalSteps.fromJson(
              json['numericalSteps'] as Map<String, dynamic>,
            )
          : null,
      markingPoints: ((json['markingPoints'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(growable: false),
      correctAnswer: (json['correctAnswer'] ?? '').toString(),
      explanation: (json['explanation'] ?? '').toString(),
      marks: (json['marks'] as num?)?.toInt() ?? 1,
      sourceType:
          QuestionSourceType.fromId((json['sourceType'] ?? '').toString()),
      sourceBoardName: json['sourceBoardId']?.toString(),
      sourceYear: (json['sourceYear'] as num?)?.toInt(),
      sourcePaperRef: json['sourcePaperRef']?.toString(),
      diagramSvg: json['diagramSvg']?.toString(),
      textDirection:
          json['textDirection'] == 'rtl' ? TextDirection.rtl : TextDirection.ltr,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'programmeId': programmeId.id,
        'grade': grade,
        'subjectId': subjectId,
        'chapterId': chapterId,
        'topicId': topicId,
        'conceptId': conceptId,
        'questionType': type.id,
        'difficulty': difficulty,
        'statement': statement,
        'options': options,
        if (multiSelectAnswers.isNotEmpty)
          'multiSelectAnswers': multiSelectAnswers,
        if (matchingPairs.isNotEmpty)
          'matchingPairs':
              matchingPairs.map((m) => m.toJson()).toList(growable: false),
        'optionMisconceptions': optionMisconceptions,
        'hints': hints,
        if (numericalSteps != null) 'numericalSteps': numericalSteps!.toJson(),
        'markingPoints': markingPoints,
        'correctAnswer': correctAnswer,
        'explanation': explanation,
        'marks': marks,
        'sourceType': sourceType.id,
        if (sourceBoardName != null) 'sourceBoardId': sourceBoardName,
        if (sourceYear != null) 'sourceYear': sourceYear,
        if (sourcePaperRef != null) 'sourcePaperRef': sourcePaperRef,
      };

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
  final List<String> multiSelectAnswers;
  final List<MatchingPairItem> matchingPairs;
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

  factory TopicItem.fromJson(Map<String, dynamic> json) {
    return TopicItem(
      id: (json['id'] ?? '').toString(),
      chapterId: (json['chapterId'] ?? '').toString(),
      orderIndex: (json['orderIndex'] as num?)?.toInt() ?? 1,
      title: (json['title'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'chapterId': chapterId,
        'orderIndex': orderIndex,
        'title': title,
      };

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
    this.chapterIntro,
    this.prerequisites = const [],
    required this.topics,
    required this.concepts,
    required this.questions,
    this.subjectName,
    this.adConfig,
    this.isBundledStarter = false,
  });

  factory ChapterPack.fromJson(Map<String, dynamic> json) {
    final chapterId = (json['chapterId'] ?? '').toString();
    final concepts = ((json['concepts'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ConceptItem.fromJson)
        .toList(growable: false);
    final rawTopics = ((json['topics'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(TopicItem.fromJson)
        .toList(growable: false);

    final inferredTopics = rawTopics.isNotEmpty
        ? rawTopics
        : concepts
            .map(
              (c) => TopicItem(
                id: c.topicId,
                chapterId: chapterId,
                orderIndex: c.orderIndex,
                title: c.title,
              ),
            )
            .toList(growable: false);

    return ChapterPack(
      chapterId: chapterId,
      programmeId: ProgrammeId.fromId((json['programmeId'] ?? '').toString()),
      grade: (json['grade'] as num?)?.toInt() ?? 9,
      subjectId: (json['subjectId'] ?? '').toString(),
      subjectName: json['subjectName']?.toString(),
      chapterNumber: (json['chapterNumber'] as num?)?.toInt() ?? 1,
      title: (json['title'] ?? '').toString(),
      packVersion: (json['packVersion'] as num?)?.toInt() ?? 1,
      estimatedSizeKb: (json['estimatedSizeKb'] as num?)?.toInt() ?? 120,
      learningOutcomes: ((json['learningOutcomes'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(growable: false),
      chapterIntro: json['chapterIntro']?.toString(),
      prerequisites: ((json['prerequisites'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(growable: false),
      topics: inferredTopics,
      concepts: concepts,
      questions: ((json['questions'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(QuestionItem.fromJson)
          .toList(growable: false),
      adConfig: json['adConfig'] is Map<String, dynamic>
          ? ChapterAdConfig.fromJson(json['adConfig'] as Map<String, dynamic>)
          : null,
      isBundledStarter: false,
    );
  }

  Map<String, dynamic> toJson() => {
        'chapterId': chapterId,
        'programmeId': programmeId.id,
        'grade': grade,
        'subjectId': subjectId,
        if (subjectName != null) 'subjectName': subjectName,
        'chapterNumber': chapterNumber,
        'title': title,
        'packVersion': packVersion,
        'estimatedSizeKb': estimatedSizeKb,
        'learningOutcomes': learningOutcomes,
        if (chapterIntro != null) 'chapterIntro': chapterIntro,
        if (prerequisites.isNotEmpty) 'prerequisites': prerequisites,
        'topics': topics.map((t) => t.toJson()).toList(growable: false),
        'concepts': concepts.map((c) => c.toJson()).toList(growable: false),
        'questions': questions.map((q) => q.toJson()).toList(growable: false),
        if (adConfig != null) 'adConfig': adConfig!.toJson(),
      };

  final String chapterId;
  final ProgrammeId programmeId;
  final int grade;
  final String subjectId;
  final String? subjectName;
  final int chapterNumber;
  final String title;
  final int packVersion;
  final int estimatedSizeKb;
  final List<String> learningOutcomes;
  final String? chapterIntro;
  final List<String> prerequisites;
  final List<TopicItem> topics;
  final List<ConceptItem> concepts;
  final List<QuestionItem> questions;
  final ChapterAdConfig? adConfig;
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
