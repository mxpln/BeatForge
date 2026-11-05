(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const tracks = [
    { name: 'Kick', pitch: 36, color: '#ff816f' },
    { name: 'Snare / Clap', pitch: 38, color: '#ffc47e' },
    { name: 'Closed Hat', pitch: 42, color: '#b7fb82' },
    { name: 'Open Hat', pitch: 46, color: '#6ce0cd' },
    { name: 'Toms', pitch: 47, color: '#bcaffb' },
    { name: 'Cymbals', pitch: 49, color: '#f291c3' },
  ];
  const datasetURL = 'https://storage.googleapis.com/magentadata/datasets/groove/groove-v1.0.0-midionly.zip';
  const STEPS = 16;
  const freshPattern = () => tracks.map(() => Array(STEPS).fill(null));
  const copyNote = (note) => note ? { ...note } : null;
  const copyPattern = (grid) => grid.map((row) => row.map(copyNote));
  const note = (velocity = 100, probability = 1, micro = 0, duration = 0.15) => ({ velocity, probability, micro, duration });
  const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
  const choose = (items) => items[Math.floor(Math.random() * items.length)];
  const round = (x, places = 3) => Number(x.toFixed(places));

  let pattern = freshPattern();
  let corpus = [];
  let livePilotRecipes = [];
  let livePilotGenres = [];
  let livePilotGenreFetched = 0;
  let filesAnalyzed = 0;
  let selected = null;
  let sourceKind = 'guide';
  let currentStep = -1;
  let playing = false;
  let audioContext = null, audioOutput = null, noiseBuffer = null;
  let playInterval = null, nextNoteTime = 0, playStep = 0, playId = 0;
  let importing = false;
  let generatorMode = 'genre';

  function feedback(text, type = 'ok') {
    $('#message').textContent = text;
    $('#message').style.borderColor = type === 'error' ? '#a95656' : '#33523b';
  }
  function importFeedback(text) { $('#load-feedback').textContent = text; }
  function readControl(id) { return Number($('#' + id).value); }
  function setBpm(value) {
    $('#bpm').value = clamp(Math.round(value || 120), 60, 190);
    $('#bpm-value').textContent = $('#bpm').value + ' BPM';
    $('#bpm-display').textContent = $('#bpm').value;
  }
  function setSwing(value) {
    $('#swing').value = clamp(Math.round(value || 0), 0, 45);
    $('#swing-value').textContent = $('#swing').value + '%';
  }
  function setPattern(grid, heading, subtitle, kind) {
    pattern = copyPattern(grid);
    selected = null;
    sourceKind = kind;
    $('#pattern-heading').textContent = heading;
    $('#pattern-subheading').textContent = subtitle;
    $('#transport-subheading').textContent = subtitle;
    renderGrid();
    inspectNote();
  }
  function showGeneratorMode(mode) {
    generatorMode = mode;
    const genre = mode === 'genre';
    $('#genre-mode').hidden = !genre;
    $('#recipe-mode').hidden = genre;
    for (const [key, active] of [['genre', genre], ['recipe', !genre]]) {
      const tab = $('#mode-' + key);
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = 0;
    }
    updateGeneratorControls();
  }
  function updateGeneratorControls() {
    const concept = $('#genre-provider').value === 'concept';
    $('#template-provider').hidden = concept;
    $('#concept-provider').hidden = !concept;
    const chosen = livePilotGenres.find(item => item.id === $('#livepilot-genre').value);
    const sourceRules = window.BeatForgeGenreRules?.specs[chosen?.id];
    const audited = chosen && sourceRules && chosen.tempoMin === sourceRules.t[0] && chosen.tempoMax === sourceRules.t[1];
    $('#generate-genre').disabled = concept && !audited;
    $('#generate-recipe').disabled = !livePilotRecipes.length;
  }
  function generateGenreOnly() {
    if (generatorMode !== 'genre') return;
    if ($('#genre-provider').value === 'concept') {
      if (!livePilotGenres.length) { feedback('Load LivePilot genre concepts first.', 'error'); return; }
      useGenreConcept();
    } else {
      template($('#guide-style').value);
    }
    // Change dynamics without adding steps that could violate explicit genre rules.
    for (let t = 0; t < tracks.length; t++) for (let s = 0; s < STEPS; s++) {
      const hit = pattern[t][s];
      if (hit) hit.velocity = clamp(hit.velocity + Math.floor(Math.random() * 15) - 7, 1, 127);
    }
    renderGrid();
    feedback('Generated a genre-only groove from the selected style. No LivePilot recipe notes were mixed in.');
  }
  function generateRecipeOnly() {
    if (generatorMode !== 'recipe') return;
    if (!livePilotRecipes.length) { feedback('LivePilot recipes are not loaded yet.', 'error'); return; }
    useLivePilotRecipe();
  }

  function template(style) {
    const sourceMapped = {
      house: 'house', techno: 'techno', disco: 'disco', minimal: 'minimal_techno',
      trap: 'trap', dnb: 'drum_and_bass', jungle: 'drum_and_bass', boombap: 'boom_bap',
      lofi: 'lo_fi', soul: 'soul',
    };
    const sourcedId = sourceMapped[style];
    if (sourcedId && window.BeatForgeGenreRules) {
      const generated = window.BeatForgeGenreRules.create(sourcedId);
      const name = $('#guide-style').selectedOptions[0]?.textContent || sourcedId;
      setBpm(generated.bpm); setSwing(generated.swing);
      setPattern(generated.pattern, name, `BeatForge template · LivePilot ${sourcedId.replaceAll('_', ' ')} rules, interpreted unspecific hits`, 'guide');
      feedback('Template checked against LivePilot’s genre specification. Exact drum positions are respected; unspecified positions are BeatForge choices.');
      return;
    }
    const grid = freshPattern();
    const eighths = [0, 2, 4, 6, 8, 10, 12, 14];
    const offbeats = [2, 6, 10, 14];
    // Tempo, swing, and six lanes of hits. These are BeatForge interpretations,
    // not copies of complete LivePilot genre descriptions or performances.
    const profiles = {
      funk: [108, 13, [[0, 3, 6, 10, 14], [4, 12], eighths, [14], [15], [3, 7, 11, 15]]],
      rock: [112, 0, [[0, 8, 10], [4, 12], eighths, [], [15], [0]]],
      jazz: [125, 19, [[0, 10], [4, 12], offbeats, [], [11], [0, 4, 6, 8, 12, 14]]],
      pop: [111, 2, [[0, 8, 12], [4, 12], eighths, [14], [], [0]]],
      reggae: [79, 14, [[8], [8], offbeats, [6, 14], [], [3, 11]]],
      reggaeton: [95, 4, [[0, 6, 8, 14], [3, 7, 11, 15], eighths, [], [], [6, 14]]],
      afrobeat: [110, 9, [[0, 6, 10, 14], [4, 12], eighths, [14], [15], [3, 7, 11, 15]]],
      latin: [105, 7, [[0, 6, 10, 14], [4, 12], eighths, [], [15], [3, 6, 10, 14]]],
    };
    const cfg = profiles[style] || profiles.house;
    cfg[2].forEach((steps, lane) => steps.forEach(s => {
      const velocity = [111, 105, 77, 76, 71, 63][lane];
      grid[lane][s] = note(velocity, 1, 0, lane === 3 ? .32 : .15);
    }));
    if (style === 'jazz') {
      grid[2].forEach((hit, s) => { if (hit && s % 4 === 2) hit.velocity = 56; });
      if (grid[1][12]) grid[1][12].micro = .012;
    }
    if (style === 'jazz') for (const s of [3, 11]) grid[1][s] = { ...note(35, .55, .01, .12), pitch: 40 };
    if (style === 'reggae') grid[0][8].velocity = 105;
    const name = $('#guide-style').selectedOptions[0]?.textContent || 'House';
    setBpm(cfg[0]); setSwing(cfg[1]);
    setPattern(grid, name, 'BeatForge genre interpretation · no corresponding LivePilot genre spec', 'guide');
    feedback('BeatForge interpretation; no matching LivePilot genre specification was found. You can edit the groove and export it as MIDI.');
  }

  function fillSelect(select, entries, getValue, getLabel) {
    select.replaceChildren();
    for (const item of entries) {
      const option = document.createElement('option');
      option.value = getValue(item); option.textContent = getLabel(item);
      select.appendChild(option);
    }
    select.disabled = entries.length === 0;
  }
  function displayGenreConcept() {
    const concept = livePilotGenres.find(item => item.id === $('#livepilot-genre').value);
    if (!concept) return;
    const cues = concept.idioms.length ? concept.idioms.slice(0, 3).join(' · ') : 'No drum-specific idioms supplied';
    const range = concept.tempoMin > 0 ? `${concept.tempoMin}–${concept.tempoMax} BPM` : (concept.tempoMax > 0 ? `Flexible, up to ${concept.tempoMax} BPM` : 'Free tempo');
    const marker = concept.fallback ? 'Cached genre facts' : 'Current GitHub source';
    $('#concept-details').textContent = `${range} · ${cues}. ${marker}; not a note transcription.`;
    const spec = window.BeatForgeGenreRules?.specs[concept.id];
    if (!spec) {
      $('#genre-validation').textContent = 'This genre has no audited pattern rules. Generation is disabled until it is reviewed.';
      updateGeneratorControls();
      return;
    }
    const beats = steps => steps.map(step => step % 4 ? `step ${step + 1}` : `beat ${step / 4 + 1}`).join(', ');
    const anchors = [
      spec.strictKick?.length && `kick: ${beats(spec.strictKick)}`,
      spec.strictSnare?.length && `${spec.snarePitch === 39 ? 'clap' : 'snare'}: ${beats(spec.strictSnare)}`,
      spec.strictHat?.length && `closed/offbeat hat: ${beats(spec.strictHat)}`,
      spec.strictOpenHat?.length && `open hat: ${beats(spec.strictOpenHat)}`,
    ].filter(Boolean);
    const changed = concept.tempoMin !== spec.t[0] || concept.tempoMax !== spec.t[1];
    $('#genre-validation').textContent = changed
      ? '⚠ LivePilot tempo data differs from this audit. Refresh/review required before generation.'
      : `Source-specified drum positions: ${anchors.length ? anchors.join(' · ') : 'none'}. ${spec.message} Other note positions are BeatForge interpretations.`;
    updateGeneratorControls();
  }
  async function fetchLivePilotData() {
    const reader = window.BeatForgeLivePilot;
    if (!reader) { $('#livepilot-feedback').textContent = 'LivePilot reader is unavailable.'; return; }
    $('#fetch-livepilot').disabled = true;
    $('#livepilot-feedback').textContent = 'Fetching public LivePilot MIDI recipes and genre concepts…';
    const results = await Promise.allSettled([reader.fetchRecipes(), reader.fetchGenreConcepts()]);
    if (results[0].status === 'fulfilled') {
      livePilotRecipes = results[0].value.patterns;
      fillSelect($('#livepilot-style'), livePilotRecipes, item => item.key, item => item.label);
    }
    if (results[1].status === 'fulfilled') {
      livePilotGenres = results[1].value.genres;
      livePilotGenreFetched = results[1].value.fetchedLive;
      fillSelect($('#livepilot-genre'), livePilotGenres, item => item.id, item => item.name);
      displayGenreConcept();
    }
    updateGeneratorControls();
    const recipeCount = livePilotRecipes.length, genreCount = livePilotGenres.length;
    if (recipeCount || genreCount) {
      $('#livepilot-feedback').textContent = `${recipeCount} programmed MIDI recipes · ${genreCount} genre concepts (${livePilotGenreFetched} fetched live; the remainder from the facts-only local catalog). Not human recordings.`;
      feedback('LivePilot data fetched. Choose a recipe or a genre concept in the sidebar.');
    } else {
      $('#livepilot-feedback').textContent = 'LivePilot data could not be fetched. Check browser access to raw.githubusercontent.com and retry.';
      feedback('LivePilot fetch blocked or unavailable; built-in BeatForge templates still work.', 'error');
    }
    $('#fetch-livepilot').disabled = false;
  }
  function useLivePilotRecipe() {
    const recipe = livePilotRecipes.find(item => item.key === $('#livepilot-style').value);
    if (!recipe) return;
    setBpm(recipe.bpm); setSwing(recipe.swing);
    setPattern(recipe.grid, recipe.label, `LivePilot ${recipe.document} · programmed example, not a recording`, 'livepilot');
    feedback('Loaded a pattern parsed from LivePilot’s public MIDI reference. It is programmed source material, not human performance data.');
  }
  function useGenreConcept() {
    const concept = livePilotGenres.find(item => item.id === $('#livepilot-genre').value);
    if (!concept) return;
    const rule = window.BeatForgeGenreRules;
    const spec = rule?.specs[concept.id];
    if (!spec || concept.tempoMin !== spec.t[0] || concept.tempoMax !== spec.t[1]) {
      feedback('This LivePilot genre differs from the checked rules. A new audit is required before generation.', 'error');
      return;
    }
    const result = rule.create(concept.id);
    setBpm(result.bpm); setSwing(result.swing);
    const preview = spec.t[0] === 0 ? ' · audition BPM only (no prescribed pulse)' : '';
    setPattern(result.pattern, concept.name, `LivePilot genre rhythm rules · BeatForge interpretations${preview}`, 'concept');
    feedback('Generated from this genre’s own reviewed tempo and rhythm idioms. No recipe notes were mixed in. Unspecified hits are interpretations.');
  }

  function renderGrid() {
    const sourceLabels = { guide: 'GENRE', concept: 'GENRE', livepilot: 'LIVEPILOT RECIPE', real: 'REAL MIDI', learned: 'LEARNED MIDI', edited: 'EDITED' };
    $('#pattern-source-badge').textContent = sourceLabels[sourceKind] || 'CUSTOM';
    const numberCells = Array.from({ length: STEPS }, (_, s) => `<span>${s + 1}</span>`).join('');
    const header = `<div class="grid-row"><div class="eyebrow" style="color:#738795">DRUM PART</div><div class="step-numbers">${numberCells}</div></div>`;
    const rows = tracks.map((track, t) => {
      const cells = pattern[t].map((hit, s) => `<button class="step-cell ${hit ? 'active' : ''} ${hit && hit.probability < 1 ? 'ghost' : ''} ${hit && hit.roll ? 'roll' : ''} ${selected && selected.t === t && selected.s === s ? 'selected' : ''}" data-track="${t}" data-step="${s}" type="button" aria-label="${track.name}, step ${s + 1}" aria-pressed="${Boolean(hit)}" title="${track.name} · step ${s + 1}${hit ? ' · velocity ' + hit.velocity + (hit.roll ? ' · 32nd roll' : '') : ''}"></button>`).join('');
      return `<div class="grid-row" style="--track:${track.color}"><div class="track-label"><span class="track-dot"></span><span class="track-name">${track.name}</span><button type="button" class="track-audition" data-audition="${t}" title="Audition ${track.name}" aria-label="Audition ${track.name}">▶</button></div><div class="step-cells">${cells}</div></div>`;
    });
    $('#grid').innerHTML = header + rows.join('');
    $('#hit-count').textContent = pattern.flat().filter(Boolean).length;
    showStep(currentStep);
  }
  function showStep(step) {
    currentStep = step;
    document.querySelectorAll('.step-cell').forEach(button => button.classList.toggle('playhead', Number(button.dataset.step) === step));
  }
  function inspectNote() {
    const chosen = selected && pattern[selected.t][selected.s];
    $('#velocity').disabled = !chosen; $('#probability').disabled = !chosen;
    if (!chosen) {
      $('#selected-summary').textContent = selected ? 'Empty step — click again to add a note.' : 'Choose a step to edit its dynamics.';
      $('#velocity-value').textContent = '—'; $('#probability-value').textContent = '—';
      return;
    }
    $('#selected-summary').textContent = `${tracks[selected.t].name} · beat ${round(selected.s / 4, 2)} · step ${selected.s + 1}`;
    $('#velocity').value = chosen.velocity; $('#velocity-value').textContent = chosen.velocity;
    $('#probability').value = Math.round(chosen.probability * 100 / 5) * 5;
    $('#probability-value').textContent = Math.round(chosen.probability * 100) + '%';
  }

  function mapDrum(pitch) {
    if ([35, 36].includes(pitch)) return 0;
    if ([37, 38, 39, 40].includes(pitch)) return 1;
    if ([22, 42, 44].includes(pitch)) return 2;
    if ([26, 46].includes(pitch)) return 3;
    if ([41, 43, 45, 47, 48, 50, 58].includes(pitch)) return 4;
    if ([49, 51, 52, 53, 55, 57, 59].includes(pitch)) return 5;
    return -1;
  }
  function readVariable(bytes, pos, end) {
    let value = 0;
    for (let i = 0; i < 4 && pos < end; i++) {
      const b = bytes[pos++]; value = (value << 7) | (b & 127);
      if (!(b & 128)) break;
    }
    return [value, pos];
  }
  function readMidi(bytes) {
    if (bytes.length < 14 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'MThd') throw new Error('Not a Standard MIDI File');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headerSize = view.getUint32(4, false), division = view.getUint16(12, false);
    if (division & 0x8000) throw new Error('SMPTE timing is not supported');
    const ppq = division, tracksCount = view.getUint16(10, false);
    if (!ppq) throw new Error('Invalid MIDI time division');
    const events = []; let bpm = 120, meter = '4/4';
    let offset = 8 + headerSize;
    for (let trackIndex = 0; trackIndex < tracksCount && offset + 8 <= bytes.length; trackIndex++) {
      if (String.fromCharCode(...bytes.subarray(offset, offset + 4)) !== 'MTrk') break;
      const size = view.getUint32(offset + 4, false);
      let pos = offset + 8, tick = 0, running = 0;
      const end = Math.min(bytes.length, pos + size), active = new Map();
      while (pos < end) {
        let delta; [delta, pos] = readVariable(bytes, pos, end); tick += delta;
        if (pos >= end) break;
        let status = bytes[pos];
        if (status >= 128) {
          pos++;
          if (status < 240) running = status;
        } else {
          status = running;
          if (!status) break;
        }
        if (status === 255) {
          const kind = bytes[pos++]; let length; [length, pos] = readVariable(bytes, pos, end);
          if (kind === 81 && length === 3 && pos + 3 <= end) {
            const micros = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
            if (micros > 0 && bpm === 120) bpm = Math.round(60000000 / micros);
          }
          if (kind === 88 && length >= 2 && pos + 2 <= end) meter = bytes[pos] + '/' + Math.pow(2, bytes[pos + 1]);
          pos += length; running = 0;
          continue;
        }
        if (status === 240 || status === 247) {
          let length; [length, pos] = readVariable(bytes, pos, end); pos += length; running = 0; continue;
        }
        if (status >= 240) break;
        const type = status & 240, channel = status & 15;
        const pitch = bytes[pos++];
        const velocity = type === 192 || type === 208 ? 0 : bytes[pos++];
        if (type === 144 && velocity > 0) {
          const key = channel + ':' + pitch;
          const list = active.get(key) || []; list.push({ tick, pitch, velocity }); active.set(key, list);
        } else if (type === 128 || (type === 144 && velocity === 0)) {
          const key = channel + ':' + pitch;
          const list = active.get(key);
          if (list && list.length) {
            const start = list.shift();
            events.push({ ...start, duration: clamp((tick - start.tick) / ppq, .04, 2) });
          }
        }
      }
      for (const list of active.values()) for (const start of list) events.push({ ...start, duration: .13 });
      offset = end;
    }
    return { ppq, bpm: clamp(bpm, 60, 190), meter, events };
  }

  function barsFromMidi(bytes, fileName, meta = {}) {
    const midi = readMidi(bytes);
    const meter = meta.time_signature ? meta.time_signature.replace('-', '/') : midi.meter;
    if (meter !== '4/4') return [];
    const bars = new Map();
    for (const hit of midi.events) {
      const lane = mapDrum(hit.pitch);
      if (lane < 0) continue;
      const beat = hit.tick / midi.ppq;
      const nearest = Math.round(beat * 4);
      const barNumber = Math.floor(nearest / 16);
      if (barNumber < 0 || barNumber >= 2000) continue;
      const step = nearest % 16;
      if (!bars.has(barNumber)) bars.set(barNumber, freshPattern());
      const grid = bars.get(barNumber);
      const candidate = note(hit.velocity, 1, clamp(beat - nearest / 4, -.125, .125), hit.duration);
      if (!grid[lane][step] || candidate.velocity > grid[lane][step].velocity) grid[lane][step] = candidate;
    }
    const ordered = [...bars.entries()].filter(([, grid]) => grid.flat().filter(Boolean).length >= 3).sort((a, b) => a[0] - b[0]);
    const picked = ordered.length <= 8 ? ordered : Array.from({ length: 8 }, (_, i) => ordered[Math.floor(i * (ordered.length - 1) / 7)]);
    return picked.map(([barNumber, grid]) => ({
      grid, source: fileName.split('/').pop(), bar: barNumber + 1,
      genre: (meta.style || 'imported').split('/')[0].toLowerCase(),
      bpm: Number(meta.bpm) || midi.bpm,
    }));
  }

  function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
    if (!lines.length) return [];
    function parseRow(line) {
      const cells = []; let current = '', quoted = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (quoted && line[i + 1] === '"') { current += '"'; i++; }
          else quoted = !quoted;
        } else if (c === ',' && !quoted) { cells.push(current); current = ''; }
        else current += c;
      }
      cells.push(current); return cells;
    }
    const header = parseRow(lines.shift());
    return lines.map(line => Object.fromEntries(parseRow(line).map((v, i) => [header[i], v])));
  }
  function zipEntries(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ZIP central directory not found');
    const amount = dv.getUint16(eocd + 10, true);
    let pos = dv.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    const entries = [];
    for (let i = 0; i < amount && pos + 46 <= bytes.length; i++) {
      if (dv.getUint32(pos, true) !== 0x02014b50) break;
      const method = dv.getUint16(pos + 10, true), size = dv.getUint32(pos + 20, true);
      const nameLen = dv.getUint16(pos + 28, true), extraLen = dv.getUint16(pos + 30, true), commentLen = dv.getUint16(pos + 32, true);
      const localOffset = dv.getUint32(pos + 42, true);
      const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
      entries.push({ name, method, size, localOffset });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }
  async function unpackEntry(zip, entry) {
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const p = entry.localOffset;
    if (p + 30 > zip.length || dv.getUint32(p, true) !== 0x04034b50) throw new Error('Invalid ZIP member');
    const start = p + 30 + dv.getUint16(p + 26, true) + dv.getUint16(p + 28, true);
    const chunk = zip.subarray(start, start + entry.size);
    if (entry.method === 0) return chunk;
    if (entry.method !== 8) throw new Error('Unsupported ZIP compression');
    if (!('DecompressionStream' in window)) throw new Error('ZIP decompression unavailable. Extract ZIP and import the MIDI files.');
    try {
      const stream = new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (_) { throw new Error('ZIP decompression failed. Extract ZIP and import its .mid files.'); }
  }
  const normalizedPath = path => path.replace(/\\/g, '/').replace(/^\.\//, '');
  function balancedSelection(entries, limit, metaMap) {
    const groups = new Map();
    for (const entry of entries) {
      const info = metaMap.get(normalizedPath(entry.name).replace(/^groove\//, '')) || {};
      const genre = (info.style || 'other').split('/')[0];
      if (!groups.has(genre)) groups.set(genre, []);
      groups.get(genre).push(entry);
    }
    for (const list of groups.values()) list.sort(() => Math.random() - .5);
    const buckets = [...groups.values()], selectedEntries = [];
    while (selectedEntries.length < Math.min(limit, entries.length)) {
      let added = false;
      for (const bucket of buckets) {
        if (bucket.length && selectedEntries.length < limit) { selectedEntries.push(bucket.pop()); added = true; }
      }
      if (!added) break;
    }
    return selectedEntries;
  }
  async function parseZIP(arrayBuffer, name) {
    const zip = new Uint8Array(arrayBuffer), entries = zipEntries(zip);
    const info = entries.find(e => /(^|\/)info\.csv$/i.test(e.name));
    const metaMap = new Map();
    if (info) {
      for (const row of parseCSV(new TextDecoder().decode(await unpackEntry(zip, info)))) {
        if (row.midi_filename) metaMap.set(normalizedPath(row.midi_filename), row);
      }
    }
    const allMIDI = entries.filter(e => /\.mid(i)?$/i.test(e.name));
    if (!allMIDI.length) throw new Error('No MIDI files found in ZIP');
    const subset = balancedSelection(allMIDI, 320, metaMap), results = [];
    let successful = 0;
    for (let i = 0; i < subset.length; i++) {
      const entry = subset[i];
      try {
        const data = await unpackEntry(zip, entry);
        const relative = normalizedPath(entry.name).replace(/^groove\//, '');
        const extracted = barsFromMidi(data, entry.name, metaMap.get(relative) || {});
        if (extracted.length) { results.push(...extracted); successful++; }
      } catch (error) {
        if (i === 0 && /decompress/i.test(error.message)) throw error;
      }
      if (i % 24 === 0) {
        importFeedback(`Reading ${name} · ${i + 1}/${subset.length} MIDI performances...`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    return { bars: results, files: successful, total: allMIDI.length, sampled: subset.length };
  }
  function installCorpus(bars, files, source) {
    if (!bars.length) throw new Error('No usable 4/4 drum bars found');
    corpus = bars; filesAnalyzed = files;
    const genres = [...new Set(corpus.map(row => row.genre))].sort();
    $('#genre').innerHTML = '<option value="all">All recorded genres</option>' + genres.map(g => `<option value="${g.replace(/[^a-z0-9_-]/g, '')}">${g.replace(/[^a-z0-9_-]/g, '')}</option>`).join('');
    $('#genre').disabled = false;
    $('#real-pattern').disabled = false;
    $('#learned-pattern').disabled = false;
    $('#bar-count').textContent = corpus.length.toLocaleString();
    importFeedback(`${files.toLocaleString()} MIDI recordings analyzed · ${bars.length.toLocaleString()} playable bars · ${source}`);
    pickReal();
  }
  async function loadDataset() {
    if (importing) return;
    importing = true; $('#load-dataset').disabled = true;
    importFeedback('Downloading the official Groove MIDI Dataset…');
    try {
      const response = await fetch(datasetURL, { mode: 'cors' });
      if (!response.ok) throw new Error(`Dataset server returned ${response.status}`);
      const parsed = await parseZIP(await response.arrayBuffer(), 'Groove MIDI');
      installCorpus(parsed.bars, parsed.files, `Magenta GMD (${parsed.sampled} of ${parsed.total} files sampled)`);
      feedback('Human MIDI performances loaded. Choose Real bar or Variation.');
    } catch (error) {
      importFeedback('Direct download failed or was blocked. Use the ZIP download link below, then Import MIDI or ZIP.');
      feedback(error.message || 'Could not load remote data.', 'error');
    } finally {
      importing = false; $('#load-dataset').disabled = false;
    }
  }
  async function importFiles(fileList) {
    if (importing || !fileList.length) return;
    importing = true; $('#load-dataset').disabled = true;
    const bars = []; let processed = 0;
    try {
      for (const file of fileList) {
        importFeedback(`Reading ${file.name}…`);
        if (/\.zip$/i.test(file.name)) {
          const parsed = await parseZIP(await file.arrayBuffer(), file.name);
          bars.push(...parsed.bars); processed += parsed.files;
        } else if (/\.mid(i)?$/i.test(file.name)) {
          const found = barsFromMidi(new Uint8Array(await file.arrayBuffer()), file.name);
          if (found.length) { bars.push(...found); processed++; }
        }
      }
      installCorpus(bars, processed, 'local import');
      feedback('Real drum MIDI loaded successfully.');
    } catch (error) {
      importFeedback(error.message || 'Import failed.');
      feedback(error.message || 'Import failed.', 'error');
    } finally {
      importing = false; $('#load-dataset').disabled = false; $('#file-input').value = '';
    }
  }

  function filteredBars() {
    const genre = $('#genre').value;
    return genre === 'all' ? corpus : corpus.filter(bar => bar.genre === genre);
  }
  function genreLabel() { return $('#genre').value === 'all' ? 'All genres' : $('#genre').value; }
  function pickReal() {
    const matching = filteredBars(); if (!matching.length) return;
    const chosen = choose(matching);
    setBpm(chosen.bpm);
    setPattern(chosen.grid, `${genreLabel()} · recorded bar`, `Real MIDI · ${chosen.source} · measure ${chosen.bar}`, 'real');
    feedback('This is a quantized transcription from a recorded MIDI performance. Human velocity and partial timing offsets remain available.');
  }
  function learnedVariation() {
    const matching = filteredBars(); if (!matching.length) return;
    const primary = choose(matching), amount = readControl('variation') / 100;
    const resulting = freshPattern();
    for (let t = 0; t < tracks.length; t++) {
      const donor = Math.random() < .58 ? primary : choose(matching);
      resulting[t] = donor.grid[t].map(copyNote);
      for (let s = 0; s < STEPS; s++) {
        if (Math.random() < amount * .4) {
          const alternative = choose(matching);
          resulting[t][s] = copyNote(alternative.grid[t][s]);
        }
      }
    }
    setBpm(primary.bpm);
    setPattern(resulting, `${genreLabel()} · new groove`, `Generated variation · recombined from ${matching.length} human-played bars`, 'learned');
    feedback(`Created from observed MIDI hits and dynamics in ${matching.length} source bars. It is a new recombination, not an original recorded performance.`);
  }
  function mutate() {
    const matching = filteredBars();
    for (let i = 0; i < 5; i++) {
      const t = Math.floor(Math.random() * tracks.length), s = Math.floor(Math.random() * STEPS);
      pattern[t][s] = matching.length ? copyNote(choose(matching).grid[t][s]) : (pattern[t][s] ? null : note(60 + Math.floor(Math.random() * 45)));
    }
    sourceKind = 'edited';
    $('#pattern-subheading').textContent = 'Edited pattern · no longer an exact transcription';
    renderGrid(); inspectNote(); feedback('Mutated five steps. You can keep editing or export this variation.');
  }
  function euclidean() {
    const lane = 5, hits = 5;
    pattern[lane] = Array.from({ length: STEPS }, (_, s) => (s * hits) % STEPS < hits ? note(s % 4 === 0 ? 79 : 57, .8, 0, .12) : null);
    sourceKind = 'edited';
    $('#pattern-subheading').textContent = 'Edited pattern · Euclidean percussion added';
    renderGrid(); inspectNote(); feedback('Applied a five-hit Euclidean percussion layer.');
  }
  function hatRoll() {
    for (let s = 12; s < 16; s++) pattern[2][s] = { ...note(50 + (s - 12) * 14, 1, 0, .09), roll: 2 };
    sourceKind = 'edited';
    $('#pattern-subheading').textContent = 'Edited pattern · 32nd-note hi-hat fill';
    renderGrid(); inspectNote(); feedback('Added a rising 32nd-note hat roll in beat four; each highlighted cell plays twice.');
  }
  function ghostSnare() {
    for (const s of [3, 5, 11, 13]) pattern[1][s] = { ...note(27 + Math.floor(Math.random() * 16), .45, 0, .125), pitch: 40 };
    sourceKind = 'edited';
    $('#pattern-subheading').textContent = 'Edited pattern · probabilistic ghost snares';
    renderGrid(); inspectNote(); feedback('Added quiet alternate-snare notes with 45% playback probability.');
  }

  function initAudio() {
    if (audioContext) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) throw new Error('Web Audio is unavailable here');
    audioContext = new AudioCtor();
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.ratio.value = 3;
    audioOutput = audioContext.createGain(); audioOutput.gain.value = .65;
    audioOutput.connect(compressor); compressor.connect(audioContext.destination);
    noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  function oscillator(time, from, to, duration, gain, type = 'sine') {
    const osc = audioContext.createOscillator(), amp = audioContext.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + duration * .68);
    amp.gain.setValueAtTime(Math.max(.0001, gain), time);
    amp.gain.exponentialRampToValueAtTime(.0001, time + duration);
    osc.connect(amp); amp.connect(audioOutput); osc.start(time); osc.stop(time + duration + .005);
  }
  function noise(time, cutoff, duration, gain) {
    const src = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), amp = audioContext.createGain();
    src.buffer = noiseBuffer; filter.type = 'highpass'; filter.frequency.value = cutoff;
    amp.gain.setValueAtTime(Math.max(.0001, gain), time);
    amp.gain.exponentialRampToValueAtTime(.0001, time + duration);
    src.connect(filter); filter.connect(amp); amp.connect(audioOutput);
    src.start(time); src.stop(time + duration + .005);
  }
  function drum(lane, time, velocity, pitch) {
    const a = clamp(velocity / 110, .18, 1.18);
    if (lane === 0) { oscillator(time, 165, 48, .3, .94 * a); noise(time, 3000, .02, .10 * a); }
    if (lane === 1) {
      if (pitch === 39) {
        noise(time, 1750, .055, .35 * a);
        noise(time + .013, 1450, .08, .28 * a);
        noise(time + .032, 2100, .11, .23 * a);
      } else {
        noise(time, 1250, .17, .5 * a);
        oscillator(time, 180, 110, .12, .2 * a, 'triangle');
      }
    }
    if (lane === 2) noise(time, 6700, .065, .24 * a);
    if (lane === 3) noise(time, 5800, .35, .27 * a);
    if (lane === 4) oscillator(time, 295, 125, .24, .32 * a, 'triangle');
    if (lane === 5) { noise(time, 4900, .43, .21 * a); oscillator(time, 520, 260, .14, .05 * a, 'square'); }
  }
  function swingOffset(s, swing) {
    // Offbeat eighths need the long-short swing, not just odd 16th steps.
    // At 35%, the offbeat falls at 67.5% of the beat (straight = 50%).
    return s % 4 === 2 ? .5 * swing : (s % 2 === 1 ? .125 * swing : 0);
  }
  function schedule() {
    if (!playing || !audioContext) return;
    const stepSeconds = 60 / readControl('bpm') / 4;
    const swing = readControl('swing') / 100;
    const quantize = readControl('quantize') / 100;
    while (nextNoteTime < audioContext.currentTime + .22) {
      const s = playStep, when = nextNoteTime, id = playId;
      for (let t = 0; t < tracks.length; t++) {
        const hit = pattern[t][s];
        if (!hit || Math.random() > hit.probability) continue;
        const microSeconds = hit.micro * (1 - quantize) * stepSeconds * 4;
        const swung = swingOffset(s, swing) * stepSeconds * 4;
        const noteTime = Math.max(audioContext.currentTime + .004, when + microSeconds + swung);
        drum(t, noteTime, hit.velocity, hit.pitch);
        if (hit.roll === 2) drum(t, noteTime + stepSeconds / 2, clamp(hit.velocity + 11, 1, 127), hit.pitch);
      }
      setTimeout(() => { if (playing && id === playId) showStep(s); }, Math.max(0, (when - audioContext.currentTime) * 1000));
      nextNoteTime += stepSeconds;
      playStep = (playStep + 1) % STEPS;
    }
  }
  async function play() {
    if (playing) { stop(); return; }
    try {
      initAudio(); await audioContext.resume();
      playing = true; playId++;
      nextNoteTime = audioContext.currentTime + .055; playStep = 0;
      $('#play').textContent = 'Ⅱ'; $('#transport-heading').textContent = 'Now playing';
      $('#session-status').textContent = 'PLAYING'; $('#status-light').classList.add('on');
      schedule(); playInterval = setInterval(schedule, 25);
    } catch (error) { feedback('Audio unavailable in this browser: ' + error.message, 'error'); }
  }
  function stop() {
    playing = false; playId++;
    clearInterval(playInterval); playInterval = null;
    showStep(-1); $('#play').textContent = '▶';
    $('#transport-heading').textContent = 'Ready to play';
    $('#session-status').textContent = 'READY'; $('#status-light').classList.remove('on');
  }
  async function audition(lane) {
    try { initAudio(); await audioContext.resume(); drum(lane, audioContext.currentTime + .01, 102); }
    catch (error) { feedback('Audio unavailable: ' + error.message, 'error'); }
  }

  function noteEvents(freezeProbability) {
    const events = [], q = readControl('quantize') / 100;
    const swing = readControl('swing') / 100;
    for (let t = 0; t < tracks.length; t++) for (let s = 0; s < STEPS; s++) {
      const hit = pattern[t][s]; if (!hit) continue;
      if (freezeProbability && Math.random() > hit.probability) continue;
      const start = clamp(s * .25 + hit.micro * (1 - q) + swingOffset(s, swing), 0, 3.99);
      const pitch = hit.pitch || tracks[t].pitch;
      events.push({ pitch, start_time: round(start), duration: round(clamp(hit.duration, .06, .75)), velocity: hit.velocity, probability: hit.probability });
      if (hit.roll === 2) events.push({ pitch, start_time: round(start + .125), duration: .09, velocity: clamp(hit.velocity + 11, 1, 127), probability: hit.probability });
    }
    return events.sort((a, b) => a.start_time - b.start_time || a.pitch - b.pitch);
  }
  function variableLength(n) {
    const out = [n & 127]; n >>>= 7;
    while (n) { out.unshift((n & 127) | 128); n >>>= 7; }
    return out;
  }
  const uint32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const ascii = s => [...s].map(c => c.charCodeAt(0));
  function exportMIDI() {
    const bpm = readControl('bpm'), microseconds = Math.round(60000000 / bpm);
    const events = [
      { tick: 0, priority: -2, bytes: [255, 81, 3, (microseconds >>> 16) & 255, (microseconds >>> 8) & 255, microseconds & 255] },
      { tick: 0, priority: -1, bytes: [255, 88, 4, 4, 2, 24, 8] },
    ];
    for (const hit of noteEvents(true)) {
      const start = Math.round(hit.start_time * 480), end = start + Math.max(24, Math.round(hit.duration * 480));
      events.push({ tick: start, priority: 1, bytes: [153, hit.pitch, hit.velocity] });
      events.push({ tick: end, priority: 0, bytes: [137, hit.pitch, 0] });
    }
    events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
    const track = []; let last = 0;
    for (const event of events) { track.push(...variableLength(event.tick - last), ...event.bytes); last = event.tick; }
    track.push(...variableLength(Math.max(0, 1920 - last)), 255, 47, 0);
    const bytes = new Uint8Array([...ascii('MThd'), ...uint32(6), 0, 0, 0, 1, 1, 224, ...ascii('MTrk'), ...uint32(track.length), ...track]);
    const link = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
    link.href = url; link.download = 'beatforge-' + sourceKind + '-' + bpm + 'bpm.mid';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    feedback('Exported a one-bar GM drum MIDI file. Probabilistic hits were sampled once for this export.');
  }
  async function copyLivePilot() {
    const exported = noteEvents(false).map(hit => ({
      pitch: hit.pitch, start_time: hit.start_time, duration: hit.duration,
      velocity: hit.velocity, probability: round(hit.probability, 2),
    }));
    const value = JSON.stringify(exported, null, 2);
    try {
      await navigator.clipboard.writeText(value);
      feedback(`${exported.length} beat-based LivePilot note dictionaries copied. Paste them into an add_notes workflow.`);
    } catch (_) {
      const area = document.createElement('textarea');
      area.value = value; area.style.position = 'fixed'; area.style.left = '-9999px';
      document.body.appendChild(area); area.select();
      const ok = document.execCommand('copy'); area.remove();
      feedback(ok ? 'LivePilot notes copied.' : 'Clipboard blocked by browser permissions.', ok ? 'ok' : 'error');
    }
  }

  $('#grid').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.audition !== undefined) { audition(Number(button.dataset.audition)); return; }
    if (button.dataset.track === undefined) return;
    const t = Number(button.dataset.track), s = Number(button.dataset.step);
    const alreadySelected = selected && selected.t === t && selected.s === s;
    let changed = false;
    if (!pattern[t][s]) { pattern[t][s] = note([113, 102, 76, 74, 88, 72][t]); changed = true; }
    else if (alreadySelected) { pattern[t][s] = null; changed = true; }
    selected = { t, s };
    if (pattern[t][s]) audition(t);
    if (changed && sourceKind !== 'edited') {
      sourceKind = 'edited';
      $('#pattern-subheading').textContent = 'Manually edited pattern · no longer identical to its source';
    }
    renderGrid(); inspectNote();
  });
  $('#velocity').addEventListener('input', () => {
    if (!selected || !pattern[selected.t][selected.s]) return;
    pattern[selected.t][selected.s].velocity = readControl('velocity');
    $('#velocity-value').textContent = $('#velocity').value;
    if (sourceKind !== 'edited') {
      sourceKind = 'edited';
      $('#pattern-subheading').textContent = 'Manually edited note dynamics';
      renderGrid();
    }
  });
  $('#probability').addEventListener('input', () => {
    if (!selected || !pattern[selected.t][selected.s]) return;
    pattern[selected.t][selected.s].probability = readControl('probability') / 100;
    $('#probability-value').textContent = $('#probability').value + '%';
    if (sourceKind !== 'edited') {
      sourceKind = 'edited';
      $('#pattern-subheading').textContent = 'Manually edited note probability';
    }
    renderGrid();
  });
  $('#bpm').addEventListener('input', () => setBpm(readControl('bpm')));
  $('#swing').addEventListener('input', () => { $('#swing-value').textContent = $('#swing').value + '%'; });
  $('#quantize').addEventListener('input', () => { $('#quantize-value').textContent = $('#quantize').value + '%'; });
  $('#play').addEventListener('click', play);
  $('#stop').addEventListener('click', stop);
  $('#mode-genre').addEventListener('click', () => showGeneratorMode('genre'));
  $('#mode-recipe').addEventListener('click', () => showGeneratorMode('recipe'));
  $('#genre-provider').addEventListener('change', updateGeneratorControls);
  $('#generate-genre').addEventListener('click', generateGenreOnly);
  $('#generate-recipe').addEventListener('click', generateRecipeOnly);
  $('#fetch-livepilot').addEventListener('click', fetchLivePilotData);
  $('#livepilot-genre').addEventListener('change', displayGenreConcept);
  $('#mutate').addEventListener('click', mutate);
  $('#euclidean').addEventListener('click', euclidean);
  $('#hat-roll').addEventListener('click', hatRoll);
  $('#ghost-notes').addEventListener('click', ghostSnare);
  $('#clear').addEventListener('click', () => {
    setPattern(freshPattern(), 'Empty pattern', 'Create your own rhythm', 'edited');
    feedback('Cleared all steps. Click a cell to add a note.');
  });
  $('#export-midi').addEventListener('click', exportMIDI);
  $('#copy-livepilot').addEventListener('click', copyLivePilot);

  template('house');
  showGeneratorMode('genre');
  setTimeout(fetchLivePilotData, 250);
})();
