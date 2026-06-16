import type { FxCategory } from '../types.js';

// Catalog tuned to the owner's library (Lidarr: ~468 artists, heavy on classic/
// psychedelic/blues rock, jazz, folk, singer-songwriter, soul, punk, prog).
// Leans into the '60s–'70s analog hardware that era is built on, so "Look it up"
// gear lookups for those artists have a vocabulary to map onto.

export const SEED_FX: Array<{ name: string; category: FxCategory; fingerprint: string; tells: string; era: string; typical_use: string }> = [
  // --- Reverb ---
  { name: 'Plate Reverb', category: 'reverb', fingerprint: 'Dense, bright, smooth tail with no distinct echoes.', tells: 'Fast bright metallic-shimmer decay; sits behind the source.', era: '1957–', typical_use: 'Vocals, snare' },
  { name: 'Spring Reverb', category: 'reverb', fingerprint: 'Boingy, mid-focused, drippy.', tells: 'Characteristic "sproing" on transients.', era: '1960s–', typical_use: 'Surf guitar, dub' },
  { name: 'Hall Reverb', category: 'reverb', fingerprint: 'Long, diffuse, deep sense of space.', tells: 'Slow build, long wash, distant.', era: '—', typical_use: 'Orchestral, ambient' },
  { name: 'Chamber Reverb', category: 'reverb', fingerprint: 'Lush, dense, organic room with real early reflections.', tells: 'Three-dimensional but tighter than a hall; "expensive" sounding.', era: '1947–', typical_use: 'Vocals, strings, drums' },
  // --- Dynamics ---
  { name: 'FET Compressor (1176-style)', category: 'dynamics', fingerprint: 'Fast, punchy, adds aggressive grab and color.', tells: 'Snappy transient control; "all-buttons" grit.', era: '1967–', typical_use: 'Vocals, drums, bass' },
  { name: 'Optical Compressor (LA-2A-style)', category: 'dynamics', fingerprint: 'Smooth, slow, musical level-riding.', tells: 'Gentle, transparent gain reduction.', era: '1965–', typical_use: 'Vocals, bass' },
  { name: 'Vari-Mu Compressor (Fairchild-style)', category: 'dynamics', fingerprint: 'Thick, glue-y tube compression that fattens as it works.', tells: 'Dense, rounded transients; whole mixes "congeal".', era: '1959–', typical_use: 'Mix bus, vocals, drums' },
  { name: 'VCA Compressor (dbx-style)', category: 'dynamics', fingerprint: 'Fast, clean, aggressive level control.', tells: 'Tight, punchy, can pump audibly when pushed.', era: '1976–', typical_use: 'Drums, bass, bus' },
  // --- Distortion / drive ---
  { name: 'Tape Saturation', category: 'distortion', fingerprint: 'Warm, gentle compression + harmonic thickening.', tells: 'Softened transients, subtle high-end roll-off.', era: '—', typical_use: 'Mix glue, drums' },
  { name: 'Tube Amp Overdrive', category: 'distortion', fingerprint: 'Warm, dynamic, touch-sensitive valve breakup.', tells: 'Cleans up when you back off; sags and blooms.', era: '1950s–', typical_use: 'Electric guitar' },
  { name: 'Germanium Fuzz', category: 'distortion', fingerprint: 'Warm, woolly, spitty vintage fuzz.', tells: 'Gated "ripping" decay; interacts with guitar volume.', era: '1965–', typical_use: 'Psychedelic/blues guitar' },
  { name: 'Big Muff Fuzz', category: 'distortion', fingerprint: 'Huge, sustaining, scooped-mid wall of fuzz.', tells: 'Violin-like sustain; thick and saturated.', era: '1969–', typical_use: 'Lead/rhythm guitar, bass' },
  { name: 'Tube Screamer Overdrive', category: 'distortion', fingerprint: 'Mid-humped, smooth, compressed overdrive.', tells: 'Pushed mids, rolled-off lows and highs.', era: '1979–', typical_use: 'Blues/rock lead' },
  { name: 'Octave Fuzz', category: 'distortion', fingerprint: 'Fuzz with a ghostly octave-up ring.', tells: 'Glassy upper-octave on single notes above the 12th fret.', era: '1967–', typical_use: 'Psychedelic lead' },
  // --- Delay / echo ---
  { name: 'Analog Delay', category: 'delay', fingerprint: 'Warm, darkening repeats that degrade over time.', tells: 'Each echo duller than the last.', era: '1970s–', typical_use: 'Guitar, vocals, dub' },
  { name: 'Tape Echo', category: 'delay', fingerprint: 'Warm, wobbly repeats with flutter and saturation.', tells: 'Pitch wow on the repeats; self-oscillates into chaos.', era: '1959–', typical_use: 'Rockabilly, dub, lead guitar' },
  { name: 'Oil-Can / Drum Echo', category: 'delay', fingerprint: 'Smeared, swirling, ethereal multi-head echo.', tells: 'Dreamy, slightly out-of-time wash (Binson-style).', era: '1962–', typical_use: 'Psychedelic guitar, vocals' },
  { name: 'Slapback Echo', category: 'delay', fingerprint: 'A single short 80–150ms echo.', tells: 'One quick "doubling" repeat; rockabilly vocals/guitar.', era: '1954–', typical_use: 'Vocals, rockabilly guitar' },
  // --- Modulation ---
  { name: 'Chorus', category: 'modulation', fingerprint: 'Shimmery thickening / doubling.', tells: 'Wobbly, wide, "underwater" sheen.', era: '1970s–', typical_use: '80s guitar, synths' },
  { name: 'Flanger', category: 'modulation', fingerprint: 'Jet-plane sweeping comb filter.', tells: 'Whooshing sweep through the spectrum.', era: '1960s–', typical_use: 'Guitar, drums' },
  { name: 'Phaser', category: 'modulation', fingerprint: 'Swirling, hollow notch sweep.', tells: 'Gentler and more "vowel-like" than a flanger.', era: '1968–', typical_use: 'Guitar, Rhodes, synths' },
  { name: 'Rotary Speaker (Leslie)', category: 'modulation', fingerprint: 'Swirling Doppler from a physically spinning horn.', tells: 'Pitch + amplitude wobble that speeds up/slows down.', era: '1941–', typical_use: 'Organ, guitar, vocals' },
  { name: 'Uni-Vibe', category: 'modulation', fingerprint: 'Throbbing, watery, photocell phase/chorus.', tells: 'Hypnotic pulsing swirl (Hendrix/Floyd).', era: '1968–', typical_use: 'Psychedelic guitar' },
  { name: 'Tremolo', category: 'modulation', fingerprint: 'Rhythmic volume pulsing.', tells: 'Amplitude throb, no pitch change; surf/soul.', era: '1955–', typical_use: 'Guitar, Rhodes' },
  { name: 'Wah', category: 'modulation', fingerprint: 'Sweeping resonant filter, foot-controlled.', tells: 'Vocal "wah" vowel sweep; can be parked for tone.', era: '1966–', typical_use: 'Funk/rock guitar, clav' },
  // --- EQ ---
  { name: 'Parametric EQ', category: 'eq', fingerprint: 'Tonal sculpting; no obvious "effect".', tells: 'Inferred from spectral balance, not a sound itself.', era: '—', typical_use: 'Everything' },
  { name: 'Pultec-style EQ', category: 'eq', fingerprint: 'Smooth tube EQ; the famous "boost+cut" low-end trick.', tells: 'Adds silky air and round, thick lows.', era: '1951–', typical_use: 'Vocals, bass, mix bus' },
  { name: 'Console EQ (API-style)', category: 'eq', fingerprint: 'Punchy, musical proportional-Q console EQ.', tells: 'Forward, aggressive mids; "American" rock sound.', era: '1968–', typical_use: 'Drums, guitars' },
  // --- Pitch ---
  { name: 'Auto-Tune (audible)', category: 'pitch', fingerprint: 'Hard-quantized pitch with zero glide.', tells: 'Robotic instant note jumps.', era: '1998–', typical_use: 'Modern vocals' },
  // --- Source: keyboards / instruments ---
  { name: 'Hammond Organ', category: 'source-instrument', fingerprint: 'Drawbar tonewheel organ, usually through a Leslie.', tells: 'Key-click attack, percussion, chorused swell.', era: '1935–', typical_use: 'Rock, soul, jazz, gospel' },
  { name: 'Fender Rhodes Electric Piano', category: 'source-instrument', fingerprint: 'Bell-like, warm, slightly barking electric piano.', tells: 'Tine "bark" when struck hard; mellow and round soft.', era: '1965–', typical_use: 'Soul, jazz, fusion, ballads' },
  { name: 'Wurlitzer Electric Piano', category: 'source-instrument', fingerprint: 'Reedy, woody, gritty electric piano.', tells: 'Hollow bark with built-in growl; barks harder than a Rhodes.', era: '1954–', typical_use: 'Soul, rock, pop' },
  { name: 'Mellotron', category: 'source-instrument', fingerprint: 'Tape-replay choir/flute/strings, haunting and wobbly.', tells: 'Wow/flutter, 8-second note limit, lo-fi sample loops.', era: '1963–', typical_use: 'Prog, psychedelic, orchestral pads' },
  { name: 'Clavinet', category: 'source-instrument', fingerprint: 'Percussive, funky, twangy electro-mechanical clav.', tells: 'Sharp staccato pluck; the funk-guitar-of-keys.', era: '1964–', typical_use: 'Funk, soul, reggae' },
  { name: 'Acoustic Piano', category: 'source-instrument', fingerprint: 'Full-range acoustic grand/upright.', tells: 'Natural hammer attack and sustain pedal bloom.', era: '—', typical_use: 'Everything' },
  // --- Source: synths ---
  { name: 'Analog Poly Synth', category: 'source-synth', fingerprint: 'Warm, slightly detuned, fat oscillators.', tells: 'Gentle pitch drift, lush unison.', era: '1978–', typical_use: 'Pads, leads' },
  { name: 'Analog Monosynth (Moog-style)', category: 'source-synth', fingerprint: 'Fat, gutsy single-voice synth with a fat ladder filter.', tells: 'Thick bass/leads; portamento glide; one note at a time.', era: '1970–', typical_use: 'Prog leads, bass, fusion' },
  { name: 'Semi-Modular Synth', category: 'source-synth', fingerprint: 'Patchable, experimental, wide sonic range.', tells: 'Unusual evolving timbres; effects-y sound design.', era: '1971–', typical_use: 'Prog, experimental, soundtrack' },
  { name: 'String Machine', category: 'source-synth', fingerprint: 'Lush ensemble-chorus synthetic strings.', tells: 'Wide chorused pad, paraphonic, "fake strings" charm.', era: '1972–', typical_use: 'Prog, pop, disco pads' },
  // --- Microphones ---
  { name: 'Tube Condenser Mic (U47-style)', category: 'mic', fingerprint: 'Large, warm, flattering large-diaphragm tube mic.', tells: 'Silky top, weighty low-mids; the classic vocal sound.', era: '1949–', typical_use: 'Lead vocals, acoustic, brass' },
  { name: 'FET Condenser Mic (U87-style)', category: 'mic', fingerprint: 'Clean, detailed, versatile solid-state condenser.', tells: 'Neutral and present; the studio workhorse.', era: '1967–', typical_use: 'Vocals, everything' },
  { name: 'Dynamic Mic (SM57-style)', category: 'mic', fingerprint: 'Tough, mid-forward, handles high SPL.', tells: 'Punchy mids, rolled-off extremes; close-mic staple.', era: '1965–', typical_use: 'Guitar amps, snare, live' },
  { name: 'Ribbon Mic (RCA-style)', category: 'mic', fingerprint: 'Smooth, dark, vintage figure-8 ribbon.', tells: 'Rolled-off highs, big proximity; "old radio" warmth.', era: '1931–', typical_use: 'Brass, strings, guitar amps, vocals' },
  // --- Amplifiers ---
  { name: 'American Tube Combo (Fender-style)', category: 'amp', fingerprint: 'Clean, scooped, sparkly with lush spring reverb.', tells: 'Chimey cleans, tight lows; breaks up late.', era: '1952–', typical_use: 'Country, surf, blues, jazz' },
  { name: 'British Combo (Vox AC30-style)', category: 'amp', fingerprint: 'Chimey, jangly, midrange-rich top-boost.', tells: 'Bright "jangle" and creamy compressed breakup.', era: '1959–', typical_use: 'British invasion, indie' },
  { name: 'British Stack (Marshall Plexi-style)', category: 'amp', fingerprint: 'Crunchy, aggressive, midrange-forward rock roar.', tells: 'Singing midrange grind at volume.', era: '1965–', typical_use: 'Hard rock, classic rock' },
  // --- Utility ---
  { name: 'Multitrack Tape Machine', category: 'utility', fingerprint: 'Analog tape recorder — medium, not an effect per se.', tells: 'Imparts head-bump lows, wow/flutter, tape compression.', era: '1948–', typical_use: 'Tracking, mixdown, ADT/flanging' },
  // --- Genre deepening: Punk / Rock ---
  { name: 'Distortion Pedal (RAT-style)', category: 'distortion', fingerprint: 'Gritty, mid-rich hard-clipping distortion.', tells: 'Buzzsaw edge, more aggressive and compressed than overdrive.', era: '1978–', typical_use: 'Punk, alt, hard rock' },
  { name: 'Talk Box', category: 'modulation', fingerprint: 'Guitar/synth "talking" through a tube into the mouth.', tells: 'Vowel-shaped, mouth-formant vocal-guitar hybrid.', era: '1970s–', typical_use: 'Rock leads, funk' },
  { name: 'Solid-State Combo Amp', category: 'amp', fingerprint: 'Clean, loud, glassy transistor amp; tons of headroom.', tells: 'Pristine ultra-clean (JC-120 chorus) or harsh when clipped.', era: '1975–', typical_use: 'Post-punk, new wave, jazz' },
  // --- Genre deepening: Jazz sources ---
  { name: 'Double Bass (Upright)', category: 'source-instrument', fingerprint: 'Woody, round, acoustic upright bass.', tells: 'Finger thump and string buzz; the heartbeat of jazz.', era: '—', typical_use: 'Jazz, blues, folk' },
  { name: 'Vibraphone', category: 'source-instrument', fingerprint: 'Shimmering metallic mallet keyboard with motor vibrato.', tells: 'Bell-like sustain with a pulsing tremolo from spinning fans.', era: '1921–', typical_use: 'Jazz, lounge' },
  { name: 'Saxophone', category: 'source-instrument', fingerprint: 'Reedy, vocal, expressive brass woodwind.', tells: 'Breathy attack, growl, and wide vibrato.', era: '—', typical_use: 'Jazz, soul, rock' },
  { name: 'Trumpet', category: 'source-instrument', fingerprint: 'Bright, brassy, piercing or muted-mellow brass.', tells: 'Buzzy attack; Harmon-mute "wah" in cool jazz.', era: '—', typical_use: 'Jazz, soul, big band' },
  // --- Genre deepening: psych / prog / funk / fusion textures ---
  { name: 'Ring Modulator', category: 'modulation', fingerprint: 'Clangorous, metallic, inharmonic bell-tones.', tells: 'Atonal "robot"/Dalek timbres; sum-and-difference frequencies.', era: '1960s–', typical_use: 'Prog, Zappa, sound design' },
  { name: 'Envelope Filter / Auto-Wah', category: 'modulation', fingerprint: 'Touch-sensitive wah that opens with pick attack.', tells: 'Quacky, vowel-y funk that follows your dynamics.', era: '1972–', typical_use: 'Funk bass/clav/guitar' },
  { name: 'Pitch Harmonizer', category: 'pitch', fingerprint: 'Adds shifted/harmonized copies of the input.', tells: 'Detuned thickening or parallel-interval harmonies.', era: '1975–', typical_use: 'Fusion lead, 80s vocals/guitar' },
  { name: 'Vocoder', category: 'pitch', fingerprint: 'Voice imposed on a synth carrier — "robot singing".', tells: 'Talking-synth formants; consonants smeared.', era: '1970s–', typical_use: 'Funk, Kraftwerk, electro' },
  { name: 'Electric Sitar', category: 'source-instrument', fingerprint: 'Guitar with a buzzing "jawari" bridge mimicking a sitar.', tells: 'Sympathetic-string drone buzz on sustained notes.', era: '1967–', typical_use: 'Psychedelia, soul' },
  { name: 'Theremin', category: 'source-instrument', fingerprint: 'Touchless electronic wail controlled by hand proximity.', tells: 'Continuous gliding pitch with no attack; eerie.', era: '1928–', typical_use: 'Psychedelia, horror, novelty' },
  { name: 'Bass Amplifier', category: 'amp', fingerprint: 'High-headroom amp/cab voiced for electric bass.', tells: 'Round lows or grindy tube drive when pushed.', era: '1960s–', typical_use: 'Rock, funk, soul bass' },
  { name: 'EBow', category: 'utility', fingerprint: 'Handheld magnetic sustainer for guitar strings.', tells: 'Infinite, bowed, attack-less sustain.', era: '1976–', typical_use: 'Ambient, prog, art-rock leads' },
];

