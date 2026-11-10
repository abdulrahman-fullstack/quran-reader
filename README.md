# Quran Reader

A plain HTML, CSS, and JavaScript reader. Chapter metadata and verse text live in local JSON files. The app loads the chapter index first, then reads only the selected chapter's verse file. Audio plays on demand from the recitation URL stored with each verse.

## Run

Requires Node.js 18 or newer. Run `npm start`, then open <http://localhost:4173>.

## Deploy

The site is deployed to GitHub Pages by the workflow in `.github/workflows/pages.yml` whenever changes are pushed to `main`. If the first deployment fails because Pages is disabled, enable **Settings → Pages → Build and deployment → GitHub Actions**, then push another commit to `main` to trigger deployment.

## Local data

`data/chapters.json` is the chapter index. `data/verses/{chapter-id}.json` contains Arabic and English verse text, translator notes, and the verse audio path. The app has no Quran text API calls at runtime; audio playback streams from Quran.com's audio host when requested.

Arabic text and Mishari al-Afasy recitation references are generated from the Quran.com API. English text and translator notes are generated from QuranEnc's `english_saheeh` edition. Run `npm run data:build` to import/update all chapter JSON; this is a one-time data operation, not part of app startup.

The QuranEnc translation is **English Translation - Noor International Center**, published by **Noor International Center**, from [QuranEnc.com](https://quranenc.com/en/home/api). The bundled edition is version **1.1.2**. The build script reads the current version from QuranEnc when refreshing the local data. When redistributing the translation, keep its wording, translator notes, title, source, publisher, and version information intact, and update it from QuranEnc's latest release.

## Verse record

```json
{
  "number": 1,
  "arabicText": "...",
  "englishText": "...",
  "footnotes": "...",
  "audioUrl": "Alafasy/mp3/001001.mp3"
}
```

Sources: [Online TNTJ Quran](https://onlinetntj.com/the-holy-quran/) (source link); [Quran.com API](https://api-docs.quran.com/) for Arabic text and recitation; [QuranEnc](https://quranenc.com/en/home/api) for the English translation.
