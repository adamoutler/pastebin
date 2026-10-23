/*
 * Secure Zero-Execution Client-Side Markdown Detector and Token-to-DOM Renderer
 *
 * Security Invariants:
 * 1. NEVER uses innerHTML, outerHTML, insertAdjacentHTML, document.write, DOMParser, or jQuery .html().
 * 2. All DOM nodes are constructed exclusively via createSafeElement() (allowlisted tags) and createTextNode() / textContent.
 * 3. Image syntax ![alt](url) is left literally as-is as plain text (zero external/internal network requests).
 * 4. Links [label](url) allow ONLY https:, http:, mailto:, or #anchor; unsafe schemes degrade to literal text.
 * 5. No user-controlled id, name, style, class, or event handler attributes are ever created.
 * 6. Written in strict ES5 for compatibility with uglify-js 2.6.0 startup minification.
 */
(function(window, document) {
  'use strict';

  var ALLOWED_TAGS = Object.create ? Object.create(null) : {};
  var tagList = [
    'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'blockquote', 'ul', 'ol', 'li',
    'pre', 'code', 'span', 'strong', 'em', 'del',
    'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'input'
  ];
  for (var t = 0; t < tagList.length; t++) {
    ALLOWED_TAGS[tagList[t]] = true;
  }

  function trimStr(s) {
    return String(s || '').replace(/^\s+|\s+$/g, '');
  }

  function createSafeElement(tagName, className) {
    var lower = String(tagName || '').toLowerCase();
    if (!ALLOWED_TAGS[lower]) {
      lower = 'span';
    }
    var el = document.createElement(lower);
    if (className) {
      el.className = className;
    }
    return el;
  }

  function clearElement(el) {
    if (!el) {
      return;
    }
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return null;
    }
    var cleaned = rawUrl.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '');
    if (!cleaned) {
      return null;
    }
    if (cleaned.charAt(0) === '#') {
      if (/^#[A-Za-z0-9_.:-]+$/.test(cleaned)) {
        return { href: cleaned, external: false };
      }
      return null;
    }
    var colonIdx = cleaned.indexOf(':');
    var slashIdx = cleaned.indexOf('/');
    if (colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx)) {
      var scheme = cleaned.substring(0, colonIdx + 1).toLowerCase();
      if (scheme !== 'https:' && scheme !== 'http:' && scheme !== 'mailto:') {
        return null;
      }
    }
    try {
      var base = (window.location && window.location.origin && window.location.origin !== 'null')
        ? window.location.origin
        : 'https://hackedyour.info';
      var parsed = new URL(cleaned, base);
      var proto = String(parsed.protocol || '').toLowerCase();
      if (proto === 'https:' || proto === 'http:' || proto === 'mailto:') {
        return { href: parsed.href, external: true };
      }
    } catch (e) {
      if (/^(https?:\/\/|mailto:)/i.test(cleaned) && !/[\s"'<>`]/.test(cleaned)) {
        return { href: cleaned, external: true };
      }
    }
    return null;
  }

  function detectMarkdown(text) {
    if (!text || typeof text !== 'string') {
      return { isMarkdown: false, score: 0 };
    }
    var trimmed = trimStr(text);
    if (trimmed.length < 12) {
      return { isMarkdown: false, score: 0 };
    }

    var firstLine = trimStr(trimmed.split(/\r?\n/, 1)[0]);
    if (/^#!/.test(firstLine)) {
      return { isMarkdown: false, score: -100 };
    }
    if (/^(<!doctype\s+html|<html\b|<\?xml\b|<\?php\b)/i.test(firstLine)) {
      return { isMarkdown: false, score: -100 };
    }
    var firstChar = trimmed.charAt(0);
    var lastChar = trimmed.charAt(trimmed.length - 1);
    if ((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']')) {
      try {
        JSON.parse(trimmed);
        return { isMarkdown: false, score: -100 };
      } catch (e) {}
    }

    var lines = text.slice(0, 32768).split(/\r?\n/);
    var maxLines = Math.min(lines.length, 250);

    var score = 0;
    var inFence = false;
    var fenceChar = '';
    var fenceLen = 0;
    var fenceHasLang = false;
    var inBlockComment = false;

    var closedFences = 0;
    var closedLangFences = 0;
    var multiHashHeadings = 0;
    var singleHashHeadings = 0;
    var setextHeadings = 0;
    var consecutiveHashLines = 0;
    var maxConsecutiveHashLines = 0;

    var mdLinks = 0;
    var refLinks = 0;
    var taskItems = 0;
    var formattedBullets = 0;
    var plainBullets = 0;
    var orderedItems = 0;
    var blockquotes = 0;
    var tableDelimiters = 0;
    var hrCount = 0;
    var boldSpans = 0;
    var inlineCodeProseLines = 0;

    var nonEmptyOutsideFence = 0;
    var codeLikeLines = 0;
    var yamlLikeLines = 0;
    var diffHeaderLines = 0;

    for (var i = 0; i < maxLines; i++) {
      var rawLine = lines[i];
      var line = trimStr(rawLine);

      var fenceMatch = rawLine.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/);
      if (fenceMatch) {
        var marker = fenceMatch[1];
        var info = trimStr(fenceMatch[2]);
        if (!inFence) {
          if (info.indexOf(marker.charAt(0)) === -1) {
            inFence = true;
            fenceChar = marker.charAt(0);
            fenceLen = marker.length;
            fenceHasLang = /^[a-zA-Z0-9_+.-]{1,30}$/.test(info);
            continue;
          }
        } else if (marker.charAt(0) === fenceChar && marker.length >= fenceLen && info === '') {
          inFence = false;
          closedFences++;
          if (fenceHasLang) {
            closedLangFences++;
          }
          continue;
        }
      }

      if (inFence) {
        continue;
      }

      if (inBlockComment) {
        if (line.indexOf('*/') !== -1) {
          inBlockComment = false;
        }
        continue;
      }
      if (/^\/\*/.test(line)) {
        codeLikeLines++;
        nonEmptyOutsideFence++;
        if (line.indexOf('*/') === -1) {
          inBlockComment = true;
        }
        continue;
      }

      if (line === '') {
        consecutiveHashLines = 0;
        continue;
      }

      nonEmptyOutsideFence++;

      if (/^#/.test(line)) {
        consecutiveHashLines++;
        if (consecutiveHashLines > maxConsecutiveHashLines) {
          maxConsecutiveHashLines = consecutiveHashLines;
        }
      } else {
        consecutiveHashLines = 0;
      }

      if (/^(diff --git |--- a\/|\+\+\+ b\/|@@ -\d+)/.test(rawLine)) {
        diffHeaderLines++;
      }

      if (/^#\s*(include|define|ifdef|ifndef|endif|pragma|undef|elif|error|line|region|endregion)\b/.test(line)) {
        codeLikeLines++;
        continue;
      }

      var hMatch = rawLine.match(/^ {0,3}(#{1,6}) +(\S.*)$/);
      if (hMatch) {
        if (hMatch[1].length >= 2) {
          multiHashHeadings++;
        } else {
          var prevIsHash = i > 0 && /^#\s/.test(trimStr(lines[i - 1]));
          var nextIsHash = i + 1 < maxLines && /^#\s/.test(trimStr(lines[i + 1]));
          if (!prevIsHash && !nextIsHash) {
            singleHashHeadings++;
          }
        }
      }

      if (i + 1 < maxLines && /^[A-Za-z0-9].{2,80}$/.test(line) && !/:\s/.test(line)) {
        var nextLine = trimStr(lines[i + 1]);
        var prevEmpty = i === 0 || trimStr(lines[i - 1]) === '';
        if (prevEmpty && /^(={3,}|-{3,})$/.test(nextLine)) {
          setextHeadings++;
        }
      }

      if (/^ {0,3}(\*{3,}|_{3,}|-{3,})\s*$/.test(rawLine)) {
        var hrPrevEmpty = i > 0 && trimStr(lines[i - 1]) === '';
        var hrNextEmpty = i + 1 < maxLines && trimStr(lines[i + 1]) === '';
        if (hrPrevEmpty && hrNextEmpty) {
          hrCount++;
        }
      }

      if (/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) {
        if (i > 0 && /\|/.test(lines[i - 1])) {
          tableDelimiters++;
        }
      }

      if (/^ {0,6}[-*+] +\[[ xX]\] +\S/.test(rawLine)) {
        taskItems++;
      } else if (/^ {0,6}[-*+] +(\*\*|`|\!?\[)/.test(rawLine)) {
        formattedBullets++;
      } else if (/^ {0,6}[-*+] +[A-Za-z0-9]/.test(rawLine)) {
        if (!/^ {0,6}-\s+[a-zA-Z0-9_-]+:\s/.test(rawLine)) {
          plainBullets++;
        } else {
          yamlLikeLines++;
        }
      }

      if (/^ {0,6}\d{1,2}\. +[A-Z`\*\[]\S*/.test(rawLine)) {
        orderedItems++;
      }

      if (/^ {0,3}> +[A-Za-z0-9`*_\[]/.test(rawLine)) {
        blockquotes++;
      }

      var linkMatches = line.match(/!?\[[^\]\r\n]{1,100}\]\((?:https?:\/\/|mailto:|\/|\.?\.?\/|#)[^\s)\r\n]+\)/g);
      if (linkMatches) {
        mdLinks += linkMatches.length;
      }

      if (/^ {0,3}\[[^\]\r\n]{1,60}\]:\s+\S+/.test(rawLine)) {
        refLinks++;
      }

      var boldMatches = line.match(/\*\*[A-Za-z0-9_][^*\r\n]{0,80}[A-Za-z0-9_.:!?]\*\*/g);
      if (boldMatches) {
        boldSpans += boldMatches.length;
      }

      var isCodeStatement =
        /[{};]\s*$/.test(line) ||
        /^(import |from \S+ import |export |def |class |function |var |let |const |return |if\s*\(|for\s*\(|while\s*\(|switch\s*\(|package |public |private |protected |try\s*\{|catch\s*\()/.test(line) ||
        /^[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^=]/.test(line) ||
        /^(echo|sudo|apt-get|chmod|chown|mkdir|grep|awk|sed|curl|wget|docker|git)\s+/.test(line);

      if (isCodeStatement) {
        codeLikeLines++;
      } else if (/`[^`\r\n]{1,80}`/.test(line)) {
        inlineCodeProseLines++;
      }

      if (/^[a-zA-Z0-9_.-]+:\s*(\S.*)?$/.test(line) && !/^https?:/i.test(line) && line.length < 80) {
        yamlLikeLines++;
      }
    }

    if (closedLangFences > 0) {
      score += 5 + Math.min(closedLangFences - 1, 2) * 3;
    }
    var unlabelledFences = closedFences - closedLangFences;
    if (unlabelledFences > 0) {
      score += Math.min(unlabelledFences, 2) * 4;
    }
    if (multiHashHeadings > 0) {
      score += Math.min(multiHashHeadings, 3) * 3;
    }
    if (singleHashHeadings > 0 && maxConsecutiveHashLines < 3) {
      score += Math.min(singleHashHeadings, 2) * 2;
    }
    if (setextHeadings > 0) {
      score += Math.min(setextHeadings, 2) * 3;
    }
    if (tableDelimiters > 0) {
      score += 5;
    }
    if (taskItems > 0) {
      score += Math.min(taskItems, 3) * 3;
    }
    if (mdLinks > 0) {
      score += 4 + Math.min(mdLinks - 1, 2) * 2;
    }
    if (refLinks > 0) {
      score += Math.min(refLinks, 2) * 3;
    }
    if (formattedBullets > 0) {
      score += Math.min(formattedBullets, 3) * 2.5;
    }
    if (plainBullets >= 2) {
      score += Math.min(plainBullets, 4) * 1;
    }
    if (orderedItems >= 2) {
      score += Math.min(orderedItems, 3) * 1.5;
    }
    if (blockquotes > 0) {
      score += Math.min(blockquotes, 2) * 2;
    }
    if (boldSpans > 0) {
      score += Math.min(boldSpans, 3) * 2;
    }
    if (inlineCodeProseLines > 0) {
      score += Math.min(inlineCodeProseLines, 3) * 1.5;
    }
    if (hrCount > 0) {
      score += Math.min(hrCount, 2) * 1.5;
    }

    if (maxConsecutiveHashLines >= 3) {
      score -= 4;
    }
    if (diffHeaderLines >= 2) {
      score -= 10;
    }
    if (nonEmptyOutsideFence > 0) {
      if ((codeLikeLines / nonEmptyOutsideFence) > 0.25) {
        score -= 8;
      }
      if ((yamlLikeLines / nonEmptyOutsideFence) > 0.40) {
        score -= 8;
      }
    }

    return { isMarkdown: score >= 5, score: score };
  }

  /*
   * Inline parser: converts inline Markdown tokens into DOM nodes inside parentEl.
   * Image syntax ![alt](url) is preserved literally as plain text.
   */
  var INLINE_TOKEN_RE = /(`+[^`]+`+)|(!\[[^\]\r\n]*\]\([^\)\r\n]*\))|(\[([^\]\r\n]+)\]\(([^\s\)\r\n]+)(?:\s+"[^"\r\n]*")?\))|(\*\*\*([^\*\r\n]+)\*\*\*)|(___([^_\r\n]+)___)|(\*\*([^\*\r\n]+)\*\*)|(__([^_\r\n]+)__)|(\*([^\*\s][^\*\r\n]*?)\*)|(\b_([^_\s][^_\r\n]*?)_\b)|(~~([^~\r\n]+)~~)/g;

  function appendInlineNodes(text, parentEl, depth) {
    if (!text) {
      return;
    }
    var currentDepth = depth || 0;
    if (currentDepth > 3) {
      parentEl.appendChild(document.createTextNode(text));
      return;
    }

    var re = new RegExp(INLINE_TOKEN_RE.source, 'g');
    var lastIndex = 0;
    var match;

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parentEl.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }

      if (match[1]) {
        // Inline code: `code` or ``code``
        var rawCode = match[1];
        var tickCount = 0;
        while (tickCount < rawCode.length && rawCode.charAt(tickCount) === '`') {
          tickCount++;
        }
        var innerCode = rawCode.substring(tickCount, rawCode.length - tickCount);
        var codeNode = createSafeElement('code', 'md-inline-code');
        codeNode.textContent = innerCode;
        parentEl.appendChild(codeNode);
      } else if (match[2]) {
        // Image syntax ![alt](url): leave literally as-is as plain text
        parentEl.appendChild(document.createTextNode(match[2]));
      } else if (match[3]) {
        // Standard link: [label](url)
        var labelText = match[4];
        var rawHref = match[5];
        var safeTarget = sanitizeUrl(rawHref);
        if (safeTarget) {
          var aNode = createSafeElement('a', 'md-link');
          aNode.setAttribute('href', safeTarget.href);
          if (safeTarget.external) {
            aNode.setAttribute('target', '_blank');
            aNode.setAttribute('rel', 'noopener noreferrer nofollow');
          }
          appendInlineNodes(labelText, aNode, currentDepth + 1);
          parentEl.appendChild(aNode);
        } else {
          parentEl.appendChild(document.createTextNode(match[0]));
        }
      } else if (match[6] || match[8]) {
        // Bold + Italic: ***text*** or ___text___
        var biText = match[7] || match[9];
        var strongBi = createSafeElement('strong');
        var emBi = createSafeElement('em');
        appendInlineNodes(biText, emBi, currentDepth + 1);
        strongBi.appendChild(emBi);
        parentEl.appendChild(strongBi);
      } else if (match[10] || match[12]) {
        // Bold: **text** or __text__
        var bText = match[11] || match[13];
        var strongNode = createSafeElement('strong');
        appendInlineNodes(bText, strongNode, currentDepth + 1);
        parentEl.appendChild(strongNode);
      } else if (match[14] || match[16]) {
        // Italic: *text* or _text_
        var iText = match[15] || match[17];
        var emNode = createSafeElement('em');
        appendInlineNodes(iText, emNode, currentDepth + 1);
        parentEl.appendChild(emNode);
      } else if (match[18]) {
        // Strikethrough: ~~text~~
        var delNode = createSafeElement('del');
        appendInlineNodes(match[19], delNode, currentDepth + 1);
        parentEl.appendChild(delNode);
      } else {
        parentEl.appendChild(document.createTextNode(match[0]));
      }

      lastIndex = re.lastIndex;
    }

    if (lastIndex < text.length) {
      parentEl.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
  }

  function splitTableRow(line) {
    var trimmed = trimStr(line);
    if (trimmed.charAt(0) === '|') {
      trimmed = trimmed.substring(1);
    }
    if (trimmed.length > 0 && trimmed.charAt(trimmed.length - 1) === '|') {
      trimmed = trimmed.substring(0, trimmed.length - 1);
    }
    var cells = trimmed.split('|');
    var result = [];
    for (var i = 0; i < cells.length; i++) {
      result.push(trimStr(cells[i]));
    }
    return result;
  }

  function isTableDelimiterLine(line) {
    var trimmed = trimStr(line);
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(trimmed) ||
           /^\|?\s*:?-{3,}:?\s*\|$/.test(trimmed);
  }

  function parseTableAlignments(delimLine) {
    var cells = splitTableRow(delimLine);
    var aligns = [];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var left = c.charAt(0) === ':';
      var right = c.charAt(c.length - 1) === ':';
      if (left && right) {
        aligns.push('md-align-center');
      } else if (right) {
        aligns.push('md-align-right');
      } else {
        aligns.push('md-align-left');
      }
    }
    return aligns;
  }

  function renderMarkdown(text, containerEl) {
    if (!containerEl) {
      return;
    }
    clearElement(containerEl);

    if (!text || typeof text !== 'string') {
      return;
    }

    var safeInput = text.length > 524288 ? text.substring(0, 524288) : text;
    var lines = safeInput.split(/\r?\n/);
    var numLines = lines.length;
    var fragment = document.createDocumentFragment();

    var i = 0;
    while (i < numLines) {
      var rawLine = lines[i];
      var trimmed = trimStr(rawLine);

      // 1. Blank lines
      if (trimmed === '') {
        i++;
        continue;
      }

      // 2. Fenced Code Blocks (``` or ~~~)
      var fenceMatch = rawLine.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/);
      if (fenceMatch && fenceMatch[2].indexOf(fenceMatch[1].charAt(0)) === -1) {
        var fenceChar = fenceMatch[1].charAt(0);
        var fenceLen = fenceMatch[1].length;
        var langInfo = trimStr(fenceMatch[2]);
        var codeLines = [];
        i++;
        while (i < numLines) {
          var closeMatch = lines[i].match(/^ {0,3}(`{3,}|~{3,})\s*$/);
          if (closeMatch && closeMatch[1].charAt(0) === fenceChar && closeMatch[1].length >= fenceLen) {
            i++;
            break;
          }
          codeLines.push(lines[i]);
          i++;
        }
        var codeWrapper = createSafeElement('div', 'md-code-wrapper');
        if (langInfo) {
          var langBadge = createSafeElement('div', 'md-code-lang');
          langBadge.textContent = langInfo;
          codeWrapper.appendChild(langBadge);
        }
        var preEl = createSafeElement('pre', 'md-fenced');
        var codeEl = createSafeElement('code', 'md-code-block');
        codeEl.textContent = codeLines.join('\n');
        preEl.appendChild(codeEl);
        codeWrapper.appendChild(preEl);
        fragment.appendChild(codeWrapper);
        continue;
      }

      // 3. ATX Headings (# to ######)
      var atxMatch = rawLine.match(/^ {0,3}(#{1,6}) +(.*?)(?: +#+\s*)?$/);
      if (atxMatch) {
        var level = atxMatch[1].length;
        var headingEl = createSafeElement('h' + level, 'md-heading md-h' + level);
        appendInlineNodes(trimStr(atxMatch[2]), headingEl, 0);
        fragment.appendChild(headingEl);
        i++;
        continue;
      }

      // 4. Setext Headings (Heading text followed by === or ---)
      if (i + 1 < numLines) {
        var nextTrimmed = trimStr(lines[i + 1]);
        if (/^(={3,}|-{3,})$/.test(nextTrimmed) && !/^ {0,3}[-*+]\s/.test(rawLine) && !/^ {0,3}>/.test(rawLine)) {
          var setextLevel = nextTrimmed.charAt(0) === '=' ? 1 : 2;
          var setextEl = createSafeElement('h' + setextLevel, 'md-heading md-h' + setextLevel);
          appendInlineNodes(trimmed, setextEl, 0);
          fragment.appendChild(setextEl);
          i += 2;
          continue;
        }
      }

      // 5. Horizontal Rule (---, ***, ___)
      if (/^ {0,3}(\*{3,}|_{3,}|-{3,})\s*$/.test(rawLine)) {
        fragment.appendChild(createSafeElement('hr', 'md-hr'));
        i++;
        continue;
      }

      // 6. GFM Tables
      if (trimmed.indexOf('|') !== -1 && i + 1 < numLines && isTableDelimiterLine(lines[i + 1])) {
        var headerCells = splitTableRow(rawLine);
        var alignments = parseTableAlignments(lines[i + 1]);
        var tableWrap = createSafeElement('div', 'md-table-wrap');
        var tableEl = createSafeElement('table', 'md-table');
        var theadEl = createSafeElement('thead');
        var headTr = createSafeElement('tr');
        for (var hc = 0; hc < headerCells.length; hc++) {
          var thEl = createSafeElement('th', alignments[hc] || 'md-align-left');
          appendInlineNodes(headerCells[hc], thEl, 0);
          headTr.appendChild(thEl);
        }
        theadEl.appendChild(headTr);
        tableEl.appendChild(theadEl);

        var tbodyEl = createSafeElement('tbody');
        i += 2;
        while (i < numLines) {
          var rowLine = trimStr(lines[i]);
          if (rowLine === '' || rowLine.indexOf('|') === -1) {
            break;
          }
          var rowCells = splitTableRow(lines[i]);
          var bodyTr = createSafeElement('tr');
          for (var rc = 0; rc < headerCells.length; rc++) {
            var tdEl = createSafeElement('td', alignments[rc] || 'md-align-left');
            appendInlineNodes(rc < rowCells.length ? rowCells[rc] : '', tdEl, 0);
            bodyTr.appendChild(tdEl);
          }
          tbodyEl.appendChild(bodyTr);
          i++;
        }
        tableEl.appendChild(tbodyEl);
        tableWrap.appendChild(tableEl);
        fragment.appendChild(tableWrap);
        continue;
      }

      // 7. Blockquotes (> ...)
      if (/^ {0,3}>/.test(rawLine)) {
        var quoteLines = [];
        while (i < numLines && /^ {0,3}>/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^ {0,3}> ?/, ''));
          i++;
        }
        var bqEl = createSafeElement('blockquote', 'md-blockquote');
        renderMarkdown(quoteLines.join('\n'), bqEl);
        fragment.appendChild(bqEl);
        continue;
      }

      // 8. Lists (Unordered - / * / + and Ordered 1. )
      var ulMatch = rawLine.match(/^( *)([-*+]) +(.*)$/);
      var olMatch = !ulMatch ? rawLine.match(/^( *)(\d{1,9})\. +(.*)$/) : null;
      if (ulMatch || olMatch) {
        var isOrdered = !!olMatch;
        var listEl = createSafeElement(isOrdered ? 'ol' : 'ul', isOrdered ? 'md-list md-ol' : 'md-list md-ul');
        if (isOrdered) {
          var startNum = parseInt(olMatch[2], 10);
          if (startNum > 1) {
            listEl.setAttribute('start', String(startNum));
          }
        }
        while (i < numLines) {
          var itemRaw = lines[i];
          var itemUl = itemRaw.match(/^( *)([-*+]) +(.*)$/);
          var itemOl = !itemUl ? itemRaw.match(/^( *)(\d{1,9})\. +(.*)$/) : null;
          if ((isOrdered && !itemOl) || (!isOrdered && !itemUl)) {
            break;
          }
          var itemContent = isOrdered ? itemOl[3] : itemUl[3];
          var indentLen = (isOrdered ? itemOl[1] : itemUl[1]).length;
          var liClass = indentLen >= 2 ? 'md-li md-li-nested' : 'md-li';
          var liEl = createSafeElement('li', liClass);

          var taskMatch = itemContent.match(/^\[([ xX])\] +(.*)$/);
          if (taskMatch) {
            liEl.className += ' md-task-item';
            var checkbox = createSafeElement('input', 'md-task-checkbox');
            checkbox.setAttribute('type', 'checkbox');
            checkbox.setAttribute('disabled', 'disabled');
            checkbox.disabled = true;
            if (taskMatch[1].toLowerCase() === 'x') {
              checkbox.setAttribute('checked', 'checked');
              checkbox.checked = true;
            }
            liEl.appendChild(checkbox);
            appendInlineNodes(taskMatch[2], liEl, 0);
          } else {
            appendInlineNodes(itemContent, liEl, 0);
          }
          listEl.appendChild(liEl);
          i++;
        }
        fragment.appendChild(listEl);
        continue;
      }

      // 9. Paragraph (collect contiguous plain lines)
      var paraLines = [];
      while (i < numLines) {
        var pRaw = lines[i];
        var pTrim = trimStr(pRaw);
        if (pTrim === '') {
          break;
        }
        if (/^ {0,3}(`{3,}|~{3,})/.test(pRaw) ||
            /^ {0,3}#{1,6} +/.test(pRaw) ||
            /^ {0,3}(\*{3,}|_{3,}|-{3,})\s*$/.test(pRaw) ||
            /^ {0,3}>/.test(pRaw) ||
            /^ *(?:[-*+]|\d{1,9}\.) +/.test(pRaw) ||
            (pTrim.indexOf('|') !== -1 && i + 1 < numLines && isTableDelimiterLine(lines[i + 1]))) {
          break;
        }
        paraLines.push(pTrim);
        i++;
      }
      if (paraLines.length > 0) {
        var pEl = createSafeElement('p', 'md-p');
        for (var pl = 0; pl < paraLines.length; pl++) {
          if (pl > 0) {
            pEl.appendChild(document.createTextNode(' '));
          }
          appendInlineNodes(paraLines[pl], pEl, 0);
        }
        fragment.appendChild(pEl);
      } else {
        i++;
      }
    }

    containerEl.appendChild(fragment);
  }

  var api = {
    detect: detectMarkdown,
    render: renderMarkdown,
    sanitizeUrl: sanitizeUrl
  };

  window.haste_markdown = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : {});
