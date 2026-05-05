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
import ErrorBoundary from './components/ErrorBoundary';
import { useResearchMode } from './context/ResearchMode';

type Page = 'home' | 'classifier' | 'analyzer' | 'about' | 'dashboard' | 'api-docs' | 'classroom' | 'atlas' | 'atlas-entry';

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
        {page === 'analyzer' && <AnalyzerPage />}
        {page === 'about' && <AboutPage />}
        {page === 'dashboard' && <DashboardPage />}
        {page === 'api-docs' && <ApiDocsPage />}
        {page === 'classroom' && <ClassroomPage />}
        {page === 'atlas' && <AtlasPage />}
        {page === 'atlas-entry' && <AtlasEntryPage forteNumber={window.location.hash.replace('#atlas/', '')} />}
      </div>
    </ErrorBoundary>
  );
}
