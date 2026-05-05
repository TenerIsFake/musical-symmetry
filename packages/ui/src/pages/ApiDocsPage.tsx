import { useState } from 'react';

const EXAMPLES: Record<string, { method: string; url: string; body?: string; description: string }> = {
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
    { name: 'Anonymous', classify: '50/day', batch: '-', analyze: '3/day', report: '-', price: 'Free' },
    { name: 'Free', classify: '100/day', batch: '10/day', analyze: '10/day', report: '1/day', price: 'Free' },
    { name: 'Pro', classify: '1,000/day', batch: '100/day', analyze: '100/day', report: '20/day', price: '$9/mo' },
    { name: 'Research', classify: '10,000/day', batch: '1,000/day', analyze: '1,000/day', report: 'Unlimited', price: '$29/mo' },
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

  const curlCode = ex.body
    ? `curl -X ${ex.method} ${ex.url} \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -d '${ex.body.replace(/\n/g, '')}'`
    : `curl ${ex.url}`;

  const pythonCode = ex.body
    ? `import requests\n\nres = requests.post(\n    "${ex.url}",\n    json=${ex.body.replace(/"/g, "'").replace(/null/g, 'None').replace(/true/g, 'True').replace(/false/g, 'False')},\n    headers={"x-api-key": "YOUR_API_KEY"}\n)\nprint(res.json())`
    : `import requests\nres = requests.get("${ex.url}")\nprint(res.json())`;

  const jsCode = ex.body
    ? `const res = await fetch("${ex.url}", {\n  method: "${ex.method}",\n  headers: {\n    "Content-Type": "application/json",\n    "x-api-key": "YOUR_API_KEY"\n  },\n  body: JSON.stringify(${ex.body})\n});\nconst data = await res.json();\nconsole.log(data);`
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

      <h2 className="text-xl font-semibold mt-8 mb-3">OpenAPI Spec</h2>
      <p className="text-gray-400">
        Download the full spec: <a href="/api/openapi.json" className="text-indigo-400 underline">/api/openapi.json</a>
      </p>
    </div>
  );
}
