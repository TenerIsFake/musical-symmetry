import { useState } from 'react';

const EXAMPLES: Record<string, { method: string; url: string; body?: string; description: string; tier?: string }> = {
  classify: {
    method: 'POST',
    url: 'https://symmetry.tendrid.us/api/classify',
    body: JSON.stringify({ pitchClasses: [0, 4, 7] }, null, 2),
    description: 'Classify a C major triad',
  },
  batch: {
    method: 'POST',
    url: 'https://symmetry.tendrid.us/api/classify/batch',
    body: JSON.stringify({ sets: [[0, 4, 7], [0, 3, 6, 9], [0, 2, 4, 6, 8, 10]] }, null, 2),
    description: 'Classify three sets at once',
  },
  voiceLeading: {
    method: 'POST',
    url: 'https://symmetry.tendrid.us/api/voice-leading',
    body: JSON.stringify({ from: [0, 4, 7], to: [0, 3, 7] }, null, 2),
    description: 'Distance from C major to C minor',
  },
  bulkSetClasses: {
    method: 'GET',
    url: 'https://symmetry.tendrid.us/api/bulk/set-classes',
    description: 'All 224 set classes (Research)',
    tier: 'research',
  },
  bulkSetClass: {
    method: 'GET',
    url: 'https://symmetry.tendrid.us/api/bulk/set-classes/3-11',
    description: 'Single set class 3-11 (Research)',
    tier: 'research',
  },
  bulkClassify: {
    method: 'POST',
    url: 'https://symmetry.tendrid.us/api/bulk/classify',
    body: JSON.stringify({ sets: [[0, 4, 7], [0, 3, 7], [0, 3, 6, 9]] }, null, 2),
    description: 'Bulk classify up to 5000 sets (Research)',
    tier: 'research',
  },
};

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative bg-gray-950 rounded-lg p-4 overflow-x-auto">
      <button
        onClick={copy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-400"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="text-sm text-gray-300 font-mono whitespace-pre">{code}</pre>
    </div>
  );
}