export const SEED_GEAR: Array<{ name: string; fxName: string; manufacturer: string; kind: string }> = [
  // Reverb
  { name: 'EMT 140', fxName: 'Plate Reverb', manufacturer: 'EMT', kind: 'hardware' },
  { name: 'Fender Reverb Unit 6G15', fxName: 'Spring Reverb', manufacturer: 'Fender', kind: 'hardware' },
  { name: 'EMT 240 Gold Foil', fxName: 'Plate Reverb', manufacturer: 'EMT', kind: 'hardware' },
  // Dynamics
  { name: 'Universal Audio 1176LN', fxName: 'FET Compressor (1176-style)', manufacturer: 'Universal Audio', kind: 'hardware' },
  { name: 'Teletronix LA-2A', fxName: 'Optical Compressor (LA-2A-style)', manufacturer: 'Teletronix', kind: 'hardware' },
  { name: 'Fairchild 660', fxName: 'Vari-Mu Compressor (Fairchild-style)', manufacturer: 'Fairchild', kind: 'hardware' },
  { name: 'dbx 160', fxName: 'VCA Compressor (dbx-style)', manufacturer: 'dbx', kind: 'hardware' },
  // EQ
  { name: 'Pultec EQP-1A', fxName: 'Pultec-style EQ', manufacturer: 'Pulse Techniques', kind: 'hardware' },
  { name: 'API 550A', fxName: 'Console EQ (API-style)', manufacturer: 'API', kind: 'hardware' },
  // Distortion / drive (pedals)
  { name: 'Dallas Arbiter Fuzz Face', fxName: 'Germanium Fuzz', manufacturer: 'Dallas Arbiter', kind: 'hardware' },
  { name: 'Maestro FZ-1 Fuzz-Tone', fxName: 'Germanium Fuzz', manufacturer: 'Maestro', kind: 'hardware' },
  { name: 'Electro-Harmonix Big Muff Pi', fxName: 'Big Muff Fuzz', manufacturer: 'Electro-Harmonix', kind: 'hardware' },
  { name: 'Ibanez TS808 Tube Screamer', fxName: 'Tube Screamer Overdrive', manufacturer: 'Ibanez', kind: 'hardware' },
  { name: 'Roger Mayer Octavia', fxName: 'Octave Fuzz', manufacturer: 'Roger Mayer', kind: 'hardware' },
  // Delay / echo
  { name: 'Maestro Echoplex EP-3', fxName: 'Tape Echo', manufacturer: 'Maestro', kind: 'hardware' },
  { name: 'Roland RE-201 Space Echo', fxName: 'Tape Echo', manufacturer: 'Roland', kind: 'hardware' },
  { name: 'Binson Echorec 2', fxName: 'Oil-Can / Drum Echo', manufacturer: 'Binson', kind: 'hardware' },
  // Modulation
  { name: 'Boss CE-1', fxName: 'Chorus', manufacturer: 'Boss', kind: 'hardware' },
  { name: 'MXR Phase 90', fxName: 'Phaser', manufacturer: 'MXR', kind: 'hardware' },
  { name: 'Leslie 122', fxName: 'Rotary Speaker (Leslie)', manufacturer: 'Leslie', kind: 'hardware' },
  { name: 'Shin-ei Uni-Vibe', fxName: 'Uni-Vibe', manufacturer: 'Shin-ei', kind: 'hardware' },
  { name: 'Dunlop Cry Baby', fxName: 'Wah', manufacturer: 'Dunlop', kind: 'hardware' },
  // Microphones
  { name: 'Neumann U47', fxName: 'Tube Condenser Mic (U47-style)', manufacturer: 'Neumann', kind: 'mic' },
  { name: 'Neumann U87', fxName: 'FET Condenser Mic (U87-style)', manufacturer: 'Neumann', kind: 'mic' },
  { name: 'AKG C12', fxName: 'Tube Condenser Mic (U47-style)', manufacturer: 'AKG', kind: 'mic' },
  { name: 'Shure SM57', fxName: 'Dynamic Mic (SM57-style)', manufacturer: 'Shure', kind: 'mic' },
  { name: 'RCA 44-BX', fxName: 'Ribbon Mic (RCA-style)', manufacturer: 'RCA', kind: 'mic' },
  // Amps
  { name: 'Fender Twin Reverb', fxName: 'American Tube Combo (Fender-style)', manufacturer: 'Fender', kind: 'amp' },
  { name: 'Fender Deluxe Reverb', fxName: 'American Tube Combo (Fender-style)', manufacturer: 'Fender', kind: 'amp' },
  { name: 'Vox AC30', fxName: 'British Combo (Vox AC30-style)', manufacturer: 'Vox', kind: 'amp' },
  { name: 'Marshall 1959 Super Lead Plexi', fxName: 'British Stack (Marshall Plexi-style)', manufacturer: 'Marshall', kind: 'amp' },
  // Keyboards / instruments
  { name: 'Hammond B-3', fxName: 'Hammond Organ', manufacturer: 'Hammond', kind: 'instrument' },
  { name: 'Fender Rhodes Mark I', fxName: 'Fender Rhodes Electric Piano', manufacturer: 'Fender', kind: 'instrument' },
  { name: 'Wurlitzer 200A', fxName: 'Wurlitzer Electric Piano', manufacturer: 'Wurlitzer', kind: 'instrument' },
  { name: 'Mellotron M400', fxName: 'Mellotron', manufacturer: 'Mellotron', kind: 'instrument' },
  { name: 'Hohner Clavinet D6', fxName: 'Clavinet', manufacturer: 'Hohner', kind: 'instrument' },
  // Synths
  { name: 'Roland Juno-106', fxName: 'Analog Poly Synth', manufacturer: 'Roland', kind: 'synth' },
  { name: 'Moog Minimoog Model D', fxName: 'Analog Monosynth (Moog-style)', manufacturer: 'Moog', kind: 'synth' },
  { name: 'ARP 2600', fxName: 'Semi-Modular Synth', manufacturer: 'ARP', kind: 'synth' },
  // Tape
  { name: 'Studer A800', fxName: 'Multitrack Tape Machine', manufacturer: 'Studer', kind: 'hardware' },
  { name: 'Ampex ATR-102', fxName: 'Multitrack Tape Machine', manufacturer: 'Ampex', kind: 'hardware' },
  // Pitch
  { name: 'Antares Auto-Tune', fxName: 'Auto-Tune (audible)', manufacturer: 'Antares', kind: 'plugin' },
  // Genre deepening — Jazz recording chain + sources
  { name: 'Neumann U67', fxName: 'Tube Condenser Mic (U47-style)', manufacturer: 'Neumann', kind: 'mic' },
  { name: 'Telefunken ELA M 251', fxName: 'Tube Condenser Mic (U47-style)', manufacturer: 'Telefunken', kind: 'mic' },
  { name: 'RCA 77-DX', fxName: 'Ribbon Mic (RCA-style)', manufacturer: 'RCA', kind: 'mic' },
  { name: 'Kay M-1 Upright Bass', fxName: 'Double Bass (Upright)', manufacturer: 'Kay', kind: 'instrument' },
  { name: 'Selmer Mark VI Saxophone', fxName: 'Saxophone', manufacturer: 'Selmer', kind: 'instrument' },
  { name: 'Deagan Vibraphone', fxName: 'Vibraphone', manufacturer: 'Deagan', kind: 'instrument' },
  { name: 'Bach Stradivarius Trumpet', fxName: 'Trumpet', manufacturer: 'Bach', kind: 'instrument' },
  // Genre deepening — Punk / Rock amps & dirt
  { name: 'ProCo RAT', fxName: 'Distortion Pedal (RAT-style)', manufacturer: 'ProCo', kind: 'hardware' },
  { name: 'Roland JC-120 Jazz Chorus', fxName: 'Solid-State Combo Amp', manufacturer: 'Roland', kind: 'amp' },
  { name: 'Orange OR120', fxName: 'British Stack (Marshall Plexi-style)', manufacturer: 'Orange', kind: 'amp' },
  { name: 'Hiwatt Custom 100 DR103', fxName: 'British Stack (Marshall Plexi-style)', manufacturer: 'Hiwatt', kind: 'amp' },
  { name: 'Fender Bassman', fxName: 'American Tube Combo (Fender-style)', manufacturer: 'Fender', kind: 'amp' },
  { name: 'Heil Talk Box', fxName: 'Talk Box', manufacturer: 'Heil Sound', kind: 'hardware' },
  // Genre deepening — psych/prog/funk/fusion units
  { name: 'Maestro Ring Modulator', fxName: 'Ring Modulator', manufacturer: 'Maestro', kind: 'hardware' },
  { name: 'Mu-Tron III', fxName: 'Envelope Filter / Auto-Wah', manufacturer: 'Musitronics', kind: 'hardware' },
  { name: 'Eventide H910 Harmonizer', fxName: 'Pitch Harmonizer', manufacturer: 'Eventide', kind: 'hardware' },
  { name: 'Roland VP-330 Vocoder Plus', fxName: 'Vocoder', manufacturer: 'Roland', kind: 'synth' },
  { name: 'Electro-Harmonix Electric Mistress', fxName: 'Flanger', manufacturer: 'Electro-Harmonix', kind: 'hardware' },
  { name: 'Sola Sound Tone Bender MkII', fxName: 'Germanium Fuzz', manufacturer: 'Sola Sound', kind: 'hardware' },
  { name: 'Coral Electric Sitar', fxName: 'Electric Sitar', manufacturer: 'Coral', kind: 'instrument' },
  { name: 'Moog Etherwave Theremin', fxName: 'Theremin', manufacturer: 'Moog', kind: 'instrument' },
  { name: 'Sequential Prophet-5', fxName: 'Analog Poly Synth', manufacturer: 'Sequential Circuits', kind: 'synth' },
  { name: 'Oberheim OB-Xa', fxName: 'Analog Poly Synth', manufacturer: 'Oberheim', kind: 'synth' },
  { name: 'ARP Odyssey', fxName: 'Analog Monosynth (Moog-style)', manufacturer: 'ARP', kind: 'synth' },
  { name: 'EMS Synthi AKS', fxName: 'Semi-Modular Synth', manufacturer: 'EMS', kind: 'synth' },
  { name: 'ARP/Eminent Solina String Ensemble', fxName: 'String Machine', manufacturer: 'ARP', kind: 'synth' },
  { name: 'Ampeg SVT', fxName: 'Bass Amplifier', manufacturer: 'Ampeg', kind: 'amp' },
  { name: 'Acoustic 360', fxName: 'Bass Amplifier', manufacturer: 'Acoustic', kind: 'amp' },
  { name: 'Sennheiser MD 421', fxName: 'Dynamic Mic (SM57-style)', manufacturer: 'Sennheiser', kind: 'mic' },
  { name: 'Coles 4038', fxName: 'Ribbon Mic (RCA-style)', manufacturer: 'Coles', kind: 'mic' },
];

