import type Database from 'better-sqlite3';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (userId: string, db: Database.Database) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-step',
    name: 'First Step',
    description: 'Perform your first classification',
    icon: '🎵',
    check: (userId, db) => {
      const row = db.prepare("SELECT COUNT(*) as c FROM api_usage WHERE user_id = ? AND endpoint = 'classify'").get(userId) as { c: number };
      return row.c >= 1;
    },
  },
  {
    id: 'triad-hunter',
    name: 'Triad Hunter',
    description: 'Classify 10 pitch-class sets',
    icon: '🔺',
    check: (userId, db) => {
      const row = db.prepare("SELECT COUNT(*) as c FROM api_usage WHERE user_id = ? AND endpoint = 'classify'").get(userId) as { c: number };
      return row.c >= 10;
    },
  },
  {
    id: 'symmetry-nerd',
    name: 'Symmetry Nerd',
    description: 'Classify sets from each cardinality 2 through 8',
    icon: '🔬',
    check: (userId, db) => {
      try {
        const rows = db.prepare("SELECT DISTINCT json_array_length(pitch_classes) as card FROM analysis_history WHERE user_id = ? AND type = 'classify'").all(userId) as { card: number }[];
        const cards = new Set(rows.map(r => r.card));
        for (let c = 2; c <= 8; c++) {
          if (!cards.has(c)) return false;
        }
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    id: 'centurion',
    name: 'Centurion',
    description: '100 total classifications',
    icon: '💯',
    check: (userId, db) => {
      const row = db.prepare("SELECT COUNT(*) as c FROM api_usage WHERE user_id = ? AND endpoint = 'classify'").get(userId) as { c: number };
      return row.c >= 100;
    },
  },
  {
    id: 'file-analyst',
    name: 'File Analyst',
    description: 'Analyze your first audio or MIDI file',
    icon: '📁',
    check: (userId, db) => {
      const row = db.prepare("SELECT COUNT(*) as c FROM api_usage WHERE user_id = ? AND endpoint = 'analyze'").get(userId) as { c: number };
      return row.c >= 1;
    },
  },
  {
    id: 'chord-whisperer',
    name: 'Chord Whisperer',
    description: 'Perform 5 chord identifications',
    icon: '🎹',
    check: (userId, db) => {
      const row = db.prepare("SELECT COUNT(*) as c FROM api_usage WHERE user_id = ? AND endpoint = 'classify'").get(userId) as { c: number };
      return row.c >= 5;
    },
  },
  {
    id: 'z-twin-finder',
    name: 'Z-Twin Finder',
    description: 'Classify both sets in a Z-related pair',
    icon: '🧬',
    check: (userId, db) => {
      try {
        const Z_PAIRS: [string, string][] = [
          ['4-Z15', '4-Z29'],
          ['5-Z12', '5-Z36'],
          ['5-Z17', '5-Z37'],
          ['5-Z18', '5-Z38'],
          ['6-Z3', '6-Z36'],
          ['6-Z4', '6-Z37'],
          ['6-Z6', '6-Z38'],
          ['6-Z10', '6-Z39'],
          ['6-Z11', '6-Z40'],
          ['6-Z12', '6-Z41'],
          ['6-Z13', '6-Z42'],
          ['6-Z17', '6-Z43'],
          ['6-Z19', '6-Z44'],
          ['6-Z23', '6-Z45'],
          ['6-Z24', '6-Z46'],
          ['6-Z25', '6-Z47'],
          ['6-Z26', '6-Z48'],
          ['6-Z28', '6-Z49'],
          ['6-Z29', '6-Z50'],
        ];
        const rows = db.prepare("SELECT DISTINCT forte FROM analysis_history WHERE user_id = ? AND forte IS NOT NULL").all(userId) as { forte: string }[];
        const forteSet = new Set(rows.map(r => r.forte));
        return Z_PAIRS.some(([a, b]) => forteSet.has(a) && forteSet.has(b));
      } catch {
        return false;
      }
    },
  },
  {
    id: 'week-streak',
    name: 'Week Streak',
    description: 'Use the app 7 days in a row',
    icon: '🔥',
    check: (userId, db) => {
      const rows = db.prepare(`
        SELECT DISTINCT date(timestamp) as day
        FROM api_usage
        WHERE user_id = ?
        ORDER BY day DESC
        LIMIT 14
      `).all(userId) as { day: string }[];

      if (rows.length < 7) return false;

      // Check for 7 consecutive days
      for (let i = 0; i <= rows.length - 7; i++) {
        let streak = true;
        for (let j = 0; j < 6; j++) {
          const d1 = new Date(rows[i + j].day);
          const d2 = new Date(rows[i + j + 1].day);
          const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays !== 1) {
            streak = false;
            break;
          }
        }
        if (streak) return true;
      }
      return false;
    },
  },
  {
    id: 'atlas-explorer',
    name: 'Atlas Explorer',
    description: 'Perform 20 or more classifications',
    icon: '🗺️',
    check: (userId, db) => {
      const row = db.prepare("SELECT COUNT(*) as c FROM api_usage WHERE user_id = ? AND endpoint = 'classify'").get(userId) as { c: number };
      return row.c >= 20;
    },
  },
  {
    id: 'quiz-ace',
    name: 'Quiz Ace',
    description: 'Score 100% on a quiz',
    icon: '🏆',
    check: (_userId, _db) => {
      // Stub: quiz tracking not yet wired
      return false;
    },
  },
  {
    id: 'research-mode',
    name: 'Research Mode',
    description: 'Export your first analysis as a LaTeX report',
    icon: '📄',
    check: (_userId, _db) => {
      // Stub: LaTeX export is client-side only, not yet tracked via API
      return false;
    },
  },
  {
    id: 'power-user',
    name: 'Power User',
    description: '500 total API calls across all endpoints',
    icon: '⚡',
    check: (userId, db) => {
      const row = db.prepare("SELECT COUNT(*) as c FROM api_usage WHERE user_id = ?").get(userId) as { c: number };
      return row.c >= 500;
    },
  },
];
