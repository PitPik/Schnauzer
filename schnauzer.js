/**! @license schnauzer v1.1.0; Copyright (C) 2017-2018 by Peter Dematté */
(function defineSchnauzer(root, factory) {
  if (typeof exports === 'object') module.exports = factory(root);
  else if (typeof define === 'function' && define.amd) define('schnauzer', [],
    function () { return factory(root); });
  else root.Schnauzer = factory(root);
}(this, function SchnauzerFactory(root, undefined) { 'use strict';
// Schnauzer 4.85 KB, 2.15 KB, Mustage 5.50 KB, 2.27 KB, Handlebars 74.20 KB, 21.86 KB
var Schnauzer = function(template, options) {
    this.version = '1.1.0';
    this.options = {
      tags: ['{{', '}}'],
      entityMap: {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
      },
      doEscape: true,
      helpers: {},
      partials: {},
      recursion: 'self',
      characters: '$"<>%-=@',
      splitter: '|##|'
    };
    init(this, options || {}, template);
  },
  init = function(_this, options, template) {
    for (var option in options) {
      _this.options[option] = options[option];
    }
    options = _this.options;
    _this.entityRegExp = new RegExp('[' + getKeys(options.entityMap).join('') + ']', 'g');
    switchTags(_this, options.tags);
    _this.partials = {};
    for (var name in options.partials) {
      _this.registerPartial(name, options.partials[name]);
    }
    template && _this.registerPartial(options.recursion, template);
  },
  isArray = Array.isArray || function(obj) { // obj instanceof Array;
    return obj && obj.constructor === Array;
  },
  isFunction = function(obj) {
    return obj && typeof obj === 'function';
  },
  getKeys = Object.keys || function(obj, keys) { // keys = []
    for (var key in obj) obj.hasOwnProperty(key) && keys.push(key);
    return keys;
  };

Schnauzer.prototype = {
  render: function(data, extra) {
    return this.partials[this.options.recursion](data, extra);
  },
  parse: function(html) {
    return this.partials[this.options.recursion] ||
      this.registerPartial(this.options.recursion, html);
  },
  registerHelper: function(name, fn) {
    this.options.helpers[name] = fn;
  },
  unregisterHelper: function(name) {
    delete this.options.helpers[name];
  },
  registerPartial: function(name, html) {
    return this.partials[name] = sizzleTemplate(this, html);
  },
  unregisterPartial: function(name) {
    delete this.partials[name];
  },
  setTags: function(tags) {
    switchTags(this, tags);
  },
};

return Schnauzer;

function switchTags(_this, tags) {
  var _tags = _this.options.tags = tags[0] === '{{' ? ['{{2,3}', '}{2,3}'] : tags;
  var chars = _this.options.characters;

  _this.variableRegExp = new RegExp('(' + _tags[0] + ')' +
    '([>!&=])*([\\w\\'+ chars + '\\.]+)\\s*([\\w' + chars + '\\.\\s]*)' + _tags[1], 'g');
  _this.sectionRegExp = new RegExp('(' + _tags[0] + ')([#^])([\\w' + chars + ']*)' +
    '(?:\\s+([\\w$\\s|./' + chars + ']*))*(' + _tags[1] + ')((?:(?!\\1[#^])[\\S\\s])*?)' +
    '\\1\\/\\3\\5', 'g');
}

function getSource(data, extra, newData, helpers) {
  return {
    extra: [].concat(data.extra || [], extra || []),
    path: [].concat(newData || [], data.path || data),
    helpers: [].concat(newData && helpers || {}, data.helpers || [])
  };
};

function crawlObjectUp(data, keys) { // faster than while
  for (var n = 0, m = keys.length; n < m; n++) {
    data = data && data[keys[n]];
  }
  return data;
}

function findData(data, key, keys, pathDepth) {
  var _data = data.path[pathDepth] || {};
  var helpers = data.helpers[pathDepth] || {};
  var value = helpers[key] !== undefined ? helpers[key] : crawlObjectUp(helpers, keys);

  if (value === undefined || keys[0] === '.') {
    value = _data[key] !== undefined ? _data[key] : crawlObjectUp(_data, keys);
  }
  if (value !== undefined) return value;
  for (var n = data.extra.length; n--; ) {
    if (data.extra[n][key] !== undefined) return data.extra[n][key];
    value = crawlObjectUp(data.extra[n], keys);
    if (value !== undefined) return value;
  }
}

function getVar(text) {
  var parts = text.split(/\s*=\s*/);
  var value = parts.length > 1 ? parts[1] : parts[0];
  var isString = value.charAt(0) === '"' || value.charAt(0) === "'";
  var depth = 0;
  var keys = [];
  var path = [];
  var strict = false;

  if (isString) {
    value = value.replace(/(?:^['"]|['"]$)/g, '');
  } else {
    path = value.split('../');
    if (path.length > 1) {
      value = (path[0] === '@' && '@' || '') + path.pop();
      depth = path.length;
    }
    name = name.replace(/^(?:\.|this)\//, function() { strict = true; return ''; });
    keys = value.split(/[\.\/]/);
    value = value.replace(/^\.\//, function() { strict = true; keys[0] = '.'; return ''; });
  }
  return {
    name: parts.length > 1 ? parts[0] : value,
    value: value,
    isString: isString,
    strict: strict,
    keys: keys,
    depth: depth,
  };
}

function escapeHtml(string, _this) {
  return String(string).replace(_this.entityRegExp, function(char) {
    return _this.options.entityMap[char];
  });
}

function tools(_this, data, parts) {
  return {
    getData: function getData(key) {
      key = parts.parts[key];
      return key.isString ? key.value : findData(data, key.name, key.keys, key.depth);
    },
    escapeHtml: function escape(string) { return escapeHtml(string, _this) }
  }
}

function addToHelper(helpers, keys, name, value) {
  if (keys) { helpers[keys[0]] = value;  helpers[keys[1]] = name; }
  return helpers;
}

function inline(_this, html, sections) {
  var keys = [];
  var options = _this.options;

  html = html.replace(_this.variableRegExp, function(all, start, type, name, vars) {
    var char0 =  type && type.charAt(0) || '';
    var partial = char0 === '>';
    var parts = {};
    var _data = {};

    if (name === '-section-') {
      keys.push({ section : vars });
      return options.splitter;
    }
    if (char0 === '!' || char0 === '=') return '';
    vars = vars.split(/\s+/); // split variables
    for (var n = vars.length, tmp = {}; n--; ) {
      tmp = getVar(vars[n]);
      parts[tmp.name] = tmp;
      parts[vars[n]] = tmp; // for tools.getData()
    }
    _data = getVar(name);
    keys.push({
      value: _data.name,
      data: vars,
      parts: parts,
      partial: partial && (_this.partials[_data.name] || _this.partials[options.recursion]),
      isUnescaped: !options.doEscape || char0 === '&' || start === '{{{',
      depth: _data.depth,
      strict: _data.strict,
      keys: _data.keys,
    });
    return options.splitter;
  }).split(options.splitter);

  return function fastReplace(data) {
    for (var n = 0, l = html.length, out = '', _out, _fn, _data, newData, part; n < l; n++) {
      out = out + html[n];
      part = keys[n];
      if (part === undefined) continue; // no other functions, just html
      if (part.section) { out += sections[part.section](data) || ''; continue; }
      if (part.partial) { // partial -> executor
        newData = {}; // create new scope (but keep functions in scope)
        for (var item in data.path[0]) newData[item] = data.path[0][item];
        for (var key in part.parts) { // TODO: this also for section.fastLoop
          _data = part.parts[key];
          newData[key] = _data.isString ? _data.value :
            findData(data, _data.value, _data.keys, _data.depth);
        }
        _out = part.partial(getSource(newData));
      } else {
        _out = findData(data, part.value, part.keys, part.depth);
        _fn = !part.strict && options.helpers[part.value] || isFunction(_out) && _out;
        _out = _fn ? _fn.apply(tools(_this, data, part), part.data) :
          _out && (part.isUnescaped ? _out : escapeHtml(_out, _this));
      }
      if (_out !== undefined) out = out + _out;
    }
    return out;
  };
}

function section(_this, fn, name, vars, isNot) {
  var type = name;
  name = getVar(vars.length && /^(each|with|if|unless)/.test(name) ? vars.shift() : name);
  var keys = vars[0] === 'as' && [vars[1], vars[2]];

  return function fastLoop(data) {
    var _data = findData(data, name.name, name.keys, name.depth);
    var _isArray = isArray(_data);
    var objData = type === 'each' && !_isArray && typeof _data === 'object' && _data;

    _data = type === 'unless' ? !_data : objData ? getKeys(_data, []) : _data;
    if (_isArray || objData) {
      if (isNot) return !_data.length ? fn[0](_data) : '';
      for (var n = 0, l = _data.length, out = '', loopData; n < l; n++) {
        loopData = _isArray ? _data[n] : objData[_data[n]];
        data = getSource(data, data.extra, loopData,
          addToHelper({ '@index': '' + n, '@last': n === l - 1, '@first': !n,
            '.': loopData, 'this': loopData, '@key': _isArray ? n : _data[n] },
            keys, _isArray ? n : _data[n], loopData));
        out = out + fn[0](data);
        data.path.shift(); // jump back out of scope-level for next iteration
        data.helpers.shift();
      }
      return out;
    }
    var _fn = (!name.strict && _this.options.helpers[name.name]) || (isFunction(_data) && _data);
    if (_fn) { // helpers or inline functions
      return _fn.apply(tools(_this, data), [fn[0](data), fn[1] && fn[1](data)].concat(vars));
    }
    if (isNot && !_data || !isNot && _data) { // regular replace
      return fn[0](type === 'unless' || type === 'if' ? data : getSource(data, data.extra, _data,
        addToHelper({ '.': _data, 'this': _data, '@key': name.name }, keys, name.name, _data)));
    }
   return fn[1] && fn[1](data); // else
  }
}

function sizzleTemplate(_this, html) {
  var _html = '';
  var sections = [];

  while (_html !== html && (_html = html)) {
    html = html.replace(_this.sectionRegExp, function(all, start, type, name, vars, end, text) {
      text = text.split('{{else}}');
      sections.push(section(_this, [inline(_this, text[0], sections),
        text[1] && inline(_this, text[1], sections)],
        name, vars && vars.replace(/\|/g, '').split(/\s+/) || [], type === '^'));
      return ('{{-section- ' + (sections.length - 1) + '}}');
    });
  }
  html = inline(_this, html, sections);

  return function executor(data, extra) { return html(getSource(data, extra)) };
}
}));
