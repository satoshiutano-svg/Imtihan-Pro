# Roshan Study — Mobile App (`mobile/`)

Canonical Flutter application for **Roshan Study** (Grades 9–12, KPK BISE boards, English-medium v1, offline-first, zero-account local progress).

## Implemented Phases (1–11)
- **Phase 1:** Academic green Light/Dark design system, adjustable reading scale, RTL Unicode readiness (`RtlAwareText`), 5-tab navigation (`Home`, `Learn`, `Practice`, `Exams`, `Progress`).
- **Phase 2:** Zero-account Onboarding & Profile setup (`OnboardingScreen`) supporting all 8 KPK BISE boards, Grades 9–12, academic groups, electives, and optional user-entered exam date countdown.
- **Phase 3:** SQLite content & reading progress persistence (`LocalDatabase`, `ContentRepository`) with 12-part `ConceptReaderScreen`, inline SVG diagrams, bookmarks, and saved scroll positions.
- **Phase 4:** Progressive Practice Engine (`PracticeSessionScreen`) across Levels 1–7, 6-step numerical solver (`Given → Required → Formula → Substitution → Calculation → Answer with unit`), progressive hints, honest marking-point self-check for short/long answers, and wrong-answer remediation loop.
- **Phase 5:** Board Examination Preparation (`ExamsScreen`, `ExamRunnerScreen`) separated for Grade 9/10 SSC and Grade 11/12 HSSC with provenance badges and timed mock execution.
- **Phase 6 & 9:** Offline Download Manager (`DownloadManagerScreen`), SHA-256 pack verification, storage cleanup, and `SyncService` outbox batching.
- **Phase 7:** Verified Progress Analytics & adaptive `1d → 3d → 7d` Spaced Revision engine (`ProgressRepository`, `SpacedRepetitionCalculator`) feeding dynamic Home recommendations.
- **Phase 10:** Architecturally isolated Admission Tests Hub (`AdmissionHubScreen`) for MDCAT & ETEA Engineering.
- **Phase 11:** Offline-accessible Privacy Policy (`PrivacyPolicyScreen`), narrow-screen (`320dp`) & `2.0x` text scaling safety.

## Running Verification Locally (Flutter SDK Environment)
```bash
cd mobile
flutter pub get
flutter analyze
flutter test
```

*Note: Because this AI Studio workspace runs a Node/Vite web environment without a Flutter SDK, Flutter tests were not executed inside this container.*
