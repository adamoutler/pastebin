///// represents the paste application
var haste = function() {
  this.appName = "AdamOutler's Pastebin";
  this.twitter = true;
  this.$textarea = $('textarea');
  this.$box = $('#code');
  this.$code = $('#code code');
  this.$markdown = $('#markdown');
  this.$modeBar = $('#mode-bar');
  this.$modeLabel = $('#mode-label');
  this.$btnPrimary = $('#btn-mode-primary');
  this.$btnSecondary = $('#btn-mode-secondary');
  this.$btnCopyRaw = $('#btn-copy-raw');
  this.mode = 'writing';
  this.subMode = 'write';
  this.configureShortcuts();
  this.configureButtons();
  this.configureModeBar();

  if (!this.twitter) {
    $('#tools .twitter').hide();
  }
};

// Set the page title - include the appName
haste.prototype.setTitle = function(ext) {
  var title = ext ? this.appName + ' - ' + ext : this.appName;
  document.title = title;
};

// Show the light key (Writing mode)
haste.prototype.lightKey = function() {
  this.configureKey(['new', 'save', 'markdown']);
};

// Show the full key (Reading mode)
haste.prototype.fullKey = function() {
  this.configureKey(['new', 'duplicate', 'raw', 'twitter', 'markdown']);
};

// Set the key up for certain things to be enabled
haste.prototype.configureKey = function(enable) {
  var $this, i = 0;
  $('#tools .function').each(function() {
    $this = $(this);
    for (i = 0; i < enable.length; i++) {
      if ($this.hasClass(enable[i])) {
        $this.addClass('enabled');
        return true;
      }
    }
    $this.removeClass('enabled');
  });
};

// Update the Writing Mode indicator badge based on live textarea content
haste.prototype.updateWritingBadge = function() {
  if (this.mode !== 'writing') {
    return;
  }
  var val = this.$textarea.val() || '';
  var detected = window.haste_markdown && window.haste_markdown.detect(val).isMarkdown;
  if (detected) {
    this.$modeLabel.text('WRITING MODE (MD)').addClass('md-detected');
  } else {
    this.$modeLabel.text('WRITING MODE').removeClass('md-detected');
  }
};

// Switch between 'write' and 'preview' inside Writing Mode
haste.prototype.setWriteSubMode = function(subMode) {
  this.mode = 'writing';
  this.subMode = subMode;
  this.$btnPrimary.text('Write');
  this.$btnSecondary.text('Preview');
  this.$btnCopyRaw.hide();
  this.updateWritingBadge();

  if (subMode === 'preview') {
    this.$btnPrimary.removeClass('active');
    this.$btnSecondary.addClass('active');
    $('#tools .function.markdown').addClass('active-view');
    var rawText = this.$textarea.val() || '';
    if (window.haste_markdown && this.$markdown.length) {
      window.haste_markdown.render(rawText, this.$markdown[0]);
    }
    this.$textarea.hide();
    this.$box.hide();
    this.$markdown.show().focus();
  } else {
    this.$btnPrimary.addClass('active');
    this.$btnSecondary.removeClass('active');
    $('#tools .function.markdown').removeClass('active-view');
    this.$markdown.hide();
    this.$box.hide();
    this.$textarea.show().focus();
  }
};

// Switch between 'markdown' (Rendered) and 'code' (Code / Raw) inside Reading Mode
haste.prototype.setReadSubMode = function(subMode) {
  this.mode = 'reading';
  this.subMode = subMode;
  this.$btnPrimary.text('Rendered');
  this.$btnSecondary.text('Code / Raw');
  this.$btnCopyRaw.show();

  if (this.doc && this.doc.isMarkdown) {
    this.$modeLabel.text('READING MODE (MD)').addClass('md-detected');
  } else {
    this.$modeLabel.text('READING MODE').removeClass('md-detected');
  }

  this.$textarea.hide();

  if (subMode === 'markdown') {
    this.$btnPrimary.addClass('active');
    this.$btnSecondary.removeClass('active');
    $('#tools .function.markdown').addClass('active-view');
    if (window.haste_markdown && this.$markdown.length && this.doc) {
      window.haste_markdown.render(this.doc.data || '', this.$markdown[0]);
    }
    this.$box.hide();
    this.$markdown.show().focus();
  } else {
    this.$btnPrimary.removeClass('active');
    this.$btnSecondary.addClass('active');
    $('#tools .function.markdown').removeClass('active-view');
    this.$markdown.hide();
    this.$box.show().focus();
  }
};

