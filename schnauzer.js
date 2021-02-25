/**! @license schnauzer v1.6.6; Copyright (C) 2017-2021 by Peter Dematté */
(function(global, factory) {
  if (typeof exports === 'object') module.exports = factory(global);
  else if (typeof define === 'function' && define.amd)
    define('schnauzer', [], function() { return factory(global); });
  else global.Schnauzer = factory(global);
}(this && this.window || global, function(global, undefined) { 'use strict';

var getObjectKeys = Object.keys || function(obj) {
  var fn = function(obj, key, keys) {obj.hasOwnProperty(key) && keys.push(key)};
  var keys = [];
  for (var key in obj) fn(obj, key, keys);
  return keys;
};
var cloneObject = function(newObj, obj) {
  var fn = function(obj, newObj, key) { newObj[key] = obj[key] };
  for (var key in obj) fn(obj, newObj, key);
  return newObj;
};
var concatArrays = function(array, host) {
  for (var n = 0, l = array.length; n < l; n++) host[host.length] = array[n];
  return host;
};

var Schnauzer = function(template, options) {
  this.version = '1.6.6';
  this.partials = {};
  this.helpers = {};
  this.regexps = {};
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
    nameCharacters: '',
    escapeHTML: true,
    limitPartialScope: true, // HBS style; new in v1.6.5
    renderHook: null,
  };
  initSchnauzer(this, options || {}, template);
};

var initSchnauzer = function(_this, options, template) {
  options = cloneObject(_this.options, options);
  switchTags(_this, options.tags);
  _this.regexps.entity =
    new RegExp('[' + getObjectKeys(options.entityMap).join('') + ']', 'g');
  _this.helpers = options.helpers;
  for (var name in options.partials)
    _this.registerPartial(name, options.partials[name]);
  _this.escapeExpression = function(txt) { return escapeHtml(_this, txt, true) }
  if (template !== undefined) _this.parse(template);
};

Schnauzer.prototype = {
  render: function(data, extra) {
    var helpers = createHelper('', '', 0, undefined, null);
    return this.partials[this.options.self]({
      extra: extra || {},
      scopes: [{ scope: data, helpers: helpers, level: [], values: null }],
    });
  },
  parse: function(txt) { return this.registerPartial(this.options.self, txt) },
  registerHelper: function(name, helperFn) {
    if (typeof name === 'string') return this.helpers[name] = helperFn;
    for (var key in name) this.helpers[key] = name[key];
  },
  unregisterHelper: function(name) { delete this.helpers[name] },
  registerPartial: function(name, txt) {
    if (typeof name === 'string') return this.partials[name] =
      this.partials[name] || (txt.constructor === Function ?
        txt : sizzleBlocks(this, txt, []));
    for (var key in name) this.registerPartial(key, name[key]);
  },
  unregisterPartial: function(name) { delete this.partials[name] },
  setTags: function(tags) { switchTags(this, tags) },
};

Schnauzer.SafeString = function(text) { this.string = text }; // WTF
Schnauzer.SafeString.prototype.toString =
Schnauzer.SafeString.prototype.toHTML = function() { return '' + this.string };

return Schnauzer;

function switchTags(_this, tags) {
  var tgs = tags[0] === '{{' ? ['({{2,3}~*)', '(~*}{2,3})'] : tags;
  var chars = _this.options.nameCharacters + '!-;=?@[-`|';
  var blockEnd = (tgs[0] + '\\/\\3' + tgs[1]).replace(/[()]/g, '');

  _this.regexps.inline = new RegExp(tgs[0] + '([>!&=])*\\s*([\\w\\' +
    chars + '<>|\\.\\s]*)' + tgs[1], 'g');
  _this.regexps.block = new RegExp(tgs[0] + '([#^][*%]*)\\s*([\\w' +
    chars + '<>~]*)(?:\\s+([\\w$\\s|.\\/' + chars + ']*))*' + tgs[1] +
    '(?:\\n*)((?:(?!' + tgs[0] + '[#^])[\\S\\s])*?)(' + blockEnd + ')', 'g');
  _this.regexps.else = new RegExp(tgs[0] + '(?:else|\\^)\\s*(.*?)' + tgs[1]);
}

// ---- render data helpers

function escapeHtml(_this, string, doEscape) {
  return string === undefined || string === null ? '' :
    string.constructor === Schnauzer.SafeString ? string.string :
    doEscape && _this.options.escapeHTML ?
    String(string).replace(_this.regexps.entity, function(char) {
      return _this.options.entityMap[char];
    }) : string;
}

function createHelper(idx, key, len, value, parent) {
  return {
    '@index': idx,
    '@last': idx === len - 1,
    '@first': idx === 0,
    '@length': len,
    '@parent': parent,
    '@key': key,
    'this': value,
    '.': value,
  };
}

function shiftScope(model, data) {
  var scopes = model.scopes;
  var newLevel = model.alias ? [model.alias] : [];
  var level = concatArrays(scopes[0].level, newLevel);
  var values = model.values || {};

  model.alias = null; model.values = null; // TODO
  return concatArrays(scopes, [{
    scope: data, helpers: {}, level: level, values: values,
  }]);
}

function tweakScope(scope, data, options) {
  var savedScope = scope.scope;
  scope.scope = data || {};
  return function() { scope.scope = savedScope; };
}

function getDeepData(scope, mainVar, parent) {
  if (mainVar.value === '.' || mainVar.value === 'this') return scope;
  if (!mainVar.path) return mainVar.value;
  parent._ = scope;
  for (var n = 0, l = mainVar.path.length; n < l; n++) {
    if (mainVar.path[n] === '@root') continue;
    scope = parent._ = scope[mainVar.path[n]];
    if (scope && scope.__isAlias) scope = parent._ = scope.value;
    if (!scope) return;
  }
  return scope[mainVar.value];
}

function getAliasValue(level, main, parent) {
  for (var n = 0, l = level.length, value = ''; n < l; n++) {
    value = getDeepData(level[n], main, parent);
    if (value !== undefined) return value;
  }
}

function createLookup(key, model, aliasKey, main, scope, value) {
  if (!model[key]) model[key] = {};
  model[key][aliasKey] = !main.path ? value : // || main.path.length
    { __isAlias: true, key: main.value, value: value, scope: scope };
}

function collectData(scope, value, main, _parent) {
  var key = scope.helpers['@key'] && value !== undefined &&
    scope.helpers['@parent'].constructor !== Array ? scope.helpers['@key'] : '';
  var parent = main.name && !main.path ? null : key ?
    scope.helpers['@parent'] || scope.scope || null : _parent;
  var _scope = parent && parent[key || main.value] || {};

  return {
    key: _scope.__isAlias ? _scope.key : key || main.value,
    parent: _scope.__isAlias ? _scope.scope : parent,
  };
}

function getData(_this, model, tagData) {
  var vars = tagData.vars;
  var parent = { _: null };
  var out = [];
  var data = {};

  if (!tagData || !vars) return [];
  if (!tagData.helper && _this.helpers[vars[0].orig]) tagData.helper = vars.shift();

  for (var n = 0, l = vars.length, main = {}, scope = {}, value; n < l; n++) {
    main = vars[n];
    scope = main.path && main.path[0] === '@root' ? model.scopes[model.scopes.length - 1] :
      model.scopes[main.depth || 0] || { scope: {}, helpers: {}, level: [] };
    value = main.value === '@root' ? scope : scope.helpers[main.value];
  
    if (value === undefined && scope.values) value = getDeepData(scope.values, main, parent);
    if (value === undefined && !main.isStrict) value = getAliasValue(scope.level, main, parent);
    if (value === undefined) value = main.helper ?
      renderHelper(_this, getData(_this, model, main), model, main) :
      main.path || main.name || main.vars ? getDeepData(scope.scope, main, parent) :
        tagData.isInline ? scope.scope[main.value] : main.value;
    if (value === undefined) value = getDeepData(model.extra, main, parent);

    if (main.alias) createLookup('alias', model, main.alias[0], main, scope.scope, value);
    if (main.name) createLookup('values', model, main.name, main, scope.scope, value);
    if (_this.options.renderHook) data = collectData(scope, value, main, parent._);
    out.push({
      value: value && value.__isAlias ? value.value : value,
      alias: main.alias,
      type: value && value.constructor === Array ? 'array' : typeof value,
      name: main.name, parent: data.parent, key: data.key,
    });
  }
  return out;
}

function checkObjectLength(main, helper, keys) {
  var value = main.value;
  var isObject = main.type === 'object';

  if (helper !== 'each' || value === undefined) return value;
  if (isObject) keys._ = getObjectKeys(value);
  return isObject ? keys._.length && value : value.length && value;
}

function getOptions(_this, model, tagData, data, newData, bodyFns) {
  var save = null;
  var noop = function noop() { return '' };
  var name = tagData.helper ? tagData.helper.orig : '';
  var options = { name: name, hash: {}, blockParams: [], data: {
    root: model.scopes[model.scopes.length - 1].scope,
  }, utils: {
    escapeExpression: _this.escapeExpression,
    SafeString: Schnauzer.SafeString,
    keys: getObjectKeys,
    extend: cloneObject,
    concat: concatArrays,
  }};

  for (var n = data.length; n--; ) {
    if (data[n].name) options.hash[data[n].name] = data[n].level;
    else newData.unshift(data[n].value);
  }
  if (bodyFns) {
    options.fn = function(context, options) {
      save = tweakScope(model.scopes[0], context, options);
      return [ bodyFns[0].bodyFn(model), save() ][0];
    };
    options.inverse = bodyFns[1] && function(context, options) {
      save = tweakScope(model.scopes[0], context, options);
      return [ bodyFns[1].bodyFn(model), save() ][0];
    } || noop;
  }
  return options;
}

function getHelperFn(_this, model, tagData) {
  var scope = model.scopes[tagData.helper.depth || 0].scope;
  var helperFn = _this.helpers[tagData.helper.orig];

  return tagData.helperFn || (tagData.helper.isStrict || !helperFn ?
    getDeepData(scope, tagData.helper, {}) : helperFn);
}

// ---- render blocks/inlines helpers (std. HBS helpers)

function renderHelper(_this, data, model, tagData, bodyFns, track) {
  var scope = model.scopes[(data[0] || {}).depth || 0].scope;
  var helper = getHelperFn(_this, model, tagData);
  var helperFn = !tagData.helper && bodyFns &&
    (data[0] ? renderConditions : undefined) || tagData.helperFn;
  var newData = [];
  var out = '';

  if (helperFn) return helperFn(_this, data, model, tagData, bodyFns, track);
  if (!helper && data.length === 1 && data[0].type === 'function') return data[0].value();
  if (model.alias) { model.scopes[0].level.unshift(model.alias); model.alias = null; }
  if (model.values) { model.scopes[0].values = model.values; model.values = null; }

  newData.push(getOptions(_this, model, tagData, data, newData, bodyFns));
  out = helper ? helper.apply(scope, newData) : '';
  model.scopes[0].level.shift();
  model.scopes[0].values = null;
  return out === undefined ? '' : out;
}

function renderPartial(_this, data, model, tagData) {
  var partial = _this.partials[tagData.partial.orig];
  var scope = !data[0].name ? data[0].value : model.scopes[0].scope;
  var tmp = model.scopes = shiftScope(model, scope);

  if (_this.options.limitPartialScope) model.scopes = [model.scopes[0]];
  return [ partial ? partial(model) : '', model.scopes = tmp, model.scopes.shift() ][0];
}

function renderConditions(_this, data, model, tagData, bodyFns, track) {
  var idx = 0;
  var objKeys = { _: [] };
  var bodyFn = bodyFns[idx];
  var helper = tagData.helper;
  var cond = /^(?:if|each|with)$/.test(helper);
  var isVarOnly = !helper && data.length === 1;
  var main = data[0] || {};
  var value = checkObjectLength(main, helper, objKeys);
  var canGo = ((cond || isVarOnly) && value) || (helper === 'unless' && !value);
  var shift = false;

  while (bodyFns[idx + 1] && !canGo) {
    bodyFn = bodyFns[++idx];
    helper = bodyFn.helper;
    cond = /^(?:if|each|with)$/.test(helper);
    data = bodyFn.vars.length ? getData(_this, model, bodyFn) : [];
    isVarOnly = !helper && data.length === 1;
    main = data[0] || {};
    value = checkObjectLength(main, helper, objKeys);
    canGo = ((cond || isVarOnly) && value) || (helper === 'unless' && !value) ||
      (!helper && !data.length && bodyFn.bodyFn); // isElese
  }
  track.fnIdx = idx;
  if (isVarOnly && main.type === 'array') helper = 'each';
  if (isVarOnly && !helper) helper = 'with';
  if (helper === 'with' || helper === 'each' && value) {
    shift = true;
    model.scopes = shiftScope(model, value);
    if (helper === 'each') return renderEach(_this, value, main, model, bodyFn.bodyFn, objKeys._);
    model.scopes[0].helpers = createHelper('', '', 0,
      isVarOnly ? value : model.scopes[0].scope, model.scopes[1]);
  }
  return [canGo ? bodyFn.bodyFn(model) : '', shift && model.scopes.shift()][0];
}

function renderEach(_this, data, main, model, bodyFn, objKeys) {
  var scope = model.scopes[0];
  var alias = main.alias;
  var level = scope.level[0];
  var isArr = main.type === 'array';
  var _data = !isArr && main.type !== 'object' ? [] : isArr ? data : objKeys;

  for (var n = 0, l = _data.length, key = '', out = ''; n < l; n++) {
    key = '' + (isArr ? n : _data[n]);
    scope.helpers = createHelper(n, key, l, data[key], data);
    scope.scope = data[key];
    if (alias) { level[alias[0]] = data[key]; level[alias[1]] = key; }
    out += bodyFn(model);
  }
  return [ out, model.scopes.shift() ][0];
}

// ---- render blocks and inlines; delegations only

function render(_this, model, data, tagData, out, renderFn, bodyFns, track) {
  return !_this.options.renderHook ? out : _this.options.renderHook.call(
    _this, out, data, tagData, track || {fnIdx: 0}, function() {
      return renderFn(_this, tagData, model, bodyFns, track || {fnIdx: 0});
    });
}

function renderInline(_this, tagData, model) {
  var data = getData(_this, model, tagData);
  var type = data[0] && data[0].type;
  var out = tagData.partial ? renderPartial(_this, data, model, tagData) :
    escapeHtml(_this, tagData.helper || type === 'function' ? // helper
      renderHelper(_this, data, model, tagData) : data[0] && data[0].value,
      type !== 'boolean' && type !== 'number' && tagData.isEscaped);

  return render(_this, model, data, tagData, out, renderInline, null);
}

function renderInlines(_this, tags, glues, blocks, model) {
  for (var n = 0, l = glues.length, out = ''; n < l; n++) {
    out += glues[n] + (!tags[n] ? '' : tags[n].blockIndex > -1 ?
      blocks[tags[n].blockIndex](model) : renderInline(_this, tags[n], model));
  }
  return out;
}

function renderBlock(_this, tagData, model, bodyFns, recursive) {
  var data = getData(_this, model, tagData);
  var track = recursive || { fnIdx: 0 }; // TODO: renderPartial on blocks? 
  var out = renderHelper(_this, data, model, tagData, bodyFns, track);
  
  return recursive ? out :
    render(_this, model, data, tagData, out, renderBlock, bodyFns, track);
}

// ---- parse (pre-render) helpers

function trim(text, start, end) {
  var regExp = !start && !end ? '' :
    !start ? '\\s*$' : !end ? '^\\s*' : '^\\s*|\\s*$';

  return regExp ? text.replace(new RegExp(regExp, 'g'), '') : text;
}

function getTrims(start, end) {
  return [ start.indexOf('~') !== -1, end.indexOf('~') !== -1 ];
}

function convertValue(text, skip) {
  return skip ? text : text === 'true' ? true : text === 'false' ?
    false : isNaN(text) || text === '' ? text : +text;
}

function cleanText(text, out) {
  return text.replace(/^(?:this[/.]|\.\/|\|)/, function($) {
    if ($) out.isStrict = true;
    return '';
  });
}

function parsePath(text, data, skip) {
  // TODO: ../[data.foo] ../["data.foo"] ../"data.foo" "data.foo".foo ... /
  var name = text.replace(/[[\]]/g, ''); // HB
  var parts = skip ? [] : name.split('../');
  var start = parts[1] ? parts[0] : '';
  var depth = parts.length - 1;
  var value = skip ? name : parts[depth];

  if (skip || value === '.' || value === 'this') return { value: value };
  parts = cleanText(value, data).split(/[./]/);
  return { value: start + parts.pop(), path: parts, depth: depth, name: name };
}

function parseAlias(value, out, spread) {
  for (var n = value.length, alias = []; n--; ) alias.unshift(value[n].value);
  if (spread) {
    while (alias.length) out[out.length - alias.length].name = alias.shift();
  } else {
    out[out.length - 1].alias = alias;
  }
}

function getVars(text, collection, out, type) {
  var txtParts = type === 'string' ? [text] : text.split(/[,;]*\s+[,;]*/);
  var isAliasOrString = type === 'alias' || type === 'string';

  for (var n = 0, l = txtParts.length,
      parts = [], value = '', data = {}, paths = {}; n < l; n++) {
    parts = txtParts[n].split('=');
    value = parts[1] !== undefined ? parts[1] : parts[0];
    if (value === '' || value === 'as') continue;

    data = collection[(value.match(/--(\d+)--/) || [])[1]] || { value: value };
    if (typeof data.value === 'object' && data.value[0].single) return data.value;
    if (parts[1] !== undefined) data.name = parts[0];
    if (data.type === 'string') data.value = data.value[0].value;
    else if (data.value && typeof data.value === 'string') {
      data.value = data.value.replace(/%+/, function($) {
        data.active = $.length; return '';
      });
      paths = parsePath(data.value, data, isAliasOrString);
      data.value = convertValue(paths.value, isAliasOrString || paths.name !== paths.value);
      if (paths.name) data.orig = paths.name;
      if (typeof data.value === 'string' && paths.path && !isAliasOrString) {
        data.path = paths.path;
        data.depth = paths.depth;
      }
    }
    data.type === 'alias' ? parseAlias(data.value, out, n > 3) : out.push(data);
  }
  return out;
}

function sizzleVars(text, out) {
  text = text.replace(/(['"|])(?:[^\\'"]|\\+['"]|['"])*?\1/g, function($, $1) {
    var value = { type: $1 !== '|' ? 'string' : 'alias', value: '' };
    value.value = $ === text ?
      [{ value: $.substring(1, $.length - 1), path: [], depth: 0, single: true }] :
      getVars($.substring(1, $.length - 1), out, [], value.type);
    return '--' + (out.push(value) - 1) + '--';
  });
  while (text !== (text = text.replace(/\([^()]*\)/g, function($) {
    var value = { vars: getVars($.substring(1, $.length - 1), out, [], 'fn') };
    if (value.vars.length > 1) value.helper = value.vars.shift();
    return '--' + (out.push(value) - 1) + '--';
  })));
  return getVars(text, out, [], '');
}

function getTagData(_this, vars, type, start, bodyFn, isInline) {
  var arr = vars ? sizzleVars(vars, []) : [];
  var helper = type === '^' ? 'unless' : /^(?:if|each|with|unless)$/
    .test((arr[0] || {}).value) ? arr.shift().value : '';

  return {
    partial: type === '>' ? arr.shift() : '',
    helper: helper ? helper : type !== '>' && arr.length > 1 ? arr.shift() : '',
    helperFn: helper ? renderConditions : '',
    isEscaped: start.lastIndexOf(_this.options.tags[0]) < 1,
    bodyFn: bodyFn || null,
    vars: arr,
    isInline: isInline, // new in v1.6.4
  };
}

// ---- sizzle inlines

function sizzleInlines(_this, text, blocks, tags, glues) {
  var parts = text.split(_this.regexps.inline);

  for (var n = 0, l = parts.length, vars = '', trims = []; n < l; n += 5) {
    if (parts[2 + n] && /^(?:!|=)/.test(parts[2 + n])) continue;
    vars = parts[3 + n] || '';
    trims = getTrims(!n ? '' : parts[4 + n - 5], !vars ? '' : parts[1 + n]);
    glues.push(trim(parts[n], trims[0], trims[1]));
    vars && tags.push(vars.indexOf('--block--') !== -1 ?
      { blockIndex: +vars.substr(10) } :
      getTagData(_this, vars, parts[2 + n] || '', parts[1 + n], null, true));
  }
  return function executeInlines(data) {
    return renderInlines(_this, tags, glues, blocks, data);
  }
}

// ---- sizzle blocks

function processBodyParts(_this, parts, blocks, mainStart, blkTrims, bodyFns) {
  for (var n = 0, l = parts.length, prev = false, trims = []; n < l; n += 4) {
    prev = trims[1] !== undefined ? trims[1] : blkTrims[0];
    trims = parts[1 + n] ? getTrims(parts[1 + n], parts[3 + n]) : [blkTrims[1]];
    bodyFns.push(getTagData(_this, parts[2 + n - 4] || '', '',
      n !== 0 ? parts[1 + n - 4] || '' : mainStart,
      sizzleInlines(_this, trim(parts[n], prev, trims[0]), blocks, [], [])));
  }
  return bodyFns;
}

function doBlock(_this, blocks, start, end, close, body, type, root, vars) {
  var closeParts = close.split(root);
  var rootAndVars = root + (vars ? ' ' + vars : '');
  var tagData = getTagData(_this, rootAndVars, type || '', start, null);
  var bodyFns = processBodyParts(_this, body.split(_this.regexps.else),
    blocks, start, getTrims(end, closeParts[0]), []);

  blocks.push(function executeBlock(model) {
    return renderBlock(_this, tagData, model, bodyFns);
  });
  return (start + '--block-- ' + (blocks.length - 1) + closeParts[1]);
}

function sizzleBlocks(_this, text, blocks) {
  var replaceCb = function($, start, type, root, vars, end, body, $$, close) {
    return type === '#*' ? _this.registerPartial(vars.replace(/['"]/g, ''),
        sizzleBlocks(_this, body, blocks)) && '' :
      doBlock(_this, blocks, start, end, close, body, type, root, vars);
  };

  while (text !== (text = text.replace(_this.regexps.block, replaceCb)));
  return sizzleInlines(_this, text, blocks, [], []);
}

}));
