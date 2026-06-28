// ── Field Panel ──────────────────────────────────────────────────────────────

let _optionSetMap = {};
let _knownFields  = {};

function setOptionSetMap(map) { _optionSetMap = map || {}; }

// ── Render field list ────────────────────────────────────────────────────────

function renderFieldList(containerId, fields, fieldType) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (!fields.length) {
    container.innerHTML = '<div style="color:#4a5070;font-size:11px;padding:4px 2px;">None found.</div>';
    return;
  }
  fields.forEach(f => {
    _knownFields[f.id] = { name: f.name, fieldType };
    const hasOS = !!_optionSetMap[f.id];
    const chip  = document.createElement('div');
    chip.className    = 'field-chip';
    chip.dataset.uid  = f.id;
    chip.dataset.name = f.name;
    chip.innerHTML = `
      <span class="chip-dot ${fieldType}"></span>
      <span class="chip-name" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
      ${hasOS ? '<span class="chip-has-optionset">opt</span>' : ''}
    `;
    chip.addEventListener('mousedown', e => {
      // mousedown fires BEFORE the editor loses focus, so Jodit's cursor is still live
      e.preventDefault(); // prevent focus leaving the editor
      openFieldPopover(e, f, fieldType);
    });
    container.appendChild(chip);
  });
}

function initFieldSearch() {
  document.getElementById('teaSearch').addEventListener('input', function() {
    _filter('teaList', this.value);
  });
  document.getElementById('deSearch').addEventListener('input', function() {
    _filter('deList', this.value);
  });
}

function _filter(listId, q) {
  q = q.toLowerCase();
  document.querySelectorAll(`#${listId} .field-chip`).forEach(c => {
    c.style.display = c.dataset.name.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── Inline popover (replaces the focus-stealing modal) ───────────────────────
// We use mousedown + preventDefault so Jodit never loses focus and the cursor
// position is preserved naturally — no save/restore needed at all.

let _popover      = null;
let _pendingField = null;

function openFieldPopover(mouseEvent, field, fieldType) {
  _pendingField = { field, fieldType };
  closeFieldPopover(); // close any existing one

  const os = _optionSetMap[field.id] || null;

  const attrOptions = [
    { value: 'value',       label: 'value — the recorded value' },
    { value: 'createdAt',   label: 'createdAt — creation timestamp' },
    { value: 'lastUpdated', label: 'lastUpdated — last update timestamp' },
    { value: 'storedBy',    label: 'storedBy — recorded by (username)' },
    { value: 'orgUnit',     label: 'orgUnit — organisation unit UID' },
    { value: 'eventDate',   label: 'eventDate — event/encounter date' },
  ];

  const pop = document.createElement('div');
  pop.className = 'field-popover';
  pop.innerHTML = `
    <div class="fp-title">${escHtml(field.name)}</div>
    ${os ? `<div class="fp-optionset">Option set: <strong>${escHtml(os.name)}</strong> · ${(os.options||[]).length} options</div>` : ''}
    <div class="fp-row">
      <label class="fp-label">Label</label>
      <input class="fp-input" id="fp-label" type="text" value="${escHtml(field.name)}" />
    </div>
    <div class="fp-row">
      <label class="fp-label">Attribute</label>
      <select class="fp-input" id="fp-attr">
        ${attrOptions.map(o => `<option value="${o.value}">${escHtml(o.label)}</option>`).join('')}
      </select>
    </div>
    <div class="fp-preview" id="fp-preview">${escHtml(buildExpression(field.id, 'value'))}</div>
    <div class="fp-actions">
      <button class="btn btn-ghost btn-sm" id="fp-cancel">Cancel</button>
      <button class="btn btn-primary btn-sm" id="fp-insert">Insert</button>
    </div>
  `;

  document.body.appendChild(pop);
  _popover = pop;

  // Position below the clicked chip, keeping it inside viewport
  const rect = mouseEvent.currentTarget.getBoundingClientRect();
  let top  = rect.bottom + window.scrollY + 4;
  let left = rect.left   + window.scrollX;
  pop.style.left = left + 'px';
  pop.style.top  = top  + 'px';

  // Update preview as user changes inputs — mousedown on inputs is fine (editor already has cursor saved)
  const labelInput = pop.querySelector('#fp-label');
  const attrSelect = pop.querySelector('#fp-attr');
  const preview    = pop.querySelector('#fp-preview');

  function updatePreview() {
    preview.textContent = buildExpression(field.id, attrSelect.value);
  }
  attrSelect.addEventListener('change', updatePreview);

  // Insert button — mousedown to avoid focus loss
  pop.querySelector('#fp-insert').addEventListener('mousedown', e => {
    e.preventDefault();
    _doInsert(field, fieldType, labelInput.value, attrSelect.value);
    closeFieldPopover();
  });

  pop.querySelector('#fp-cancel').addEventListener('mousedown', e => {
    e.preventDefault();
    closeFieldPopover();
  });

  // Close if user clicks outside
  setTimeout(() => {
    document.addEventListener('mousedown', _outsideClick);
  }, 0);
}

function _outsideClick(e) {
  if (_popover && !_popover.contains(e.target)) {
    closeFieldPopover();
  }
}

function closeFieldPopover() {
  if (_popover) {
    _popover.remove();
    _popover = null;
  }
  document.removeEventListener('mousedown', _outsideClick);
  _pendingField = null;
}

function _doInsert(field, fieldType, label, attr) {
  insertFieldIntoActiveSection({
    uid:       field.id,
    name:      field.name,
    label:     label || field.name,
    attr:      attr  || 'value',
    fieldType,
  });
}

// ── Keep old modal init as a no-op (called from app.js) ─────────────────────
function initFieldModal() {}

// ── Load program metadata ────────────────────────────────────────────────────

function loadProgramMetadata(programId) {
  ['teaList','deList'].forEach(id => {
    document.getElementById(id).innerHTML =
      '<div style="color:#4a5070;font-size:11px;padding:4px;">Loading…</div>';
  });
  document.getElementById('teaSearch').value = '';
  document.getElementById('deSearch').value  = '';

  // Load TEAs + their optionSets
  getProgramAttributes(programId).then(({ attrs, optionSetMap: teaOsMap }) => {
    // Merge TEA optionSets into the shared map so the popover and payload can see them
    Object.assign(_optionSetMap, teaOsMap);
    renderFieldList('teaList', attrs, 'tea');
  }).catch(() => {
    document.getElementById('teaList').innerHTML =
      '<div style="color:#ef4444;font-size:11px;">Failed to load.</div>';
  });

  // Load DEs + their optionSets
  getProgramDataElements(programId).then(({ stages, optionSetMap: deOsMap }) => {
    setStagesForDropdowns(stages);
    // Merge DE optionSets (setOptionSetMap replaces the whole map, so merge first)
    Object.assign(_optionSetMap, deOsMap);
    const deMap = {};
    stages.forEach(st => st.programStageDataElements.forEach(d => { deMap[d.dataElement.id] = d.dataElement; }));
    renderFieldList('deList', Object.values(deMap), 'de');
  }).catch(() => {
    document.getElementById('deList').innerHTML =
      '<div style="color:#ef4444;font-size:11px;">Failed to load.</div>';
  });
}
