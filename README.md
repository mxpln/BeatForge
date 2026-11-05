# BeatForge — Rhythm Lab

BeatForge is a browser-based drum sequencer with separate genre and LivePilot
recipe generators, editable 16-step patterns, playback, and MIDI export.

## Files

- `dist/`: complete static website. There is no compilation or backend.
- `tests/`: checks for all 27 LivePilot genres, generator independence, and
  the current interface.
- `.github/workflows/deploy-pages.yml`: checks and GitHub Pages deployment.

## Deploy with GitHub Pages

1. In this repository, open **Settings → Pages → Build and deployment**.
2. Choose **GitHub Actions** as the source.
3. Push to `main` or run **Actions → Verify and deploy BeatForge → Run workflow**.
4. Once GitHub Pages finishes, visit the URL shown in the deployment job.

On pull requests, only checks run; there is no deployment. Pushes to `main`
deploy the exact `dist/` files after the checks pass.

## Local development

```sh
node tests/interface-cleanup.mjs
node tests/genre-audit.mjs
node tests/generation-modes.mjs
python3 -m http.server --directory dist 8000
```

Visit `http://localhost:8000`.

The site is static. Its built-in genre rules work without a backend, but
fetching current LivePilot MIDI recipe documents requires internet access.

**Sources:** [LivePilot genres](https://github.com/dreamrec/LivePilot/tree/main/livepilot/skills/livepilot-core/references/concepts/genres) · [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
