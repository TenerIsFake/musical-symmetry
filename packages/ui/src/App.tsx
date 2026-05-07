import { useState, useEffect, lazy, Suspense } from 'react';
import ClassifierPage from './pages/ClassifierPage';
import LandingPage from './pages/LandingPage';
import ErrorBoundary from './components/ErrorBoundary';
import { useResearchMode } from './context/ResearchMode';

const AnalyzerPage = lazy(() => import('./pages/AnalyzerPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'));
const ClassroomPage = lazy(() => import('./pages/ClassroomPage'));
const AtlasPage = lazy(() => import('./pages/AtlasPage'));
const AtlasEntryPage = lazy(() => import('./pages/AtlasEntryPage'));
const EarTrainingPage = lazy(() => import('./pages/EarTrainingPage'));
const ProgressionPage = lazy(() => import('./pages/ProgressionPage'));
const LiveDetectionPage = lazy(() => import('./pages/LiveDetectionPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const MelodyPage = lazy(() => import('./pages/MelodyPage'));
const IntervalCyclesPage = lazy(() => import('./pages/IntervalCyclesPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const RhythmPage = lazy(() => import('./pages/RhythmPage'));
const EuclideanPage = lazy(() => import('./pages/EuclideanPage'));
const VoiceLeadingGraphPage = lazy(() => import('./pages/VoiceLeadingGraphPage'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const PracticePage = lazy(() => import('./pages/PracticePage'));
const TuningPage = lazy(() => import('./pages/TuningPage'));
const ScoreAnnotationPage = lazy(() => import('./pages/ScoreAnnotationPage'));
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const EmbedPage = lazy(() => import('./pages/EmbedPage'));
const FlashcardPage = lazy(() => import('./pages/FlashcardPage'));
const DailyChallengePage = lazy(() => import('./pages/DailyChallengePage'));
const PublicProfileIndexPage = lazy(() => import('./pages/PublicProfileIndexPage'));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'));
const RoomPage = lazy(() => import('./pages/RoomPage'));
const CorpusPage = lazy(() => import('./pages/CorpusPage'));
const LearningPathPage = lazy(() => import('./pages/LearningPathPage'));
const TransformChainPage = lazy(() => import('./pages/TransformChainPage'));
const SetClassPalettePage = lazy(() => import('./pages/SetClassPalettePage'));
const SketchpadPage = lazy(() => import('./pages/SketchpadPage'));

type Page = 'home' | 'classifier' | 'analyzer' | 'about' | 'dashboard' | 'api-docs' | 'classroom' | 'atlas' | 'atlas-entry' | 'ear-training' | 'progression' | 'live' | 'compare' | 'melody' | 'cycles' | 'search' | 'quiz' | 'rhythm' | 'euclidean' | 'vl-graph' | 'timeline' | 'practice' | 'tuning' | 'annotate' | 'assignments' | 'privacy' | 'history' | 'embed' | 'flashcards' | 'challenge' | 'profile' | 'profile-collection' | 'room' | 'corpus' | 'learn' | 'learn-path' | 'learn-lesson' | 'transform' | 'palette' | 'sketchpad';

function getPage(): Page {
  const hash = window.location.hash.replace('#', '').split('?')[0];
  if (hash === 'classifier') return 'classifier';
  if (hash === 'analyzer') return 'analyzer';
  if (hash === 'about') return 'about';
  if (hash === 'dashboard') return 'dashboard';
  if (hash === 'api-docs') return 'api-docs';
  if (hash === 'classroom') return 'classroom';
  if (hash === 'atlas') return 'atlas';
  if (hash.startsWith('atlas/')) return 'atlas-entry';
  if (hash === 'ear-training') return 'ear-training';
  if (hash === 'progression') return 'progression';
  if (hash === 'live') return 'live';
  if (hash === 'compare') return 'compare';
  if (hash === 'melody') return 'melody';
  if (hash === 'cycles') return 'cycles';
  if (hash === 'search') return 'search';
  if (hash === 'quiz') return 'quiz';
  if (hash === 'rhythm') return 'rhythm';
  if (hash === 'euclidean') return 'euclidean';
  if (hash === 'vl-graph') return 'vl-graph';
  if (hash === 'timeline') return 'timeline';
  if (hash === 'practice') return 'practice';
  if (hash === 'tuning') return 'tuning';
  if (hash === 'annotate') return 'annotate';
  if (hash === 'assignments') return 'assignments';
  if (hash === 'privacy') return 'privacy';
  if (hash === 'history') return 'history';
  if (hash === 'embed') return 'embed';
  if (hash === 'flashcards') return 'flashcards';
  if (hash === 'challenge') return 'challenge';
  if (hash.startsWith('room/')) return 'room';
  if (hash === 'corpus') return 'corpus';
  if (hash === 'learn') return 'learn';
  if (/^learn\/[^/]+\/[^/]+/.test(hash)) return 'learn-lesson';
  if (hash.startsWith('learn/')) return 'learn-path';
  if (hash.startsWith('u/')) {
    const parts = hash.slice(2).split('/');
    if (parts.length >= 2 && parts[1]) return 'profile-collection';
    return 'profile';
  }
  if (hash === 'transform') return 'transform';
  if (hash === 'palette') return 'palette';
  if (hash === 'sketchpad') return 'sketchpad';
  if (hash === '' || hash === 'home') return 'home';
  return 'home';
}

export default function App() {
  const [page, setPage] = useState<Page>(getPage);
  const { researchMode, toggle: toggleResearch } = useResearchMode();

  useEffect(() => {
    const handler = () => setPage(getPage());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  if (page === 'embed') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="text-center py-12 text-gray-500">Loading…</div>}>
          <EmbedPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (page === 'home') {
    return (
      <ErrorBoundary>
        <LandingPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Chrometria</h1>
            <p className="text-gray-400 mt-1 text-sm sm:text-base">
              {page === 'classifier'
                ? 'Select notes to see their hidden geometry'
                : page === 'analyzer'
                ? 'Upload a file to analyze symmetry across time'
                : page === 'dashboard'
                ? 'Manage your account and usage'
                : page === 'api-docs'
                ? 'Integrate pitch-class analysis into your applications'
                : page === 'classroom'
                ? 'Analyze chords together in real time'
                : page === 'atlas'
                ? 'Every pitch-class set class, classified by symmetry group'
                : page === 'atlas-entry'
                ? 'Set class detail'
                : page === 'ear-training'
                ? 'Train your ear to recognize pitch-class sets'
                : page === 'progression'
                ? 'Build and optimize chord progressions with voice-leading analysis'
                : page === 'live'
                ? 'Detect pitches in real time from your microphone'
                : page === 'compare'
                ? 'Compare two pieces side by side for symmetry differences'
                : page === 'melody'
                ? 'Analyze melodic contour — shape, symmetry, and similarity'
                : page === 'cycles'
                ? 'Explore interval cycles — the geometry of musical intervals'
                : page === 'search'
                ? 'Query the full space of pitch-class sets by symmetry properties'
                : page === 'quiz'
                ? 'Spaced-repetition flashcards for set class mastery'
                : page === 'rhythm'
                ? 'Rhythmic symmetry — cyclic geometry of beat patterns'
                : page === 'euclidean'
                ? "Generate maximally even rhythms with Bjorklund's algorithm"
                : page === 'vl-graph'
                ? 'Voice-leading landscape — explore minimal chord movements'
                : page === 'timeline'
                ? 'Harmonic timeline — trace symmetry evolution across a piece'
                : page === 'practice'
                ? 'Sing or play along — test your contour accuracy'
                : page === 'tuning'
                ? 'Explore symmetry in microtonal tuning systems'
                : page === 'annotate'
                ? 'Annotate scores with symmetry analysis'
                : page === 'assignments'
                ? 'Create and complete music theory assignments'
                : page === 'privacy'
                ? 'How we collect, use, and protect your data'
                : page === 'history'
                ? 'Browse, bookmark, and tag your past analyses'
                : page === 'flashcards'
                ? 'Build custom decks and study set classes with spaced repetition'
                : page === 'challenge'
                ? 'One set class question per day — build your streak'
                : page === 'room'
                ? 'Collaborative live analysis — share and explore pitch-class sets together'
                : page === 'corpus'
                ? 'Batch upload files, compute aggregate corpus statistics, and compare corpora'
                : page === 'learn'
                ? 'Structured lessons guiding you through music theory and symmetry'
                : page === 'learn-path'
                ? 'Learning path overview'
                : page === 'learn-lesson'
                ? 'Guided lesson with quiz and practice task'
                : page === 'transform'
                ? 'Apply T/I/PLR operations to build transformation chains'
                : page === 'palette'
                ? 'Browse all transpositions and inversions of any set class'
                : page === 'sketchpad'
                ? 'Multi-track composition workspace — melody, rhythm, and chords'
                : 'Mathematical foundations for researchers'}
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <a
              href="#home"
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              Home
            </a>
            <a
              href="#classifier"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'classifier' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Classifier
            </a>
            <a
              href="#analyzer"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'analyzer' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Analyzer
            </a>
            <a
              href="#about"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'about' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              The Math
            </a>
            <a
              href="#dashboard"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'dashboard' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Dashboard
            </a>
            <a
              href="#api-docs"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'api-docs' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              API Docs
            </a>
            <a
              href="#classroom"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'classroom' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Classroom
            </a>
            <a
              href="#atlas"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'atlas' || page === 'atlas-entry' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Atlas
            </a>
            <a
              href="#ear-training"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'ear-training' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Ear Training
            </a>
            <a
              href="#progression"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'progression' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Progression
            </a>
            <a
              href="#live"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'live' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Live
            </a>
            <a
              href="#compare"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'compare' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Compare
            </a>
            <a
              href="#melody"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'melody' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Melody
            </a>
            <a
              href="#cycles"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'cycles' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Cycles
            </a>
            <a
              href="#search"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'search' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Search
            </a>
            <a
              href="#quiz"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'quiz' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Quiz
            </a>
            <a
              href="#rhythm"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'rhythm' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Rhythm
            </a>
            <a
              href="#euclidean"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'euclidean' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Euclidean
            </a>
            <a
              href="#vl-graph"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'vl-graph' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              VL Graph
            </a>
            <a
              href="#timeline"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'timeline' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Timeline
            </a>
            <a
              href="#practice"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'practice' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Practice
            </a>
            <a
              href="#tuning"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'tuning' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Tuning
            </a>
            <a
              href="#annotate"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'annotate' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Annotate
            </a>
            <a
              href="#assignments"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'assignments' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Assignments
            </a>
            <a
              href="#history"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'history' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              History
            </a>
            <a
              href="#flashcards"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'flashcards' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Flashcards
            </a>
            <a
              href="#challenge"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'challenge' ? 'bg-amber-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Challenge
            </a>
            <a
              href="#learn"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'learn' || page === 'learn-path' || page === 'learn-lesson' ? 'bg-teal-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Learn
            </a>
            <a
              href="#corpus"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'corpus' ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Research tier: Comparative Corpus Analysis"
            >
              Corpus
            </a>
            <a
              href="#transform"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'transform' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Transform
            </a>
            <a
              href="#palette"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'palette' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Palette
            </a>
            <a
              href="#sketchpad"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                page === 'sketchpad' ? 'bg-emerald-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Sketchpad
            </a>
            <span className="w-px h-5 bg-gray-600 mx-1" />
            <button
              onClick={toggleResearch}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                researchMode ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={researchMode ? 'Switch to casual mode' : 'Show full technical details'}
            >
              {researchMode ? 'Research' : 'Casual'}
            </button>
          </nav>
        </header>


        {page === 'classifier' && <ClassifierPage />}
        <Suspense fallback={<div className="text-center py-12 text-gray-500">Loading…</div>}>
          {page === 'analyzer' && <AnalyzerPage />}
          {page === 'about' && <AboutPage />}
          {page === 'dashboard' && <DashboardPage />}
          {page === 'api-docs' && <ApiDocsPage />}
          {page === 'classroom' && <ClassroomPage />}
          {page === 'atlas' && <AtlasPage />}
          {page === 'atlas-entry' && <AtlasEntryPage forteNumber={window.location.hash.replace('#atlas/', '')} />}
          {page === 'ear-training' && <EarTrainingPage />}
          {page === 'progression' && <ProgressionPage />}
          {page === 'live' && <LiveDetectionPage />}
          {page === 'compare' && <ComparePage />}
          {page === 'melody' && <MelodyPage />}
          {page === 'cycles' && <IntervalCyclesPage />}
          {page === 'search' && <SearchPage />}
          {page === 'quiz' && <QuizPage />}
          {page === 'rhythm' && <RhythmPage />}
          {page === 'euclidean' && <EuclideanPage />}
          {page === 'vl-graph' && <VoiceLeadingGraphPage />}
          {page === 'timeline' && <TimelinePage />}
          {page === 'practice' && <PracticePage />}
          {page === 'tuning' && <TuningPage />}
          {page === 'annotate' && <ScoreAnnotationPage />}
          {page === 'assignments' && <AssignmentsPage />}
          {page === 'privacy' && <PrivacyPage />}
          {page === 'history' && <HistoryPage />}
          {page === 'flashcards' && <FlashcardPage />}
          {page === 'challenge' && <DailyChallengePage />}
          {page === 'profile' && (() => {
            const username = window.location.hash.replace('#u/', '').split('/')[0];
            return <PublicProfileIndexPage username={username} />;
          })()}
          {page === 'profile-collection' && (() => {
            const parts = window.location.hash.replace('#u/', '').split('/');
            const username = parts[0];
            const slug = parts[1] || '';
            return <PublicProfilePage username={username} slug={slug} />;
          })()}
          {page === 'room' && (() => {
            const roomId = window.location.hash.replace('#room/', '');
            return <RoomPage roomId={roomId} />;
          })()}
          {page === 'corpus' && <CorpusPage />}
          {page === 'transform' && <TransformChainPage />}
          {page === 'palette' && <SetClassPalettePage />}
          {page === 'sketchpad' && <SketchpadPage />}
          {(page === 'learn' || page === 'learn-path' || page === 'learn-lesson') && (() => {
            const hash = window.location.hash.replace('#', '').split('?')[0];
            const parts = hash.split('/');
            const pathId = parts[1] || undefined;
            const lessonId = parts[2] || undefined;
            return <LearningPathPage pathId={pathId} lessonId={lessonId} />;
          })()}
        </Suspense>

      </div>
    </ErrorBoundary>
  );
}
