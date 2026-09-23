// ── Section Manager ──────────────────────────────────────────────────────────

let sections        = [];
let activeSection   = null;
let activeEditorKey = 'body';
let programStages   = [];
let sectionCounter  = 0;

function initSections() {}

function setStagesForDropdowns(stages) {
  programStages = stages || [];
  sections.forEach(s => _populateStageSelect(s));
}

// ── Create section ───────────────────────────────────────────────────────────

function addSection(opts) {
  opts = opts || {};
  sectionCounter++;
  const id      = opts.id      || `sec_${sectionCounter}_${Date.now()}`;
  const name    = opts.name    || `Section ${sections.length + 1}`;
  const stageId = opts.stageId || null;
  const mode    = opts.mode    || 'today';

  const tpl = document.getElementById('sectionTemplate').content.cloneNode(true);
  const container = document.getElementById('sectionsContainer');
  container.appendChild(tpl);
  // After appending the fragment, grab the newly added element from the live DOM
  const el = container.lastElementChild;
  el.dataset.sectionId = id;
  el.querySelector('.section-name-input').value = name;

  const editorBody = createRichEditor(el.querySelector('.editor-slot-body'),
    'HTML content — click a field on the left to insert…');

  const section = { id, name, stageId, mode, el, editors: { body: editorBody } };
  sections.push(section);

  section.editors.body._jodit.events.on('focus', () => _setActive(section, 'body'));
  section.editors.body.onChange(() => refreshJson());

  _bindControls(section);

  // Set mode dropdown value
  el.querySelector('.mode-select').value = mode;

  // Populate stage after push so _populateStageSelect can find it
  _populateStageSelect(section);
  if (stageId) el.querySelector('.stage-select').value = stageId;

  if (opts.htmlBody) editorBody.setHtml(opts.htmlBody);

  // Accordion: collapse all others, expand this one
  _expandOnly(section);
  return section;
}

// ── Accordion ────────────────────────────────────────────────────────────────

function _expandOnly(section) {
  sections.forEach(s => {
    if (s.id === section.id) {
      s.el.querySelector('.section-body').classList.remove('collapsed');
      s.el.querySelector('.btn-collapse').textContent = '▲';
    } else {
      s.el.querySelector('.section-body').classList.add('collapsed');
      s.el.querySelector('.btn-collapse').textContent = '▼';
    }
  });
  _setActive(section, 'body');
}

function _setActive(section, editorKey) {
  activeSection   = section;
  activeEditorKey = editorKey || 'body';
  document.querySelectorAll('.section-block').forEach(b => b.classList.remove('focused'));
  section.el.classList.add('focused');
}

function _activeEditor(section) {
  section = section || activeSection;
  if (!section) return null;
  return section.editors.body;
}

function deleteSection(id) {
  const idx = sections.findIndex(s => s.id === id);
  if (idx === -1) return;
  const s = sections[idx];
  try { s.editors.body._jodit.destruct(); } catch(e) {}
  s.el.remove();
  sections.splice(idx, 1);
  if (activeSection && activeSection.id === id) {
    const next = sections[sections.length - 1] || null;
    if (next) _expandOnly(next);
    else activeSection = null;
  }
}

// ── Controls ─────────────────────────────────────────────────────────────────

function _bindControls(section) {
  const el = section.el;

  el.querySelector('.section-name-input').addEventListener('input', e => {
    section.name = e.target.value;
    refreshJson();
  });

  el.querySelector('.stage-select').addEventListener('change', e => {
    section.stageId = e.target.value || null;
    refreshJson();
  });

  el.querySelector('.mode-select').addEventListener('change', e => {
    section.mode = e.target.value;
    refreshJson();
  });

  el.querySelector('.btn-collapse').addEventListener('click', () => {
    const body      = el.querySelector('.section-body');
    const collapsed = body.classList.contains('collapsed');
    if (collapsed) {
      // Expand this one, collapse rest
      _expandOnly(section);
    } else {
      // Just collapse this one
      body.classList.add('collapsed');
      el.querySelector('.btn-collapse').textContent = '▼';
    }
  });

  el.querySelector('.btn-delete-section').addEventListener('click', () => {
    if (sections.length <= 1) { alert('At least one section is required.'); return; }
    if (confirm(`Delete "${section.name}"?`)) { deleteSection(section.id); refreshJson(); }
  });
}

function _populateStageSelect(section) {
  const sel     = section.el.querySelector('.stage-select');
  const current = section.stageId;
  sel.innerHTML = '<option value="">— no stage —</option>';
  programStages.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st.id; opt.textContent = st.name;
    if (current === st.id) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── Insert field ─────────────────────────────────────────────────────────────

function insertFieldIntoActiveSection(cfg) {
  if (!activeSection) activeSection = sections[sections.length - 1];
  if (!activeSection) return;
  const editor = _activeEditor(activeSection);
  if (!editor) return;
  const expr = buildExpression(cfg.uid, cfg.attr);
  editor.insertHtmlAtCursor(expr);
  editor.focus();
  refreshJson();
}

// ── Used UIDs (for optionSets payload) ───────────────────────────────────────

function getUsedFieldUids() {
  const uids    = new Set();
  const pattern = /\{([A-Za-z][A-Za-z0-9]{10})(?:\.[A-Za-z]+)?\}/g;
  sections.forEach(s => {
    const html = s.editors.body.getHtml();
    let m;
    while ((m = pattern.exec(html)) !== null) uids.add(m[1]);
  });
  return uids;
}

// ── Serialise ─────────────────────────────────────────────────────────────────

function serialiseSections() {
  return sections.map(s => {
    const obj = {
      id:       s.id,
      title:    s.name,
      mode:     s.mode || 'today',
      htmlBody: quillHtmlToRaw(s.editors.body.getHtml()),
    };
    if (s.stageId) obj.programStage = s.stageId;
    return obj;
  });
}

// ── Restore ───────────────────────────────────────────────────────────────────

function restoreSections(saved) {
  sections.forEach(s => {
    try { s.editors.body._jodit.destruct(); } catch(e) {}
    s.el.remove();
  });
  sections = []; activeSection = null; sectionCounter = 0;
  if (!saved || !saved.length) { addSection(); return; }
  saved.forEach(s => addSection({
    id:       s.id,
    name:     s.title || s.name || 'Section',
    stageId:  s.programStage || null,
    mode:     s.mode || 'today',
    htmlBody: rehydrateExpressions(s.htmlBody || ''),
  }));
  // After restore, expand only the first section
  if (sections.length) _expandOnly(sections[0]);
}
