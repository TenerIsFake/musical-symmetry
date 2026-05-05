import { useState, useEffect } from 'react';
import ClassifierPage from './pages/ClassifierPage';
import AnalyzerPage from './pages/AnalyzerPage';

type Page = 'classifier' | 'analyzer';

function getPage(): Page {
  const hash = window.location.hash.replace('#', '');
  return hash === 'analyzer' ? 'analyzer' : 'classifier';
}

export default function App() {
  const [page, setPage] = useState<Page>(getPage);

  useEffect(() => {
    const handler = () => setPage(getPage());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Musical Symmetry</h1>
          <p className="text-gray-400 mt-1 text-sm sm:text-base">
            {page === 'classifier'
              ? 'Select notes to see their hidden geometry'
              : 'Upload a file to analyze symmetry across time'}
          </p>
        </div>
        <nav className="flex gap-2">
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
        </nav>
      </header>

      {page === 'classifier' && <ClassifierPage />}
      {page === 'analyzer' && <AnalyzerPage />}
    </div>
  );
}
