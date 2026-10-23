var assert = require('assert');
var fs = require('fs');
var UglifyJS = require('uglify-js');
var CleanCSS = require('clean-css');
var markdown = require('./static/markdown.js');

console.log('1. Testing ES5 UglifyJS 2.6.0 & CleanCSS minification...');
['./static/markdown.js', './static/application.js'].forEach(function(file) {
  var minified = UglifyJS.minify(file);
  assert(minified && typeof minified.code === 'string' && minified.code.length > 100, 'Minification failed for ' + file);
  var dest = file.replace(/\.js$/, '.min.js');
  fs.writeFileSync(dest, minified.code, 'utf8');
  console.log('   Verified & wrote ' + dest + ' (' + minified.code.length + ' bytes)');
});

var cssSource = fs.readFileSync('./static/application.css', 'utf8');
var minifiedCss = new CleanCSS().minify(cssSource).styles;
assert(minifiedCss && minifiedCss.length > 100, 'CSS minification failed');
fs.writeFileSync('./static/application.min.css', minifiedCss, 'utf8');
console.log('   Verified & wrote ./static/application.min.css (' + minifiedCss.length + ' bytes)');

console.log('2. Testing Markdown heuristic detector...');
var samplePaste = [
  '# Optional Polish Idea for Future Revision: Lazy-Loaded Brand Icons for SSO Buttons',
  '',
  '## Overview',
  'Since `.well-known/openid-configuration` (OIDC Discovery 1.0 / RFC 8414) does not advertise an IdP logo or icon URL, `ProviderButtons` in `frontend/src/pages/Login/index.tsx` currently renders a generic `<IconKey />`.',
  '',
  '### Benefits',
  '- **Zero External Network Calls:** Avoids fetching external `/favicon.ico` or third-party image URLs.',
  '- **Zero Backend Changes:** Uses `provider.name` already returned by `/api/tokens/options`.',
  '',
  '---',
  '',
  '## 1. New File: `frontend/src/pages/Login/ProviderButtons.tsx`',
  '',
  '```tsx',
  'import { IconKey } from "@tabler/icons-react";',
  'export function getIcon() { return IconKey; }',
  '```'
].join('\n');

var sampleRes = markdown.detect(samplePaste);
assert.strictEqual(sampleRes.isMarkdown, true, 'Sample paste xVOvra0kGLqBmR3t must be detected as Markdown');

var readmeRes = markdown.detect(fs.readFileSync('./README.md', 'utf8'));
assert.strictEqual(readmeRes.isMarkdown, true, 'README.md must be detected as Markdown');

var tableMd = '| Header 1 | Header 2 |\n| --- | :---: |\n| Cell A | Cell B |\n';
assert.strictEqual(markdown.detect(tableMd).isMarkdown, true, 'GFM table must be detected as Markdown');

var taskMd = '## Tasks\n- [x] Implement parser\n- [ ] Verify security\n';
assert.strictEqual(markdown.detect(taskMd).isMarkdown, true, 'Task list must be detected as Markdown');

// Negative cases: source code, scripts, configs, JSON, diffs
var negativeFiles = [
  './server.js',
  './test_server.py',
  './documents/test.java',
  './init.d/pastebin',
  './config.js'
];
negativeFiles.forEach(function(f) {
  var content = fs.readFileSync(f, 'utf8');
  var res = markdown.detect(content);
  assert.strictEqual(res.isMarkdown, false, 'File ' + f + ' should NOT be detected as Markdown (got score ' + res.score + ')');
});

var cHeader = '#ifndef UTIL_H\n#define UTIL_H\n#include <stdio.h>\n// comment\nint compute(int **ptr, int n);\n#endif\n';
assert.strictEqual(markdown.detect(cHeader).isMarkdown, false, 'C header should NOT be detected as Markdown');

var yamlConfig = '---\nversion: "3.8"\nservices:\n  web:\n    image: nginx:latest\n    ports:\n      - "80:80"\n';
assert.strictEqual(markdown.detect(yamlConfig).isMarkdown, false, 'YAML config should NOT be detected as Markdown');

var gitDiff = 'diff --git a/server.js b/server.js\n--- a/server.js\n+++ b/server.js\n@@ -1,4 +1,4 @@\n-var a = 1;\n+var a = 2;\n';
assert.strictEqual(markdown.detect(gitDiff).isMarkdown, false, 'Git diff should NOT be detected as Markdown');

console.log('3. Testing Token-to-DOM renderer & Zero-Execution security invariants...');

// Minimal spec-compliant Mock DOM to verify exact DOM node construction and attributes
function MockNode(nodeType, tagName) {
  this.nodeType = nodeType;
  this.tagName = tagName ? tagName.toUpperCase() : null;
  this.className = '';
  this.attributes = Object.create(null);
  this.childNodes = [];
  this._text = '';
  this.parentNode = null;
}
Object.defineProperty(MockNode.prototype, 'firstChild', {
  get: function() { return this.childNodes[0] || null; }
});
Object.defineProperty(MockNode.prototype, 'textContent', {
  get: function() {
    if (this.nodeType === 3) return this._text;
    return this.childNodes.map(function(c) { return c.textContent; }).join('');
  },
  set: function(val) {
    this.childNodes = [];
    if (this.nodeType === 3) {
      this._text = String(val);
    } else {
      var tn = new MockNode(3, null);
      tn._text = String(val);
      this.appendChild(tn);
    }
  }
});
Object.defineProperty(MockNode.prototype, 'innerHTML', {
  set: function() {
    throw new Error('SECURITY VIOLATION: innerHTML setter was invoked!');
  }
});
Object.defineProperty(MockNode.prototype, 'outerHTML', {
  set: function() {
    throw new Error('SECURITY VIOLATION: outerHTML setter was invoked!');
  }
});
MockNode.prototype.appendChild = function(child) {
  if (child.nodeType === 11) {
    var list = child.childNodes.slice();
    child.childNodes = [];
    for (var i = 0; i < list.length; i++) {
      this.appendChild(list[i]);
    }
    return child;
  }
  child.parentNode = this;
  this.childNodes.push(child);
  return child;
};
MockNode.prototype.removeChild = function(child) {
  var idx = this.childNodes.indexOf(child);
  if (idx !== -1) {
    this.childNodes.splice(idx, 1);
    child.parentNode = null;
  }
  return child;
};
MockNode.prototype.setAttribute = function(k, v) {
  this.attributes[String(k).toLowerCase()] = String(v);
};

