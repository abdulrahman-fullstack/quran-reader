const chapterList = document.querySelector('#chapter-list');
const chapterSearch = document.querySelector('#chapter-search');
const versesElement = document.querySelector('#verses');
const audioElement = document.querySelector('#verse-audio');
const audioToast = document.querySelector('#audio-toast');
const audioStatus = document.querySelector('#audio-status');
const audioTrack = document.querySelector('#audio-track');
const audioToggle = document.querySelector('#audio-toggle');
const audioStop = document.querySelector('#audio-stop');
const sidebar = document.querySelector('#chapter-sidebar');
const sidebarScrim = document.querySelector('#sidebar-scrim');
const menuToggle = document.querySelector('#menu-toggle');
let chapters = [];
let selectedChapter = null;
let currentVerseData = null;
let playbackSession = null;
let arabicScale = 2;
let chapterLoadId = 0;

const audioBase = 'https://verses.quran.com/';

function closeSidebar() {
  sidebar.classList.remove('is-open');
  sidebarScrim.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
}

function renderChapterList(filter = '') {
  const query = filter.trim().toLocaleLowerCase();
  const matchingChapters = chapters.filter((chapter) => {
    const searchable = `${chapter.name} ${chapter.meaning} ${chapter.arabicName} ${chapter.id}`.toLocaleLowerCase();
    return searchable.includes(query);
  });

  chapterList.replaceChildren();
  if (matchingChapters.length === 0) {
    chapterList.innerHTML = '<div class="list-empty">No chapters match that search.</div>';
    return;
  }

  for (const chapter of matchingChapters) {
    const button = document.createElement('button');
    button.className = 'chapter-link';
    button.type = 'button';
    button.dataset.chapterId = chapter.id;
    button.setAttribute('aria-current', selectedChapter?.id === chapter.id ? 'page' : 'false');
    button.innerHTML = `<span class="chapter-number">${String(chapter.id).padStart(3, '0')}</span><span class="chapter-name">${escapeHtml(chapter.name)}</span><span class="chapter-arabic" lang="ar" dir="rtl">${escapeHtml(chapter.arabicName)}</span>`;
    chapterList.append(button);
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function renderChapter(chapter, verseData) {
  selectedChapter = chapter;
  currentVerseData = verseData;
  document.querySelector('#breadcrumb-chapter').textContent = chapter.name;
  document.querySelector('#chapter-title').textContent = chapter.name;
  document.querySelector('#chapter-meaning').textContent = chapter.meaning;
  document.querySelector('#chapter-arabic-name').textContent = chapter.arabicName;
  document.querySelector('#chapter-kicker').textContent = `SURAH ${String(chapter.id).padStart(3, '0')}`;
  document.querySelector('#verse-count').textContent = chapter.verseCount;
  document.querySelector('#translation-version').textContent = verseData.translation.version;

  const versesFragment = document.createDocumentFragment();
  for (const verse of verseData.verses) {
    const article = document.createElement('article');
    article.className = 'verse';
    article.id = `verse-${verse.number}`;
    const footnotes = verse.footnotes
      ? `<details class="verse-footnotes"><summary>Translator notes</summary><p>${escapeHtml(verse.footnotes)}</p></details>`
      : '';
    article.innerHTML = `
      <span class="verse-index" aria-label="Verse ${verse.number}">${verse.number}</span>
      <div class="verse-body">
        <p class="verse-arabic" lang="ar" dir="rtl">${escapeHtml(verse.arabicText)}</p>
        <p class="verse-english" lang="en">${escapeHtml(verse.englishText)}</p>
        ${footnotes}
      </div>
      <div class="verse-actions">
        <button class="verse-action play-button" type="button" data-audio="${escapeHtml(verse.audioUrl ?? '')}" data-verse-number="${verse.number}" aria-label="Play from verse ${verse.number}" title="Play from this verse">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path class="play-fill" d="M8 5.8c0-.7.8-1.1 1.4-.7l9.1 6a1.1 1.1 0 0 1 0 1.8l-9.1 6c-.6.4-1.4 0-1.4-.7z"></path></svg>
        </button>
        <button class="verse-action bookmark-button" type="button" data-bookmark="${chapter.id}:${verse.number}" aria-label="Bookmark verse ${verse.number}" title="Bookmark verse">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.8c0-.5.4-.8.8-.8h8.4c.4 0 .8.3.8.8V20l-5-3.3L7 20z"></path></svg>
        </button>
      </div>`;
    versesFragment.append(article);
  }

  versesElement.replaceChildren(versesFragment);
  updateBookmarks();
  renderChapterList(chapterSearch.value);
  updateChapterSteps();
  renderPlaybackState();
  closeSidebar();
}

function updateChapterSteps() {
  const previous = chapters.find((chapter) => chapter.id === selectedChapter.id - 1);
  const next = chapters.find((chapter) => chapter.id === selectedChapter.id + 1);
  const previousButton = document.querySelector('#previous-chapter');
  const nextButton = document.querySelector('#next-chapter');
  previousButton.disabled = !previous;
  nextButton.disabled = !next;
  previousButton.querySelector('strong').textContent = previous?.name ?? '—';
  nextButton.querySelector('strong').textContent = next?.name ?? '—';
  previousButton.onclick = previous ? () => loadChapter(previous.id) : null;
  nextButton.onclick = next ? () => loadChapter(next.id) : null;
}

async function loadChapter(chapterId) {
  const chapter = chapters.find((item) => item.id === Number(chapterId));
  if (!chapter) return;
  const loadId = ++chapterLoadId;
  selectedChapter = chapter;
  renderChapterList(chapterSearch.value);
  versesElement.innerHTML = '<div class="verse-loading" aria-label="Loading verses"><span></span><span></span><span></span></div>';

  try {
    const response = await fetch(chapter.dataFile);
    if (!response.ok) throw new Error(`Could not load chapter ${chapter.id}.`);
    const verseData = await response.json();
    if (loadId !== chapterLoadId) return;
    renderChapter(chapter, verseData);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    if (loadId !== chapterLoadId) return;
    versesElement.innerHTML = `<p class="error-state">${escapeHtml(error.message)} Check that the local data files are present and start the app through <code>npm start</code>.</p>`;
  }
}

function getBookmarks() {
  try { return new Set(JSON.parse(localStorage.getItem('quran-reader-bookmarks') ?? '[]')); }
  catch { return new Set(); }
}

function updateBookmarks() {
  const bookmarks = getBookmarks();
  document.querySelectorAll('.bookmark-button').forEach((button) => {
    const isBookmarked = bookmarks.has(button.dataset.bookmark);
    button.classList.toggle('bookmarked', isBookmarked);
    button.setAttribute('aria-pressed', String(isBookmarked));
    button.title = isBookmarked ? 'Remove bookmark' : 'Bookmark verse';
  });
}

function renderPlaybackState(status = '') {
  if (!playbackSession) return;
  const verse = playbackSession.verses[playbackSession.currentIndex];
  const isPlaying = !audioElement.paused;
  audioToast.hidden = false;
  document.body.classList.add('audio-active');
  audioStatus.textContent = status || (isPlaying ? 'Now playing' : 'Paused');
  audioTrack.textContent = `Surah ${String(playbackSession.chapter.id).padStart(3, '0')} · ${playbackSession.chapter.name} · Verse ${verse.number} of ${playbackSession.verses.length}`;
  audioToggle.classList.toggle('is-playing', isPlaying);
  audioToggle.setAttribute('aria-label', isPlaying ? 'Pause recitation' : 'Resume recitation');

  document.querySelectorAll('.play-button').forEach((button) => {
    const isCurrentVerse = playbackSession.chapter.id === selectedChapter?.id
      && Number(button.dataset.verseNumber) === verse.number;
    button.classList.toggle('is-playing', isCurrentVerse && isPlaying);
    button.setAttribute('aria-label', isCurrentVerse
      ? (isPlaying ? `Pause verse ${verse.number}` : `Resume verse ${verse.number}`)
      : `Play from verse ${button.dataset.verseNumber}`);
  });
}

function playCurrentVerse() {
  if (!playbackSession) return;
  const verse = playbackSession.verses[playbackSession.currentIndex];
  if (!verse?.audioUrl) {
    stopRecitation();
    return;
  }

  audioElement.src = new URL(verse.audioUrl, audioBase).href;
  renderPlaybackState('Loading audio');
  audioElement.play().catch(() => renderPlaybackState('Audio could not be played'));
}

function startRecitation(chapter, verseData, verseNumber) {
  const verseIndex = verseData.verses.findIndex((verse) => verse.number === verseNumber);
  if (verseIndex < 0) return;
  playbackSession = { chapter, verses: verseData.verses, currentIndex: verseIndex };
  playCurrentVerse();
}

function stopRecitation() {
  playbackSession = null;
  audioElement.pause();
  audioElement.removeAttribute('src');
  audioElement.load();
  audioToast.hidden = true;
  document.body.classList.remove('audio-active');
  document.querySelectorAll('.play-button').forEach((button) => button.classList.remove('is-playing'));
}

function toggleRecitation() {
  if (!playbackSession) return;
  if (audioElement.paused) {
    audioElement.play().catch(() => renderPlaybackState('Audio could not be played'));
  } else {
    audioElement.pause();
  }
}

chapterList.addEventListener('click', (event) => {
  const button = event.target.closest('.chapter-link');
  if (button) loadChapter(button.dataset.chapterId);
});

versesElement.addEventListener('click', (event) => {
  const playButton = event.target.closest('.play-button');
  if (playButton) {
    const verseNumber = Number(playButton.dataset.verseNumber);
    const currentVerse = playbackSession?.verses[playbackSession.currentIndex];
    if (playbackSession?.chapter.id === selectedChapter?.id && currentVerse?.number === verseNumber) {
      toggleRecitation();
    } else if (selectedChapter && currentVerseData) {
      startRecitation(selectedChapter, currentVerseData, verseNumber);
    }
  }

  const bookmarkButton = event.target.closest('.bookmark-button');
  if (bookmarkButton) {
    const bookmarks = getBookmarks();
    bookmarks.has(bookmarkButton.dataset.bookmark)
      ? bookmarks.delete(bookmarkButton.dataset.bookmark)
      : bookmarks.add(bookmarkButton.dataset.bookmark);
    localStorage.setItem('quran-reader-bookmarks', JSON.stringify([...bookmarks]));
    updateBookmarks();
  }
});

audioElement.addEventListener('playing', () => renderPlaybackState());
audioElement.addEventListener('pause', () => renderPlaybackState());
audioElement.addEventListener('ended', () => {
  if (!playbackSession) return;
  if (playbackSession.currentIndex + 1 >= playbackSession.verses.length) {
    stopRecitation();
    return;
  }
  playbackSession.currentIndex += 1;
  playCurrentVerse();
});
audioElement.addEventListener('error', () => {
  if (playbackSession) renderPlaybackState('Audio unavailable');
});
audioToggle.addEventListener('click', toggleRecitation);
audioStop.addEventListener('click', stopRecitation);
chapterSearch.addEventListener('input', () => renderChapterList(chapterSearch.value));
document.querySelector('#text-smaller').addEventListener('click', () => {
  arabicScale = Math.max(1.5, arabicScale - 0.125);
  document.documentElement.style.setProperty('--arabic-size', `${arabicScale}rem`);
});
document.querySelector('#text-larger').addEventListener('click', () => {
  arabicScale = Math.min(3.25, arabicScale + 0.125);
  document.documentElement.style.setProperty('--arabic-size', `${arabicScale}rem`);
});
menuToggle.addEventListener('click', () => {
  const willOpen = !sidebar.classList.contains('is-open');
  sidebar.classList.toggle('is-open', willOpen);
  sidebarScrim.hidden = !willOpen;
  menuToggle.setAttribute('aria-expanded', String(willOpen));
});
sidebarScrim.addEventListener('click', closeSidebar);
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    chapterSearch.focus();
  }
  if (event.key === 'Escape') closeSidebar();
});

async function initialize() {
  try {
    const response = await fetch('data/chapters.json');
    if (!response.ok) throw new Error('Could not load the local chapter index.');
    chapters = await response.json();
    document.querySelector('#chapter-total').textContent = `${chapters.length} chapters`;
    renderChapterList();
    const initialId = Number(new URLSearchParams(location.search).get('chapter')) || 1;
    await loadChapter(initialId);
  } catch (error) {
    chapterList.innerHTML = `<div class="list-empty">${escapeHtml(error.message)} Start the app with <code>npm start</code>.</div>`;
    versesElement.innerHTML = '';
  }
}

initialize();