// Enter Reading Mode after loading or saving a document
haste.prototype.enterReadingMode = function(ret) {
  var formattedCode = ret.value;
  if (formattedCode.indexOf('<span class="line">') === -1) {
    formattedCode = formattedCode.trim()
      .replace(/.+/g, '<span class="line">$&</span>')
      .replace(/^\s*[\r\n]/gm, '<span class="line"></span>\n');
  }
  this.$code.html(formattedCode);
  this.setTitle(ret.key);
  this.fullKey();
  this.$textarea.val('').hide();

  var mdCheck = (window.haste_markdown && this.doc && this.doc.data)
    ? window.haste_markdown.detect(this.doc.data)
    : { isMarkdown: false, score: 0 };
  if (this.doc) {
    this.doc.isMarkdown = !!mdCheck.isMarkdown;
  }

  if (mdCheck.isMarkdown) {
    this.setReadSubMode('markdown');
  } else {
    this.setReadSubMode('code');
  }
};

// Toggle between the primary and secondary view in the current mode
haste.prototype.toggleMarkdownView = function() {
  if (this.doc && this.doc.locked) {
    if (this.subMode === 'markdown') {
      this.setReadSubMode('code');
    } else {
      this.setReadSubMode('markdown');
    }
  } else {
    if (this.subMode === 'preview') {
      this.setWriteSubMode('write');
    } else {
      this.setWriteSubMode('preview');
    }
  }
};

// Bind mode bar buttons and live detection on textarea
haste.prototype.configureModeBar = function() {
  var _this = this;

  this.$btnPrimary.click(function(evt) {
    evt.preventDefault();
    if (_this.doc && _this.doc.locked) {
      _this.setReadSubMode('markdown');
    } else {
      _this.setWriteSubMode('write');
    }
  });

  this.$btnSecondary.click(function(evt) {
    evt.preventDefault();
    if (_this.doc && _this.doc.locked) {
      _this.setReadSubMode('code');
    } else {
      _this.setWriteSubMode('preview');
    }
  });

  this.$btnCopyRaw.click(function(evt) {
    evt.preventDefault();
    if (!_this.doc || typeof _this.doc.data !== 'string') {
      return;
    }
    var rawData = _this.doc.data;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(rawData).then(function() {
        _this.$btnCopyRaw.text('Copied!');
        setTimeout(function() {
          _this.$btnCopyRaw.text('Copy Raw');
        }, 1500);
      });
    } else {
      var temp = document.createElement('textarea');
      temp.value = rawData;
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand('copy');
        _this.$btnCopyRaw.text('Copied!');
        setTimeout(function() {
          _this.$btnCopyRaw.text('Copy Raw');
        }, 1500);
      } catch (e) {}
      document.body.removeChild(temp);
    }
  });

  this.$textarea.on('input keyup paste', function() {
    _this.updateWritingBadge();
  });
};

// Remove the current document (if there is one) and set up for a new one
haste.prototype.newDocument = function(hideHistory) {
  this.$box.hide();
  this.$markdown.hide();
  this.doc = new haste_document();
  if (!hideHistory) {
    window.history.pushState(null, this.appName, '/');
  }
  this.setTitle();
  this.lightKey();
  this.$textarea.val(this.defaultText || '');
  this.setWriteSubMode('write');
};

// Load a document and show it
haste.prototype.loadDocument = function(key) {
  // Ask for what we want
  var _this = this;
  _this.doc = new haste_document();
  _this.doc.load(key, function(ret) {
    if (ret) {
      _this.enterReadingMode(ret);
    } else {
      _this.newDocument();
    }
  });
};

// Duplicate the current document - only if locked
haste.prototype.duplicateDocument = function() {
  if (this.doc.locked) {
    var currentData = this.doc.data;
    this.newDocument();
    this.$textarea.val(currentData);
    this.updateWritingBadge();
  }
};

// Lock the current document
haste.prototype.lockDocument = function() {
  var _this = this;
  this.doc.save(this.$textarea.val(), function(err, ret) {
    if (!err && ret) {
      var file = '/' + ret.key;
      window.history.pushState(null, _this.appName + '-' + ret.key, file);
      _this.enterReadingMode(ret);
    }
  });
};

