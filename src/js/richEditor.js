// ── Jodit-based Rich Editor ──────────────────────────────────────────────────
// Each call to createRichEditor() mounts a Jodit instance inside `container`.
// The returned editor object exposes the same interface as the old contenteditable
// editor so the rest of the app (sections.js, expressionEngine.js) needs no changes.

const JODIT_CONFIG = {
  theme: 'default',
  height: 160,
  minHeight: 100,
  toolbarAdaptive: false,
  toolbarSticky: false,
  showCharsCounter: false,
  showWordsCounter: false,
  showXPathInStatusbar: false,
  disablePlugins: ['speech-recognize', 'spellcheck', 'stat'],
  buttons: [
    'bold', 'italic', 'underline', 'strikethrough',
    '|',
    'font', 'fontsize', 'brush',
    '|',
    'align',
    '|',
    'ul', 'ol',
    '|',
    'table',
    '|',
    'hr',
    '|',
    'image', 'link',
    '|',
    'eraser',
    '|',
    'source',
  ],
  allowHTML: true,
  processPasteHTML: false,
  askBeforePasteHTML: false,
  askBeforePasteFromWord: false,
  defaultActionOnPaste: 'insert_as_html',
  // Allow inserting a table inside a table cell
  tableAllowCellSelection: true,
  tableAllowCellResize: true,
  // Do not strip nested tables or unknown attributes
  cleanHTML: {
    fillEmptyParagraph: false,
    replaceNBSP: false,
    allowTags: false,
    denyTags: false,
  },
  // Table context menu: include border/style controls
  table: {
    allowCellSelection: true,
    allowCellResize: true,
    allowAddColumnOrRow: true,
    allowDeleteRowOrColumn: true,
    allowBorderColorJodit: true,
    useExtraClassesOptions: true,
  },
  // Extra table-insert dialog: show border, width, alignment options
  tableDefaultAttributes: {
    border: '1',
    cellpadding: '5',
    cellspacing: '0',
    style: 'border-collapse:collapse;width:100%',
  },
  style: {
    fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
    fontSize: '13px',
  },
};

function createRichEditor(container, placeholder) {
  // Jodit needs a <textarea> or <div> to attach to
  const ta = document.createElement('textarea');
  ta.setAttribute('placeholder', placeholder || '');
  container.appendChild(ta);

  const jodit = Jodit.make(ta, {
    ...JODIT_CONFIG,
    placeholder: placeholder || '',
  });

  let _changeHandlers = [];

  // Fire onChange after user edits
  jodit.events.on('change', () => {
    _changeHandlers.forEach(fn => fn());
  });

  const editor = {
    // Expose jodit instance for advanced use if ever needed
    _jodit: jodit,
    // surface: a fake element so focus-tracking in sections.js still works
    surface: jodit.editor,

    getHtml() {
      return jodit.value || '';
    },

    setHtml(html) {
      jodit.value = html || '';
      _changeHandlers.forEach(fn => fn());
    },

    focus() {
      jodit.focus();
    },

    onChange(fn) {
      _changeHandlers.push(fn);
    },

    _fireChange() {
      _changeHandlers.forEach(fn => fn());
    },

    /**
     * Insert raw HTML at the current cursor position inside the Jodit editor.
     * Uses Jodit's own selection helper so cursor placement is handled correctly.
     */
    insertHtmlAtCursor(text) {
      jodit.focus();
      // Insert as a plain text node so Jodit doesn't parse/wrap it as HTML
      const node = jodit.createInside.text(text);
      jodit.selection.insertNode(node);
      _changeHandlers.forEach(fn => fn());
    },
  };

  return editor;
}
