/**! @license schnauzer v1.1.0; Copyright (C) 2017-2018 by Peter Dematté */
(function defineSchnauzer(root, factory) {
  if (typeof exports === 'object') module.exports = factory(root);
  else if (typeof define === 'function' && define.amd) define('schnauzer', [],
    function () { return factory(root); });
  else root.Schnauzer = factory(root);
}(this, function SchnauzerFactory(root, undefined, help) { 'use strict';
// Schnauzer 4.93 KB, 2.21 KB, Mustage 5.50 KB, 2.27 KB, Handlebars 74.20 KB, 21.86 KB
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
    help = 1; // counter helper for nestings
    options = _this.options;
    _this.entityRegExp = (function(entityMap, output){
      for (var symbol in entityMap) {
        output += symbol;
      }
      return new RegExp('[' + output + ']', 'g');
    })(options.entityMap, []);
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
  var _tags = _this.options.tags = tags[0] === '{{' ? ['{{2,3}', '}{2,3}'] : tags,
    chars = _this.options.characters;

  _this.variableRegExp = new RegExp('(' + _tags[0] + ')' +
    '([>!&=]\\s*)*([\\w\\'+ chars + '\\.\\s*]+)*' + _tags[1], 'g');
  _this.sectionRegExp = new RegExp('(' + _tags[0] + ')([#^])([\\w' + chars + ']*)' +
    '(?:\\s+([\\w$\\s|./' + chars + ']*))*(' + _tags[1] + ')((?:(?!\\1[#^])[\\S\\s])*?)' +
    '\\1\\/\\3\\5', 'g');
}

function getSource(data, extra, newData, helpers) {
  return {
    data: newData || data.data || data,
    extra: [].concat(data.extra || [], extra || []),
    path: [].concat(data.path !== undefined ? data.path : data, newData || []),
    helpers: [].concat(data.helpers || [], newData && (helpers || {}) || []),
    __schnauzer: true,
  };
};

function crawlObjectUp(data, keys) { // faster than while
  for (var n = 0, m = keys.length; n < m; n++) {
    data = data && data[keys[n]];
  }
  return data;
}

function findData(data, key, keys, pathDepth) {
  var seachDepth = (data.path.length - 1) - pathDepth,
    _data = data.path[seachDepth] || {},
    helpers = data.helpers[seachDepth - 1] || {},
    value = helpers[key] !== undefined ? helpers[key] : crawlObjectUp(helpers, keys);

  if (value === undefined) {
      value = _data[key] !== undefined ? _data[key] : crawlObjectUp(_data, keys);
  }
  if (value !== undefined) return value;
  for (var n = data.extra.length; n--; ) {
    if (data.extra[n][key] !== undefined) return data.extra[n][key];
    value = crawlObjectUp(data.extra[n], keys);
    if (value !== undefined) return value;
  }
}

function getVar(text, data) {
  var parts = text.split(/\s*=\s*/);
  var value = parts.length > 1 ? parts[1] : parts[0];
  var isString = value.charAt(0) === '"' || value.charAt(0) === "'";
  var depth = 0;
  var keys = [];
  var isStrict = false;

  if (isString) {
    value = value.replace(/(?:^['"]|['"]$)/g, '');
  } else {
    var path = value.split('../');
    if (path.length > 1) {
      value = (path[0] === '@' && '@' || '') + path.pop();
      depth = path.length;
    }
    name = name.replace(/^(?:\.|this)\//, function() {
      isStrict = true;
      return '';
    });
    keys = value.split(/[\.\/]/);
  }
  return {
    name: parts.length > 1 ? parts[0] : value,
    value: isString || !data ? value : findData(data, value, keys, depth),
    isString: isString,
    isStrict: isStrict,
    keys: keys,
    depth: depth,
  };
}

function escapeHtml(string, _this) {
  return String(string).replace(_this.entityRegExp, function(char) {
    return _this.options.entityMap[char];
  });
}

function tools(_this, data, dataTree) {
  return {
    getData: function getData(key) { return getVar(key, data) },
    escapeHtml: function escape(string) { return escapeHtml(string, _this) }
  }
}

function addToHelper(helpers, keys, name, value) {
  if (keys) { helpers[keys[0]] = value;  helpers[keys[1]] = name; }
  return helpers;
}

function inline(_this, html) {
  var keys = [],
    options = _this.options;

  html = html.replace(_this.variableRegExp, function(all, start, type, vars) {
    var char0 =  type && type.charAt(0) || '',
      isPartial = char0 === '>',
      isSelf = false,
      name = '',
      isStrict = false,
      _data = {};

    if (char0 === '!' || char0 === '=') return '';
    vars = vars.split(/\s+/); // split variables
    name = vars.shift();
    if (name === '-section-') { // faster approach
      keys.push({ section : vars[0] });
      return options.splitter;
    }
    if (isPartial) {
      for (var n = vars.length, tmp = {}; n--; ) {
        tmp = getVar(vars[n]);
        _data[tmp.name] = tmp;
      }
    } else {
      _data = getVar(name);
      isStrict = _data.isStrict;
      name = _data.name;
    }
    isSelf = name === options.recursion;
    isPartial = isPartial && (!!_this.partials[name] || isSelf);
    keys.push({
      value: isPartial ? _this.partials[name] : name,
      data: isPartial ? _data : vars,
      isPartial: isPartial,
      isUnescaped: !options.doEscape || char0 === '&' || start === '{{{',
      isSelf: isSelf,
      depth: isPartial ? undefined : _data.depth,
      isStrict: isStrict,
      keys: isPartial ? undefined : _data.keys
    });
    return options.splitter;
  }).split(options.splitter);

  return function fastReplace(data, sections) {
    for (var n = 0, l = html.length, out = '', _out, _func, _data, newData, part; n < l; n++) {
      out = out + html[n];
      part = keys[n];
      if (part === undefined) continue; // no other functions, just html
      if (part.section) { out += sections[part.section](data) || ''; continue; }
      if (part.isPartial) { // partial -> executor
        newData = {}; // create new scope (but keep functions in scope)
        for (var item in data.data) newData[item] = data.data[item];
        for (var key in part.data) {
          _data = part.data[key];
          newData[key] = _data.isString ? _data.value :
            findData(data, _data.value, _data.keys, _data.depth);
        }
        _out = (part.value || _this.partials[options.recursion])(getSource(newData, data.extra));
      } else {
        _out = findData(data, part.value, part.keys, part.depth);
        _func = !part.isStrict && options.helpers[part.value] || isFunction(_out) && _out;
        _out = _func ? _func.apply(tools(_this, data), part.data) :
          _out && (part.isUnescaped ? _out : escapeHtml(_out, _this));
      }
      if (_out !== undefined) out = out + _out;
    }
    return out;
  };
}

function section(_this, func, name, vars, isNot, sections) {
  var type = name;
  name = getVar(/^(each|with|if|unless)/.test(name) ? vars.shift() : name);
  var keys = vars[0] === 'as' && [vars[1], vars[2]];

  return function fastLoop(data) {
    var _data = findData(data, name.name, name.keys, name.depth);
    var _isArray = isArray(_data);
    var objData = type === 'each' && !_isArray && typeof _data === 'object' && _data;

    _data = type === 'unless' ? !_data : objData ? getKeys(_data, []) : _data;
    if (_isArray || objData) {
      if (isNot) return !_data.length ? func[0](_data, sections) : '';
      for (var n = 0, l = _data.length, out = '', loopData; n < l; n++) {
        loopData = _isArray ? _data[n] : objData[_data[n]];
        data = getSource(data, data.extra, loopData,
          addToHelper({ '@index': '' + n, '@last': n === l - 1, '@first': !n,
            '.': loopData, 'this': loopData, '@key': _isArray ? n : _data[n] },
            keys, _isArray ? n : _data[n], loopData));
        out = out + func[0](data, sections);
        data.path.pop(); // jump back out of scope-level for next iteration
        data.helpers.pop();
      }
      return out;
    }
    var _func = (!name.isStrict && _this.options.helpers[name.name]) ||
      (isFunction(_data) && _data);
    if (_func) { // helpers or inline functions
      return _func.apply(tools(_this, data), [func[0](data, sections)].concat(vars));
    }
    if (isNot && !_data || !isNot && _data) { // regular replace
      return func[0](type === 'unless' || type === 'if' ? data :
        getSource(data, data.extra, _data,
        addToHelper({ '.': _data, 'this': _data, '@key': name.name },
          keys, name.name, _data)), sections);
    }
   return func[1] && func[1](data, sections); // else
  }
}

function sizzleTemplate(_this, html) {
  var _html = '',
    sections = [];

  while (_html !== html && (_html = html)) {
    html = html.replace(_this.sectionRegExp, function(all, start, type, name, vars, end, text) {
      text = text.split('{{else}}');
      sections.push(section(_this, [inline(_this, text[0]), text[1] && inline(_this, text[1])],
        name, vars && vars.replace(/\|/g, '').split(/\s+/) || [], type === '^', sections));
      return ('{{-section- ' + (sections.length - 1) + '}}');
    });
  }
  html = inline(_this, html);

  return function executor(data, extra) {
    return html(!data.__schnauzer || extra ? getSource(data, extra) : data, sections);
  }
}

}));
