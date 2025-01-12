/**! @license schnauzer v3.0.1; Copyright (C) 2017-2025 by Peter Dematté */
(function(global, factory) {
  if (typeof exports === 'object' && typeof module === 'object')
    module.exports = factory(global);
  else if (typeof define === 'function' && define.amd)
    define([], function() { return factory(global); }, 'schnauzer');
  else if (typeof exports === 'object') exports['Schnauzer'] = factory(global);
  else global.Schnauzer = factory(global);
}(this && this.window || global, function factory(global) { 'use strict';

var console = global.console;
var trims = { start: /^\s+/, end: /\s+$/, whitespace: /\s+/ };
var getKeys = Object.keys || function(obj) {
  var keys = [], prop = '';
  for (prop in obj) if (hasOwnProperty.call(obj, prop)) keys.push(prop);
  return keys;
};
var extendFn = function(obj, newObj, key) { newObj[key] = obj[key] };
var extend = Object.assign || function(newObj, obj) {
  for (var key in obj) extendFn(obj, newObj, key);
  return newObj;
};
var templateError = function() { throw('Schnauzer Error: Incorrect template') };

var Schnauzer = function(templateOrOptions, options) {
  this.version = '3.0.1';
  this.partials = {};
  this.exports = {};
  this.helpers = {
    lookup: lookupProperty,
    log: function(options) {
      if (!console) return;
      for (var n = 0, l = arguments.length, args = []; n < l; n++)
        if (n === l - 1) options = arguments[n]; else args.push(arguments[n]);
      (console[options.hash['level']] || console.log).apply(console, args);
    },
  };
  this.regex = { tags: null, entity: null };
  this.controls = { partialBlocks: [] };
  this.options = {
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
    escapeHTML: true,
    limitPartialScope: true,
    strictArguments: true,
    loopHelper: null,
    renderHook: null,
    evaluationHook: null,
    dynamic: null,
  };
  initSchnauzer(this, options || {}, templateOrOptions, this.exports);
};

var initSchnauzer = function(_this, options, template, exp) {
  if (typeof template !== 'string') { options = template; template = undefined }
  options = extend(_this.options, options);
  _this.regex.tags = /({{2,3})([#~^/!>*-]*)\s*([^~}]*)([~}]{2,4})/;
  _this.regex.entity = new RegExp(
    '[' + getKeys(options.entityMap).join('') + ']', 'g'
  );
  _this.helpers = extend(_this.helpers, options.helpers);
  _this.registerPartial(options.partials);
  if (template !== undefined) _this.parse(template);
  if (options.dynamic) {
    exp.render = render;
    exp.renderBlock = renderBlock;
    exp.renderHelper = renderHelper;
    exp.renderEach = renderEach;
  }
  delete options.helpers;
  delete options.partials;
};

var SafeString = function(text) { this.string = text };
SafeString.prototype.toString = SafeString.prototype.toHTML =
  function() { return '' + this.string };
Schnauzer.extend = extend;
Schnauzer.getKeys = getKeys;

Schnauzer.prototype = {
  render: function(data, extra) {
    var helpers = createHelper([{ context: data }], data);
    var scopes = [{ context: data, helpers: helpers, vars: {} }];

    return render(this, this.partials[this.options.self], {
      scopes: scopes, extra: extra || {}, $vars: {}, $alias: {},
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
      this.partials[name] ||
      (txt.constructor === Array ? txt : parseTags(this, txt));
    for (var key in name) this.registerPartial(key, name[key]);
  },
  unregisterPartial: function(name) { delete this.partials[name] },
};

return Schnauzer;

function escapeHtml(_this, string, doEscape) {
  return string == null ? '' :
    string.constructor === SafeString ? string.toString() :
    doEscape && _this.options.escapeHTML ? String(string).replace(
      _this.regex.entity,
      function(char) { return _this.options.entityMap[char] }
    ) : string;
}

function lookupProperty(parent, propertyName) {
  var out = parent[propertyName];

  if (out == null) return out;
  if (Object.prototype.hasOwnProperty.call(parent, propertyName)) return out;
  return undefined;
}

// ---- render data helpers

function addScope(model, value, partialContent) {
  var scope = model.scopes[0];
  var sav = {};
  var vars = extend({}, model.$vars);

  if (partialContent) for (var key in scope.$vars) {
    vars[key] = sav[key] = scope.$vars[key];
    scope.vars[key] = undefined;
  }

  if (scope.$alias) for (var key in scope.$alias)
    if (!model.$alias.hasOwnProperty(key)) model.$alias[key] = scope.vars[key];
  extend(vars, model.$alias);

  model.scopes.unshift({
    context: value === undefined ? {} : value,
    helpers: scope.helpers,
    vars: vars,
    $alias: model.$alias,
    $vars: model.$vars,
  });
  model.$vars = {};
  model.$alias = {};

  return function() {
    model.scopes.shift();
    if (partialContent) extend(scope.vars, sav);
  };
}

function createHelper(scopes, value, parent, idx, key, len) {
  return len ? {
    '@index': idx,
    '@number': idx + 1,
    '@key': key,
    '@odd': idx % 2 !== 0,
    '@last': idx === len - 1,
    '@first': idx === 0,
    '@length': len,
    '@depth': scopes.length - 2 >= 0 ? scopes.length - 2 : 0,
    '@parent': scopes[1].context,
    '@root': scopes[scopes.length - 1].context,
    'this': value,
  } : {
    '@parent': parent,
    '@root': scopes[scopes.length - 1].context,
    'this': value,
  };
}

function createAlias(main, model, data, out) {
  if (main.name) {
    if (main.name === 'includeZero') return out[0].zero = main.value;
    model.$vars[main.name] = data.value;
    data.alias = main.name;
  } else for (var n = 0, l = main.alias.length; n < l; n++)
    model.$alias[main.alias[n]] = out[n] ? out[n].value : undefined;
}

function createDataModel(main, context, isLoop) {
  var key = main.value;
  var type = main.type;
  var isLiteral = type !== 'key' && type !== 'helper';
  var isThis = key === 'this';
  var noParent = isLiteral || isThis;

  if (main.path.length) context = deepData(main, context, {}).parent;

  return {
    value: isThis ? context : isLiteral ? key : context && context[key],
    type: isLiteral ? type : undefined,
    parent: noParent ? undefined : context,
    active: noParent || type === 'helper' ? 0 : main.active,
    key: isLiteral ? '' : key,
    alias: '',
    args: [],
    isLoop: isLoop || false,
    helper: main.enclosed,
    // zero: false,
  };
}

function deepData(main, context, data) {
  var n = 0;
  var l = main.path.length;
  var value = null;

  for ( ; n < l; n++) if (!(context = context[main.path[n]])) return data;
  if ((value = context[main.value]) === undefined) return data;

  data.value = value;
  data.parent = context;

  return data;
}

function getHelperData(_this, model, data, main, isHelper) {
  if (isHelper) main.helper = true;
  data.args = getData(_this, { vars: main.args }, model);
}

function getData(_this, tagData, model) {
  var out = [];
  var main = {};
  var scope = null;
  var context = {};
  var data = {};
  var helper = null;
  var alias = false;
  var isLoop = tagData.helper === 'each';

  for (var n = 0, l = tagData.vars.length; n < l; n++) {
    main = tagData.vars[n];
    alias = !!main.name || !!main.alias.length;
    scope = model.scopes[main.depth];
    if (!scope) { out.push(createDataModel(main, context)); continue; }

    helper = !main.strict ? _this.helpers[main.value] : null;
    if (helper && main.type !== 'string') main.type = 'helper';
    context = main.value[0] === '@' || (main.path[0] || '')[0] === '@' ?
      scope.helpers : helper ? _this.helpers : scope.context;

    out.push(data = createDataModel(main, context, isLoop));
    if (main.type === 'helper') getHelperData(_this, model, data, main, !n);
    if (!alias || data.value === undefined) deepData(main, scope.vars, data);
    if (data.value === undefined) deepData(main, model.extra, data);

    if (!data.type) data.type = data.value && data.value.constructor === Array ?
      'array' : typeof data.value;
    if (!n && data.type === 'array' && !tagData.helper) data.isLoop = true;
    if (alias) createAlias(main, model, data, out);
  }

  return out;
}

function checkValue(main, value, helper, keys) {
  var isIf = helper === 'if' || helper === 'unless';
  var isLiteral = main.type === 'number' || main.type === 'string';
  var isObject = main.type === 'object' && main.value !== null;

  if (!keys) keys = {};

  return main.type === 'array' ? !!main.value.length :
    isObject ? helper !== 'each' || !!(keys.keys = getKeys(main.value)).length :
    main.zero && main.value === 0 ? true :
    !isIf && isLiteral ? value !== undefined : !!value;
}

function helperArgs(_this, tagData, main, model) {
  var helpers = model.scopes[0].helpers;
  var args = {
    name: main.key,
    data: {},
    hash: {},
    lookupProperty: lookupProperty,
    createFrame: function(data) { return extend({}, data)},
    escapeExpression: function(txt) { return escapeHtml(_this, txt, true) },
    SafeString: SafeString,
  };
  var item = null;

  for (var key in helpers) if (key[0] === '@' && helpers[key] !== undefined)
    args.data[key.substring(1)] = helpers[key];
  for (var n = main.args.length; n--; ) if (item = main.args[n], item.alias)
    args.hash[item.alias] = item.value;

  if (tagData.block && tagData.alts) {
    args.fn = function(context, fnData) {
      return scopeFn(_this, context, model, tagData.children, fnData || args);
    };
    args.inverse = tagData.alts[0] ? function(context, fnData) {
      var tags = tagData.alts;
      var altTag = tags[1] ? extend({}, tags[0]) : null;

      if (altTag) { altTag.alts = tags.slice(1); tags = [altTag]; }
      return scopeFn(_this, context, model, tags, fnData || args);
    } : function noop() { return ''; };
  }

  return args;
}

// ---- render blocks/inlines helpers (std. HBS helpers)

function renderPartial(_this, data, model, tagData) {
  var scopes = model.scopes;
  var out = '';
  var main = data[0];
  var name = main.key || main.value;
  var key = main.helper ? renderHelper(_this, tagData, main, model) : name;
  var content = key === '@partial-block';
  var partialBlocks = _this.controls.partialBlocks;
  var children = content ? partialBlocks[0] : tagData.children;
  var partial = content ? null : _this.partials[key];
  var limit = _this.options.limitPartialScope;
  var scope = data[1] && !data[1].alias ? data[1].value : scopes[0].context;
  var resetScope = addScope(model, scope, !partial);

  if (!tagData.block || !partial) out = render(_this, children, model);
  if (tagData.block) partialBlocks.unshift(tagData.children);

  if (limit) model.scopes = [scopes[0]];
  if (partial) out += render(_this, partial, model);
  if (limit) model.scopes = scopes;
  if (tagData.block) partialBlocks.shift();
  if (resetScope) resetScope();

  return out;
}

function scopeFn(_this, context, model, children, data) {
  var out = '';
  var resetScope = addScope(model, context);

  if (data && data.data && !data.SafeString) for (var key in data.data)
    model.scopes[0].vars['@' + key] = data.data[key];

  out = render(_this, children, model);
  resetScope();

  return out;
}

function renderEach(_this, model, main, tagData, objKeys) {
  var out = '';
  var value = main.value;
  var hook = _this.options.loopHelper;
  var resetScope = addScope(model, value);
  var scopes = model.scopes;
  var scope = scopes[0];
  var isArray = main.type === 'array';
  var data = isArray ? value : objKeys.keys;
  var alias = tagData.vars[0].alias;

  for (var n = 0, key = '', l = data.length; n < l; n++) {
    if (hook && data[n] === undefined) continue;
    key = isArray ? n : data[n];
    scope.helpers = createHelper(scopes, value[key], value, n, key, l);
    scope.context = value[key];

    if (alias[0]) scope.vars[alias[0]] = value[key];
    if (alias[1]) scope.vars[alias[1]] = key;

    out += !hook ? render(_this, tagData.children, model) :
      hook(_this, tagData, model, main, n);
  }
  resetScope();

  return out;
}

function renderHelper(_this, tagData, main, model) {
  var fnArgs = [];
  var arg = null;
  var n = 0, l = main.args.length;
  var context = model.scopes[0].context;

  if (!main.value || !main.value.apply) return main.value;

  for ( ; n < l; n++) if (arg = main.args[n], arg.helper)
    fnArgs.push(renderHelper(_this, tagData, arg, model));
  else if (!arg.alias) fnArgs.push(arg.value);

  if (main.key[0] !== '$' && tagData.vars[0].type === 'helper')
    fnArgs.push(helperArgs(_this, tagData, main, model));

  return main.value.apply(context, fnArgs);
}

function renderBlockHelper(_this, tagData, model, value) {
  var isIf = tagData.vars.length !== 0 && tagData.vars[0].type !== 'helper';
  var resetScope = isIf && !tagData.helper ? addScope(model, value) : null;
  var out = tagData.text;

  out += !tagData.helper && !isIf ? value :
    render(_this, tagData.children, model);

  if (resetScope) resetScope();
  return out;
}

function getEvaluationHookHelper(_this, alts, main, hook) {
  var mainAlts = alts.length ? main.alts = main.alts || [] : null;
  var lastIndex = alts.length - 1;
  var elseIndex = alts[lastIndex] && alts[lastIndex].vars.length === 0 ?
    lastIndex : -1;

  if (!mainAlts) return function() {};

  main.index = 0;
  return function(data, n) {
    if (!data) return hook(main);

    if (!mainAlts[n]) mainAlts[n] = n === elseIndex ? { args: [] } : data;
    if (n !== elseIndex) mainAlts[n].type = data.type;
    main.index = n + 1;
  };
}

function evaluateBlock(_this, data, model, tagData) {
  var main = data[0];
  var unless = tagData.helper === 'unless';
  var value = renderHelper(_this, tagData, main, model);
  var keys = { keys: [] };
  var check = checkValue(main, value, tagData.helper, keys);
  var alts = tagData.alts;
  var hook = _this.options.evaluationHook;
  var $hook = hook && getEvaluationHookHelper(_this, alts, main, hook);

  if (check === unless) for (var n = 0, l = alts.length ;n < l; n++) {
    tagData = alts[n];
    unless = tagData.helper === 'unless';

    if (tagData.helper) {
      main = getData(_this, tagData, model)[0];
      value = renderHelper(_this, tagData, main, model);
    } else value = render(_this, tagData.children, model);
    if ($hook) $hook(main, n);

    check = checkValue(main, value, tagData.helper);
    if (check !== unless) break;
  }

  if (tagData.helper === 'with' && value)
    return scopeFn(_this, value, model, tagData.children);
  if (main.isLoop && value)
    return renderEach(_this, model, main, tagData, keys);
  if ((!$hook || !$hook()) && check !== unless)
    return renderBlockHelper(_this, tagData, model, value);
  return !tagData.alts && !tagData.helper ? tagData.text : '';
}

// ---- render blocks and inlines; delegations only

function renderBlock(_this, tag, model, data) {
  var hook = _this.options.renderHook;
  var out = tag.partial ?
    renderPartial(_this, data, model, tag) :
    evaluateBlock(_this, data, model, tag);

  return hook ? hook(_this, model, tag, data, out) : out;
}

function renderInline(_this, tag, model, data) {
  var hook = _this.options.renderHook;
  var out = tag.partial ?
    renderPartial(_this, data, model, tag) : data[0].type === 'function' ?
    renderHelper(_this, tag, data[0], model) :
    data[0].value;

  out = escapeHtml(_this, out, tag.escape);
  if (hook) out = hook(_this, model, tag, data, out);

  return out + tag.text;
}

function render(_this, tags, model) {
  var out = '';
  var renderFn = null;
  var tag = {};

  for (var n = 0, l = tags.length; n < l; n++) if (tag = tags[n], tag.vars) {
    renderFn = tag.block ? renderBlock : renderInline;
    out += renderFn(_this, tag, model, getData(_this, tag, model));
  } else out += tag.text;

  return out;
}

// ---- parse variables

function convertValue(text, model) {
  return text === 'true' ? (model.type = 'boolean', true) :
    text === 'false' ? (model.type = 'boolean', false) :
    isNaN(text) || text === '' ? text : (model.type = 'number', +text);
}

function getVarsModel() {
  return {
    active: 0, alias: [], args: [], depth: 0, name: '', helper: false,
    path: [], strict: false, type: 'key', value: '', enclosed: false,
  };
}

function isStringIsolated(start, end, extra) {
  return (!start || start === ' ') && (!end || end === ' ') ||
    end === ')' || extra === '=';
}

function packageVar(model, cache, out, args) {
  if (!cache) return model;
  model.value = convertValue(cache, model);
  if (model.type !== 'helper' && args.length) args[0].push(model);
  else out.push(model);

  return getVarsModel();
}

function getVars(vars, out, isPartial, isHelper, strictArgs) {
  var model = getVarsModel();
  var cache = '';
  var char = '';
  var beforeString = '';
  var quotation = '';
  var cast = false;
  var args = [];

  for (var n = 0, l = vars.length; n < l; n++) {
    char = vars[n];

    if ('"' === char || '\'' === char) {
      if (vars[n - 1] === '\\' && ('"' === char || '\'' === char)) {
        cache = cache.substring(0, cache.length - 1) + char;
      } else if (char === quotation) {
        if (isStringIsolated(beforeString, vars[n + 1], beforeString)) {
          model.type = 'string';
          model = packageVar(model, cache, out, args);
          cache = '';
        }
        quotation = '';
      } else if (!quotation) {
        quotation = char;
        beforeString = vars[n - 1];
      } else cache += char;
    } else if (quotation) {
      cache += char;
    } else if ('[' === char || ']' === char) {
      cast = '[' === char;
    } else if (cast) {
      cache += char;
    } else if (' a./@=()%|'.indexOf(char) === -1) {
      cache += char;
    } else if ('a' === char) {
      if (' as ' === vars.substring(n - 1, n + 3)) n += 2;
      else cache += char;
    } else if (' ' === char) {
      model = packageVar(model, cache, out, args);
      cache = '';
    } else if ('.' === char && '../' === vars.substring(n, n + 3)) {
      model.depth++;
      model.strict = true;
      n += 2;
    } else if ('/' === char || '.' === char) {
      if ('.' === char && isStringIsolated(vars[n - 1], vars[n + 1])) {
        model = packageVar(model, 'this', out, args);
        continue;
      }
      if (cache && cache !== 'this') model.path.push(cache);
      model.strict = true;
      cache = '';
    } else if ('@' === char && '@parent' === vars.substring(n, n + 7)) {
      if ('./'.indexOf(vars[n + 7]) !== -1) {
        model.depth++;
        model.strict = true;
      } else cache += '@parent';
      n += 6;
    } else if ('=' === char) {
      model.name = cache ? cache : out.pop().value;
      cache = '';
    } else if ('(' === char) {
      model.type = 'helper';
      model.enclosed = true;
      args.unshift(model.args);
    } else if (')' === char) {
      model = packageVar(model, cache, out, args);
      args.shift();
      if (args.length) args[0].push(out.pop());
      cache = '';
    } else if ('%' === char) {
      model.active++;
    } else if ('|' === char) {
      cache = vars.substring(n + 1);
      cache = cache.substring(0, cache.indexOf(char));
      n += cache.length + 1;
      out[out.length - 1].alias = trim(cache, '~', '~').split(' ');
      cache = '';
    } else cache += char;
  }

  if (args.length) templateError();
  packageVar(model, cache, out, args);
  if (isPartial || !out.length) return out;

  if (!isHelper) out[0].type = 'key';
  if (out[1] && out[0].type === 'key') {
    out[0].type = 'helper';
    if (strictArgs) for (var n = 1, l = out.length; n < l; n++)
      if (out[n].type === 'key') out[n].strict = true;
    out[0].args = out.splice(1);
  }

  return out;
}

// ---- parse inline and block tags and build tree

function skipTag(parts, tree, index) {
  var previous = tree[tree.length - 1];
  var text = previous.text;

  previous.text = text.substring(0, text.length - 1);
  tree.push({ text: parts.slice(index, index + 5).join('') });
}

function trim(text, start, end) {
  if (start.indexOf('~') !== -1) text = text.replace(trims.start, '');
  return end && end.indexOf('~') !== -1 ? text.replace(trims.end, '') : text;
}

function checkBlockStart(tree, close) {
  for (var n = tree.length; n--; ) if (tree[n].alts) break;
  return close === tree[n].helper || close === tree[n].block ||
    close === tree[n].vars[0].value;
}

function movePartialText(tagData) {
  tagData.children.unshift({ text: tagData.text });
  tagData.text = '';
}

function getTreeChildren(tree, tagData) {
  tagData.children.__parent = tree;
  return tagData.children;
}

function getTreeParent(tree) {
  var parent = tree.__parent;
  if (!parent) templateError();
  delete tree.__parent;
  return parent;
}

function buildTree(tree, tagData) {
  if (tagData.close) {
    tree = getTreeParent(tree);
    if (!checkBlockStart(tree, tagData.close)) templateError();
    if (tree[tree.length - 1].partial) movePartialText(tree[tree.length - 1]);
    tree.push({ text: tagData.text });
  } else if (tagData.block) {
    tree.push(tagData);
    tree = getTreeChildren(tree, tagData);
  } else if (!tagData.alts) {
    tagData.block = true;
    tree = getTreeParent(tree);
    tree[tree.length - 1].alts.push(tagData);
    tree = getTreeChildren(tree, tagData);
  } else tree.push(tagData);

  return tree;
}

function inlineTemplate(_this, templates, tree, args, text) {
  var tmpl = {};

  if (!args[1]) {
    tree = buildTree(tree, { close: args[0], text: text });
    tmpl = tree.splice(-2, 1)[0];
    tmpl.children.unshift({ text: tmpl.text });
    _this.registerPartial(tmpl.name, tmpl.children);
    templates.shift();
    return tree;
  }

  templates.unshift(args[0]);
  return buildTree(tree, {
    block: args[0],
    name: args[1].replace(/['"]/g, ''),
    children: [],
    text: text,
    alts: [],
  });
}

function parseTags(_this, templateText) {
  var parts = templateText.split(_this.regex.tags);
  var tree = [{ text: trim(parts[0], '', parts[2]) }];
  var open = '', type = '', args = [], text = '';
  var isPartial = false, isBlock = false, helper = '';
  var helperTester = { if: true, unless: true, each: true, with: true };
  var templates = [];
  var strict = _this.options.strictArguments;

  for (var n = 1, l = parts.length; n < l; n += 5) {
    open = parts[n];
    type = parts[n + 1].replace('~', '');
    if (parts[n - 1].slice(-1) === '\\') { skipTag(parts, tree, n); continue; }
    if (type === '^~') { type = '^'; parts[n + 3] += '~'; }
    text = trim(parts[n + 4], parts[n + 3], parts[n + 6] || '');
    if (type[0] === '!') { tree.push({ text: text }); continue; }
    args = parts[n + 2].split(trims.whitespace);
    isPartial = type.indexOf('>') !== -1;
    isBlock = type.indexOf('#') !== -1;

    if (type === '/' && args[0] === templates[0] || type === '#*') {
      tree = inlineTemplate(_this, templates, tree, args, text); continue;
    } else if (type === '^' && !args[0]) { type = ''; args = ['else'] }
    else if (type === '^') args.unshift('unless');

    tree = buildTree(tree, type === '/' ? { close: args[0], text: text } : {
      block: isBlock || type === '^',
      partial: isPartial,
      alts: args[0] === 'else' ? !!args.shift() && null : [],
      helper: helper = helperTester[args[0]] ? args.shift() : '',
      vars: getVars(args.join(' '), [], isPartial, !!helper, strict),
      escape: open.lastIndexOf('{{') < 1 && !isPartial,
      text: isBlock ? '' : text,
      children: isBlock ? [{ text: text }] : [],
    });
  }
  if (tree.__parent) templateError();

  return tree;
}

}));
