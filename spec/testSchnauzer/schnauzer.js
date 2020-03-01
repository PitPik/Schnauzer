/**! @license schnauzer v1.5.0; Copyright (C) 2017-2020 by Peter Dematté */
(function(global, factory) {
  if (typeof exports === 'object') module.exports = factory(global);
  else if (typeof define === 'function' && define.amd)
    define('schnauzer', [], function() { return factory(global); });
  else global.Schnauzer = factory(global);
}(this && this.window || global, function(global, undefined) { 'use strict';

var isFunction = function(obj) {
  return !!obj && obj.constructor === Function;
};
var isArray = Array.isArray || function(obj) {
  return !!obj && obj.constructor === Array;
};
var getKeys = Object.keys || function(obj) {
  var keys = [];
  for (var key in obj) obj.hasOwnProperty(key) && keys.push(key);
  return keys;
};

var Schnauzer = function(template, options) {
  this.version = '1.5.0';
  this.partials = {};
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
    helpers: {},
    partials: {},
    self: 'self',
    characters: '$"<>%-=@',
    splitter: '|##|',
    useMustageUnless: true,
    evaluate: false, // TODO
  };
  initSchnauzer(this, options || {}, template);
};

var initSchnauzer = function(_this, options, template) {
  for (var option in options) {
    _this.options[option] = options[option];
  }
  options = _this.options;
  switchTags(_this, options.tags);
  _this.entityRegExp = new RegExp('[' + getKeys(options.entityMap)
    .join('') + ']', 'g');
  _this.helpers = options.helpers;
  _this.registerHelper('lookup', function() {
    // TODO...
  });
  for (var name in options.partials) {
    _this.registerPartial(name, options.partials[name]);
  }
  if (template) _this.parse(template);
};

Schnauzer.prototype = {
  render: function(data, extra) {
    return this.partials[this.options.self](data, extra);
  },
  parse: function(text) {
    return this.registerPartial(this.options.self, text);
  },
  registerHelper: function(name, helperFn) {
    this.helpers[name] = helperFn;
  },
  unregisterHelper: function(name) {
    delete this.helpers[name];
  },
  registerPartial: function(name, text) {
    return this.partials[name] = (this.partials[name] ||
      isFunction(text) ? text : sizzleBlocks(this, text, []));
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
  var tgs = tags[0] === '{{' ? ['({{2,3}~*)', '(~*}{2,3})'] : tags;
  var chars = _this.options.characters + '\\][';
  var blockEnd = (tgs[0] + '\\/\\3' + tgs[1]).replace(/[()]/g, '');
  var umu = _this.options.useMustageUnless ? '[#^]' : '[#]';

  _this.inlineRegExp = new RegExp(tgs[0] + '([>!&=])*\\s*([\\w\\' +
    chars + '\\.]+)\\s*([\\w' + chars + '|\\.\\s]*)' + tgs[1], 'g');
  _this.sectionRegExp = new RegExp(tgs[0] + '([#^][*%]*)\\s*([\\w' +
    chars + ']*)(?:\\s+([\\w$\\s|./' + chars + ']*))*' + tgs[1] +
    '((?:(?!' + tgs[0] + umu + ')[\\S\\s])*?)(' + blockEnd + ')', 'g');
  _this.elseSplitter = new RegExp(tgs[0] + '(?:else|\\^)\\s*(.*?)' + tgs[1]);
}

// ---- render helpers

function escapeHtml(string, _this) {
  return String(string).replace(_this.entityRegExp, function(char) {
    return _this.options.entityMap[char];
  });
}

function concat(array, host) { // way faster than [].concat
  for (var n = 0, l = array.length; n < l; n++) {
    host[host.length] = array[n];
  }
  return host;
}

function createHelper(idx, len, isArray, key, value) {
  var helpers = isArray ? {
    '@index': idx,
    '@last': idx === len - 1,
    '@first': idx === 0,
  } : {};

  helpers['@key'] = key;
  helpers['.'] = helpers['this'] = value;

  return helpers;
}

function shiftScope(scopes, parentDepth, path) {
  var scope = {};
  
  scopes = concat(scopes, []); // TODO: [ ...scopes ]? maybe for ../
  if (parentDepth) scopes = scopes.splice(parentDepth);
  scope = (scopes[0] || {}).scope;
  for (var n = 0, l = path.length; n < l; n++) {
    scopes.unshift({ scope: scope = (scope || {})[path[n]], helpers: {} });
  }
  return scopes;
}

function getScope(data, tagData) {
  var tagRoot = tagData.root || {};
  var mainVar = tagRoot.variable || {};

  return tagRoot.variable === undefined ?
    { extra: tagData, scopes: [{ scope: data, helpers: {} }] } : // root
    {
      extra: data.extra,
      scopes: shiftScope(data.scopes, mainVar.parentDepth, mainVar.path),
    };
}

function getExtraData(extra, isStrict, mainVar) { // TODO: keep scope??
  if (isStrict || mainVar.parentDepth) return;
  for (var n = 0, l = mainVar.path.length; n < l; n++) {
    extra = extra[mainVar.path[n]];
    if (!extra) return;
  }
  return extra[mainVar.value];
}

function getData(_this, model, root) { // TODO: unify renderInline/Block
  var scope = model.scopes && model.scopes[0] || {};
  var scopeData = scope.scope || {};
  var key = root.variable.value;
  var helper = !root.isStrict && _this.helpers[key] || null;
  var partial = root.isPartial && _this.partials[key] || null;
  var value = root.isString || root.variable.isLiteral ? key :
    helper || partial || (scopeData[key] !== undefined ? scopeData[key] :
      scope.helpers[key] !== undefined ? scope.helpers[key] :
      getExtraData(model.extra || {}, root.isStrict, root.variable));

  return {
    key: key,
    value: value,
    type:
      value === undefined ? '' :
      helper ? 'helper' :
      partial ? 'partial' :
      isArray(value) ? 'array' :
      isFunction(value) ? 'function' :
      typeof value === 'object' ? 'object' :
      'literal',
  };
}

function getValue(_this, data, model, tagData, bodyFn) {
  return data.type === 'helper' ? // || isFunction(data.value) ?
    renderHelper(_this, data, model, tagData, bodyFn) : data.value;
}

function renderHelper(_this, data, model, tagData, bodyFn) {
  for (var n = tagData.vars.length, item = {}, key = '', scope = {}; n--; ) {
    item = tagData.vars[n]; // TODO: repetitive: see renderInline()
    key = item.isString || (item.variable.isLiteral && !item.variable.name) ?
      ('$' + n) : item.variable.name || item.variable.value;
    scope[key] = getData(_this, model, item).value;
  }

  return data.value.apply(scope, [
    function getBody() { return bodyFn ? bodyFn(model) : '' },
    function escape(string) { return escapeHtml(string, _this) },
    model.scopes[0].scope,
    function getIntData(key) {
      var variable = getVar(key, false);
      return getData(_this,getScope(model, { root: variable }), variable).value;
    }
  ]);
}

function renderIntHelper(_this, data, model, tagData, bodyFns) {
  var idx = 0;
  var item = bodyFns[idx];
  var alt = !tagData.helper || tagData.helper === 'if' ? true : false;
  var value = getValue(_this, data, model, tagData, item.bodyFn);

  while (!(alt && value || !alt && !value) && bodyFns[idx + 1]) {
    item = bodyFns[++idx];
    alt = !item.helper || item.helper === 'if' ? true : false;
    data = item.root ? getData(_this, model, item.root) : { value: alt };
    value = getValue(_this, data, model, item, item.bodyFn);
  }
  return (alt && value || !alt && !value) ? item.bodyFn(model) : '';
}

function renderLoops(model, data, bodyFn) {
  var out = '';
  var idx = 0;

  model.scopes = concat(model.scopes, [
    { scope: {}, helpers: {} },
    { scope: data.value, helpers: {} }
  ]);
  for(var key in data.value) {
    model.scopes[0] = { // TODO: concat for ../ ?
      scope: data.value[key],
      helpers: createHelper(idx++, data.value.length,
        data.type === 'array', key, data.value[key]),
    };
    out += bodyFn(model);
  }
  return out;
}

function renderInline(_this, tagData, model, bodyFn) {
  var data = getData(_this, model, tagData.root);
  var out = '';

  if (tagData.isPartial) { // partial // TODO: previous function??
    for (var n = tagData.vars.length, item = {}, key = ''; n--; ) {
      item = tagData.vars[n]; // TODO: repetitive: see renderHelper()
      key = item.isString || (item.variable.isLiteral && !item.variable.name) ?
        ('$' + n) : item.variable.name || item.variable.value;
      model.scopes[0].helpers[key] = getData(_this, model, item).value;
    }
    out = data.value && data.value(model); // TODO: vars???
  } else {
    out = data.type === 'helper' ? // data.value() ...
      renderHelper(_this, data, model, tagData, bodyFn) : data.value || '';
  }

  return out;
}

function renderBlock(_this, tagData, model, bodyFns) {
  var data = getData(_this, model, tagData.root);
  var intHelper = tagData.helper === 'if' || tagData.helper === 'unless';
  var isHelper = data.type === 'helper' || isFunction(data.value);

  return intHelper ? renderIntHelper(_this, data, model, tagData, bodyFns) :
    isHelper ? renderHelper(_this, data, model, tagData, bodyFns[0].bodyFn) :
    renderLoops(model, data, bodyFns[0].bodyFn);
}

// ---- parse (pre-render) helpers

function trim(text, start, end) {
  var regExp = '^\\s*|\\s*$';

  if (!start && !end) return text;
  regExp = !start ? '\\s*$' : !end ? '^\\s*' : regExp;

  return text.replace(new RegExp(regExp, 'g'), '');
}

function getTrims(start, end) {
  return [ start.indexOf('~') !== -1, end.indexOf('~') !== -1 ];
}

function convertValue(text, obj) {
  if (text.charAt(0) === '"' || text.charAt(0) === "'") {
    obj.isString = true;
    return text.substr(1, text.length - 2);
  }
  return text === 'true' ? true : text === 'false' ?
    false : isNaN(text) || text === '' ? text : +text;
}

function cleanText(text, obj) {
  return text.replace(/^(?:this[/.]|\.\/)/, function($) {
    if ($) obj.isStrict = true;
    return '';
  }).replace(/[[\]|]/g, '');
}

function getActiveState(text) {
  return text.charAt(1) === '%' ? 2 : text.charAt(0) === '%' ? 1 : 0;
}

function splitVars(text, collection) {
  if (!text) return collection;
  text.replace(/\(.*?\)|(?:\S*?"(?:\\.|[^\"])*\")|\S+/g, function(match) {
    if (match) collection.push(match);
  });
  return collection;
}

function parseScope(text, name) {
  var isString = typeof text === 'string';
  var isDot = text === '.';
  var parts = isString && !isDot ? text.split('../') : [];
  var pathParts = isString && !isDot ? parts.pop().split(/[.\/]/) : [text];

  return !isString ? { name: name, value: text, isLiteral: true, path: [] } : {
    name: name,
    value: pathParts.pop(),
    path: pathParts,
    parentDepth: parts.length,
  }
}

function getVar(item, isAs) {
  var split = [];
  var out = {
    variable: {},
    isAlias: isAs || false,
    aliasKey: '',
    isString: false, // if value else variable
    isStrict: false,
    active: 0,
  };

  item = cleanText(item, out).substr(out.active = getActiveState(item));
  if (item.charAt(0) === '(') {
    item = item.substr(1, item.length - 2);
    split = splitVars(item, []);
    return { variable: { root: split.shift(), vars: processVars(split, []) } };
  }
  split = item.split(/([=!<>]+)/);
  out.variable = split[1] ?
    parseScope(convertValue(split[2], out), split[0]) :
    parseScope(convertValue(split[0], out), '');
  return out;
}

function processVars(vars, collection) {
  var out = {};
  var isAs = false;
  var asKey = '';

  for (var n = 0, l = vars.length; n < l; n++) {
    isAs = vars[n] === 'as';
    asKey = (vars[n + 2] || '');
    out = getVar(vars[isAs ? ++n : n], isAs);
    out.aliasKey = isAs && asKey.charAt(asKey.length - 1) === '|' && ++n ?
      cleanText(asKey) : '';
    collection.push(out);
  }

  return collection;
}

function getTagData(_this, root, vars, type, start, bodyFn) {
  var varsArr = splitVars(root + (vars ? ' ' + vars : ''), []);
  var _root = varsArr.shift() || '';
  var helper = /if|each|with|unless/.test(_root) ? _root : '';
  var active = getActiveState(_root = helper ? varsArr.shift() || '' : _root);
  var isEscaped = start.lastIndexOf(_this.options.tags[0]) < 1;

  return bodyFn && !_root ? { bodyFn: bodyFn, isEscaped: isEscaped } : {
    root: getVar(_root.substr(active), varsArr[0] === 'as'),
    isPartial: type === '>',
    isNot: type === '^',
    isEscaped: isEscaped,
    hasAlias: varsArr[0] === 'as',
    helper: helper,
    vars: processVars(varsArr, []),
    active: active,
    bodyFn: bodyFn,
  };
}

// ---- sizzle inlines

function loopInlines(_this, tags, glues, blocks, data) {
  for (var n = 0, l = glues.length, out = ''; n < l; n++) {
    out += glues[n];
    if (!tags[n]) continue;

    out += tags[n].blockIndex > -1 ? blocks[tags[n].blockIndex](data) :
      renderInline(_this, tags[n], getScope(data, tags[n]));
  }

  return out;
}

function sizzleInlines(_this, text, blocks, tags) {
  var trims = [];
  var glues = text.replace(
    _this.inlineRegExp,
    function($, start, type, root, vars, end) {
      if (/^(?:!|=)/.test(type || '')) return '';
      trims.push(getTrims(start, end));
      tags.push(root === '-block-' ? { blockIndex: +vars } :
        getTagData(_this, root, vars, type || '', start));
      return _this.options.splitter;
    }
  ).split(_this.options.splitter);

  for (var n = glues.length; n--; ) glues[n] = trim(
    glues[n],
    trims[n - 1] ? trims[n - 1][1] : false,
    trims[n] ? trims[n][0] : false
  );

  return function executeInlines(data, extra) {
    data = extra && !data.extra ? getScope(data, extra || {}) : data;
    return loopInlines(_this, tags, glues, blocks, data);
  }
}

// ---- sizzle blocks

function processBodyParts(_this, bodyFns, parts, blocks, mainStartTag) {
  var trims = [];
  var prevTagData = '';
  var prevTrim = false;
  var separator = 0;

  for (var n = 0, l = parts.length; n < l; n += 4) {
    prevTagData = parts[2 + n - 4] || '';
    separator = prevTagData ? prevTagData.indexOf(' ') : 0,
    prevTrim = trims[1] || false;
    trims = parts[1 + n] ? getTrims(parts[1 + n], parts[3 + n]) : [false];
    bodyFns.push(getTagData(
      _this,
      prevTagData ? prevTagData.substr(0, separator) : '',
      prevTagData ? prevTagData.substr(separator) : '',
      '',
      n !== 0 ? parts[1 + n - 4] || '' : mainStartTag,
      sizzleInlines(_this, trim(parts[n], prevTrim, trims[0]), blocks, []),
    ));
  }
  return bodyFns;
}

function doBlock(_this, blocks, start, end, close, body, type, root, vars) {
  var closeParts = close.split(root);
  var trims = getTrims(end, closeParts[0]);
  var bodyParts = trim(body, trims[0], trims[1]).split(_this.elseSplitter);
  var bodyFns = processBodyParts(_this, [], bodyParts, blocks, start);
  var tagData = getTagData(_this, root, vars, type || '', start);

  blocks.push(function executeBlock(data) {
    return renderBlock(_this, tagData, getScope(data, tagData), bodyFns);
  });

  return (start + '-block- ' + (blocks.length - 1) + closeParts[1]);
}

function sizzleBlocks(_this, text, blocks) {
  var replaceCb = function($, start, type, root, vars, end, body, $$, close) {
    if (type === '#*') {
      _this.partials[vars.replace(/['"]/g, '')] = sizzleBlocks(_this, body, []);
      return '';
    }
    return doBlock(_this, blocks, start, end, close, body, type, root, vars);
  };

  while (text !== (text = text.replace(_this.sectionRegExp, replaceCb)));

  return sizzleInlines(_this, text, blocks, []);
}

}));