function TierTable() {
  const tiers = [
    { name: 'Anonymous', classify: '50/day', batch: '-', analyze: '3/day', report: '-', bulk: '-', price: 'Free' },
    { name: 'Free', classify: '100/day', batch: '10/day', analyze: '10/day', report: '1/day', bulk: '-', price: 'Free' },
    { name: 'Pro', classify: '1,000/day', batch: '100/day', analyze: '100/day', report: '20/day', bulk: '-', price: '$9/mo' },
    { name: 'Research', classify: '10,000/day', batch: '1,000/day', analyze: '1,000/day', report: 'Unlimited', bulk: '100/day', price: '$29/mo' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-800 text-gray-400">
          <tr>
            <th className="px-4 py-2">Tier</th>
            <th className="px-4 py-2">Classify</th>
            <th className="px-4 py-2">Batch</th>
            <th className="px-4 py-2">Analyze</th>
            <th className="px-4 py-2">Report</th>
            <th className="px-4 py-2">Bulk Export</th>
            <th className="px-4 py-2">Price</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map(t => (
            <tr key={t.name} className="border-b border-gray-800">
              <td className="px-4 py-2 font-medium text-white">{t.name}</td>
              <td className="px-4 py-2 text-gray-300">{t.classify}</td>
              <td className="px-4 py-2 text-gray-300">{t.batch}</td>
              <td className="px-4 py-2 text-gray-300">{t.analyze}</td>
              <td className="px-4 py-2 text-gray-300">{t.report}</td>
              <td className="px-4 py-2 text-gray-300">{t.bulk}</td>
              <td className="px-4 py-2 text-indigo-400">{t.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApiDocsPage() {
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'javascript'>('curl');
  const [selectedExample, setSelectedExample] = useState<string>('classify');

  const ex = EXAMPLES[selectedExample]!;

  const needsAuth = Boolean(ex.tier);

  const curlCode = ex.body
    ? `curl -X ${ex.method} ${ex.url} \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -d '${ex.body.replace(/\n/g, '')}'`
    : needsAuth
      ? `curl ${ex.url} \\\n  -H "x-api-key: YOUR_API_KEY"`
      : `curl ${ex.url}`;

  const pythonCode = ex.body
    ? `import requests\n\nres = requests.post(\n    "${ex.url}",\n    json=${ex.body.replace(/"/g, "'").replace(/null/g, 'None').replace(/true/g, 'True').replace(/false/g, 'False')},\n    headers={"x-api-key": "YOUR_API_KEY"}\n)\nprint(res.json())`
    : needsAuth
      ? `import requests\nres = requests.get("${ex.url}", headers={"x-api-key": "YOUR_API_KEY"})\nprint(res.json())`
      : `import requests\nres = requests.get("${ex.url}")\nprint(res.json())`;

  const jsCode = ex.body
    ? `const res = await fetch("${ex.url}", {\n  method: "${ex.method}",\n  headers: {\n    "Content-Type": "application/json",\n    "x-api-key": "YOUR_API_KEY"\n  },\n  body: JSON.stringify(${ex.body})\n});\nconst data = await res.json();\nconsole.log(data);`
    : needsAuth
      ? `const res = await fetch("${ex.url}", {\n  headers: { "x-api-key": "YOUR_API_KEY" }\n});\nconst data = await res.json();\nconsole.log(data);`
      : `const res = await fetch("${ex.url}");\nconst data = await res.json();`;

  const codeMap = { curl: curlCode, python: pythonCode, javascript: jsCode };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
      <p className="text-gray-400 mb-8">
        Integrate pitch-class set analysis into your own applications. Authenticate with an API key from your{' '}
        <a href="#dashboard" className="text-indigo-400 underline">dashboard</a>.
      </p>

      <h2 className="text-xl font-semibold mb-3">Rate Limits</h2>
      <TierTable />

      <h2 className="text-xl font-semibold mt-8 mb-3">Try It</h2>

      <div className="flex gap-2 mb-4">
        {Object.entries(EXAMPLES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setSelectedExample(key)}
            className={`px-3 py-1.5 rounded text-sm ${
              selectedExample === key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {val.description}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        {(['curl', 'python', 'javascript'] as const).map(lang => (
          <button
            key={lang}
            onClick={() => setActiveTab(lang)}
            className={`px-3 py-1 rounded text-xs font-mono ${
              activeTab === lang ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      <CodeBlock code={codeMap[activeTab]} />

      <h2 className="text-xl font-semibold mt-8 mb-3">Authentication</h2>
      <p className="text-gray-400 mb-3">
        Pass your API key in the <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300">x-api-key</code> header.
        Get your key from the <a href="#dashboard" className="text-indigo-400 underline">dashboard</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">Bulk Set Class Export <span className="ml-2 text-xs bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded">Research tier</span></h2>
      <p className="text-gray-400 mb-3">
        Research subscribers can retrieve the full Forte catalog programmatically. All three endpoints require
        the <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300">x-api-key</code> header and a Research-tier account.
        The set-class list is cached in-memory after first request for fast repeated access.
      </p>
      <div className="space-y-4 mb-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono bg-blue-900 text-blue-200 px-2 py-0.5 rounded">GET</span>
            <code className="text-sm text-gray-200 font-mono">/api/bulk/set-classes</code>
          </div>
          <p className="text-sm text-gray-400">Returns all 224 set classes (cardinalities 2–12) with Forte number, prime form, interval vector, symmetry group, Mulliken label, and boolean properties. Rate limit: 100/day.</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono bg-blue-900 text-blue-200 px-2 py-0.5 rounded">GET</span>
            <code className="text-sm text-gray-200 font-mono">/api/bulk/set-classes/:forte</code>
          </div>
          <p className="text-sm text-gray-400">Returns a single set class by Forte number (e.g. <code className="bg-gray-800 px-1 rounded">3-11</code>, <code className="bg-gray-800 px-1 rounded">4-Z15</code>, <code className="bg-gray-800 px-1 rounded">6-35</code>). Returns 404 if not found.</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono bg-green-900 text-green-200 px-2 py-0.5 rounded">POST</span>
            <code className="text-sm text-gray-200 font-mono">/api/bulk/classify</code>
          </div>
          <p className="text-sm text-gray-400">Classify up to 5,000 pitch-class sets in a single request (vs. 1,000 for <code className="bg-gray-800 px-1 rounded">/api/classify/batch</code>). Accepts <code className="bg-gray-800 px-1 rounded">{"{ sets: number[][] }"}</code>. Rate limit: 100/day.</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-3">Embed Widget</h2>
      <p className="text-gray-400 mb-3">
        Drop an interactive Chrometria classifier into any course website with a single <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300">&lt;iframe&gt;</code>.
        No authentication required. Supports <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300">pcs</code>, <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300">theme</code> (dark/light), and <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300">size</code> (compact/full) query params.
      </p>
      <CodeBlock code={`<iframe\n  src="https://symmetry.tendrid.us/#embed?pcs=0,4,7&theme=dark&size=compact"\n  width="600" height="500"\n  frameborder="0"\n  allow="midi"\n></iframe>`} />

      <h2 className="text-xl font-semibold mt-8 mb-3">OpenAPI Spec</h2>
      <p className="text-gray-400">
        Download the full spec: <a href="/api/openapi.json" className="text-indigo-400 underline">/api/openapi.json</a>
      </p>
    </div>
  );
}