export const SEED_SOUNDS: Array<{ name: string; description: string; chainFxNames: string[] }> = [
  { name: '80s gated-reverb snare', description: 'Huge snare with an abruptly cut reverb tail.', chainFxNames: ['Plate Reverb', 'Parametric EQ'] },
  { name: 'Dub delay throw', description: 'A word/snare flung into degrading echoes.', chainFxNames: ['Analog Delay', 'Spring Reverb'] },
  { name: 'Modern pop vocal', description: 'Up-front, pitch-perfect, tightly controlled vocal.', chainFxNames: ['Auto-Tune (audible)', 'FET Compressor (1176-style)', 'Plate Reverb'] },
  { name: 'Hendrix psychedelic lead', description: 'Singing, swirling, fuzzed-out lead guitar.', chainFxNames: ['Germanium Fuzz', 'Octave Fuzz', 'Uni-Vibe', 'British Stack (Marshall Plexi-style)'] },
  { name: 'Surf guitar twang', description: 'Wet, drippy, tremolo-pulsed clean guitar.', chainFxNames: ['Spring Reverb', 'Tremolo', 'American Tube Combo (Fender-style)'] },
  { name: 'Hammond + Leslie swell', description: 'Soulful drawbar organ whirling through a rotating cabinet.', chainFxNames: ['Hammond Organ', 'Rotary Speaker (Leslie)'] },
  { name: 'Floyd echo lead', description: 'Dreamy, smeared, repeating lead guitar in deep space.', chainFxNames: ['Oil-Can / Drum Echo', 'Tube Amp Overdrive'] },
  { name: 'Motown / soul lead vocal', description: 'Warm, intimate, beautifully level-ridden vocal.', chainFxNames: ['Tube Condenser Mic (U47-style)', 'Optical Compressor (LA-2A-style)', 'Plate Reverb'] },
  { name: 'Intimate folk fingerstyle', description: 'Close, woody, natural fingerpicked acoustic.', chainFxNames: ['Ribbon Mic (RCA-style)', 'Chamber Reverb'] },
  { name: 'Beatles ADT / tape flange', description: 'Doubled, swirling vocal/instrument from manipulated tape.', chainFxNames: ['Multitrack Tape Machine', 'Flanger'] },
  { name: 'British-invasion jangle', description: 'Bright, chiming, compressed clean rhythm guitar.', chainFxNames: ['British Combo (Vox AC30-style)', 'Chorus'] },
  { name: 'Funk clav', description: 'Percussive, wah-swept, syncopated keyboard riffing.', chainFxNames: ['Clavinet', 'Wah'] },
  { name: 'Prog Mellotron pad', description: 'Haunting tape-choir/strings bed under a band.', chainFxNames: ['Mellotron', 'Hall Reverb'] },
  { name: 'Punk wall of guitar', description: 'Loud, saturated, midrange-roaring rhythm guitar.', chainFxNames: ['British Stack (Marshall Plexi-style)', 'Big Muff Fuzz'] },
  // Genre deepening — Jazz / Punk / Rock
  { name: 'Blue Note jazz combo', description: 'Warm, intimate, naturally-recorded small-group jazz.', chainFxNames: ['Tube Condenser Mic (U47-style)', 'Plate Reverb'] },
  { name: 'Bebop horn section', description: 'Bright, brassy horns with smooth vintage air.', chainFxNames: ['Ribbon Mic (RCA-style)', 'Chamber Reverb'] },
  { name: 'Upright bass + brushes', description: 'Woody walking bass under softly-swept brushed drums.', chainFxNames: ['Double Bass (Upright)', 'Ribbon Mic (RCA-style)'] },
  { name: 'Punk buzzsaw guitar', description: 'Fast, raw, mid-forward distorted downstrokes.', chainFxNames: ['British Stack (Marshall Plexi-style)', 'Distortion Pedal (RAT-style)'] },
  { name: 'Post-punk clean chime', description: 'Glassy, chorused, ultra-clean solid-state guitar.', chainFxNames: ['Solid-State Combo Amp', 'Chorus'] },
  { name: 'Talk-box solo', description: 'A guitar/synth made to "talk" with mouth-shaped vowels.', chainFxNames: ['Talk Box', 'British Stack (Marshall Plexi-style)'] },
  { name: 'Garage-rock fuzz', description: 'Raw, jangly, fuzzed-out British-combo rhythm.', chainFxNames: ['Germanium Fuzz', 'British Combo (Vox AC30-style)'] },
  // Genre deepening — psych / prog / funk / fusion signatures
  { name: 'Funk envelope bass', description: 'Quacky, dynamic, auto-wah-swept electric bass.', chainFxNames: ['Envelope Filter / Auto-Wah', 'Bass Amplifier'] },
  { name: 'Psychedelic sitar drone', description: 'Buzzing, droning, raga-tinged psychedelic guitar.', chainFxNames: ['Electric Sitar', 'Spring Reverb'] },
  { name: 'Theremin séance', description: 'Eerie, gliding, attack-less electronic wail.', chainFxNames: ['Theremin', 'Hall Reverb'] },
  { name: 'Prog ring-mod stab', description: 'Clangorous, metallic, atonal keyboard/guitar texture.', chainFxNames: ['Ring Modulator', 'Phaser'] },
  { name: 'Fusion harmonized lead', description: 'Singing fusion guitar thickened with shifted harmonies.', chainFxNames: ['Pitch Harmonizer', 'Tube Amp Overdrive'] },
  { name: 'Vocoder robot vocal', description: 'A talking synthesizer — voice riding a synth carrier.', chainFxNames: ['Vocoder', 'Analog Poly Synth'] },
  { name: 'EBow art-rock sustain', description: 'Infinite bowed-guitar sustain over a wash.', chainFxNames: ['EBow', 'Analog Delay'] },
  // Song breakdowns — iconic tracks decomposed into their production chains
  { name: "Tomorrow Never Knows — The Beatles", description: "Lennon's vocal fed through a rotating Leslie cabinet over tape-loop collage and Abbey Road's prized tube limiters (1966).", chainFxNames: ['Rotary Speaker (Leslie)', 'Multitrack Tape Machine', 'Vari-Mu Compressor (Fairchild-style)'] },
  { name: "London Calling — The Clash", description: "Strummer's Telecaster into a Fender combo with Mick Jones' tape-echo throws; Wessex Studios, Bill Price engineering (1979).", chainFxNames: ['American Tube Combo (Fender-style)', 'Tape Echo'] },
  { name: "Riders on the Storm — The Doors", description: "Manzarek's Fender Rhodes electric piano, Krieger's blackface Fender combo, and a wash of spring reverb under whispered, doubled vocals (1971).", chainFxNames: ['Fender Rhodes Electric Piano', 'American Tube Combo (Fender-style)', 'Spring Reverb'] },
  { name: "Zappa lead guitar (Zoot Allures era)", description: "Frank Zappa's singing lead tone — racked, heavily-modified Big Muffs into pushed tube amps with analog delay (mid-70s).", chainFxNames: ['Big Muff Fuzz', 'Tube Amp Overdrive', 'Analog Delay'] },
  { name: "Don't Come Around Here No More — Tom Petty", description: "Psychedelic Dave Stewart production: an electric-sitar hook against gritty RAT distortion (1985).", chainFxNames: ['Electric Sitar', 'Distortion Pedal (RAT-style)'] },
  { name: "Trout Mask Replica — Captain Beefheart", description: "The Magic Band's bone-dry, interlocking twin guitars and bass — rented Fender Twin Reverb and a Bassman, almost no studio sweetening (1969).", chainFxNames: ['American Tube Combo (Fender-style)', 'Bass Amplifier'] },
  { name: "Voodoo Child (Slight Return) — Jimi Hendrix", description: "Wah-drenched Strat through a germanium fuzz into cranked British stacks (1968).", chainFxNames: ['Wah', 'Germanium Fuzz', 'British Stack (Marshall Plexi-style)'] },
  { name: "Shine On You Crazy Diamond — Pink Floyd", description: "Gilmour's keening sustain: a Big Muff and Binson-style multi-head echo into clean, loud Hiwatt-class stacks (1975).", chainFxNames: ['Big Muff Fuzz', 'Oil-Can / Drum Echo', 'British Stack (Marshall Plexi-style)'] },
];

