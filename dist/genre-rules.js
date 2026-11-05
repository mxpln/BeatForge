/* BeatForge's audited interpretations of LivePilot's public genre concepts.
 * Source: dreamrec/LivePilot, concepts/genres/*.yaml, main on 2026-11-04.
 * tempo and rules marked strict are taken from explicit source idioms.
 * Other hit placements are deliberate BeatForge interpretations, not source facts.
 */
(() => {
  'use strict';
  const four = [0, 4, 8, 12];
  const eighths = [0, 2, 4, 6, 8, 10, 12, 14];
  const offbeats = [2, 6, 10, 14];
  const specs = {
    ambient: { t: [0, 90], p: [0, 8], pChance: .35, message: 'No regular beat is specified; occasional distant accents only.' },
    boom_bap: { t: [85, 95], k: [0, 6], s: [8], h: offbeats, swing: 35, strictKick: [0], strictSnare: [8], strictHat: offbeats, message: 'Kick on beat 1, snare on beat 3; closed hats on offbeat eighths with roughly 67.5% swing.' },
    deep_minimal: { t: [125, 135], k: [0, 8], p: [3, 7, 11, 15], pChance: .85, micro: .025, message: 'Hand and metallic micro-percussion; kick placement is an interpretation.' },
    deep_house: { t: [118, 124], k: four, s: [4, 12], snarePitch: 39, o: offbeats, p: [3, 7, 11, 15], strictKick: four, strictSnare: [4, 12], strictOpenHat: offbeats, message: 'Four-on-floor kick, clap on 2 and 4, open hat on offbeats.' },
    detroit_techno: { t: [128, 140], k: four, s: [4, 12], snarePitch: 39, h: offbeats, p: [15], message: '909 kick/clap/hat core; precise clap placement is an interpretation.' },
    disco: { t: [110, 125], k: four, s: [4, 12], h: offbeats, strictKick: four, strictHat: offbeats, message: 'Straight four-on-floor kick and offbeat hats; snare is an interpretation.' },
    downtempo: { t: [70, 100], k: [0, 10], s: [4, 12], h: offbeats, p: [15], swing: 14, message: 'Slow boom-bap-adjacent rhythm; no exact backbeat is prescribed.' },
    drone: { t: [0, 0], message: 'No pulse or kit drums specified. This pattern is intentionally silent.' },
    drum_and_bass: { t: [170, 180], k: [0, 10], s: [4, 12], h: eighths, ghost: [15], message: 'Chopped break and ghost snare feel; exact backbeat positions are interpreted.' },
    dub_techno: { t: [120, 130], k: four, s: [4, 12], h: offbeats, p: [7, 15], pChance: .55, strictKick: four, message: 'Rigid four-on-floor kick with a spacious kick-snare relationship. Snare beats 2 and 4 are interpreted; source does not specify positions.' },
    dub: { t: [70, 90], k: [8], h: [4, 12], p: [15], pChance: .5, strictKick: [8], strictHat: [4, 12], message: 'One-drop kick on beat 3 and hat emphasis on beats 2 and 4; snare unspecified.' },
    dubstep: { t: [138, 142], k: [0, 10], s: [8], h: eighths, p: [15], strictSnare: [8], message: 'Half-time feel, source-specified snare on beat 3, 909 hats and glitch accents. Separate clap layering needs another lane.' },
    experimental: { t: [0, 0], p: [3, 7, 11, 15], pChance: .4, message: 'Found-sound and polymetric ideas; standard kit cannot fully represent the source.' },
    footwork: { t: [155, 165], k: [0, 3, 10, 13], h: [0, 3, 5, 7, 10, 11, 14, 15], roll: [11, 15], swing: 17, message: 'Sparse syncopated kick and rapid chops; triplets and 3:2 cannot be exact on this grid.' },
    hip_hop: { t: [85, 95], k: [0, 10], s: [8], h: offbeats, swing: 35, micro: .018, message: 'Off-grid Dilla-style break interpretation; no exact snare placement in source.' },
    house: { t: [120, 126], k: four, s: [4, 12], snarePitch: 39, o: offbeats, p: [7, 15], strictKick: four, strictSnare: [4, 12], strictOpenHat: offbeats, message: 'Four-on-floor kick, clap on beats 2 and 4, and an open offbeat hi-hat (specified in sonic identity).' },
    hyperpop: { t: [100, 160], k: [0, 7, 12], s: [8], h: eighths, roll: [13, 14, 15], p: [3, 11, 15], message: 'Trap-adjacent rapid hats and metallic accents; backbeat is interpreted.' },
    idm: { t: [80, 150], k: [0, 9], p: [3, 6, 10, 13], micro: .035, message: 'Off-grid polymetric percussion; quintuplets cannot be represented exactly.' },
    lo_fi: { t: [70, 90], k: [0, 7, 10], s: [8], h: offbeats, swing: 35, micro: .02, message: 'Loose boom-bap interpretation with off-grid micro-timing.' },
    microhouse: { t: [122, 128], k: [0, 8], h: offbeats, p: [3, 5, 7, 11, 13, 15], micro: .025, message: 'Micro-percussion and off-grid texture; kick pattern is an interpretation.' },
    minimal_techno: { t: [128, 132], k: four, h: eighths, p: [11, 15], pChance: .55, strictKick: four, message: 'Steady 4/4 kick, restrained 909 hats and rare percussion.' },
    modern_classical: { t: [60, 90], message: 'No kit drums are prescribed. Timpani/rubato require instruments outside this sequencer.' },
    soul: { t: [85, 100], k: [0, 8], s: [4, 12], h: offbeats, p: [3, 7, 11, 15], ghost: [3, 5, 11, 13], swing: 17, micro: .015, strictKick: [0, 8], strictSnare: [4, 12], message: 'Kick on 1 and 3; snare on 2 and 4 with soft ghost notes and individually offset hits.' },
    synthwave: { t: [85, 115], k: [0, 8], s: [4, 12], h: eighths, swing: 5, message: 'Mid-tempo gated-snare interpretation; reverb character needs a sound-design effect.' },
    techno: { t: [128, 140], k: four, s: [4, 12], snarePitch: 39, h: eighths, p: [0, 8], pChance: .45, message: 'Relentless 909 kick-clap-hat engine; clap beats 2 and 4 are interpreted, not specified positions.' },
    trap: { t: [130, 160], k: [0, 10], s: [8], h: eighths, roll: [13, 14, 15], strictSnare: [8], message: 'Sparse snare only on beat 3, half-time at 130–160 BPM; 1/32 hats are approximated, 1/64 rolls need a finer grid.' },
    uk_garage: { t: [130, 140], k: [0, 7, 10], s: [8], h: [0, 3, 6, 9, 12, 15], tom: [14], swing: 22, strictKick: [0], strictSnare: [8], message: 'Kick on beat 1, snare on beat 3, shuffled broken hats and occasional toms.' },
  };

  function create(id, random = Math.random) {
    const spec = specs[id];
    if (!spec) return null;
    const pattern = Array.from({ length: 6 }, () => Array(16).fill(null));
    const baseVelocity = [111, 103, 76, 75, 69, 57];
    const place = (lane, positions, options = {}) => {
      for (const step of positions || []) {
        const velocity = Math.max(1, Math.min(127, (options.velocity || baseVelocity[lane]) + Math.floor(random() * 9) - 4));
        pattern[lane][step] = { velocity, probability: options.probability ?? 1, micro: options.micro ?? 0, duration: lane === 3 ? .3 : .14 };
        if (options.pitch) pattern[lane][step].pitch = options.pitch;
      }
    };
    place(0, spec.k);
    place(1, spec.s, { pitch: spec.snarePitch || 38 });
    place(2, spec.h);
    place(3, spec.o);
    place(4, spec.tom);
    place(5, spec.p, { probability: spec.pChance ?? 1 });
    place(1, spec.ghost, { velocity: 34, probability: .55, pitch: 40 });
    for (const step of spec.roll || []) {
      pattern[2][step] = { velocity: 57 + step * 3, probability: 1, micro: 0, duration: .09, roll: 2 };
    }
    if (spec.micro) {
      for (const row of pattern) for (const hit of row) {
        if (hit) hit.micro = (random() - .5) * spec.micro * 2;
      }
    }
    const bpm = spec.t[0] > 0 ? Math.round((spec.t[0] + spec.t[1]) / 2) : (spec.t[1] > 0 ? Math.min(80, spec.t[1]) : 75);
    return { id, bpm, swing: spec.swing || 0, pattern, spec };
  }
  const api = { specs, create };
  if (typeof window !== 'undefined') window.BeatForgeGenreRules = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
