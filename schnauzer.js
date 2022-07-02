/**! @license schnauzer v2.0.1; Copyright (C) 2017-2022 by Peter Dematté */
(function(global, factory) {
  if (typeof exports === 'object') module.exports = factory(global);
  else if (typeof define === 'function' && define.amd)
    define('schnauzer', [], function() { return factory(global); });
  else global.Schnauzer = factory(global);
}(this && this.window || global, function() { 'use strict';

var getObjectKeysFn = function(obj, key, keys) { obj.hasOwnProperty(key) && keys.push(key) };
var getObjectKeys = Object.keys || function(obj) {
  var keys = [];
  for (var key in obj) getObjectKeysFn(obj, key, keys);
  return keys;
};
var cloneObjectFn = function(obj, newObj, key) { newObj[key] = obj[key] };
var cloneObject = function(newObj, obj) {
  for (var key in obj) cloneObjectFn(obj, newObj, key);
  return newObj;
};
var concatArrays = function(array, host) {
  for (var n = 0, l = array.length; n < l; n++) host[host.length] = array[n];
  return host;
};

var Schnauzer = function(templateOrOptions, options) {
  this.version = '2.0.1';
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
    collectPath: false,
    loopHelper: null,
    renderHook: null,
  };
  initSchnauzer(this, options || {}, templateOrOptions);
};

var initSchnauzer = function(_this, options, template) {
  if (typeof template !== 'string') { options = template; template = '' }
  options = cloneObject(_this.options, options);
  switchTags(_this, options.tags);
  _this.helpers = options.helpers;
  for (var name in options.partials) _this.registerPartial(name, options.partials[name]);
  _this.escapeExpression = function(txt) { return escapeHtml(_this, txt, true) };
  if (template) _this.parse(template);
};

var HBSS = Schnauzer.SafeString = function(text) { this.string = text }; // WTF
HBSS.prototype.toString = HBSS.prototype.toHTML = function() { return '' + this.string };
Schnauzer.getObjectKeys = getObjectKeys; Schnauzer.cloneObject = cloneObject;
Schnauzer.concatArrays = concatArrays;

Schnauzer.prototype = {
  render: function(data, extra) {
    var helpers = createHelper('', '', 0, undefined, null, [{ scope: data }]);
    return this.partials[this.options.self]({
      extra: extra, scopes: [{ scope: data, helpers: helpers, level: [], values: null, alias: {} }],
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
      this.partials[name] || (txt.constructor === Function ? txt : parseTags(this, txt, []));
    for (var key in name) this.registerPartial(key, name[key]);
  },
  unregisterPartial: function(name) { delete this.partials[name] },
  setTags: function(tags) { switchTags(this, tags) },
};

return Schnauzer;

function switchTags(_this, tags) {
  var tgs = (function(tags) { for (var n = tags.length; n--; ) {
    tags[n] = '(' + (n ? '~*' : '') + (!n ? '\\\\*' : '') + tags[n] + (!n ? '~*' : '') + ')';
  } return tags; })(tags[0] === '{{' ? ['{{2,3}', '}{2,3}'] : tags);

  _this.regexps = { tags: new RegExp(tgs[0] + '([#^/!>*-]*)\\s*(.*?)\\s*' + tgs[1]) };
}

// ---- render data helpers

function escapeHtml(_this, string, doEscape) {
  return string == null ? '' : string.constructor === Schnauzer.SafeString ? string.string :
    doEscape && _this.options.escapeHTML ? String(string).replace(
      _this.regexps.entity, function(char) { return _this.options.entityMap[char] }
    ) : string;
}

function createHelper(idx, key, len, value, parent, scopes) {
  return len ? {
    '@index': idx,
    '@number': idx + 1,
    '@key': key,
    '@last': idx === len - 1,
    '@first': idx === 0,
    '@length': len,
    '@parent': parent,
    '@root': scopes[scopes.length - 1].scope,
    'this': value,
    '.': value,
  } : { '@parent': parent, '@root': scopes[scopes.length - 1].scope, 'this': value, '.': value };
}

function addScope(model, data, alias) {
  var scopes = model.scopes;
  var newLevel = model.alias ? [model.alias] : [];
  var level = concatArrays(scopes[0].level, newLevel);
  var values = model.values;
  var prevAlias = scopes[1] ? cloneObject({}, scopes[1].alias) : {};

  model.alias = null; model.values = null; // TODO
  alias = alias ? cloneObject(prevAlias, alias) : prevAlias;
  model.scopes = concatArrays(scopes, [{
    scope: data, helpers: {}, level: level, values: values, alias: alias,
  }]);
  return function() { model.scopes = scopes };
}

function tweakScope(scope, data) {
  var savedScope = scope.scope;
  scope.scope = data || {};
  return function() { scope.scope = savedScope; };
}

function getDeepData(data, main, alias) {
  if (main.value === '.' || main.value === 'this') return { value: data, variable: main };
  if (main.type !== 'key') return { value: main.value, variable: main };
  for (var n = main.path[0] === '@root' ? 1 : 0, l = main.path.length; n < l; n++)
    if (!(data = data[main.path[n]])) return { variable: main };
  return { value: data[main.value], parent: data, variable: main, alias: alias || false };
}

function getAlias(level, main, scope, data, trackData) {
  for (var n = 0, l = level.length, helpers = scope.helpers; n < l; n++) {
    data = getDeepData(level[n], main, true);
    if (data.value !== undefined) {
      if (trackData && (scope = scope.alias[data.variable.value])) {
        data.parent = scope.parent;
        data.key = scope.key;
        if (helpers['@length']) data.helpers = helpers;
      }
      return data;
    }
  }
  return { variable: main };
}

function createAliasMap(key, scope, model, aliasKey, data) {
  if (data.value === undefined || aliasKey === undefined) return;
  if (!model[key]) model[key] = {};
  model[key][aliasKey] = data.value;
  if (scope) scope.alias[aliasKey] = { parent: data.parent, key: data.variable.value };
}

function collectPath(scopes, scope, varData, tag) {
  var prevPath = (scopes[1] || {}).path || [];
  var isLoop = scopes[0].helpers['@length'] !== undefined;
  var depth = isLoop && varData.depth ? varData.depth + 1 : varData.depth;

  scope.path = prevPath.slice(0, prevPath.length - depth);
  if (!/^(?:\.|this)$/.test(varData.value)) scope.path[scope.path.length] = varData.value;
  return tag === 'I' ? scope.path : scope.path.slice(0);
}

function getData(_this, model, tagData, out) {
  var vars = tagData.vars;
  var trackData = !!_this.options.renderHook;

  if (!vars) return [];

  for (var n = 0, l = vars.length, main = {}, scope = {}, data = {}, args = []; n < l; n++) {
    main = vars[n];
    scope = !main.path || main.path[0] !== '@root' ? model.scopes[main.depth || 0] :
      model.scopes[model.scopes.length - 1];
    if (!scope) { out.push(data); continue; }
    data = { value: scope.helpers[main.value], variable: main, parent: scope.helpers['@parent'],
      key: scope.helpers['@key'], helpers: scope.helpers };

    if (data.value === undefined && scope.values)
      data = getAlias([scope.values], main, scope, data, trackData);
    if (data.value === undefined && !main.isStrict)
      data = getAlias(scope.level, main, scope, data, trackData);
    if (data.value === undefined) data = !main.helper ? getDeepData(scope.scope, main) :
      { value: renderHelper(_this, args = getData(_this, model, main, []), model, main) };
    if (data.value === undefined && model.extra) data = getDeepData(model.extra, main);

    if (main.alias) createAliasMap('alias', trackData && scope, model, main.alias[0], data);
    if (main.name) createAliasMap('values', trackData && scope, model, main.name, data);

    data.type = data.value && data.value.constructor === Array ? 'array' : typeof data.value;
    if (!data.variable) data.variable = main; // nested helper functions don't
    if (trackData) {
      if (main.helper && !main.name) data.helperFn = function(newData) {
        return renderHelper(_this, newData, { extra: model.extra, scopes: model.scopes }, main);
      };
      if (main.helper) data.helperFnArgs = args;
      if (_this.options.collectPath) data.path = collectPath(model.scopes, scope, main, tagData.tag);
    }
    out.push(data);
  }
  return out;
}

function checkObjectLength(main, helper, objKeys) {
  var value = main.value;
  var isObject = main.type === 'object';
  var go = helper === 'each' || (main.type === 'array' &&
    (helper === 'if' || helper === 'unless'));

  if (!go || value === undefined) return value;
  if (isObject) objKeys.keys = getObjectKeys(value);
  return isObject ? objKeys.keys.length && value : value.length && value;
}

function getHelperArgs(_this, model, tagData, data, newData) {
  var save = null;
  var noop = function noop() { return '' };
  var name = tagData.helper ? tagData.helper.orig : '';
  var helpers = model.scopes[0].helpers;
  var args = {
    name: name,
    hash: {},
    data: { root: helpers['@root'], scope: helpers['this'], parent: helpers['@parent'] },
    escapeExpression: _this.escapeExpression,
    SafeString: Schnauzer.SafeString,
    keys: getObjectKeys,
    extend: cloneObject,
    concat: concatArrays,
    getDataDetails: function() { return data },
  };

  if (helpers['@length']) cloneObject(args.data, {
    first: helpers['@first'], last: helpers['@last'], number: helpers['@number'],
    index: helpers['@index'], key: helpers['@key'], length: helpers['@length'],
  });
  for (var n = data.length; n--; ) {
    if (data[n].variable.name) args.hash[data[n].variable.name] = data[n].value;
    else newData.unshift(data[n].value);
  }
  if (tagData.children) {
    args.fn = function(context) {
      save = tweakScope(model.scopes[0], context);
      return [ tagData.children[0].text + tagData.children[0].bodyFn(model), save() ][0];
    };
    args.inverse = tagData.children[1] && function(context) {
      save = tweakScope(model.scopes[0], context);
      return [ tagData.children[1].text + tagData.children[1].bodyFn(model), save() ][0];
    } || noop;
  }
  return args;
}

function getHelperFn(_this, model, tagData) {
  var scope = model.scopes[tagData.helper.depth || 0].scope;
  var helperFn = _this.helpers[tagData.helper.orig];

  return tagData.helperFn || (tagData.helper.isStrict || !helperFn ?
    getDeepData(scope, tagData.helper).value : helperFn);
}

// ---- render blocks/inlines helpers (std. HBS helpers)

function renderHelper(_this, data, model, tagData, track) {
  var helperFn = !tagData.helper && tagData.children &&
    (data[0] ? renderConditions : undefined) || tagData.helperFn;
  var newData = [];
  var out = '';
  var restore = model.scopes[0].values;

  if (helperFn) return helperFn(_this, data, model, tagData, track);
  helperFn = getHelperFn(_this, model, tagData);
  if (!helperFn && data.length === 1 && data[0].type === 'function') helperFn = data.shift().value;
  if (model.values) model.scopes[0].values = model.values;

  if (data.length) newData.push(getHelperArgs(_this, model, tagData, data, newData));
  out = helperFn ? helperFn.apply(model.scopes[0].scope, newData) : '';
  model.scopes[0].values = restore;
  return out === undefined ? '' : out;
}

function renderPartial(_this, data, model, tagData) {
  var newData = tagData.partial.vars && getData(_this, model, tagData.partial, []);
  var helperValue = tagData.partial.helper && renderHelper(_this, newData, model, tagData.partial);
  var name = tagData.partial.orig || newData && (helperValue || newData[0].value) || '';
  var isTemplate = name === '@partial-block';
  var isBlock = !isTemplate && name.substring(0, 1) === '@';
  var partial = _this.partials[isBlock ? name.substring(1) : name];
  var scope = data[0] && !data[0].variable.name ? data[0].value : model.scopes[0].scope;
  var reset = addScope(model, scope);

  if (!partial && isBlock) partial = _this.partials[name];
  if (isBlock) model.partialBlock = _this.partials[name]; // TODO: no nested scenario possible
    else if (isTemplate) partial = model.partialBlock;
  if (_this.options.limitPartialScope) model.scopes = [model.scopes[0]]; // TODO: check isTemplate

  return [ partial ? partial(model) : '', reset(), delete model.partialBlock ][0];
}

function renderConditions(_this, data, model, tagData, track) {
  var idx = 0;
  var objKeys = { keys: [] };
  var tag = tagData.children[idx];
  var helper = tagData.helper;
  var cond = helper === 'if' || helper === 'each' || helper === 'with';
  var isVarOnly = !helper && data.length === 1;
  var main = data[0] || {};
  var value = checkObjectLength(main, helper, objKeys);
  var canGo = ((cond || isVarOnly) && value) || (helper === 'unless' && !value);
  var reset = null;

  while (tagData.children[idx + 1] && !canGo) {
    tag = tagData.children[++idx];
    helper = tag.helper;
    cond = helper === 'if' || helper === 'each' || helper === 'with';
    data = tag.vars.length ? getData(_this, model, tag, []) : [];
    isVarOnly = !helper && data.length === 1;
    main = data[0] || {};
    value = checkObjectLength(main, helper, objKeys);
    canGo = ((cond || isVarOnly) && value) || (helper === 'unless' && !value) ||
      (!helper && !data.length && tag.bodyFn); // isElse
  }
  track.fnIdx = idx;
  if (isVarOnly && main.type === 'array') helper = 'each';
  if (isVarOnly && !helper) helper = 'with';
  if (helper === 'with' || helper === 'each' && value) {
    reset = addScope(model, value, helper === 'with' && model.scopes[0].alias);
    if (helper === 'each') return renderEach(_this, value, main, model,
      tag, objKeys.keys, _this.options.loopHelper, reset);
    model.scopes[0].helpers = createHelper('', '', 0,
      isVarOnly ? value : model.scopes[0].scope, model.scopes[1].scope, model.scopes);
  }
  return [canGo ? tag.text + tag.bodyFn(model) : '', reset && reset()][0];
}

function renderEach(_this, data, main, model, tagData, objKeys, loopHelper, reset) {
  var bodyFn = tagData.bodyFn;
  var scope = model.scopes[0];
  var alias = main.variable.alias;
  var level = scope.level[0];
  var isArr = main.type === 'array';
  var value = !isArr && main.type !== 'object' ? [] : isArr ? data : objKeys;
  var loopFn = loopHelper && function(newModel) {
    model.scopes[0].scope = newModel[0].parent; // TODO: check
    return bodyFn(newModel);
  };

  if (alias && loopHelper) scope.alias[alias[0]] = { parent: data };
  for (var n = 0, l = value.length, key = '', out = ''; n < l; n++) {
    key = (isArr ? n : value[n]);
    scope.helpers = main.helpers = createHelper(n, key, l, data[key], data, model.scopes);
    scope.scope = data[key];
    if (alias) {
      if (alias[1]) level[alias[1]] = key;
      level[alias[0]] = data[key];
      if (loopHelper) scope.alias[alias[0]].key = key;
    }
    if (_this.options.collectPath && _this.options.renderHook)
      model.scopes[1].path[model.scopes[1].path.length - (n ? 1 : 0)] = '' + key;
    out += loopFn ? loopHelper(_this, tagData.text + bodyFn(model), main, loopFn, tagData) :
      tagData.text + bodyFn(model);
  }
  return [ out, reset() ][0];
}

// ---- render blocks and inlines; delegations only

function render(_this, model, data, tagData, out, renderFn, track) {
  model.values = null; model.alias = null;
  if (_this.options.renderHook && tagData.tag === 'B')
    model = { extra: model.extra, scopes: model.scopes };
  return !_this.options.renderHook || !data.length ? out : _this.options.renderHook(
    _this, out, data, function(newModel) {
      model.scopes[0].scope = newModel[0].parent;
      return renderFn(_this, tagData, newModel, model, track || { fnIdx: 0 });
    }, tagData, tagData.tag === 'B' ? track || { fnIdx: 0 } : undefined);
}

function renderInline(_this, tagData, data, model) {
  var type = data[0] && data[0].type;
  var out = tagData.partial ? renderPartial(_this, data, model, tagData) :
    escapeHtml(_this, tagData.helper || type === 'function' ? // helper
      renderHelper(_this, data, model, tagData) : data[0] && data[0].value,
      type !== 'boolean' && type !== 'number' && tagData.isEscaped);

  return render(_this, model, data, tagData, out, renderInline);
}

function renderInlines(_this, tags, model) {
  for (var n = 0, l = tags.length, out = '', data = {}; n < l; n++) {
    data = getData(_this, model, tags[n], []);
    out += tags[n].tag === 'B' ? renderBlock(_this, tags[n], data, model) :
      renderInline(_this, tags[n], data, model) + tags[n].text;
  }
  return out;
}

function renderBlock(_this, tagData, data, model, recursive) {
  var track = recursive || { fnIdx: 0 };
  var out = renderHelper(_this, data, model, tagData, track);

  return (recursive ? out :
    render(_this, model, data, tagData, out, renderBlock, track)) + tagData.text;
}

// ---- parse (pre-render) helpers

function trim(text, start, end) {
  var doStart = start.indexOf('~') !== -1;
  var doEnd = end.indexOf('~') !== -1;
  var regExp = !doStart && !doEnd ? '' :
    !doStart ? '\\s*$' : !doEnd ? '^\\s*' : '^\\s*|\\s*$';

  return regExp ? text.replace(new RegExp(regExp, 'g'), '') : text;
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
  var hasDot = false;
  var name = text.replace('@parent/', '../').replace(/\[.*?]/g, function($) { // HB
    return $.substring(1, $.length - 1).replace(/\./g, function() { hasDot = true; return '^'; });
  });
  var parts = skip ? [] : name.split('../');
  var start = parts[1] ? parts[0] : '';
  var depth = parts.length - 1;
  var value = skip ? name : parts[depth];

  if (skip || value === '.' || value === 'this' || +value == value) return {
    value: value, path: [], depth: depth, type: 'key'
  };
  parts = cleanText(value, data).split(/[./]/);
  if (hasDot) {
    for (var n = parts.length; n--; ) parts[n] = parts[n].replace(/\^/g, '.');
    name = name.replace(/\^/g, '.');
  }
  return { value: start + parts.pop(), path: parts, depth: depth, orig: name };
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

  for (var n = 0, l = txtParts.length, match = /--(\d+)--/, replace = /%+/, dataType = '',
      parts = [], value = '', data = {}, paths = {}, skipConvert = false; n < l; n++) {
    parts = txtParts[n].split('=');
    value = parts[1] !== undefined ? parts[1] : parts[0];
    if (value === '' || value === 'as') continue;

    data = collection[(value.match(match) || [])[1]] || { value: value, type: 'key' };
    dataType = typeof data.value;
    if (dataType === 'object' && data.value[0] && data.value[0].single) return data.value;
    if (parts[1] !== undefined) data.name = parts[0];
    if (data.type === 'string') data.value = data.value[0] && data.value[0].value || '';
    else if (data.value && dataType === 'string') {
      data.value = data.value.replace(replace, function($) { data.active = $.length; return '' });
      paths = parsePath(data.value, data, isAliasOrString);
      skipConvert = isAliasOrString || (paths.orig && paths.orig !== paths.value);
      data.value = convertValue(paths.value, skipConvert);
      dataType = typeof data.value;
      if (dataType !== 'string') data.type = dataType;
      else if (paths.path && !isAliasOrString) cloneObject(data, paths);
    }
    data.type === 'alias' ? parseAlias(data.value, out, n > 3) : out.push(data);
  }
  return out;
}

function sizzleVars(text, out) {
  var replace = /\([^()]*\)/g;
  var replaceCb = function($) {
    var value = { vars: getVars($.substring(1, $.length - 1), out, [], 'fn') };
    if (value.vars.length > 1) value.helper = value.vars.shift();
    return '--' + (out.push(value) - 1) + '--';
  };

  text = text.replace(/(['"|])(?:[^\\'"]|\\+['"]|['"])*?\1/g, function($, $1) {
    var value = { type: $1 !== '|' ? 'string' : 'alias', value: '' };

    if (text.indexOf('[' + $1) !== -1 || text.indexOf($1 + '=') !== -1) return $;
    value.value = $ === text ?
      [{ value: $.substring(1, $.length - 1), path: [], depth: 0, single: true, type: 'key' }] :
      getVars($.substring(1, $.length - 1), out, [], value.type);
    return '--' + (out.push(value) - 1) + '--';
  });
  while (text !== (text = text.replace(replace, replaceCb)));
  return getVars(text, out, [], '');
}

function getTagData(_this, vars, type, start, tag, text) {
  var arr = vars ? sizzleVars(vars, []) : [];
  var helper = type === '^' ? 'unless' :
    /^(?:if|each|with|unless)$/.test((arr[0] || {}).value) ? arr.shift().value : '';

  return {
    partial: type === '>' ? arr.shift() : undefined,
    helper: helper ? helper : type !== '>' && arr.length > 1 ? arr.shift() : '',
    helperFn: helper ? renderConditions : undefined,
    isEscaped: start.lastIndexOf(_this.options.tags[0]) < 1,
    bodyFn: null,
    vars: arr,
    isInline: tag !== 'B', // new in v1.6.4 ...
    tag: tag,
    text: text,
    children: null,
  };
}

// ---- parse inline and block tags

function createExecutor(_this, tagData) { // TODO: check if all is needed (dyn)...
  return tagData.bodyFn = tagData.tag === 'B' ? function executeBlock(model) {
    return renderBlock(_this, tagData, getData(_this, model, tagData, []), model);
  } : function executeInlines(model) {
    return renderInlines(_this, tagData.children, model);
  };
}

function buildTree(_this, tree, tagData, open) {
  var errorMessage = 'Schnauzer Error: Wrong closing tag: "/' + tagData.vars + '"';
  var parent = tree.parent;
  var getChildren = function(tagData, isFirstChild) {
    tagData.children = [];
    tagData.children.parent = tree;
    tree = tagData.children;
    if (isFirstChild) {
      tree.push(getTagData(_this, '', '', open, '', tagData.text)); // TODO
      getChildren(tree[tree.length - 1]);
      tree.isElse = true;
    }
  };
  var getParent = function() {
    delete tree.parent; delete tree.isElse;
    tree = parent;
    parent = tree.parent;
    createExecutor(_this, tree[tree.length - 1]);
  };

  if (tagData.tag === 'C') {
    if (!tree.parent) throw(errorMessage);
    if (tree.isElse) getParent();
    getParent();
    if (tree.lastBlock !== tagData.vars) throw(errorMessage);
    delete tree.lastBlock;
    tree[tree.length - 1].text = tagData.text;
  } else if (tagData.tag === 'B') {
    tree.push(tagData);
    tree.lastBlock = tagData.alt || tagData.helper.value || tagData.helper || tagData.vars[0].orig;
    getChildren(tagData, true);
  } else if (tagData.tag === 'E') {
    if (tree.isElse) getParent();
    tree.push(tagData);
    getChildren(tagData);
    tree.isElse = true;
  } else { // tagData.tag === 'I'
    tree.push(tagData);
  }
  return tree;
}

function parseTags(_this, text, tree) {
  var split = text.split(_this.regexps.tags);
  var types = {'#':'B','^':'B','/':'C','E':'E'};

  if (split[0]) tree.unshift({ text: split[0] });

  for (var n = 1, type = '', vars = '', body = '', space = 0, root = '', tmp = '',
      cType = '', tag = '', tagData = {}, l = split.length; n < l; n += 5) {
    type  = split[1 + n];
    vars  = split[2 + n];
    body  = trim(split[4 + n], split[3 + n], split[5 + n] || '');

    if (split[n].substring(0, 1) === '\\' || /^[!-]+/.test(type)) continue;

    space = vars.indexOf(' ');
    root = type !== '/' && vars.substring(0, space) || vars; // TODO
    cType = type === '^' && (space !== -1 || vars === '') || root === 'else' ? 'E' : type;
    tag = types[cType.substring(0, 1)] || 'I'; // TODO: ^ if === else if

    if (type === '#>') tmp = root;
    if (cType === 'E') vars = vars.replace(/^else\s*/, ''); // TODO; split in old
    tagData = type === '/' ? { tag: 'C', text: body, vars: vars } :
      getTagData(_this, vars, type, split[n], tag, body);
    if (type === '^' && tag === 'B') tagData.alt = tagData.vars[0].orig;
    if (type === '#*') tagData.isPartial = true;

    tree = buildTree(_this, tree, tagData, split[n]);

    if (tag === 'C' && (tree[tree.length - 1].isPartial || tmp)) { // Don't like this
      tmp = tmp ? '@' + tmp : ''; // TODO: introduce counter
      tagData = tree.splice(-1, 1, tmp ?
        getTagData(_this, tmp, '>', split[n], 'I', tagData.text) : { text: tagData.text })[0];
      tagData.children[0].children.unshift({ text: tagData.children[0].text });
      _this.registerPartial(tmp || tagData.vars[0].value, tagData.children[0].bodyFn);
      tmp = '';
    }
  }
  if (tree.parent) throw('Schnauzer Error: Missing closing tag(s)');
  split = text = tagData = null;

  return createExecutor(_this, { children: tree });
}

}));
