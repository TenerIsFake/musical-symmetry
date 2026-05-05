export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="#home" className="text-lg font-bold tracking-tight">
            Musical Symmetry
          </a>
          <div className="flex items-center gap-4 text-sm">
            <a href="#home" className="text-gray-400 hover:text-white transition-colors hidden sm:inline">Home</a>
            <a href="#classifier" className="text-gray-400 hover:text-white transition-colors">Classifier</a>
            <a href="#analyzer" className="text-gray-400 hover:text-white transition-colors">Analyzer</a>
            <a href="#about" className="text-gray-400 hover:text-white transition-colors hidden sm:inline">The Math</a>
            <a href="#dashboard" className="text-gray-400 hover:text-white transition-colors hidden sm:inline">Dashboard</a>
            <a
              href="#classifier"
              className="ml-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-400 hover:to-purple-400 transition-all"
            >
              Try Free
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 sm:py-32 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/30 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
            See the hidden geometry{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              of chords
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Discover what group theory reveals about the music you play.
            Every chord has a symmetry group — find yours.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#classifier"
              className="px-8 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-lg hover:from-indigo-400 hover:to-purple-400 transition-all shadow-lg shadow-indigo-500/25"
            >
              Try It Free
            </a>
            <a
              href="#demo"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-8 py-3 rounded-full border border-gray-600 text-gray-300 font-semibold text-lg hover:border-gray-400 hover:text-white transition-all"
            >
              Watch Demo
            </a>
          </div>

          {/* Animated orbit preview */}
          <div className="mt-16 flex justify-center">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56">
              {/* Clock face ring */}
              <div className="absolute inset-0 rounded-full border border-gray-700/50" />
              {/* Rotating polygon */}
              <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full animate-[spin_20s_linear_infinite]">
                <polygon
                  points="100,20 170,145 30,145"
                  fill="none"
                  stroke="url(#heroGrad)"
                  strokeWidth="2"
                  opacity="0.8"
                />
                <defs>
                  <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Dots at vertices */}
              {[0, 1, 2].map((i) => {
                const angle = (i * 120 - 90) * (Math.PI / 180);
                const cx = 50 + 40 * Math.cos(angle);
                const cy = 50 + 40 * Math.sin(angle);
                return (
                  <div
                    key={i}
                    className="absolute w-3 h-3 rounded-full bg-indigo-400 shadow-lg shadow-indigo-400/50 animate-[spin_20s_linear_infinite_reverse]"
                    style={{
                      left: `${cx}%`,
                      top: `${cy}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-gray-500 font-mono">D&#x2081;&#x2082;</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo — How It Works */}
      <section id="demo" className="py-20 sm:py-28 px-4 bg-gray-950/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
            Three steps from notes to insight.
          </p>
          <div className="grid md:grid-cols-3 gap-8 sm:gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="mx-auto w-48 h-28 mb-6 rounded-xl bg-gray-800/80 border border-gray-700/50 flex items-end justify-center pb-1 overflow-hidden">
                {/* Mini piano */}
                <div className="flex">
                  {['C','','D','','E','F','','G','','A','','B'].map((note, i) => {
                    const isBlack = [1,3,6,8,10].includes(i);
                    const isActive = [0,4,7].includes(i);
                    if (isBlack) {
                      return (
                        <div key={i} className={`w-3 h-14 -mx-1.5 z-10 rounded-b ${isActive ? 'bg-indigo-500' : 'bg-gray-900'} border border-gray-600`} />
                      );
                    }
                    return (
                      <div key={i} className={`w-5 h-20 rounded-b ${isActive ? 'bg-indigo-400' : 'bg-gray-200'} border border-gray-400`} />
                    );
                  })}
                </div>
              </div>
              <div className="text-sm font-bold text-indigo-400 mb-2">Step 1</div>
              <h3 className="text-lg font-semibold mb-1">Pick any chord</h3>
              <p className="text-gray-400 text-sm">Click notes on the keyboard or type pitch classes directly.</p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="mx-auto w-48 h-28 mb-6 rounded-xl bg-gray-800/80 border border-gray-700/50 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-24 h-24">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#374151" strokeWidth="1" />
                  <polygon points="50,12 84,69 16,69" fill="none" stroke="#818cf8" strokeWidth="2" />
                  <circle cx="50" cy="12" r="4" fill="#818cf8" />
                  <circle cx="84" cy="69" r="4" fill="#818cf8" />
                  <circle cx="16" cy="69" r="4" fill="#818cf8" />
                  <text x="50" y="54" textAnchor="middle" fill="#9ca3af" fontSize="10" fontFamily="monospace">Z&#x2083;</text>
                </svg>
              </div>
              <div className="text-sm font-bold text-purple-400 mb-2">Step 2</div>
              <h3 className="text-lg font-semibold mb-1">See its symmetry</h3>
              <p className="text-gray-400 text-sm">The orbit diagram reveals the chord's symmetry group under D&#x2081;&#x2082;.</p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="mx-auto w-48 h-28 mb-6 rounded-xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-gray-700/50 flex items-center justify-center">
                <div className="text-left px-3">
                  <div className="text-[10px] text-gray-500 font-mono mb-1">C Major</div>
                  <div className="text-xs font-bold text-white mb-0.5">Symmetry: Z&#x2083;</div>
                  <div className="text-[10px] text-gray-400">Forte: 3-11B</div>
                  <div className="flex gap-1 mt-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <div className="w-2 h-2 rounded-full bg-pink-400" />
                  </div>
                </div>
              </div>
              <div className="text-sm font-bold text-pink-400 mb-2">Step 3</div>
              <h3 className="text-lg font-semibold mb-1">Share your discovery</h3>
              <p className="text-gray-400 text-sm">Generate beautiful share cards in 20 different styles.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Features</h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
            Everything you need to explore the mathematics of music.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="12" stroke="#818cf8" strokeWidth="1.5" />
                    <polygon points="16,4 27,22 5,22" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
                  </svg>
                ),
                title: 'Symmetry Classification',
                desc: 'Full D\u2081\u2082 group theory analysis of any pitch-class set. Orbit decomposition, stabilizer subgroups, and abstract group identification.',
              },
              {
                icon: (
                  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                    <path d="M4 24 L10 12 L18 18 L28 6" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="4" cy="24" r="2" fill="#a78bfa" />
                    <circle cx="28" cy="6" r="2" fill="#a78bfa" />
                  </svg>
                ),
                title: 'Voice-Leading Distance',
                desc: 'Measure harmonic motion between any two chords using optimal voice-leading distance computation.',
              },
              {
                icon: (
                  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                    <rect x="4" y="4" width="24" height="24" rx="4" stroke="#818cf8" strokeWidth="1.5" />
                    <rect x="8" y="8" width="16" height="16" rx="2" fill="#a78bfa" fillOpacity="0.3" />
                    <circle cx="16" cy="16" r="3" fill="#818cf8" />
                  </svg>
                ),
                title: '20 Share Card Styles',
                desc: 'Orbit diagrams, neon glows, blueprints, constellations, and more. Beautiful OG-ready SVG graphics.',
              },
              {
                icon: (
                  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                    <rect x="6" y="20" width="3" height="8" rx="1" fill="#818cf8" />
                    <rect x="11" y="14" width="3" height="14" rx="1" fill="#a78bfa" />
                    <rect x="16" y="10" width="3" height="18" rx="1" fill="#818cf8" />
                    <rect x="21" y="16" width="3" height="12" rx="1" fill="#a78bfa" />
                  </svg>
                ),
                title: 'MIDI Analysis',
                desc: 'Upload MIDI or MusicXML files and see how symmetry evolves across an entire piece of music.',
              },
              {
                icon: (
                  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                    <circle cx="11" cy="16" r="7" stroke="#818cf8" strokeWidth="1.5" />
                    <circle cx="21" cy="16" r="7" stroke="#a78bfa" strokeWidth="1.5" />
                  </svg>
                ),
                title: 'Comparison Mode',
                desc: 'Place two chords side by side. See their orbits, shared stabilizers, and voice-leading path.',
              },
              {
                icon: (
                  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                    <path d="M8 8h16M8 14h12M8 20h16M8 26h10" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="26" cy="26" r="4" stroke="#a78bfa" strokeWidth="1.5" />
                  </svg>
                ),
                title: 'Research Mode',
                desc: 'Academic-grade tools: Forte numbers, Mulliken labels, interval vectors, character tables, and more.',
              },
            ].map((f, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-gray-800/50 border border-gray-700/50 hover:border-indigo-500/30 transition-colors"
              >
                <div className="mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Analysis */}
      <section className="py-20 sm:py-28 px-4 bg-gray-950/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            What does <em className="not-italic text-indigo-400">Riders on the Storm</em> look like?
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Upload any MIDI file and watch symmetry unfold beat by beat.
          </p>
          <div className="rounded-2xl bg-gray-800/60 border border-gray-700/50 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-sm font-mono text-gray-500">riders_on_the_storm.mid</div>
              <div className="ml-auto text-xs text-gray-600">156 slices | beat mode</div>
            </div>
            {/* Fake timeline bars */}
            <div className="flex items-end gap-px h-32">
              {Array.from({ length: 64 }, (_, i) => {
                const groups = ['Z1', 'Z2', 'Z3', 'Z4', 'Z6', 'D2', 'D3', 'D4'];
                const colors: Record<string, string> = {
                  Z1: 'bg-gray-600', Z2: 'bg-blue-500', Z3: 'bg-indigo-500',
                  Z4: 'bg-purple-500', Z6: 'bg-pink-500', D2: 'bg-amber-500',
                  D3: 'bg-emerald-500', D4: 'bg-red-500',
                };
                const g = groups[Math.floor(Math.sin(i * 0.7 + 1) * 3.5 + 4) % groups.length];
                const h = 20 + Math.abs(Math.sin(i * 0.3 + 2)) * 80;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${colors[g]} opacity-80`}
                    style={{ height: `${h}%` }}
                    title={g}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-3 text-xs text-gray-600 font-mono">
              <span>Beat 1</span>
              <span>Beat 32</span>
              <span>Beat 64</span>
            </div>
            <div className="mt-6 text-center">
              <a
                href="#analyzer"
                className="inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm hover:from-indigo-400 hover:to-purple-400 transition-all"
              >
                Try with your own file
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Pricing</h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
            Start free. Upgrade when you need more.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free */}
            <div className="rounded-2xl bg-gray-800/50 border border-gray-700/50 p-6 flex flex-col">
              <h3 className="text-xl font-bold mb-1">Free</h3>
              <div className="text-3xl font-extrabold mb-1">$0</div>
              <div className="text-sm text-gray-500 mb-6">forever</div>
              <ul className="space-y-3 text-sm text-gray-300 flex-1">
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Classify any chord</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Basic share cards</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> 3 MIDI analyses per day</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Voice-leading distance</li>
              </ul>
              <a
                href="#classifier"
                className="mt-8 block text-center px-6 py-2.5 rounded-full border border-gray-600 text-gray-300 font-medium text-sm hover:border-gray-400 hover:text-white transition-all"
              >
                Get Started
              </a>
            </div>

            {/* Pro */}
            <div className="rounded-2xl bg-gray-800/50 border-2 border-indigo-500/50 p-6 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-xs font-bold text-white">
                Popular
              </div>
              <h3 className="text-xl font-bold mb-1">Pro</h3>
              <div className="text-3xl font-extrabold mb-1">
                $9<span className="text-lg font-normal text-gray-400">/mo</span>
              </div>
              <div className="text-sm text-gray-500 mb-6">billed monthly</div>
              <ul className="space-y-3 text-sm text-gray-300 flex-1">
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Unlimited analysis</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> All 20 card styles</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> CSV / JSON export</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Batch API (100 req/day)</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Comparison mode</li>
              </ul>
              <a
                href="#classifier"
                className="mt-8 block text-center px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm hover:from-indigo-400 hover:to-purple-400 transition-all shadow-lg shadow-indigo-500/20"
              >
                Start Free Trial
              </a>
            </div>

            {/* Research */}
            <div className="rounded-2xl bg-gray-800/50 border border-gray-700/50 p-6 flex flex-col">
              <h3 className="text-xl font-bold mb-1">Research</h3>
              <div className="text-3xl font-extrabold mb-1">
                $29<span className="text-lg font-normal text-gray-400">/mo</span>
              </div>
              <div className="text-sm text-gray-500 mb-6">billed monthly</div>
              <ul className="space-y-3 text-sm text-gray-300 flex-1">
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Everything in Pro</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Bulk API (10k req/day)</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Priority support</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Early access features</li>
                <li className="flex gap-2"><span className="text-green-400">&#10003;</span> Academic citations</li>
              </ul>
              <a
                href="#classifier"
                className="mt-8 block text-center px-6 py-2.5 rounded-full border border-gray-600 text-gray-300 font-medium text-sm hover:border-gray-400 hover:text-white transition-all"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <a href="#about" className="hover:text-gray-300 transition-colors">About the Math</a>
            <a href="/api/docs" className="hover:text-gray-300 transition-colors">API Docs</a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition-colors"
            >
              GitHub
            </a>
            <span>MIT License</span>
          </div>
          <div className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} Musical Symmetry
          </div>
        </div>
      </footer>
    </div>
  );
}