global.window = { location: { origin: 'https://hackedyour.info' } };
global.document = {
  createElement: function(tag) { return new MockNode(1, tag); },
  createTextNode: function(text) {
    var n = new MockNode(3, null);
    n._text = String(text);
    return n;
  },
  createDocumentFragment: function() { return new MockNode(11, '#fragment'); }
};

// Re-require markdown with Mock DOM attached
delete require.cache[require.resolve('./static/markdown.js')];
var domMarkdown = require('./static/markdown.js');

var hostilePayload = [
  '# H1 Normalized Header',
  '## H2 Subheader',
  '### H3 Section',
  '',
  'Paragraph with **bold**, *italic*, ~~strike~~, `inline <script>alert(1)</script>`, and literal image ![my-alt](https://evil.example/track.png) plus ![ssrf](http://127.0.0.1:7777/raw/about).',
  '',
  '<script>window.__xss = 1;</script>',
  '<img src="x" onerror="window.__xss = 2">',
  '<svg onload="window.__xss = 3"></svg>',
  '<a id="location" name="doc" href="javascript:alert(1)" onclick="alert(1)">clobber</a>',
  '',
  '- [x] Safe task item',
  '- [ ] Unchecked task item',
  '- [Valid HTTPS Link](https://hackedyour.info/about)',
  '- [XSS JS Link](javascript:alert(document.domain))',
  '- [XSS Data Link](data:text/html,<script>alert(1)</script>)',
  '- [XSS VBScript Link](vbscript:msgbox(1))',
  '- [XSS Control Char Link](\u0001java\u0009script:alert(1))',
  '',
  '| Col 1 | Col 2 |',
  '| :--- | ---: |',
  '| val 1 | <img onerror=alert(1)> |',
  '',
  '```javascript',
  'const x = "<script>alert(1)</script>";',
  '```'
].join('\n');

var root = global.document.createElement('div');
domMarkdown.render(hostilePayload, root);

// Traverse all nodes in rendered tree and assert security invariants
var forbiddenTags = ['SCRIPT', 'SVG', 'IMG', 'IFRAME', 'OBJECT', 'EMBED', 'STYLE', 'LINK', 'META', 'BASE', 'FORM'];
var allElements = [];
function collectElements(node) {
  for (var i = 0; i < node.childNodes.length; i++) {
    var child = node.childNodes[i];
    if (child.nodeType === 1) {
      allElements.push(child);
      collectElements(child);
    }
  }
}
collectElements(root);

assert(allElements.length > 10, 'Expected rendered DOM elements');

var linksFound = [];
var headingsFound = [];
var tablesFound = 0;

allElements.forEach(function(el) {
  assert.strictEqual(forbiddenTags.indexOf(el.tagName), -1, 'Forbidden tag rendered: ' + el.tagName);

  var attrNames = Object.keys(el.attributes);
  attrNames.forEach(function(attr) {
    assert(!/^on/i.test(attr), 'Event handler attribute found: ' + attr);
    assert(attr !== 'id' && attr !== 'name' && attr !== 'style', 'Forbidden attribute found: ' + attr);
  });

  if (el.tagName === 'A') {
    var href = el.attributes['href'] || '';
    linksFound.push(href);
    assert(
      /^https:\/\/|^http:\/\/|^mailto:|^#[A-Za-z0-9_.:-]+$/.test(href),
      'Unsafe href rendered on <a>: ' + href
    );
    if (!/^#/.test(href)) {
      assert.strictEqual(el.attributes['rel'], 'noopener noreferrer nofollow');
      assert.strictEqual(el.attributes['target'], '_blank');
    }
  }

  if (/^H[1-6]$/.test(el.tagName)) {
    headingsFound.push(el.tagName);
  }
  if (el.tagName === 'TABLE') {
    tablesFound++;
  }
});

assert.deepStrictEqual(headingsFound, ['H1', 'H2', 'H3'], 'Expected H1, H2, H3 elements');
assert.strictEqual(tablesFound, 1, 'Expected 1 rendered GFM table');
assert.deepStrictEqual(linksFound, ['https://hackedyour.info/about'], 'Only the valid HTTPS link should render as <a>');

var fullRenderedText = root.textContent;
assert(fullRenderedText.indexOf('![my-alt](https://evil.example/track.png)') !== -1, 'Image syntax ![alt](url) must be preserved literally as plain text');
assert(fullRenderedText.indexOf('![ssrf](http://127.0.0.1:7777/raw/about)') !== -1, 'SSRF image syntax must be preserved literally as plain text');
assert(fullRenderedText.indexOf('<script>window.__xss = 1;</script>') !== -1, 'Raw <script> tag must be rendered as literal textContent');

console.log('All Markdown heuristic, DOM rendering, and Zero-Execution security tests PASSED!');
