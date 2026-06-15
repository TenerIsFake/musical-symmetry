import { useEffect, useState } from 'react';
import { AtlasSection } from './sections/AtlasSection';
import { CatalogSection } from './sections/CatalogSection';
import { IdentifySection } from './sections/IdentifySection';
import { ArtistsSection } from './sections/ArtistsSection';
import { ReviewSection } from './sections/ReviewSection';
const routes: Record<string, () => JSX.Element> = {
  '#atlas': AtlasSection, '#catalog': CatalogSection, '#identify': IdentifySection,
  '#artists': ArtistsSection, '#review': ReviewSection,
};
export function App() {
  const [hash, setHash] = useState(location.hash || '#atlas');
  useEffect(() => { const h = () => setHash(location.hash || '#atlas'); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h); }, []);
  const Section = routes[hash] ?? AtlasSection;
  return (
    <div>
      <nav>
        <a href="#atlas">Atlas</a>
        <a href="#catalog">Catalog</a>
        <a href="#identify">Identify</a>
        <a href="#artists">Artists</a>
        <a href="#review">Review</a>
      </nav>
      <Section />
    </div>
  );
}
