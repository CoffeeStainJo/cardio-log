# Cardio Log

A phone-first PWA for logging speed intervals and steady cardio, with a calendar, progress charts and next-session suggestions. Data is stored in `localStorage` on the device.

```bash
npm install
npm run dev      # develop
npm test         # domain tests
npm run build    # production build (dist/), installable as a PWA
npm run icons    # regenerate icons from scripts/icons.mjs
```

- `src/domain` — types, seed history, stats, progression suggestions
- `src/store` — localStorage-backed store, backup parsing
- `src/screens`, `src/components` — UI, hand-rolled SVG charts

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` tests, builds and deploys on every push to `main`, serving from `https://<user>.github.io/<repo>/`.

One-time setup: push to GitHub, then in the repository open **Settings → Pages** and set **Source** to **GitHub Actions**.
