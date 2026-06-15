import { useEffect, useState } from 'react';
import { CatalogSection } from './sections/CatalogSection';
import { IdentifySection } from './sections/IdentifySection';
const routes: Record<string, () => JSX.Element> = {
  '#catalog': CatalogSection, '#identify': IdentifySection,
};
export function App() {
  const [hash, setHash] = useState(location.hash || '#catalog');
  useEffect(() => { const h = () => setHash(location.hash || '#catalog'); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h); }, []);
  const Section = routes[hash] ?? CatalogSection;
  return (<div><nav><a href="#catalog">Catalog</a> <a href="#identify">Identify</a></nav><Section /></div>);
}
