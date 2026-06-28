// ── Expression Engine ────────────────────────────────────────────────────────

function buildExpression(uid, attr) {
  if (!attr || attr === 'value') return `{${uid}}`;
  return `{${uid}.${attr}}`;
}

/** Single-line inline field chip: dot + label + expression, all inline, small font */
function renderFieldChip(cfg) {
  const dotColor = cfg.fieldType === 'tea' ? '#0ea5e9' : '#8b5cf6';
  const label    = cfg.label || cfg.name || cfg.uid;
  const expr     = buildExpression(cfg.uid, cfg.attr);
  const cfgJson  = JSON.stringify(cfg).replace(/"/g, '&quot;');
  return `<span class="dhis2-field" contenteditable="false" data-uid="${cfg.uid}" data-config="${cfgJson}"><span class="ft-dot" style="background:${dotColor}"></span><span class="ft-text">${escHtml(label)} <span class="ft-expr">${expr}</span></span></span>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/**
 * Convert editor HTML → raw HTML string for JSON output.
 * Expressions are already plain text {uid} / {uid.attr} — just trim and return.
 */
function quillHtmlToRaw(html) {
  return html ? html.trim() : '';
}

/**
 * On load, expressions in saved HTML are already plain {uid} — nothing to rehydrate.
 */
function rehydrateExpressions(raw) {
  return raw || '';
}
