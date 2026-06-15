import { kiwixWikiUrl } from '../wiki';

/** "📖 Wikipedia" link into the offline Kiwix Wikipedia for a named item. */
export function WikiLink({ name }: { name: string }) {
  return (
    <a
      className="wiki-link"
      href={kiwixWikiUrl(name)}
      target="_blank"
      rel="noreferrer"
      title={`Look up "${name}" in offline Wikipedia (Kiwix)`}
    >
      📖 Wikipedia
    </a>
  );
}
