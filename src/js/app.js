// ── App Bootstrap ────────────────────────────────────────────────────────────

// Holds optionSets from a loaded payload so they survive program metadata reload
let _loadedOptionSets = {};

$(document).ready(function () {

  initSections();
  initFieldSearch();
  initFieldModal();
  initLoadModal();

  addSection({ name: 'Section 1' });

  getPrograms()
    .done(res => {
      const programs = res.programs || [];
      programs.forEach(p => {
        $('#programSelect').append(`<option value="${p.id}">${escHtml(p.name)}</option>`);
      });
      if (programs.length) loadProgramMetadata(programs[0].id);
    })
    .fail(() => console.warn('Could not load programs'));

  $('#programSelect').on('change', function () {
    if (this.value) loadProgramMetadata(this.value);
  });

  $('#btnAddSection').on('click', () => { addSection(); refreshJson(); });

  // Meta changes → refresh JSON
  $('#datastoreKey, #cardId, #cardName, #cardAccessAt').on('change input', refreshJson);

  // Save
  $('#btnSave').on('click', () => {
    const key = $('#datastoreKey').val().trim();
    if (!key) {
      showSaveStatus('⚠ Enter a Datastore Key first', '#f59e0b');
      $('#datastoreKey').focus();
      return;
    }
    showSaveStatus('Saving…', '#3b82f6');
    datastoreSaveByKey(key, buildPayload())
      .done(() => showSaveStatus(`✓ Saved as "${key}"`, '#22c55e'))
      .fail(err => { console.error(err); showSaveStatus('✗ Save failed', '#ef4444'); });
  });

  // Load
  $('#btnLoad').on('click', () => openLoadModal());

  // JSON panel
  $('#btnShowJson').on('click', () => {
    const panel  = document.getElementById('jsonPanel');
    const isOpen = panel.classList.toggle('open');
    if (isOpen) refreshJson();
    $('#btnShowJson').text(isOpen ? '✕ Close JSON' : '{ } View JSON');
  });
  $('#btnCopyJson').on('click', () => {
    navigator.clipboard.writeText(document.getElementById('jsonOutput').textContent).then(() => {
      const fb = document.getElementById('jsonCopyFeedback');
      fb.textContent = '✓ Copied!'; fb.classList.add('visible');
      setTimeout(() => fb.classList.remove('visible'), 2000);
    });
  });
  $('#btnCloseJson').on('click', () => {
    document.getElementById('jsonPanel').classList.remove('open');
    $('#btnShowJson').text('{ } View JSON');
  });

  // Keyboard shortcuts
  $(document).on('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') { e.preventDefault(); $('#btnCopyJson').trigger('click'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's')               { e.preventDefault(); $('#btnSave').trigger('click'); }
  });
});

// ── Payload ───────────────────────────────────────────────────────────────────

function buildPayload() {
  const usedUids   = getUsedFieldUids();
  const optionSets = {};

  // Merge live map + anything loaded from datastore that hasn't been re-fetched yet
  const combined = Object.assign({}, _loadedOptionSets, _optionSetMap);
  Object.entries(combined).forEach(([uid, os]) => {
    if (usedUids.has(uid)) optionSets[uid] = typeof os === 'string' ? os : os.id;
  });

  return {
    id:        $('#cardId').val()      || 'cardTemplate',
    name:      $('#cardName').val()    || 'Card Template',
    accessAt:  $('#cardAccessAt').val() || 'everywhere',
    sections:  serialiseSections(),
    optionSets,
  };
}

function refreshJson() {
  if (!document.getElementById('jsonPanel').classList.contains('open')) return;
  document.getElementById('jsonOutput').textContent = JSON.stringify(buildPayload(), null, 2);
}

// ── Save status ───────────────────────────────────────────────────────────────

function showSaveStatus(msg, color) {
  const el = document.getElementById('saveStatus');
  el.textContent = msg; el.style.color = color; el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 3500);
}

// ── Load modal ────────────────────────────────────────────────────────────────

function initLoadModal() {
  document.getElementById('cancelLoadModal').addEventListener('click', closeLoadModal);
  document.getElementById('closeLoadModal').addEventListener('click', closeLoadModal);
  document.getElementById('loadModal').addEventListener('click', e => {
    if (e.target === document.getElementById('loadModal')) closeLoadModal();
  });
}

function openLoadModal() {
  document.getElementById('loadModal').classList.remove('hidden');
  const listEl = document.getElementById('loadKeyList');
  listEl.innerHTML = '<div class="load-key-empty">Loading saved templates…</div>';
  datastoreListKeys()
    .done(keys => {
      keys = keys || [];
      if (!keys.length) { listEl.innerHTML = '<div class="load-key-empty">No saved templates yet.</div>'; return; }
      listEl.innerHTML = '';
      keys.forEach(key => {
        const item = document.createElement('div');
        item.className = 'load-key-item';
        item.innerHTML = `<span class="load-key-name">${escHtml(key)}</span><span class="load-key-arrow">Load →</span>`;
        item.addEventListener('click', () => loadTemplateByKey(key));
        listEl.appendChild(item);
      });
    })
    .fail(() => { listEl.innerHTML = '<div class="load-key-empty">Could not list templates.</div>'; });
}

function closeLoadModal() {
  document.getElementById('loadModal').classList.add('hidden');
}

function loadTemplateByKey(key) {
  showSaveStatus('Loading…', '#3b82f6');
  datastoreGetByKey(key)
    .done(payload => {
      if (!payload) return;
      $('#datastoreKey').val(key);
      if (payload.id)       $('#cardId').val(payload.id);
      if (payload.name)     $('#cardName').val(payload.name);
      if (payload.accessAt) $('#cardAccessAt').val(payload.accessAt);

      // Cache the loaded optionSets so buildPayload can use them even before
      // the live program metadata fetch has completed/merged them
      _loadedOptionSets = payload.optionSets || {};

      if (payload.sections) restoreSections(payload.sections);
      refreshJson();
      closeLoadModal();
      showSaveStatus(`✓ Loaded "${key}"`, '#22c55e');
    })
    .fail(err => { console.error(err); showSaveStatus('✗ Load failed', '#ef4444'); });
}