export const SEED_IDENTIFY: Array<{ key: string; question: string; branches: Array<{ answer: string; next: string }>; leafFxNames: string[]; explanation: string }> = [
  { key: 'root', question: 'What is the dominant character of the effect?', branches: [
    { answer: 'space / ambience', next: 'space' },
    { answer: 'repeats / echo', next: 'echo' },
    { answer: 'movement / modulation', next: 'mod' },
    { answer: 'dirt / distortion', next: 'dirt' },
  ], leafFxNames: [], explanation: '' },
  // Space
  { key: 'space', question: 'Short & metallic, long & washy, boingy/drippy, or a real-room feel?', branches: [
    { answer: 'short metallic', next: 'plate' },
    { answer: 'long washy', next: 'hall' },
    { answer: 'boingy / drippy', next: 'spring' },
    { answer: 'real room', next: 'chamber' },
  ], leafFxNames: [], explanation: '' },
  { key: 'plate', question: '', branches: [], leafFxNames: ['Plate Reverb'], explanation: 'Fast bright metallic decay with no distinct echoes points to a plate reverb.' },
  { key: 'hall', question: '', branches: [], leafFxNames: ['Hall Reverb'], explanation: 'A long, slow, diffuse wash points to a hall reverb.' },
  { key: 'spring', question: '', branches: [], leafFxNames: ['Spring Reverb'], explanation: 'A drippy "sproing", especially on a guitar amp, is a spring reverb.' },
  { key: 'chamber', question: '', branches: [], leafFxNames: ['Chamber Reverb'], explanation: 'A dense, three-dimensional real-room sound is an echo chamber.' },
  // Echo
  { key: 'echo', question: 'Wobbly & saturated, smeared & swirling, or one quick slap?', branches: [
    { answer: 'wobbly / saturated', next: 'tapeecho' },
    { answer: 'smeared / swirling', next: 'oilcan' },
    { answer: 'one quick slap', next: 'slap' },
  ], leafFxNames: [], explanation: '' },
  { key: 'tapeecho', question: '', branches: [], leafFxNames: ['Tape Echo'], explanation: 'Warm repeats with pitch wow/flutter are a tape echo (Echoplex/Space Echo).' },
  { key: 'oilcan', question: '', branches: [], leafFxNames: ['Oil-Can / Drum Echo'], explanation: 'A dreamy, smeared multi-head swirl is a Binson-style drum/oil-can echo.' },
  { key: 'slap', question: '', branches: [], leafFxNames: ['Slapback Echo'], explanation: 'A single short doubling repeat is slapback echo.' },
  // Modulation
  { key: 'mod', question: 'Swirling/whooshing, throbbing volume, or spinning Doppler?', branches: [
    { answer: 'swirling / whooshing', next: 'phaser' },
    { answer: 'throbbing volume', next: 'trem' },
    { answer: 'spinning doppler', next: 'leslie' },
  ], leafFxNames: [], explanation: '' },
  { key: 'phaser', question: '', branches: [], leafFxNames: ['Phaser'], explanation: 'A hollow, vowel-like notch sweep is a phaser (a harsher jet-sweep is a flanger).' },
  { key: 'trem', question: '', branches: [], leafFxNames: ['Tremolo'], explanation: 'Rhythmic volume pulsing with no pitch change is tremolo.' },
  { key: 'leslie', question: '', branches: [], leafFxNames: ['Rotary Speaker (Leslie)'], explanation: 'Pitch + amplitude swirl that accelerates/decelerates is a rotating Leslie speaker.' },
  // Dirt
  { key: 'dirt', question: 'Woolly/spitty fuzz, huge sustaining wall, or warm amp-like grit?', branches: [
    { answer: 'woolly / spitty', next: 'fuzz' },
    { answer: 'huge sustain', next: 'muff' },
    { answer: 'warm amp grit', next: 'odrive' },
  ], leafFxNames: [], explanation: '' },
  { key: 'fuzz', question: '', branches: [], leafFxNames: ['Germanium Fuzz'], explanation: 'Woolly, gated, volume-sensitive fuzz is a germanium fuzz (Fuzz Face-style).' },
  { key: 'muff', question: '', branches: [], leafFxNames: ['Big Muff Fuzz'], explanation: 'A huge, scooped, violin-sustain wall is a Big Muff-style fuzz.' },
  { key: 'odrive', question: '', branches: [], leafFxNames: ['Tube Amp Overdrive'], explanation: 'Warm, dynamic, touch-sensitive grit that cleans up with guitar volume is tube-amp overdrive.' },
];
