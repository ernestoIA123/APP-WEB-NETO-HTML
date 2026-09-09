const editor = document.querySelector("#codeEditor");
const highlightLayer = document.querySelector("#highlightLayer");
const lineNumbers = document.querySelector("#lineNumbers");
const lineCount = document.querySelector("#lineCount");
const searchInput = document.querySelector("#searchInput");
const matchCount = document.querySelector("#matchCount");
const previousMatch = document.querySelector("#previousMatch");
const nextMatch = document.querySelector("#nextMatch");
const previewFrame = document.querySelector("#previewFrame");
const proModeButton = document.querySelector("#proModeButton");
const addCodeButton = document.querySelector("#addCodeButton");
const copyButton = document.querySelector("#copyButton");
const clearButton = document.querySelector("#clearButton");
const zoomOutCodeButton = document.querySelector("#zoomOutCodeButton");
const zoomInCodeButton = document.querySelector("#zoomInCodeButton");
const codeZoomLevel = document.querySelector("#codeZoomLevel");
const codeDialog = document.querySelector("#codeDialog");
const newCodeInput = document.querySelector("#newCodeInput");
const loadCodeButton = document.querySelector("#loadCodeButton");
const toast = document.querySelector("#toast");

const DEFAULT_CODE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mi página</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 48px;
      color: #172033;
    }

    h1 {
      color: #1267e5;
    }

    .boton {
      display: inline-block;
      margin-top: 16px;
      padding: 12px 20px;
      border-radius: 8px;
      background: #1267e5;
      color: white;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <h1>Mi página de ventas</h1>
  <p>Edita este código y mira los cambios al instante.</p>
  <a href="https://example.com" target="_blank">Este enlace se muestra en azul</a>
  <br>
  <a class="boton" href="#contacto">Contáctame</a>
</body>
</html>`;

let matches = [];
let activeMatchIndex = -1;
let previewTimer;
let toastTimer;
let isEditingPreview = false;
let codeZoom = 100;

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function findMatches(text, query) {
  if (!query) return [];

  const found = [];
  const haystack = text.toLocaleLowerCase("es");
  const needle = query.toLocaleLowerCase("es");
  let start = 0;

  while (start <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, start);

    if (index === -1) break;

    found.push({
      start: index,
      end: index + query.length
    });

    start = index + Math.max(query.length, 1);
  }

  return found;
}

function findLinkRanges(text) {
  const ranges = [];
  const attributePattern = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi;
  const urlPattern = /(?:https?:\/\/|\/\/)[^\s"'<>]+/gi;

  for (const match of text.matchAll(attributePattern)) {
    const value = match[2];
    const offset = match[0].indexOf(value);

    ranges.push({
      start: match.index + offset,
      end: match.index + offset + value.length
    });
  }

  for (const match of text.matchAll(urlPattern)) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return ranges;
}

function isInside(index, range) {
  return index >= range.start && index < range.end;
}

function renderHighlightedCode() {
  const text = editor.value;

  matches = findMatches(text, searchInput.value);

  const linkRanges = findLinkRanges(text);

  if (matches.length === 0) {
    activeMatchIndex = -1;
  }

  if (matches.length > 0 && activeMatchIndex < 0) {
    activeMatchIndex = 0;
  }

  if (activeMatchIndex >= matches.length) {
    activeMatchIndex = matches.length - 1;
  }

  const boundaries = new Set([0, text.length]);

  [...matches, ...linkRanges].forEach(({ start, end }) => {
    boundaries.add(start);
    boundaries.add(end);
  });

  const points = [...boundaries].sort((a, b) => a - b);

  let html = "";

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const classes = [];

    if (linkRanges.some((range) => isInside(start, range))) {
      classes.push("code-link");
    }

    const matchIndex = matches.findIndex((range) =>
      isInside(start, range)
    );

    if (matchIndex !== -1) {
      classes.push("search-match");

      if (matchIndex === activeMatchIndex) {
        classes.push("active-match");
      }
    }

    const content = escapeHtml(text.slice(start, end));

    html += classes.length
      ? `<span class="${classes.join(" ")}">${content}</span>`
      : content;
  }

  highlightLayer.innerHTML = `${html}\n`;

  updateMatchLabel();
}

function updateMatchLabel() {
  const total = matches.length;

  if (!searchInput.value) {
    matchCount.textContent = "0 coincidencias";
  } else if (total === 0) {
    matchCount.textContent = "Sin coincidencias";
  } else {
    const activeMatch = matches[activeMatchIndex];

    const line = editor.value
      .slice(0, activeMatch.start)
      .split("\n").length;

    matchCount.textContent =
      `${activeMatchIndex + 1} de ${total} · línea ${line}`;
  }

  previousMatch.disabled = total === 0;
  nextMatch.disabled = total === 0;
}

function updateLineNumbers() {
  const total = editor.value.split("\n").length;

  const matchingLines = new Set(
    matches.map((match) =>
      editor.value.slice(0, match.start).split("\n").length - 1
    )
  );

  const activeMatch = matches[activeMatchIndex];

  const activeLine = activeMatch
    ? editor.value.slice(0, activeMatch.start).split("\n").length - 1
    : -1;

  lineNumbers.innerHTML = Array.from(
    { length: total },
    (_, index) => {
      const classes = ["line-number"];

      if (matchingLines.has(index)) {
        classes.push("has-search-match");
      }

      if (index === activeLine) {
        classes.push("is-active-match");
      }

      return `
        <span class="${classes.join(" ")}">
          <span class="line-marker"></span>${index + 1}
        </span>
      `;
    }
  ).join("");

  lineCount.textContent =
    `${total} ${total === 1 ? "línea" : "líneas"}`;
}

function syncEditorScroll() {
  highlightLayer.scrollTop = editor.scrollTop;
  highlightLayer.scrollLeft = editor.scrollLeft;
  lineNumbers.scrollTop = editor.scrollTop;
}

function scrollToActiveMatch({ focusEditor = false } = {}) {
  const match = matches[activeMatchIndex];

  if (!match) return;

  const textBefore = editor.value.slice(0, match.start);
  const lineIndex = textBefore.split("\n").length - 1;
  const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);

  editor.scrollTop = Math.max(
    0,
    lineIndex * lineHeight -
      editor.clientHeight / 2 +
      lineHeight
  );

  syncEditorScroll();

  if (focusEditor) {
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(match.start, match.end);
  }
}

function goToMatch(direction) {
  if (!matches.length) return;

  activeMatchIndex =
    (activeMatchIndex + direction + matches.length) %
    matches.length;

  renderHighlightedCode();
  updateLineNumbers();
  scrollToActiveMatch();

  searchInput.focus({ preventScroll: true });
}

function previewTools() {
  return `
    <style data-neto-preview-tool>
      [data-neto-editing] {
        outline: 2px dashed #19a767 !important;
        outline-offset: 3px;
        cursor: text;
      }

      .neto-image-dialog {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(5, 10, 16, .68);
        font-family: Arial, sans-serif;
      }

      .neto-image-box {
        width: min(560px, 100%);
        padding: 20px;
        border-radius: 14px;
        color: #172033;
        background: white;
        box-shadow: 0 20px 70px rgba(0, 0, 0, .35);
      }

      .neto-image-box strong {
        display: block;
        margin-bottom: 8px;
        font-size: 18px;
      }

      .neto-image-box p {
        margin: 0 0 12px;
        color: #5d6675;
        font-size: 14px;
      }

      .neto-image-box textarea {
        width: 100%;
        min-height: 110px;
        resize: vertical;
        padding: 11px;
        border: 1px solid #bcc7d6;
        border-radius: 8px;
        color: #172033;
        background: #f7f9fc;
        font: 14px/1.45 monospace;
      }

      .neto-image-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 14px;
      }

      .neto-image-actions button {
        min-height: 40px;
        padding: 0 15px;
        border: 0;
        border-radius: 8px;
        font-weight: 700;
        cursor: pointer;
      }

      .neto-cancel {
        color: #475569;
        background: #e9eef5;
      }

      .neto-save {
        color: white;
        background: #168955;
      }

      .neto-open {
        color: white;
        background: #1768d8;
      }

      .neto-edit-link {
        color: white;
        background: #7c3aed;
      }

      .neto-image-actions button:disabled {
        opacity: .45;
        cursor: not-allowed;
      }

      @media (pointer: coarse), (max-width: 700px) {
        html {
          touch-action: manipulation;
        }

        a, button, [role="button"], input[type="button"], input[type="submit"] {
          touch-action: manipulation;
        }

        .neto-image-dialog {
          padding: 12px;
          align-items: end;
        }

        .neto-image-box {
          width: 100%;
          max-height: 88vh;
          overflow: auto;
          padding: 18px;
          border-radius: 16px 16px 10px 10px;
        }

        .neto-image-box textarea {
          min-height: 130px;
          font-size: 16px;
        }

        .neto-image-actions {
          flex-wrap: wrap;
        }

        .neto-image-actions button {
          flex: 1 1 135px;
          min-height: 48px;
          font-size: 15px;
        }
      }
    </style>

    <script data-neto-preview-tool>
      (() => {
        let pendingButtonTimer;
        let touchHoldTimer;
        let touchStartX = 0;
        let touchStartY = 0;
        let touchMoved = false;
        let touchHoldActivated = false;
        let lastTapTime = 0;
        let lastTapTarget = null;
        let suppressControlClickUntil = 0;

        const sendCleanHtml = () => {
          const clone = document.documentElement.cloneNode(true);

          clone
            .querySelectorAll(
              '[data-neto-preview-tool], .neto-image-dialog'
            )
            .forEach((node) => node.remove());

          clone
            .querySelectorAll('[data-neto-editing]')
            .forEach((node) => {
              node.removeAttribute('data-neto-editing');
              node.removeAttribute('contenteditable');
            });

          parent.postMessage(
            {
              type: 'neto-preview-html',
              html: '<!DOCTYPE html>\\n' + clone.outerHTML
            },
            '*'
          );
        };

        const selectContents = (element) => {
          const range = document.createRange();

          range.selectNodeContents(element);

          const selection = window.getSelection();

          selection.removeAllRanges();
          selection.addRange(range);
        };

        const editImage = (image) => {
          const overlay = document.createElement('div');

          overlay.className = 'neto-image-dialog';
          overlay.setAttribute('data-neto-preview-tool', '');

          const box = document.createElement('div');
          box.className = 'neto-image-box';

          const title = document.createElement('strong');
          title.textContent = 'Código o enlace de la imagen';

          const description = document.createElement('p');
          description.textContent =
            'Pega aquí tu enlace de Cloudinary o la URL de la imagen.';

          const input = document.createElement('textarea');
          input.value = image.getAttribute('src') || '';
          input.placeholder = 'https://res.cloudinary.com/...';

          const actions = document.createElement('div');
          actions.className = 'neto-image-actions';

          const cancel = document.createElement('button');
          cancel.className = 'neto-cancel';
          cancel.textContent = 'Cancelar';

          const save = document.createElement('button');
          save.className = 'neto-save';
          save.textContent = 'Cambiar imagen';

          actions.append(cancel, save);
          box.append(title, description, input, actions);
          overlay.append(box);

          document.body.append(overlay);

          input.focus();
          input.select();

          cancel.addEventListener('click', () => {
            overlay.remove();
          });

          overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
              overlay.remove();
            }
          });

          save.addEventListener('click', () => {
            const newSource = input.value.trim();

            if (!newSource) {
              input.focus();
              return;
            }

            image.setAttribute('src', newSource);
            overlay.remove();
            sendCleanHtml();
          });
        };

        const buttonLink = (control) => {
          if (control instanceof HTMLAnchorElement) {
            return control.getAttribute('href') || '';
          }

          return (
            control.getAttribute('data-link') ||
            control.getAttribute('formaction') ||
            ''
          );
        };

        const saveButtonLink = (control, value) => {
          if (control instanceof HTMLAnchorElement) {
            control.setAttribute('href', value);
          } else if (control.hasAttribute('formaction')) {
            control.setAttribute('formaction', value);
          } else {
            control.setAttribute('data-link', value);
            control.setAttribute(
              'onclick',
              'location.href=this.dataset.link'
            );
          }
        };

        const showButtonActions = (control) => {
          const overlay = document.createElement('div');

          overlay.className = 'neto-image-dialog';
          overlay.setAttribute('data-neto-preview-tool', '');

          const box = document.createElement('div');
          box.className = 'neto-image-box';

          const title = document.createElement('strong');
          title.textContent = 'Enlace del botón';

          const description = document.createElement('p');
          const currentLink = buttonLink(control);

          description.textContent =
            currentLink ||
            'Este botón todavía no tiene un enlace.';

          const actions = document.createElement('div');
          actions.className = 'neto-image-actions';

          const cancel = document.createElement('button');
          cancel.className = 'neto-cancel';
          cancel.textContent = 'Cancelar';

          const open = document.createElement('button');
          open.className = 'neto-open';
          open.textContent = 'Abrir enlace';
          open.disabled = !currentLink;

          const edit = document.createElement('button');
          edit.className = 'neto-edit-link';
          edit.textContent = 'Editar enlace';

          actions.append(cancel, open, edit);
          box.append(title, description, actions);
          overlay.append(box);

          document.body.append(overlay);

          const close = () => {
            overlay.remove();
          };

          cancel.addEventListener('click', close);

          overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
              close();
            }
          });

          open.addEventListener('click', () => {
            if (
              !currentLink ||
              /^javascript:/i.test(currentLink)
            ) {
              return;
            }

            window.open(
              new URL(currentLink, document.baseURI).href,
              '_blank',
              'noopener'
            );
          });

          edit.addEventListener('click', () => {
            description.textContent =
              'Escribe o pega el nuevo enlace del botón.';

            actions.innerHTML = '';

            const input = document.createElement('textarea');
            input.value = currentLink;
            input.placeholder = 'https://...';

            const save = document.createElement('button');
            save.className = 'neto-save';
            save.textContent = 'Guardar enlace';

            const back = document.createElement('button');
            back.className = 'neto-cancel';
            back.textContent = 'Cancelar';

            actions.append(back, save);
            box.insertBefore(input, actions);

            input.focus();
            input.select();

            back.addEventListener('click', close);

            save.addEventListener('click', () => {
              const value = input.value.trim();

              if (!value) {
                input.focus();
                return;
              }

              saveButtonLink(control, value);
              close();
              sendCleanHtml();
            });
          });
        };

        const blockedTags = [
          'HTML',
          'BODY',
          'SCRIPT',
          'STYLE',
          'LINK',
          'META',
          'INPUT',
          'TEXTAREA',
          'SELECT',
          'OPTION'
        ];

        const controlSelector =
          'a, button, [role="button"], input[type="button"], input[type="submit"]';

        const beginTextEditing = (target) => {
          if (!(target instanceof Element)) return;
          if (target.closest('.neto-image-dialog')) return;
          if (target.closest(controlSelector)) return;
          if (blockedTags.includes(target.tagName)) return;
          if (target.hasAttribute('data-neto-editing')) return;

          target.setAttribute('contenteditable', 'true');
          target.setAttribute('data-neto-editing', '');
          target.focus();
          selectContents(target);

          let timer;

          const sync = () => {
            clearTimeout(timer);
            timer = setTimeout(sendCleanHtml, 80);
          };

          const finish = () => {
            clearTimeout(timer);
            target.removeAttribute('contenteditable');
            target.removeAttribute('data-neto-editing');
            sendCleanHtml();
          };

          target.addEventListener('input', sync);
          target.addEventListener('blur', finish, { once: true });
          target.addEventListener('keydown', (keyEvent) => {
            if (keyEvent.key === 'Escape') target.blur();
          });
        };

        const editPreviewTarget = (target) => {
          if (!(target instanceof Element)) return;
          if (document.querySelector('.neto-image-dialog')) return;

          if (target instanceof HTMLImageElement) {
            editImage(target);
            return;
          }

          beginTextEditing(target);
        };

        document.addEventListener(
          'touchstart',
          (event) => {
            const target = event.target;

            if (
              !(target instanceof Element) ||
              target.closest('.neto-image-dialog')
            ) {
              return;
            }

            const control = target.closest(controlSelector);

            if (control) {
              event.preventDefault();
              event.stopPropagation();
              clearTimeout(pendingButtonTimer);
              suppressControlClickUntil = Date.now() + 800;
              showButtonActions(control);
              return;
            }

            const touch = event.touches[0];
            if (!touch) return;

            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchMoved = false;
            touchHoldActivated = false;
            clearTimeout(touchHoldTimer);

            touchHoldTimer = setTimeout(() => {
              if (touchMoved) return;
              touchHoldActivated = true;
              editPreviewTarget(target);
            }, 550);
          },
          { capture: true, passive: false }
        );

        document.addEventListener(
          'touchmove',
          (event) => {
            const touch = event.touches[0];
            if (!touch) return;

            if (
              Math.abs(touch.clientX - touchStartX) > 12 ||
              Math.abs(touch.clientY - touchStartY) > 12
            ) {
              touchMoved = true;
              clearTimeout(touchHoldTimer);
            }
          },
          { capture: true, passive: true }
        );

        document.addEventListener(
          'touchend',
          (event) => {
            clearTimeout(touchHoldTimer);

            const target = event.target;

            if (
              !(target instanceof Element) ||
              target.closest('.neto-image-dialog') ||
              target.closest(controlSelector)
            ) {
              return;
            }

            if (touchMoved) {
              lastTapTime = 0;
              lastTapTarget = null;
              return;
            }

            if (touchHoldActivated) {
              event.preventDefault();
              event.stopPropagation();
              lastTapTime = 0;
              lastTapTarget = null;
              return;
            }

            const now = Date.now();
            const isDoubleTap =
              lastTapTarget === target && now - lastTapTime < 420;

            if (isDoubleTap) {
              event.preventDefault();
              event.stopPropagation();
              editPreviewTarget(target);
              lastTapTime = 0;
              lastTapTarget = null;
            } else {
              lastTapTime = now;
              lastTapTarget = target;
            }
          },
          { capture: true, passive: false }
        );

        document.addEventListener('touchcancel', () => {
          clearTimeout(touchHoldTimer);
          touchMoved = true;
        }, true);

        document.addEventListener('contextmenu', (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest('.neto-image-dialog')) return;
          if (target.closest(controlSelector)) return;
          event.preventDefault();
          editPreviewTarget(target);
        }, true);

        document.addEventListener(
          'click',
          (event) => {
            const target = event.target;

            if (
              !(target instanceof Element) ||
              target.closest('.neto-image-dialog')
            ) {
              return;
            }

            const control = target.closest(
              controlSelector
            );

            if (
              !control ||
              control.hasAttribute('data-neto-editing')
            ) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (Date.now() < suppressControlClickUntil) {
              return;
            }

            clearTimeout(pendingButtonTimer);

            pendingButtonTimer = setTimeout(
              () => showButtonActions(control),
              220
            );
          },
          true
        );

        document.addEventListener(
          'dblclick',
          (event) => {
            clearTimeout(pendingButtonTimer);

            const target = event.target;

            if (
              !(target instanceof Element) ||
              target.closest('.neto-image-dialog')
            ) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();

            editPreviewTarget(target);
          },
          true
        );
      })();
    <\/script>
  `;
}

function updatePreview() {
  if (isEditingPreview) return;

  const linkStyle = `
    <style data-neto-preview-tool>
      a:not([class]) {
        color: #0666d6 !important;
      }
    </style>
  `;

  previewFrame.srcdoc =
    `${linkStyle}${editor.value}${previewTools()}`;
}

function schedulePreview() {
  clearTimeout(previewTimer);

  previewTimer = setTimeout(updatePreview, 120);
}

function refreshEditorVisuals() {
  renderHighlightedCode();
  updateLineNumbers();
  syncEditorScroll();
}

function updateEverything() {
  isEditingPreview = false;
  refreshEditorVisuals();
  schedulePreview();
}

function showToast(message) {
  clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.add("show");

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

editor.addEventListener("input", updateEverything);

editor.addEventListener("scroll", syncEditorScroll);

editor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();

    editor.setRangeText(
      "  ",
      editor.selectionStart,
      editor.selectionEnd,
      "end"
    );

    updateEverything();
  }

  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "f"
  ) {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

searchInput.addEventListener("input", () => {
  activeMatchIndex = searchInput.value ? 0 : -1;

  renderHighlightedCode();
  updateLineNumbers();

  if (matches.length) {
    scrollToActiveMatch();
  }
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    goToMatch(event.shiftKey ? -1 : 1);
  }
});

previousMatch.addEventListener("click", () => {
  goToMatch(-1);
});

nextMatch.addEventListener("click", () => {
  goToMatch(1);
});

proModeButton.addEventListener("click", () => {
  const enabled =
    document.body.classList.toggle("pro-mode");

  proModeButton.setAttribute(
    "aria-pressed",
    String(enabled)
  );

  showToast(
    enabled
      ? "Modo Pro activado"
      : "Editor visual activado"
  );

  if (enabled) {
    requestAnimationFrame(syncEditorScroll);
  }
});

function updateCodeZoom(change) {
  if (!zoomOutCodeButton || !zoomInCodeButton || !codeZoomLevel) return;

  codeZoom = Math.min(
    160,
    Math.max(60, codeZoom + change)
  );

  const fontSize = 0.92 * (codeZoom / 100);
  const lineHeight = 1.65 * (codeZoom / 100);

  document.documentElement.style.setProperty(
    "--editor-font-size",
    `${fontSize.toFixed(3)}rem`
  );

  document.documentElement.style.setProperty(
    "--editor-line-height",
    `${lineHeight.toFixed(3)}rem`
  );

  codeZoomLevel.textContent = `${codeZoom}%`;

  zoomOutCodeButton.disabled = codeZoom === 60;
  zoomInCodeButton.disabled = codeZoom === 160;

  requestAnimationFrame(() => {
    syncEditorScroll();
    scrollToActiveMatch();
  });
}

zoomOutCodeButton?.addEventListener("click", () => {
  updateCodeZoom(-10);
});

zoomInCodeButton?.addEventListener("click", () => {
  updateCodeZoom(10);
});

addCodeButton.addEventListener("click", () => {
  newCodeInput.value = "";
  codeDialog.showModal();

  requestAnimationFrame(() => {
    newCodeInput.focus();
  });
});

loadCodeButton.addEventListener("click", (event) => {
  event.preventDefault();

  const code = newCodeInput.value.trim();

  if (!code) {
    showToast("Primero pega el código HTML");
    newCodeInput.focus();
    return;
  }

  editor.value = code;
  searchInput.value = "";
  activeMatchIndex = -1;

  updateEverything();
  codeDialog.close();

  showToast("Página cargada correctamente");
});

window.addEventListener("message", (event) => {
  if (event.source !== previewFrame.contentWindow) {
    return;
  }

  if (
    !event.data ||
    event.data.type !== "neto-preview-html" ||
    typeof event.data.html !== "string"
  ) {
    return;
  }

  isEditingPreview = true;
  editor.value = event.data.html;

  refreshEditorVisuals();

  showToast("Cambio aplicado al código");
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editor.value);
    showToast("Código copiado");
  } catch {
    editor.select();
    document.execCommand("copy");
    showToast("Código copiado");
  }
});

clearButton.addEventListener("click", () => {
  if (
    !editor.value ||
    window.confirm("¿Quieres borrar todo el código?")
  ) {
    editor.value = "";
    activeMatchIndex = -1;

    updateEverything();
    editor.focus();
  }
});

editor.value = DEFAULT_CODE;
updateEverything();
