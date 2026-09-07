(() => {
  const STORAGE_KEY = 'storydesk.v1';
  const els = {};
  const $ = (id) => document.getElementById(id);
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const now = () => new Date().toISOString();

  let state = loadState();
  let editingProjectId = null;
  let editingChapterId = null;
  let activeIdeaFilter = 'All';
  let saveTimer = null;

  function defaultState() {
    return {
      projects: [],
      activeProjectId: null,
      activeChapterId: null,
      ui: { shelfOpen: true, theme: 'light', focus: false }
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || !Array.isArray(parsed.projects)) return defaultState();
      parsed.ui = { shelfOpen: true, theme: 'light', focus: false, ...(parsed.ui || {}) };
      return parsed;
    } catch {
      return defaultState();
    }
  }

  function saveState({ quiet = true } = {}) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!quiet) toast('Saved');
  }

  function debounceSave() {
    $('saveState').textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveState();
      $('saveState').textContent = 'Saved';
    }, 350);
  }

  function currentProject() {
    return state.projects.find(p => p.id === state.activeProjectId) || null;
  }

  function currentChapter() {
    const p = currentProject();
    return p?.chapters.find(c => c.id === state.activeChapterId) || null;
  }

  function normalizeProject(project) {
    return {
      id: project.id || uuid(),
      name: project.name || 'Untitled Project',
      description: project.description || '',
      wordGoal: Number(project.wordGoal) || 0,
      createdAt: project.createdAt || now(),
      updatedAt: project.updatedAt || now(),
      chapters: Array.isArray(project.chapters) ? project.chapters.map(c => ({
        id: c.id || uuid(), title: c.title || 'Untitled Chapter', content: c.content || '', notes: c.notes || '',
        status: c.status || 'Drafting', createdAt: c.createdAt || now(), updatedAt: c.updatedAt || now()
      })) : [],
      ideas: Array.isArray(project.ideas) ? project.ideas.map(i => ({
        id: i.id || uuid(), text: i.text || '', type: i.type || 'Idea', pinned: !!i.pinned, done: !!i.done,
        createdAt: i.createdAt || now()
      })) : []
    };
  }

  function textFromHtml(html = '') {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.innerText || div.textContent || '';
  }

  function countWords(text = '') {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean ? clean.split(' ').length : 0;
  }

  function escapeHtml(str = '') {
    return str.replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function chapterWords(chapter) {
    return countWords(textFromHtml(chapter?.content || ''));
  }

  function projectWords(project) {
    return project?.chapters.reduce((sum, c) => sum + chapterWords(c), 0) || 0;
  }

  function ensureActiveSelection() {
    if (!state.projects.length) {
      state.activeProjectId = null;
      state.activeChapterId = null;
      return;
    }
    let p = currentProject();
    if (!p) {
      state.activeProjectId = state.projects[0].id;
      p = state.projects[0];
    }
    if (!p.chapters.length) {
      state.activeChapterId = null;
      return;
    }
    if (!p.chapters.some(c => c.id === state.activeChapterId)) {
      state.activeChapterId = p.chapters[0].id;
    }
  }

  function renderAll() {
    ensureActiveSelection();
    renderTheme();
    renderProjects();
    renderOverview();
    renderChapters();
    renderEditor();
    renderIdeas();
    renderLayout();
  }

  function renderTheme() {
    document.documentElement.dataset.theme = state.ui.theme || 'light';
    $('themeBtn').textContent = state.ui.theme === 'dark' ? '☀' : '◐';
  }

  function renderLayout() {
    document.body.classList.toggle('shelf-closed', !state.ui.shelfOpen);
    document.body.classList.toggle('focus-mode', !!state.ui.focus);
    $('focusBtn').classList.toggle('active', !!state.ui.focus);
  }

  function renderProjects() {
    const select = $('projectSelect');
    select.innerHTML = '';
    if (!state.projects.length) {
      const opt = document.createElement('option');
      opt.textContent = 'No projects';
      select.appendChild(opt);
      select.disabled = true;
    } else {
      select.disabled = false;
      state.projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
      });
      select.value = state.activeProjectId;
    }
    $('editProjectBtn').disabled = !currentProject();
    $('deleteProjectBtn').disabled = !currentProject();
    $('addChapterBtn').disabled = !currentProject();
  }

  function renderOverview() {
    const p = currentProject();
    if (!p) {
      $('projectDescription').textContent = 'No project selected.';
      $('projectWordCount').textContent = '0';
      $('goalLabel').textContent = 'No goal';
      $('goalFill').style.width = '0%';
      return;
    }
    $('projectDescription').textContent = p.description || 'No description yet.';
    const words = projectWords(p);
    $('projectWordCount').textContent = words.toLocaleString();
    if (p.wordGoal) {
      $('goalLabel').textContent = `${Math.min(100, Math.round(words / p.wordGoal * 100))}% of ${p.wordGoal.toLocaleString()}`;
      $('goalFill').style.width = `${Math.min(100, words / p.wordGoal * 100)}%`;
    } else {
      $('goalLabel').textContent = 'No goal';
      $('goalFill').style.width = '0%';
    }
  }

  function renderChapters() {
    const list = $('chapterList');
    const p = currentProject();
    const filter = $('chapterFilter').value.trim().toLowerCase();
    list.innerHTML = '';
    if (!p) return;
    const chapters = p.chapters.filter(c => !filter || `${c.title} ${c.status}`.toLowerCase().includes(filter));
    if (!chapters.length) {
      list.innerHTML = `<div class="no-ideas">${p.chapters.length ? 'No matching chapters.' : 'No chapters yet. Add one when you’re ready.'}</div>`;
      return;
    }
    chapters.forEach((c, index) => {
      const button = document.createElement('button');
      button.className = `chapter-item${c.id === state.activeChapterId ? ' active' : ''}`;
      button.dataset.id = c.id;
      button.innerHTML = `
        <div class="chapter-item-title">${escapeHtml(c.title)}</div>
        <div class="chapter-item-meta">
          <span>${chapterWords(c).toLocaleString()} words</span>
          <span>${escapeHtml(c.status)}</span>
        </div>`;
      button.addEventListener('click', () => {
        flushEditor();
        state.activeChapterId = c.id;
        saveState();
        renderAll();
        document.body.classList.remove('mobile-nav-open');
      });
      list.appendChild(button);
    });
  }

  function renderEditor() {
    const p = currentProject();
    const c = currentChapter();
    const hasProject = !!p;
    $('emptyState').classList.toggle('hidden', hasProject && !!c);
    $('editorShell').classList.toggle('hidden', !hasProject || !c);

    if (!hasProject) {
      $('emptyState').querySelector('h1').textContent = 'Start a story.';
      $('emptyState').querySelector('p').textContent = 'Create a project, split it into chapters, and throw every stray thought onto the Idea Shelf before it disappears.';
      $('emptyCreateBtn').textContent = 'Create your first project';
      return;
    }

    if (!c) {
      $('emptyState').classList.remove('hidden');
      $('emptyState').querySelector('h1').textContent = 'Your project is ready.';
      $('emptyState').querySelector('p').textContent = 'Add the first chapter. It can be Chapter 1, a prologue, a scene dump—whatever gets the story moving.';
      $('emptyCreateBtn').textContent = 'Add first chapter';
      return;
    }

    $('breadcrumb').textContent = `${p.name} / ${c.title}`;
    $('chapterTitle').value = c.title;
    $('chapterStatus').value = c.status || 'Drafting';
    if ($('editor').innerHTML !== c.content) $('editor').innerHTML = c.content || '';
    $('chapterNotes').value = c.notes || '';
    updateEditorStats();
  }

  function updateEditorStats() {
    const c = currentChapter();
    if (!c) return;
    const text = $('editor').innerText || '';
    const words = countWords(text);
    $('chapterWordCount').textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
    $('readTime').textContent = `${Math.max(1, Math.ceil(words / 230))} min read`;
    $('chapterCharCount').textContent = `${text.length.toLocaleString()} characters`;
    renderOverview();
    renderChapters();
  }

  function renderIdeas() {
    const p = currentProject();
    const list = $('ideaList');
    const search = $('ideaSearch').value.trim().toLowerCase();
    list.innerHTML = '';
    if (!p) {
      $('ideaCountLabel').textContent = '0 notes';
      list.innerHTML = '<div class="no-ideas">Create a project to start collecting ideas.</div>';
      return;
    }
    let ideas = [...p.ideas];
    if (activeIdeaFilter === 'Idea') ideas = ideas.filter(i => ['Idea','Plot','Character','World','Research'].includes(i.type));
    else if (activeIdeaFilter !== 'All') ideas = ideas.filter(i => i.type === activeIdeaFilter);
    if (search) ideas = ideas.filter(i => `${i.text} ${i.type}`.toLowerCase().includes(search));
    ideas.sort((a,b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt));
    $('ideaCountLabel').textContent = `${p.ideas.length} ${p.ideas.length === 1 ? 'note' : 'notes'}`;
    if (!ideas.length) {
      list.innerHTML = '<div class="no-ideas">Nothing on this shelf yet.</div>';
      return;
    }
    ideas.forEach(idea => {
      const card = document.createElement('div');
      card.className = `idea-card${idea.pinned ? ' pinned' : ''}${idea.done ? ' done' : ''}`;
      card.innerHTML = `
        <div class="idea-card-top">
          <span class="idea-badge">${escapeHtml(idea.type)}</span>
          <div class="idea-actions">
            <button data-action="done" title="${idea.done ? 'Mark active' : 'Mark done'}">${idea.done ? '↶' : '✓'}</button>
            <button data-action="pin" title="${idea.pinned ? 'Unpin' : 'Pin'}">${idea.pinned ? '★' : '☆'}</button>
            <button data-action="delete" title="Delete">×</button>
          </div>
        </div>
        <div class="idea-text">${escapeHtml(idea.text)}</div>
        <div class="idea-date">${fmtDate(idea.createdAt)}</div>`;
      card.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => handleIdeaAction(idea.id, btn.dataset.action));
      });
      list.appendChild(card);
    });
  }

  function handleIdeaAction(id, action) {
    const p = currentProject();
    if (!p) return;
    const idea = p.ideas.find(i => i.id === id);
    if (!idea) return;
    if (action === 'done') idea.done = !idea.done;
    if (action === 'pin') idea.pinned = !idea.pinned;
    if (action === 'delete') p.ideas = p.ideas.filter(i => i.id !== id);
    p.updatedAt = now();
    saveState();
    renderIdeas();
  }

  function flushEditor() {
    const c = currentChapter();
    const p = currentProject();
    if (!c || !p || $('editorShell').classList.contains('hidden')) return;
    c.content = $('editor').innerHTML;
    c.notes = $('chapterNotes').value;
    c.title = $('chapterTitle').value.trim() || c.title || 'Untitled Chapter';
    c.status = $('chapterStatus').value;
    c.updatedAt = now();
    p.updatedAt = now();
    saveState();
  }

  function openProjectModal(project = null) {
    editingProjectId = project?.id || null;
    $('projectModalTitle').textContent = project ? 'Edit project' : 'New project';
    $('projectNameInput').value = project?.name || '';
    $('projectDescriptionInput').value = project?.description || '';
    $('projectGoalInput').value = project?.wordGoal || '';
    $('modalBackdrop').classList.remove('hidden');
    setTimeout(() => $('projectNameInput').focus(), 0);
  }

  function closeProjectModal() {
    $('modalBackdrop').classList.add('hidden');
    editingProjectId = null;
  }

  function openChapterModal(chapter = null) {
    editingChapterId = chapter?.id || null;
    $('chapterModalTitle').textContent = chapter ? 'Rename chapter' : 'New chapter';
    const p = currentProject();
    $('chapterNameInput').value = chapter?.title || `Chapter ${(p?.chapters.length || 0) + 1}`;
    $('chapterModalBackdrop').classList.remove('hidden');
    setTimeout(() => { $('chapterNameInput').focus(); $('chapterNameInput').select(); }, 0);
  }

  function closeChapterModal() {
    $('chapterModalBackdrop').classList.add('hidden');
    editingChapterId = null;
  }

  function submitProject(ev) {
    ev.preventDefault();
    const name = $('projectNameInput').value.trim();
    if (!name) return;
    const description = $('projectDescriptionInput').value.trim();
    const wordGoal = Math.max(0, Number($('projectGoalInput').value) || 0);
    if (editingProjectId) {
      const p = state.projects.find(p => p.id === editingProjectId);
      if (p) {
        p.name = name; p.description = description; p.wordGoal = wordGoal; p.updatedAt = now();
      }
      toast('Project updated');
    } else {
      const project = normalizeProject({ name, description, wordGoal, chapters: [], ideas: [] });
      state.projects.push(project);
      state.activeProjectId = project.id;
      state.activeChapterId = null;
      toast('Project created');
    }
    saveState();
    closeProjectModal();
    renderAll();
  }

  function submitChapter(ev) {
    ev.preventDefault();
    const p = currentProject();
    if (!p) return;
    const title = $('chapterNameInput').value.trim();
    if (!title) return;
    if (editingChapterId) {
      const c = p.chapters.find(c => c.id === editingChapterId);
      if (c) { c.title = title; c.updatedAt = now(); }
      toast('Chapter renamed');
    } else {
      const c = { id: uuid(), title, content: '', notes: '', status: 'Drafting', createdAt: now(), updatedAt: now() };
      p.chapters.push(c);
      state.activeChapterId = c.id;
      toast('Chapter added');
    }
    p.updatedAt = now();
    saveState();
    closeChapterModal();
    renderAll();
  }

  function deleteProject() {
    const p = currentProject();
    if (!p) return;
    if (!confirm(`Delete “${p.name}” and all of its chapters and ideas? This cannot be undone.`)) return;
    state.projects = state.projects.filter(x => x.id !== p.id);
    state.activeProjectId = state.projects[0]?.id || null;
    state.activeChapterId = state.projects[0]?.chapters[0]?.id || null;
    saveState(); renderAll(); toast('Project deleted');
  }

  function deleteChapter(chapter = currentChapter()) {
    const p = currentProject();
    if (!p || !chapter) return;
    if (!confirm(`Delete “${chapter.title}”? This cannot be undone.`)) return;
    const idx = p.chapters.findIndex(c => c.id === chapter.id);
    p.chapters.splice(idx, 1);
    state.activeChapterId = p.chapters[Math.min(idx, p.chapters.length - 1)]?.id || null;
    saveState(); renderAll(); toast('Chapter deleted');
  }

  function duplicateChapter() {
    const p = currentProject(); const c = currentChapter();
    if (!p || !c) return;
    const idx = p.chapters.findIndex(x => x.id === c.id);
    const copy = { ...c, id: uuid(), title: `${c.title} copy`, createdAt: now(), updatedAt: now() };
    p.chapters.splice(idx + 1, 0, copy);
    state.activeChapterId = copy.id;
    saveState(); renderAll(); toast('Chapter duplicated');
  }

  function moveChapter(delta) {
    const p = currentProject(); const c = currentChapter();
    if (!p || !c) return;
    const idx = p.chapters.findIndex(x => x.id === c.id);
    const target = idx + delta;
    if (target < 0 || target >= p.chapters.length) return;
    [p.chapters[idx], p.chapters[target]] = [p.chapters[target], p.chapters[idx]];
    saveState(); renderChapters();
  }

  function handleChapterMenu(action) {
    $('chapterMenu').classList.add('hidden');
    if (action === 'rename') openChapterModal(currentChapter());
    if (action === 'duplicate') duplicateChapter();
    if (action === 'move-up') moveChapter(-1);
    if (action === 'move-down') moveChapter(1);
    if (action === 'delete') deleteChapter();
  }

  function addIdea(ev) {
    ev.preventDefault();
    const p = currentProject();
    const text = $('ideaInput').value.trim();
    if (!p) { toast('Create a project first'); return; }
    if (!text) return;
    p.ideas.push({ id: uuid(), text, type: $('ideaType').value, pinned: false, done: false, createdAt: now() });
    p.updatedAt = now();
    $('ideaInput').value = '';
    saveState(); renderIdeas(); toast('Added to Idea Shelf');
  }

  function clearDoneIdeas() {
    const p = currentProject();
    if (!p) return;
    const count = p.ideas.filter(i => i.done).length;
    if (!count) { toast('No completed ideas to clear'); return; }
    if (!confirm(`Clear ${count} completed ${count === 1 ? 'note' : 'notes'}?`)) return;
    p.ideas = p.ideas.filter(i => !i.done);
    saveState(); renderIdeas();
  }

  function exportProject() {
    flushEditor();
    const p = currentProject();
    if (!p) { toast('No project to export'); return; }
    const backup = {
      app: 'StoryDesk', version: 1, exportedAt: now(), project: p
    };
    download(`${safeFilename(p.name)}.storydesk.json`, JSON.stringify(backup, null, 2), 'application/json');

    const markdown = projectToMarkdown(p);
    download(`${safeFilename(p.name)}.md`, markdown, 'text/markdown');
    toast('Exported JSON backup + Markdown manuscript');
  }

  function projectToMarkdown(p) {
    const lines = [`# ${p.name}`, ''];
    if (p.description) lines.push(p.description, '');
    lines.push(`> Total words: ${projectWords(p).toLocaleString()}`, '');
    p.chapters.forEach(c => {
      lines.push(`## ${c.title}`, '', htmlToMarkdownish(c.content), '');
      if (c.notes) lines.push(`<!-- Chapter notes: ${c.notes.replace(/-->/g, '-- >')} -->`, '');
    });
    if (p.ideas.length) {
      lines.push('---', '', '# Idea Shelf', '');
      p.ideas.forEach(i => lines.push(`- [${i.done ? 'x' : ' '}] **${i.type}:** ${i.text.replace(/\n/g, ' ')}`));
    }
    return lines.join('\n');
  }

  function htmlToMarkdownish(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    div.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    div.querySelectorAll('strong,b').forEach(el => el.replaceWith(`**${el.textContent}**`));
    div.querySelectorAll('em,i').forEach(el => el.replaceWith(`*${el.textContent}*`));
    div.querySelectorAll('h2').forEach(el => el.replaceWith(`\n### ${el.textContent}\n`));
    div.querySelectorAll('blockquote').forEach(el => el.replaceWith(`\n> ${el.textContent}\n`));
    div.querySelectorAll('div,p').forEach(el => el.replaceWith(`${el.textContent}\n\n`));
    return (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function safeFilename(name) {
    return (name || 'story').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim().replace(/\s+/g, '-').slice(0, 100) || 'story';
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function importProject(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const source = parsed.project || parsed;
      if (!source || !source.name || !Array.isArray(source.chapters)) throw new Error('Not a StoryDesk project');
      const p = normalizeProject(source);
      p.id = uuid();
      p.name = state.projects.some(x => x.name === p.name) ? `${p.name} (imported)` : p.name;
      p.chapters = p.chapters.map(c => ({ ...c, id: uuid() }));
      p.ideas = p.ideas.map(i => ({ ...i, id: uuid() }));
      state.projects.push(p);
      state.activeProjectId = p.id;
      state.activeChapterId = p.chapters[0]?.id || null;
      saveState(); renderAll(); toast('Project imported');
    } catch (err) {
      alert(`Could not import this file. ${err.message}`);
    } finally {
      $('importFile').value = '';
    }
  }

  function openSearch() {
    $('searchOverlay').classList.remove('hidden');
    $('globalSearchInput').value = '';
    renderSearchResults('');
    setTimeout(() => $('globalSearchInput').focus(), 0);
  }

  function closeSearch() {
    $('searchOverlay').classList.add('hidden');
  }

  function renderSearchResults(query) {
    const q = query.trim().toLowerCase();
    const results = [];
    state.projects.forEach(p => {
      p.chapters.forEach(c => {
        const content = textFromHtml(c.content);
        const hay = `${p.name} ${c.title} ${content} ${c.notes}`.toLowerCase();
        if (!q || hay.includes(q)) results.push({ kind:'Chapter', projectId:p.id, chapterId:c.id, title:`${p.name} — ${c.title}`, snippet: snippetAround(content || c.notes || 'Empty chapter', q) });
      });
      p.ideas.forEach(i => {
        const hay = `${p.name} ${i.type} ${i.text}`.toLowerCase();
        if (q && hay.includes(q)) results.push({ kind:i.type, projectId:p.id, ideaId:i.id, title:p.name, snippet:snippetAround(i.text, q) });
      });
    });
    const box = $('searchResults');
    box.innerHTML = '';
    if (!results.length) {
      box.innerHTML = `<div class="search-empty">${q ? 'No matches found.' : 'Type to search your writing and Idea Shelf.'}</div>`;
      return;
    }
    results.slice(0, 80).forEach(r => {
      const b = document.createElement('button');
      b.className = 'search-result';
      b.innerHTML = `<div class="search-result-kind">${escapeHtml(r.kind)}</div><div class="search-result-title">${escapeHtml(r.title)}</div><div class="search-result-snippet">${escapeHtml(r.snippet)}</div>`;
      b.addEventListener('click', () => {
        flushEditor();
        state.activeProjectId = r.projectId;
        const p = currentProject();
        if (r.chapterId) state.activeChapterId = r.chapterId;
        else if (!p.chapters.some(c => c.id === state.activeChapterId)) state.activeChapterId = p.chapters[0]?.id || null;
        if (r.ideaId) state.ui.shelfOpen = true;
        saveState(); closeSearch(); renderAll();
      });
      box.appendChild(b);
    });
  }

  function snippetAround(text, q) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!q) return clean.slice(0, 130);
    const idx = clean.toLowerCase().indexOf(q);
    const start = Math.max(0, idx - 55);
    return `${start ? '…' : ''}${clean.slice(start, start + 150)}${start + 150 < clean.length ? '…' : ''}`;
  }

  function insertAtSelection(text) {
    $('editor').focus();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    sel.removeAllRanges(); sel.addRange(range);
    $('editor').dispatchEvent(new Event('input', { bubbles: true }));
  }

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'toast'; node.textContent = message;
    $('toastStack').appendChild(node);
    setTimeout(() => node.remove(), 2200);
  }

  function bindEvents() {
    $('newProjectBtn').addEventListener('click', () => openProjectModal());
    $('emptyCreateBtn').addEventListener('click', () => currentProject() ? openChapterModal() : openProjectModal());
    $('editProjectBtn').addEventListener('click', () => openProjectModal(currentProject()));
    $('deleteProjectBtn').addEventListener('click', deleteProject);
    $('projectSelect').addEventListener('change', e => {
      flushEditor();
      state.activeProjectId = e.target.value;
      const p = currentProject();
      state.activeChapterId = p?.chapters[0]?.id || null;
      saveState(); renderAll();
    });
    $('addChapterBtn').addEventListener('click', () => openChapterModal());
    $('chapterFilter').addEventListener('input', renderChapters);

    $('projectForm').addEventListener('submit', submitProject);
    $('closeProjectModal').addEventListener('click', closeProjectModal);
    $('cancelProjectModal').addEventListener('click', closeProjectModal);
    $('modalBackdrop').addEventListener('click', e => { if (e.target === $('modalBackdrop')) closeProjectModal(); });

    $('chapterForm').addEventListener('submit', submitChapter);
    $('closeChapterModal').addEventListener('click', closeChapterModal);
    $('cancelChapterModal').addEventListener('click', closeChapterModal);
    $('chapterModalBackdrop').addEventListener('click', e => { if (e.target === $('chapterModalBackdrop')) closeChapterModal(); });

    $('chapterMenuBtn').addEventListener('click', e => { e.stopPropagation(); $('chapterMenu').classList.toggle('hidden'); });
    $('chapterMenu').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => handleChapterMenu(btn.dataset.action)));
    document.addEventListener('click', e => { if (!e.target.closest('#chapterMenu') && !e.target.closest('#chapterMenuBtn')) $('chapterMenu').classList.add('hidden'); });

    $('chapterTitle').addEventListener('input', () => {
      const c = currentChapter(); const p = currentProject(); if (!c || !p) return;
      c.title = $('chapterTitle').value || 'Untitled Chapter'; c.updatedAt = now(); p.updatedAt = now();
      $('breadcrumb').textContent = `${p.name} / ${c.title}`;
      debounceSave(); renderChapters();
    });
    $('chapterStatus').addEventListener('change', () => { const c = currentChapter(); if (!c) return; c.status = $('chapterStatus').value; debounceSave(); renderChapters(); });
    $('editor').addEventListener('input', () => {
      const c = currentChapter(); const p = currentProject(); if (!c || !p) return;
      c.content = $('editor').innerHTML; c.updatedAt = now(); p.updatedAt = now();
      debounceSave(); updateEditorStats();
    });
    $('chapterNotes').addEventListener('input', () => { const c = currentChapter(); if (!c) return; c.notes = $('chapterNotes').value; debounceSave(); });
    $('toggleNotesBtn').addEventListener('click', () => $('chapterNotesPanel').classList.toggle('hidden'));

    $('formatToolbar').querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        $('editor').focus();
        document.execCommand(btn.dataset.cmd, false, btn.dataset.value || null);
        $('editor').dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    $('formatToolbar').querySelector('[data-insert="em-dash"]').addEventListener('click', () => insertAtSelection('—'));
    $('formatToolbar').querySelector('[data-insert="scene-break"]').addEventListener('click', () => insertAtSelection('\n\n⁂\n\n'));

    $('ideaForm').addEventListener('submit', addIdea);
    $('ideaSearch').addEventListener('input', renderIdeas);
    $('ideaTypeTabs').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
      activeIdeaFilter = btn.dataset.type;
      $('ideaTypeTabs').querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      renderIdeas();
    }));
    $('clearDoneIdeasBtn').addEventListener('click', clearDoneIdeas);

    $('shelfToggleBtn').addEventListener('click', toggleShelf);
    $('closeShelfBtn').addEventListener('click', toggleShelf);
    $('focusBtn').addEventListener('click', () => { state.ui.focus = !state.ui.focus; saveState(); renderLayout(); });
    $('themeBtn').addEventListener('click', () => { state.ui.theme = state.ui.theme === 'dark' ? 'light' : 'dark'; saveState(); renderTheme(); });
    $('mobileNavBtn').addEventListener('click', () => document.body.classList.toggle('mobile-nav-open'));

    $('exportBtn').addEventListener('click', exportProject);
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', e => importProject(e.target.files[0]));

    $('searchBtn').addEventListener('click', openSearch);
    $('closeSearchBtn').addEventListener('click', closeSearch);
    $('globalSearchInput').addEventListener('input', e => renderSearchResults(e.target.value));
    $('searchOverlay').addEventListener('click', e => { if (e.target === $('searchOverlay')) closeSearch(); });

    window.addEventListener('beforeunload', flushEditor);
    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'i') { e.preventDefault(); toggleShelf(); }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); flushEditor(); toast('Saved'); }
      if (e.key === 'Escape') {
        closeSearch();
        $('chapterMenu').classList.add('hidden');
        document.body.classList.remove('mobile-nav-open');
      }
    });
  }

  function toggleShelf() {
    state.ui.shelfOpen = !state.ui.shelfOpen;
    state.ui.focus = false;
    saveState(); renderLayout();
  }

  function init() {
    Object.assign(els, {
      editor: $('editor')
    });
    bindEvents();
    renderAll();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  init();
})();
