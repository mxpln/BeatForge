/* Public LivePilot reference reader. These are programmed examples, never recordings. */
(() => {
  'use strict';
  const revision = '76a860a45224c59a5aaefb0f73adcc083d7bd07b';
  const base = `https://raw.githubusercontent.com/dreamrec/LivePilot/${revision}/`;
  const sources = {
    manual: base + 'docs/manual/midi-guide.md',
    recipes: base + 'livepilot/skills/livepilot-core/references/midi-recipes.md',
  };
  const genreRoot = 'https://raw.githubusercontent.com/dreamrec/LivePilot/main/livepilot/skills/livepilot-core/references/concepts/genres/';
  const genreFiles = [
    'ambient.yaml', 'boom_bap.yaml', 'deep-minimal.yaml', 'deep_house.yaml',
    'detroit_techno.yaml', 'disco.yaml', 'downtempo.yaml', 'drone.yaml',
    'drum-and-bass.yaml', 'dub-techno.yaml', 'dub.yaml', 'dubstep.yaml',
    'experimental.yaml', 'footwork.yaml', 'hip-hop.yaml', 'house.yaml',
    'hyperpop.yaml', 'idm.yaml', 'lo_fi.yaml', 'microhouse.yaml',
    'minimal-techno.yaml', 'modern-classical.yaml', 'soul.yaml',
    'synthwave.yaml', 'techno.yaml', 'trap.yaml', 'uk-garage.yaml',
  ];
  const cloneGrid = () => Array.from({ length: 6 }, () => Array(16).fill(null));
  const fromPitch = (pitch) => {
    if ([35, 36].includes(pitch)) return 0;
    if ([37, 38, 39, 40].includes(pitch)) return 1;
    if ([22, 42, 44].includes(pitch)) return 2;
    if ([26, 46].includes(pitch)) return 3;
    if ([41, 43, 45, 47, 48, 50, 58].includes(pitch)) return 4;
    if ([49, 51, 52, 53, 54, 55, 56, 57, 59, 75].includes(pitch)) return 5;
    return -1;
  };
  function section(markdown, prefix) {
    const lines = markdown.split('\n');
    const at = lines.findIndex(line => line.startsWith('### ' + prefix));
    if (at < 0) return '';
    const next = lines.findIndex((line, i) => i > at && /^(## |### )/.test(line));
    return lines.slice(at, next < 0 ? lines.length : next).join('\n');
  }
  function manualPattern(text) {
    const match = text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!match) return null;
    let notes;
    try { notes = JSON.parse(match[1]); } catch (_) { return null; }
    if (!Array.isArray(notes)) return null;
    const grid = cloneGrid();
    for (const entry of notes) {
      const lane = fromPitch(Number(entry.pitch));
      const start = Number(entry.start_time);
      if (lane < 0 || !Number.isFinite(start) || start < 0 || start >= 4) continue;
      const step = Math.max(0, Math.min(15, Math.round(start * 4)));
      const hit = {
        velocity: Math.max(1, Math.min(127, Number(entry.velocity) || 100)),
        probability: Math.max(0, Math.min(1, Number(entry.probability ?? 1))),
        micro: Math.max(-.125, Math.min(.125, start - step / 4)),
        duration: Math.max(.05, Number(entry.duration) || .15),
      };
      if ([39, 40, 54, 56, 75].includes(Number(entry.pitch))) hit.pitch = Number(entry.pitch);
      if (!grid[lane][step] || hit.velocity >= grid[lane][step].velocity) grid[lane][step] = hit;
    }
    return grid;
  }
  function recipeGrid(text) {
    const match = text.match(/```\s*\n([\s\S]*?)\n```/);
    if (!match) return null;
    const grid = cloneGrid();
    for (const line of match[1].split('\n')) {
      const row = line.match(/^\s*(Kick|Snare|CHH|OHH):\s*(.+)$/i);
      if (!row) continue;
      const lane = { kick: 0, snare: 1, chh: 2, ohh: 3 }[row[1].toLowerCase()];
      const symbols = (row[2].split('(')[0].match(/[Xx.]/g) || []).slice(0, 16);
      if (symbols.length < 8) continue;
      symbols.forEach((symbol, step) => {
        if (symbol === '.') return;
        grid[lane][step] = { velocity: symbol === 'x' ? 62 : [114, 107, 78, 82][lane], probability: 1, micro: 0, duration: lane === 3 ? .36 : .14 };
      });
    }
    return grid;
  }
  function countHits(grid) { return grid?.flat().filter(Boolean).length || 0; }
  function parseSources(manual, recipes) {
    const found = [];
    const manualSet = [
      ['house', 'House / Techno', 'House / Techno', 126, 4],
      ['boombap', 'Boom Bap', 'Hip-Hop / Boom Bap', 90, 22],
      ['trap', 'Trap', 'Trap (', 145, 5],
      ['dnb', 'Drum & Bass', 'Drum and Bass', 174, 3],
      ['minimal', 'Minimal', 'Minimal / Rominimal', 125, 3],
    ];
    const recipeSet = [
      ['disco', 'Four-on-the-floor / Disco', 'Four-on-the-floor', 122, 3],
      ['hiphop', 'Boom Bap / Hip-Hop', 'Boom Bap', 92, 22],
      ['trap-recipes', 'Trap / Hi-Hats', 'Trap', 142, 5],
      ['breakbeat', 'Breakbeat / Jungle', 'Breakbeat', 174, 3],
      ['reggaeton', 'Reggaeton / Dembow', 'Reggaeton / Dembow', 94, 3],
    ];
    if (manual) for (const [key, label, heading, bpm, swing] of manualSet) {
      const grid = manualPattern(section(manual, heading));
      if (countHits(grid)) found.push({ key: 'manual-' + key, label: 'Manual · ' + label, grid, bpm, swing, document: 'MIDI Programming Guide' });
    }
    if (recipes) for (const [key, label, heading, bpm, swing] of recipeSet) {
      const grid = recipeGrid(section(recipes, heading));
      if (countHits(grid)) found.push({ key: 'recipes-' + key, label: 'Recipes · ' + label, grid, bpm, swing, document: 'MIDI Recipes' });
    }
    return found;
  }
  async function fetchRecipes() {
    const received = await Promise.allSettled(Object.values(sources).map(async url => {
      const response = await fetch(url, { mode: 'cors', cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    }));
    const manual = received[0].status === 'fulfilled' ? received[0].value : '';
    const recipes = received[1].status === 'fulfilled' ? received[1].value : '';
    const patterns = parseSources(manual, recipes);
    if (!patterns.length) throw new Error('LivePilot documents could not be fetched or parsed; try again later.');
    return { patterns, sources: { manual: Boolean(manual), recipes: Boolean(recipes) }, revision };
  }
  function yamlScalar(text, field) {
    const found = text.match(new RegExp('^' + field + ':\\s*(.*)$', 'm'));
    return found ? found[1].trim().replace(/^["']|["']$/g, '') : '';
  }
  function yamlSection(text, field) {
    const lines = text.split('\n');
    const start = lines.findIndex(line => line.trim() === field + ':');
    if (start < 0) return '';
    const end = lines.findIndex((line, i) => i > start && /^[A-Za-z_][\w-]*:/.test(line));
    return lines.slice(start + 1, end < 0 ? lines.length : end).join('\n');
  }
  function parseGenreConcept(content, filename) {
    const tempo = yamlSection(content, 'tempo_hint');
    const min = Number((tempo.match(/^\s+min:\s*(\d+)/m) || [])[1]);
    const max = Number((tempo.match(/^\s+max:\s*(\d+)/m) || [])[1]);
    const rawIdioms = yamlSection(content, 'rhythm_idioms');
    const idioms = [...rawIdioms.matchAll(/^\s+-\s+(.+)$/gm)].map(match => match[1].trim().replace(/^['"]|['"]$/g, '')).slice(0, 7);
    const name = yamlScalar(content, 'name') || filename.replace(/\.yaml$/, '').replace(/[-_]/g, ' ');
    return {
      id: yamlScalar(content, 'id') || filename.replace(/\.yaml$/, ''),
      name, filename, tempoMin: Number.isFinite(min) ? min : 70,
      tempoMax: Number.isFinite(max) ? max : 140,
      meter: (tempo.match(/^\s+time_signature:\s*['"]?([^\s'"]+)/m) || [])[1] || '4/4',
      idioms,
    };
  }
  async function fetchGenreConcepts() {
    const responses = await Promise.allSettled(genreFiles.map(async filename => {
      const response = await fetch(genreRoot + filename, { mode: 'cors', cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return parseGenreConcept(await response.text(), filename);
    }));
    const liveGenres = responses.filter(x => x.status === 'fulfilled').map(x => x.value);
    const byId = new Map();
    if (liveGenres.length < genreFiles.length) {
      try {
        const fallback = await fetch('./livepilot-catalog.json');
        if (fallback.ok) {
          const data = await fallback.json();
          for (const item of data.genres || []) byId.set(item.id, { ...item, meter: '4/4', idioms: [], fallback: true });
        }
      } catch (_) { /* Optional local facts-only catalog. */ }
    }
    for (const item of liveGenres) byId.set(item.id, { ...item, fallback: false });
    const genres = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (!genres.length) throw new Error('The public LivePilot genre catalog could not be loaded.');
    return { genres, attempted: genreFiles.length, fetchedLive: liveGenres.length };
  }
  window.BeatForgeLivePilot = { fetchRecipes, fetchGenreConcepts, parseSources, parseGenreConcept, sources, genreRoot };
})();
