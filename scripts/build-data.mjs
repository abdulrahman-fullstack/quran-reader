import { mkdir, writeFile } from 'node:fs/promises';

const api = 'https://api.quran.com/api/v4';
const translationApi = 'https://quranenc.com/api/v1';
const englishTranslationKey = 'english_saheeh';
const translationInfoUrl = 'https://quranenc.com/en/home/api';
const dataDirectory = new URL('../data/', import.meta.url);
const verseDirectory = new URL('../data/verses/', import.meta.url);

await mkdir(verseDirectory, { recursive: true });
const translationsResponse = await fetch(`${translationApi}/translations/list/en`);
if (!translationsResponse.ok) throw new Error(`Translation list request failed: ${translationsResponse.status}`);
const { translations } = await translationsResponse.json();
const translation = translations.find(({ key }) => key === englishTranslationKey);
if (!translation) throw new Error(`QuranEnc translation ${englishTranslationKey} was not found`);
const translationMetadata = {
  source: 'QuranEnc.com',
  sourceUrl: translationInfoUrl,
  title: translation.title,
  version: translation.version,
};
const chapterResponse = await fetch(`${api}/chapters?language=en`);
if (!chapterResponse.ok) throw new Error(`Chapter request failed: ${chapterResponse.status}`);
const { chapters: sourceChapters } = await chapterResponse.json();

const chapters = sourceChapters.map((chapter) => ({
  id: chapter.id,
  name: chapter.name_simple,
  arabicName: chapter.name_arabic,
  meaning: chapter.translated_name.name,
  verseCount: chapter.verses_count,
  revelation: chapter.revelation_place,
  dataFile: `data/verses/${chapter.id}.json`,
  tntjChapterUrl: 'https://onlinetntj.com/the-holy-quran/',
}));
await writeFile(new URL('chapters.json', dataDirectory), `${JSON.stringify(chapters, null, 2)}\n`, 'utf8');

let completed = 0;
let nextChapter = 0;
const workerCount = 4;
async function writeNextChapter() {
  while (nextChapter < chapters.length) {
    const chapter = chapters[nextChapter++];
    const arabicUrl = `${api}/verses/by_chapter/${chapter.id}?language=en&audio=7&fields=text_uthmani&per_page=300`;
    const englishUrl = `${translationApi}/translation/sura/${englishTranslationKey}/${chapter.id}`;
    const [arabicResponse, englishResponse] = await Promise.all([fetch(arabicUrl), fetch(englishUrl)]);
    if (!arabicResponse.ok) throw new Error(`Arabic request for chapter ${chapter.id} failed: ${arabicResponse.status}`);
    if (!englishResponse.ok) throw new Error(`English request for chapter ${chapter.id} failed: ${englishResponse.status}`);
    const [{ verses }, { result: englishVerses }] = await Promise.all([arabicResponse.json(), englishResponse.json()]);
    const englishByVerse = new Map(englishVerses.map((verse) => [Number(verse.aya), verse]));
    if (englishByVerse.size !== chapter.verseCount) throw new Error(`English verse count mismatch in chapter ${chapter.id}`);
    const localVerses = verses.map((verse) => {
      const englishVerse = englishByVerse.get(verse.verse_number);
      if (!englishVerse) throw new Error(`English verse ${chapter.id}:${verse.verse_number} is missing`);
      return {
      number: verse.verse_number,
      arabicText: verse.text_uthmani,
      englishText: englishVerse.translation,
      footnotes: englishVerse.footnotes,
      audioUrl: verse.audio?.url ?? null,
      };
    });
    await writeFile(new URL(`${chapter.id}.json`, verseDirectory), `${JSON.stringify({ chapterId: chapter.id, translation: translationMetadata, verses: localVerses }, null, 2)}\n`, 'utf8');
    completed += 1;
    console.log(`Saved chapter ${chapter.id}/${chapters.length} (${completed} complete)`);
  }
}

await Promise.all(Array.from({ length: workerCount }, () => writeNextChapter()));
console.log(`Built ${chapters.length} chapters and ${completed} local verse files.`);