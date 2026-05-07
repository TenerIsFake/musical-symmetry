import { useState, useEffect } from 'react';
import ClassifierPage from './pages/ClassifierPage';
import AnalyzerPage from './pages/AnalyzerPage';
import AboutPage from './pages/AboutPage';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import ApiDocsPage from './pages/ApiDocsPage';
import ClassroomPage from './pages/ClassroomPage';
import AtlasPage from './pages/AtlasPage';
import AtlasEntryPage from './pages/AtlasEntryPage';
import EarTrainingPage from './pages/EarTrainingPage';
import ProgressionPage from './pages/ProgressionPage';
import LiveDetectionPage from './pages/LiveDetectionPage';
import ComparePage from './pages/ComparePage';
import MelodyPage from './pages/MelodyPage';
import ErrorBoundary from './components/ErrorBoundary';
import AdBanner from './components/AdBanner';
import { useResearchMode } from './context/ResearchMode';

type Page = 'home' | 'classifier' | 'analyzer' | 'about' | 'dashboard' | 'api-docs' | 'classroom' | 'atlas' | 'atlas-entry' | 'ear-training' | 'progression' | 'live' | 'compare' | 'melody';

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
            <h1 className="text-2xl sm:text-3xl font-bold">Musical Symmetry</h1>
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
                : 'Mathematical foundations for researchers'}
            </p>
          </div>
          <nav className="flex items-center gap-2">
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

        <AdBanner slot="top-banner" format="horizontal" />

        {page === 'classifier' && <ClassifierPage />}
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

        <AdBanner slot="bottom-banner" format="horizontal" />
      </div>
    </ErrorBoundary>
  );
}
