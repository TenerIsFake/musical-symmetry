import type { ReactNode } from 'react';

interface Props {
  text: string;
  children: ReactNode;
}

export default function Tooltip({ text, children }: Props) {
  return (
    <span className="group relative inline-flex items-center">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-full bg-gray-950 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50 border border-gray-700">
        {text}
      </span>
    </span>
  );
}
