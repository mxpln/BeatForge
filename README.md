# BeatForge — GitHub Pages

This repository contains a static BeatForge site and a GitHub Actions workflow
that validates and deploys it to GitHub Pages.

## Publish the website

1. Create a GitHub repository (for example, `beatforge`).
2. Upload **all** files from this folder to its `main` branch, including the
   hidden `.github/workflows/deploy-pages.yml` file. The workflow must be in
   that exact path. Do not upload the ZIP as a single file.
3. In the GitHub repository, open **Settings → Pages → Build and deployment**.
   Select **GitHub Actions** as the source.
4. Open **Actions → Verify and deploy BeatForge**. The workflow runs on pushes
   to `main`. You can also select **Run workflow** manually.
5. When the deployment succeeds, GitHub Pages provides the URL. For a project
   named `beatforge`, the usual URL is
   `https://YOUR-USERNAME.github.io/beatforge/`.

The workflow also runs checks on pull requests, without publishing those PRs.
On every push to `main`, it validates the site and deploys **only if checks
pass**. It requires no personal access token or repository secret.

## Directory layout

This package places `index.html` and other static assets at the repository
root. The workflow also supports a repository where those assets live in
`dist/`, matching the original BeatForge project layout.

## What needs internet access?

BeatForge is a static site with no backend. The built-in genre templates and
sequencer work without a hosted API. LivePilot MIDI recipe definitions are
fetched from LivePilot's public GitHub files at runtime, so those recipes need
an internet connection.

## Sources

GitHub Pages setup: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

LivePilot genre and recipe sources are linked in the site footer.