haste.prototype.configureButtons = function() {
  var _this = this;
  this.buttons = [
    {
      $where: $('#tools .save'),
      shortcut: function(evt) {
        return evt.ctrlKey && (evt.keyCode === 83);
      },
      action: function() {
        if (_this.$textarea.val().replace(/^\s+|\s+$/g, '') !== '') {
          _this.lockDocument();
        }
      }
    },
    {
      $where: $('#tools .new'),
      shortcut: function(evt) {
        return evt.ctrlKey && evt.keyCode === 78;
      },
      action: function() {
        _this.newDocument(!_this.doc.key);
      }
    },
    {
      $where: $('#tools .duplicate'),
      shortcut: function(evt) {
        return _this.doc.locked && evt.ctrlKey && evt.keyCode === 68;
      },
      action: function() {
        _this.duplicateDocument();
      }
    },
    {
      $where: $('#tools .raw'),
      shortcut: function(evt) {
        return evt.ctrlKey && evt.shiftKey && evt.keyCode === 82;
      },
      action: function() {
        window.location.href = '/raw/' + _this.doc.key;
      }
    },
    {
      $where: $('#tools .twitter'),
      shortcut: function(evt) {
        return _this.twitter && _this.doc.locked && evt.shiftKey && evt.ctrlKey && evt.keyCode == 84;
      },
      action: function() {
        window.open('https://twitter.com/share?url=' + encodeURI(window.location.href));
      }
    },
    {
      $where: $('#tools .markdown'),
      shortcut: function(evt) {
        return evt.ctrlKey && evt.shiftKey && evt.keyCode === 77;
      },
      action: function() {
        _this.toggleMarkdownView();
      }
    }
  ];
  for (var i = 0; i < this.buttons.length; i++) {
    this.configureButton(this.buttons[i]);
  }
};

haste.prototype.configureButton = function(options) {
  // Handle the click action
  options.$where.click(function(evt) {
    evt.preventDefault();
    if (!options.clickDisabled && $(this).hasClass('enabled')) {
      options.action();
    }
  });
};

// Configure keyboard shortcuts for the textarea
haste.prototype.configureShortcuts = function() {
  var _this = this;
  $(document.body).keydown(function(evt) {
    var button;
    for (var i = 0 ; i < _this.buttons.length; i++) {
      button = _this.buttons[i];
      if (button.shortcut && button.shortcut(evt)) {
        evt.preventDefault();
        button.action();
        return;
      }
    }
  });
};

///// represents a single document
var haste_document = function() {
  this.locked = false;
  this.isMarkdown = false;
};

// Escapes HTML tag characters
haste_document.prototype.htmlEscape = function(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/>/g, '&gt;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
};

// Get this document from the server and lock it here
haste_document.prototype.load = function(key, callback, lang) {
  var _this = this;
  $.ajax('/documents/' + key, {
    type: 'get',
    dataType: 'json',
    success: function(res) {
      _this.locked = true;
      _this.key = key;
      _this.data = res.data;
      var high = hljs.highlightAuto(res.data).value;
      callback({
        value: high.replace(/.+/g, '<span class="line">$&</span>').replace(/^\s*[\r\n]/gm, '<span class="line"></span>\n'),
        key: key
      });
    },
    error: function(err) {
      callback(false);
    }
  });
};

// Save this document to the server and lock it here
haste_document.prototype.save = function(data, callback) {
  if (this.locked) {
    return false;
  }
  this.data = data;
  var _this = this;
  $.ajax('/documents', {
    type: 'post',
    data: data.trim(),
    dataType: 'json',
    contentType: 'application/json; charset=utf-8',
    success: function(res) {
      _this.locked = true;
      _this.key = res.key;
      var high = hljs.highlightAuto(data).value;
      callback(null, {
        value: high,
        key: res.key
      });
    },
    error: function(res) {
      try {
        callback($.parseJSON(res.responseText));
      }
      catch (e) {
        callback({message: 'Something went wrong!'});
      }
    }
  });
};

///// Tab behavior in the textarea - 4 spaces per tab
$(function() {
  $('textarea').keydown(function(evt) {
    if (evt.keyCode === 9) {
      evt.preventDefault();
      var myValue = '    ';
      if (document.selection) {
        this.focus();
        var sel = document.selection.createRange();
        sel.text = myValue;
        this.focus();
      } else if (this.selectionStart || this.selectionStart == '0') {
        var startPos = this.selectionStart;
        var endPos = this.selectionEnd;
        var scrollTop = this.scrollTop;
        this.value = this.value.substring(0, startPos) + myValue + this.value.substring(endPos,this.value.length);
        this.focus();
        this.selectionStart = startPos + myValue.length;
        this.selectionEnd = startPos + myValue.length;
        this.scrollTop = scrollTop;
      }
      else {
        this.value += myValue;
        this.focus();
      }
    }
  });
});
