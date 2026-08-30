# Setup

This repo self-generates its own stat cards instead of relying on external badge
services. A GitHub Action runs `scripts/generate.js` on a schedule, which pulls
your live GitHub data and writes fresh SVGs into `/assets`.

## One-time setup

1. **Create the repo.** It must be public and named exactly the same as your
   username: `adixlucifer0011/adixlucifer0011`.

2. **Add these files** to that repo, keeping the folder structure:
   ```
   .github/workflows/update-assets.yml
   scripts/generate.js
   assets/            (empty is fine, it'll be filled in automatically)
   README.md
   SETUP.md
   ```

3. **Add a Personal Access Token (recommended).**
   The default `GITHUB_TOKEN` works for most public data, but contribution
   history sometimes needs a token with `read:user` scope for full accuracy.
   - Go to GitHub → Settings → Developer settings → Personal access tokens →
     Fine-grained tokens → Generate new token.
   - Scope: `read:user` is enough.
   - Copy the token.
   - In your repo: Settings → Secrets and variables → Actions → New repository
     secret → name it `STATS_TOKEN` → paste the token.

4. **Run it once manually.**
   Go to the Actions tab → "Update profile assets" → Run workflow. This
   generates the first version of the SVGs and commits them.

After that, it refreshes automatically once a day, and also whenever you push
to `main`.

## Local testing (optional)

```bash
npm install --global nothing   # no dependencies needed, uses built-in fetch
GH_USERNAME=adixlucifer0011 GH_TOKEN=your_token node scripts/generate.js
```
