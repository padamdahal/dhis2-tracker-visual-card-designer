// ── App Bootstrap ────────────────────────────────────────────────────────────

$(document).ready(function () {

  initSections();
  initFieldSearch();
  initFieldModal();
  initLoadModal();

  // Start with one blank section
  addSection({ name: 'Section 1' });

  // Load programs
  getPrograms()
    .done(res => {
      const programs = res.programs || [];
      programs.forEach(p => {
        $('#programSelect').append(
          `<option value="${p.id}">${escHtml(p.name)}</option>`
        );
      });
      if (programs.length) {
        loadProgramMetadata(programs[0].id);
      }
    })
    .fail(() => console.warn('Could not load programs — check DHIS2 connection'));

  $('#programSelect').on('change', function () {
    if (this.value) loadProgramMetadata(this.value);
  });

  // Add section
  $('#btnAddSection').on('click', () => {
    addSection();
    refreshJson();
  });

  // Meta field changes → refresh JSON
  $('#datastoreKey, #cardId, #cardName, #cardAccessAt').on('input', refreshJson);

  // ── Save ──────────────────────────────────────────────────────────────────
  $('#btnSave').on('click', () => {
    const key = $('#datastoreKey').val().trim();
    if (!key) {
      showSaveStatus('⚠ Enter a Datastore Key first', '#f59e0b');
      $('#datastoreKey').focus();
      return;
    }
    const payload = buildPayload();
    showSaveStatus('Saving…', '#3b82f6');
    datastoreSaveByKey(key, payload)
      .done(() => showSaveStatus(`✓ Saved as "${key}"`, '#22c55e'))
      .fail(err => {
        console.error('Save failed:', err);
        showSaveStatus('✗ Save failed', '#ef4444');
      });
  });

  // ── Load ──────────────────────────────────────────────────────────────────
  $('#btnLoad').on('click', () => openLoadModal());

  // View JSON panel toggle
  $('#btnShowJson').on('click', () => {
    const panel = document.getElementById('jsonPanel');
    const isOpen = panel.classList.toggle('open');
    if (isOpen) refreshJson();
    $('#btnShowJson').text(isOpen ? '✕ Close JSON' : '{ } View JSON');
  });

  // Copy JSON
  $('#btnCopyJson').on('click', () => {
    const text = document.getElementById('jsonOutput').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const fb = document.getElementById('jsonCopyFeedback');
      fb.textContent = '✓ Copied!';
      fb.classList.add('visible');
      setTimeout(() => fb.classList.remove('visible'), 2000);
    });
  });

  $('#btnCloseJson').on('click', () => {
    document.getElementById('jsonPanel').classList.remove('open');
    $('#btnShowJson').text('{ } View JSON');
  });

  // Keyboard shortcuts
  $(document).on('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      $('#btnCopyJson').trigger('click');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      $('#btnSave').trigger('click');
    }
  });

});

// ── Build payload (shared by Save + JSON panel) ──────────────────────────────

function buildPayload() {
  const usedUids = getUsedFieldUids();
  const optionSets = {};
  Object.entries(_optionSetMap).forEach(([deUid, os]) => {
    if (usedUids.has(deUid)) optionSets[deUid] = os.id;
  });

  return {
    id:        $('#cardId').val()       || 'cardTemplate',
    name:      $('#cardName').val()     || 'Card Template',
    accessAt:  $('#cardAccessAt').val() || 'everywhere',
    sections:  serialiseSections(),
    optionSets,
  };
}

function refreshJson() {
  if (!document.getElementById('jsonPanel').classList.contains('open')) return;
  document.getElementById('jsonOutput').textContent =
    JSON.stringify(buildPayload(), null, 2);
}

// ── Save status feedback ─────────────────────────────────────────────────────

function showSaveStatus(msg, color) {
  const el = document.getElementById('saveStatus');
  el.textContent = msg;
  el.style.color = color;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 3500);
}

// ── Load Template Modal ───────────────────────────────────────────────────────

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
      if (!keys.length) {
        listEl.innerHTML = '<div class="load-key-empty">No saved templates yet.</div>';
        return;
      }
      listEl.innerHTML = '';
      keys.forEach(key => {
        const item = document.createElement('div');
        item.className = 'load-key-item';
        item.innerHTML = `<span class="load-key-name">${escHtml(key)}</span><span class="load-key-arrow">Load →</span>`;
        item.addEventListener('click', () => loadTemplateByKey(key));
        listEl.appendChild(item);
      });
    })
    .fail(() => {
      listEl.innerHTML = '<div class="load-key-empty">Could not list templates. Check Datastore namespace.</div>';
    });
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
      if (payload.sections) restoreSections(payload.sections);
      refreshJson();
      closeLoadModal();
      showSaveStatus(`✓ Loaded "${key}"`, '#22c55e');
    })
    .fail(err => {
      console.error('Load failed:', err);
      showSaveStatus('✗ Load failed', '#ef4444');
    });
}
