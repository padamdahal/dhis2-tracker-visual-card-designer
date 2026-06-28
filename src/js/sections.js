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
  const id   = opts.id   || `sec_${sectionCounter}_${Date.now()}`;
  const name = opts.name || `Section ${sections.length + 1}`;
  const type = opts.type || 'single';

  const tpl = document.getElementById('sectionTemplate').content.cloneNode(true);
  const el  = tpl.querySelector('.section-block');
  el.dataset.sectionId = id;
  el.querySelector('.section-name-input').value = name;

  document.getElementById('sectionsContainer').appendChild(el);

  const editorHeader = createRichEditor(el.querySelector('.editor-slot-header'),
    'Header HTML — printed once, e.g. table-opening tag + column headers…');
  const editorBody   = createRichEditor(el.querySelector('.editor-slot-body'),
    'Body HTML — click a field on the left to insert it here…');
  const editorFooter = createRichEditor(el.querySelector('.editor-slot-footer'),
    'Footer HTML — printed once, e.g. closing tags…');

  const section = {
    id, name, type,
    stageId: opts.stageId || null,
    el,
    editors: { header: editorHeader, body: editorBody, footer: editorFooter },
  };
  sections.push(section);

  // Track focus per editor using Jodit's focus event
  ['header','body','footer'].forEach(key => {
    section.editors[key]._jodit.events.on('focus', () => {
      _setActive(section, key);
    });
    section.editors[key].onChange(() => refreshJson());
  });

  _applyType(section, type);
  _bindControls(section);

  if (opts.htmlHeader) editorHeader.setHtml(opts.htmlHeader);
  if (opts.htmlBody)   editorBody.setHtml(opts.htmlBody);
  if (opts.htmlFooter) editorFooter.setHtml(opts.htmlFooter);

  _setActive(section, 'body');
  return section;
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
  // For single sections, always use body even if activeEditorKey says otherwise
  if (section.type === 'single') return section.editors.body;
  return section.editors[activeEditorKey] || section.editors.body;
}

function deleteSection(id) {
  const idx = sections.findIndex(s => s.id === id);
  if (idx === -1) return;
  const s = sections[idx];
  ['header','body','footer'].forEach(key => {
    try { s.editors[key]._jodit.destruct(); } catch(e) {}
  });
  s.el.remove();
  sections.splice(idx, 1);
  if (activeSection && activeSection.id === id) {
    activeSection = sections[sections.length - 1] || null;
  }
}

// ── Controls ─────────────────────────────────────────────────────────────────

function _bindControls(section) {
  const el = section.el;

  el.querySelector('.section-name-input').addEventListener('input', e => {
    section.name = e.target.value;
    refreshJson();
  });

  el.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => _applyType(section, btn.dataset.type));
  });

  el.querySelector('.stage-select').addEventListener('change', e => {
    section.stageId = e.target.value || null;
    refreshJson();
  });

  el.querySelector('.btn-collapse').addEventListener('click', () => {
    const body = el.querySelector('.section-body');
    const collapsed = body.classList.toggle('collapsed');
    el.querySelector('.btn-collapse').textContent = collapsed ? '▼' : '▲';
  });

  el.querySelector('.btn-delete-section').addEventListener('click', () => {
    if (sections.length <= 1) { alert('At least one section is required.'); return; }
    if (confirm(`Delete "${section.name}"?`)) { deleteSection(section.id); refreshJson(); }
  });
}

function _applyType(section, type) {
  section.type = type;
  const el  = section.el;
  const sel = el.querySelector('.stage-select');

  el.querySelectorAll('.type-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.type === type));
  el.classList.toggle('type-repeatable', type === 'repeatable');

  // Show/hide header & footer slots — only meaningful for repeatable
  const headerWrap = el.querySelector('.editor-wrap-header');
  const footerWrap = el.querySelector('.editor-wrap-footer');
  if (headerWrap) headerWrap.classList.toggle('hidden', type !== 'repeatable');
  if (footerWrap) footerWrap.classList.toggle('hidden', type !== 'repeatable');

  // Update body hint text
  const bodyHint = el.querySelector('.body-hint');
  if (bodyHint) {
    bodyHint.textContent = type === 'repeatable'
      ? '(repeats once per row)'
      : '(the full card content)';
  }

  if (type === 'repeatable') {
    sel.classList.remove('hidden');
    _populateStageSelect(section);
    if (activeSection && activeSection.id === section.id) activeEditorKey = 'body';
  } else {
    sel.classList.add('hidden');
    section.stageId = null;
    if (activeSection && activeSection.id === section.id) activeEditorKey = 'body';
  }
  refreshJson();
}

function _populateStageSelect(section) {
  const sel = section.el.querySelector('.stage-select');
  const current = section.stageId;
  sel.innerHTML = '<option value="">— stage (optional) —</option>';
  programStages.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st.id; opt.textContent = st.name;
    if (current === st.id) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── Insert field into active editor ──────────────────────────────────────────

function insertFieldIntoActiveSection(cfg) {
  if (!activeSection) activeSection = sections[sections.length - 1];
  if (!activeSection) return;
  const editor = _activeEditor(activeSection);
  if (!editor) return;
  const expr = buildExpression(cfg.uid, cfg.attr);
  editor.insertHtmlAtCursor(expr);
  editor.focus();
  refreshJson();
  trackUsedField(cfg.uid);
}

// ── Track fields ──────────────────────────────────────────────────────────────

function getUsedFieldUids() {
  const uids = new Set();
  const pattern = /\{([A-Za-z][A-Za-z0-9]{10})(?:\.[A-Za-z]+)?\}/g;
  sections.forEach(s => {
    ['header','body','footer'].forEach(key => {
      const html = s.editors[key].getHtml();
      let m;
      while ((m = pattern.exec(html)) !== null) uids.add(m[1]);
    });
  });
  return uids;
}

function trackUsedField(uid) {}

// ── Serialise ────────────────────────────────────────────────────────────────

function serialiseSections() {
  return sections.map(s => {
    const obj = {
      id:       s.id,
      type:     s.type,
      title:    s.name,
      htmlBody: quillHtmlToRaw(s.editors.body.getHtml()),
    };
    if (s.type === 'repeatable') {
      obj.htmlHeader = quillHtmlToRaw(s.editors.header.getHtml());
      obj.htmlFooter = quillHtmlToRaw(s.editors.footer.getHtml());
      if (s.stageId) obj.programStage = s.stageId;
    }
    return obj;
  });
}

// ── Restore ──────────────────────────────────────────────────────────────────

function restoreSections(saved) {
  sections.forEach(s => {
    ['header','body','footer'].forEach(key => {
      try { s.editors[key]._jodit.destruct(); } catch(e) {}
    });
    s.el.remove();
  });
  sections = []; activeSection = null; sectionCounter = 0;
  if (!saved || !saved.length) { addSection(); return; }
  saved.forEach(s => addSection({
    id:         s.id,
    name:       s.title || s.name || 'Section',
    type:       s.type  || 'single',
    stageId:    s.programStage || null,
    htmlHeader: rehydrateExpressions(s.htmlHeader || ''),
    htmlBody:   rehydrateExpressions(s.htmlBody   || ''),
    htmlFooter: rehydrateExpressions(s.htmlFooter || ''),
  }));
}
