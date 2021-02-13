/**! @license schnauzer v1.6.0; Copyright (C) 2017-2021 by Peter Dematté */
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
var cloneObject = function(obj, newObj) {
  var fn = function(obj, newObj, key) { newObj[key] = obj[key] };
  for (var key in obj) fn(obj, newObj, key);
  return newObj;
};
var concatArrays = function(array, host) {
  for (var n = 0, l = array.length; n < l; n++) host[host.length] = array[n];
  return host;
};

var Schnauzer = function(template, options) {
  this.version = '1.6.0';
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
    renderHook: null,
  };
  initSchnauzer(this, options || {}, template);
};

var initSchnauzer = function(_this, options, template) {
  options = cloneObject(options, _this.options);
  switchTags(_this, options.tags);
  _this.regexps.entity =
    new RegExp('[' + getObjectKeys(options.entityMap).join('') + ']', 'g');
  _this.helpers = options.helpers;
  for (var name in options.partials)
    _this.registerPartial(name, options.partials[name]);
  if (template) _this.parse(template);
};

Schnauzer.prototype = {
  render: function(data, extra) {
    var helpers = createHelper('', '', 0, data, {});
    return this.partials[this.options.self]({
      extra: extra || {},
      scopes: [{ scope: data, helpers: helpers, level: { '@root': data } }],
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
  escapeExpression: function(txt) { return escapeHtml(this, txt, true) }
};

return Schnauzer;

function switchTags(_this, tags) {
  var tgs = tags[0] === '{{' ? ['({{2,3}~*)', '(~*}{2,3})'] : tags;
  var chars = _this.options.nameCharacters + '!-;=?@[-`|';
  var blockEnd = (tgs[0] + '\\/\\3' + tgs[1]).replace(/[()]/g, '');

  _this.regexps.inline = new RegExp(tgs[0] + '([>!&=])*\\s*([\\w\\' +
    chars + '<>|\\.\\s]*)' + tgs[1], 'g');
  _this.regexps.block = new RegExp(tgs[0] + '([#^][*%]*)\\s*([\\w' +
    chars + '<>~]*)(?:\\s+([\\w$\\s|.\\/' + chars + ']*))*' + tgs[1] +
    '(?:\\n*)((?:(?!' + tgs[0] + '[#])[\\S\\s])*?)(' + blockEnd + ')', 'g');
  _this.regexps.else = new RegExp(tgs[0] + '(?:else|\\^)\\s*(.*?)' + tgs[1]);
}

// ---- render data helpers

function escapeHtml(_this, string, doEscape) {
  return doEscape && _this.options.escapeHTML ?
    String(string).replace(_this.regexps.entity, function(char) {
      return _this.options.entityMap[char];
    }) : string;
}

function createHelper(idx, key, len, value, parent) {
  return {
    '@index': +idx,
    '@last': +idx === len - 1,
    '@first': +idx === 0,
    '@length': len,
    '@parent': parent,
    '@key': key,
    'this': value,
    '.': value,
  };
}

function setSimpleHelper(model, data) {
  model.scopes[0].helpers = createHelper('', '', 0, data, model.scopes[1]);
}

function shiftScope(scopes, data, helpers, level) {
  level = cloneObject(scopes[0].level, level);
  return concatArrays(scopes, [{scope: data, helpers: helpers, level: level}]);
}

function getDeepData(scope, mainVar, getParent) {
  if (!mainVar.path) return mainVar.value;
  for (var n = 0, l = mainVar.path.length; n < l; n++) {
    scope = scope[mainVar.path[n]];
    if (!scope) return;
  }
  return getParent ? scope : scope && scope[mainVar.value];
}

function getData(_this, model, tagData) {
  if (!tagData || !tagData.vars) return [];
  if (!tagData.helper && _this.helpers[tagData.vars[0].orig])
    tagData.helper = tagData.vars.shift();
  for (var n = 0, l = tagData.vars.length, main = {}, scope = {}, value = '',
      out = []; n < l; n++) {
    main = tagData.vars[n];
    scope = model.scopes[main.depth || 0] || {};
    value = getDeepData(scope.scope || {}, main);
    if (main.helper) {
      value = renderHelper(_this, getData(_this, model, main), model, main);
    } else if (main.name && tagData.helperFn) {
      scope.level[main.name] = main.value;
    } else if (!main.depth) {
      value = (!main.name && scope.scope[value]) /* funky strings */ ||
        getDeepData(scope.level, main) || value;
    }
    if (value === undefined || value === '.' || value === 'this') {
      value = scope.helpers[main.value];
    }
    if (value === undefined) value = model.extra[main.orig];
    out.push({
      value: value === undefined ? '' : value,
      alias: main.alias,
      type: value && value.constructor === Array ? 'array' : typeof value,
      name: main.name,
    });
  }
  return out;
}

function getOptions(_this, model, tagData, data, newData, bodyFns) {
  var noop = function noop() { return ''; };
  var name = tagData.helper ? tagData.helper.orig : '';
  var options = { name: name, hash: {}, data: {
    root: model.scopes[model.scopes.length - 1].scope,
  }};

  for (var n = data.length; n--; ) {
    if (data[n].name) options.hash[data[n].name] = data[n].value;
    else newData.unshift(data[n].value);
  }
  options.escapeExpression = _this.escapeExpression;
  if (bodyFns) {
    options.fn = bodyFns[0].bodyFn;
    options.inverse = bodyFns[1] && bodyFns[1].bodyFn || noop;
  }
  return options;
}

function getHelperFn(_this, model, tagData) {
  var scope = model.scopes[tagData.helper.depth || 0].scope;
  var helperFn = _this.helpers[tagData.helper.orig];

  return tagData.helperFn || (tagData.helper.isStrict || !helperFn ?
    getDeepData(scope, tagData.helper) : helperFn);
}

// ---- render blocks/inlines helpers (std. HBS helpers)

function renderHelper(_this, data, model, tagData, bodyFns, track) {
  var scope = model.scopes[(data[0] || {}).depth || 0].scope;
  var helper = getHelperFn(_this, model, tagData);
  var helperFn = !tagData.helper && bodyFns &&
    (data[0] ? renderConditions : undefined) || tagData.helperFn;
  var newData = [];

  if (helperFn) return helperFn(_this, data, model, tagData, bodyFns, track);
  newData.push(getOptions(_this, model, tagData, data, newData, bodyFns));
  return helper ? helper.apply(scope, newData) : '';
}

function renderPartial(_this, data, model, tagData) {
  var partial = _this.partials[tagData.partial.orig];
  var main = {};
  var shift = false;

  for (var n = 0, l = data.length; n < l; n++) {
    main = data[n];
    if (n === 0 && !main.name) {
      model.scopes = shiftScope(model.scopes, data[0].value, {}, {});
      shift = true;
    } else if (main.name) {
      model.scopes[0].level[main.name] = data[n].value;
    }
  }
  return [ partial ? partial(model) : '', shift && model.scopes.shift(),
    !shift && main.name && delete model.scopes[0].level[main.name] ][0];
}

function renderConditions(_this, data, model, tagData, bodyFns, track) {
  var idx = 0;
  var bodyFn = bodyFns[idx];
  var helper = tagData.helper;
  var cond = /^(?:if|each|with)$/.test(helper);
  var isVarOnly = !helper && data.length === 1;
  var main = data[0] || {};
  var value = main.value;
  var canGo = ((cond || isVarOnly) && value) || (helper === 'unless' && !value);
  var shift = false;
  var isInverse = false;
  var isIfUnless = false;
  var isLoop = false;

  while (bodyFns[idx + 1] && !canGo) {
    bodyFn = bodyFns[++idx];
    helper = bodyFn.helper;
    cond = /^(?:if|each|with)$/.test(helper);
    data = bodyFn.vars.length ? getData(_this, model, bodyFn) : [];
    isVarOnly = !helper && data.length === 1;
    main = data[0] || {};
    value = main.value;
    canGo = ((cond || isVarOnly) && value) || (helper === 'unless' && !value) ||
      (!helper && !data.length); // represents else
  }
  track.fnIdx = idx;
  isInverse = helper === 'unless' || (!data.length && bodyFn.bodyFn);
  isIfUnless = helper === 'if' || isInverse;
  isLoop = helper === 'each' || (!isIfUnless && main.type === 'array');
  if (helper === 'with' || isLoop) {
    shift = true;
    model.scopes = shiftScope(model.scopes, main.value, {}, {});
    if (main.alias && !isLoop) model.scopes[0].level[main.alias[0]] = value;
    if (isLoop) {
      return main.type === 'array' || main.type === 'object' ?
        renderEach(_this, main.value, model, bodyFn.bodyFn, main.alias) : '';
    }
  }
  setSimpleHelper(model, isVarOnly ? value : model.scopes[0].scope);
  return [canGo ? bodyFn.bodyFn(model) : '', shift && model.scopes.shift()][0];
}

function renderEach(_this, data, model, bodyFn, alias) {
  var scope = model.scopes[0];
  var out = '';
  var executor = function(n) {
    scope.helpers = createHelper(n, n, data.length, data[n], data);
    scope.scope = data[n];
    if (alias) { scope.level[alias[0]] = data[n]; scope.level[alias[1]] = n; }
    out += bodyFn(model);
  };

  for (var n in data) executor(n);
  return [ out, model.scopes.shift() ][0];
}

// ---- render blocks and inlines; delegations only

function render(_this, model, data, tagData, isBlock, out,
    renderFn, bodyFns, track) {
  return !_this.options.renderHook ? out : _this.options.renderHook.call(
    _this, out, data, tagData, model, isBlock, track || {fnIdx: 0}, function() {
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

  return render(_this, model, data, tagData, false, out, renderInline, null);
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
  var track = recursive || { fnIdx: 0 };
  var value = renderHelper(_this, data, model, tagData, bodyFns, track);

  return recursive ? value : render(_this, model, data, tagData, true,
    value, renderBlock, bodyFns, track);
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
  var name = text.replace(/[[\]]/g, ''); // HB
  var parts = skip ? [] : name.split('../');
  var depth = parts.length - 1;
  var value = skip ? name : parts[depth];

  if (skip || value === '.' || value === 'this') return { value: value };
  parts = cleanText(value, data).split(/[./]/);
  return { value: parts.pop(), path: parts, depth: depth, name: name };
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
  var parts = [];
  var value = '';
  var data = {};
  var paths = {};

  for (var n = 0, l = txtParts.length; n < l; n++) {
    parts = txtParts[n].split('=');
    value = parts[1] !== undefined ? parts[1] : parts[0];
    if (value === '' || value === 'as') continue;

    data = collection[(value.match(/--(\d+)--/) || [])[1]] || { value: value };
    if (parts[1] !== undefined) data.name = parts[0];
    if (data.type === 'string') {
      data.value = data.value[0].value;
      delete data.type;
    } else if (data.value && typeof data.value === 'string') {
      data.value = data.value.replace(/%+/, function($) {
        data.active = $.length; return '';
      });
      paths = parsePath(data.value, data, isAliasOrString);
      data.value = convertValue(paths.value, isAliasOrString || !paths.path);
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
    value.value = getVars($.substring(1, $.length - 1), out, [], value.type);
    return '--' + (out.push(value) - 1) + '--';
  });
  while (text !== (text = text.replace(/\([^()]*\)/g, function($) {
    var value = { vars: getVars($.substring(1, $.length - 1), out, [], 'fn') };
    if (value.vars.length > 1) value.helper = value.vars.shift();
    return '--' + (out.push(value) - 1) + '--';
  })));
  return getVars(text, out, [], '');
}

function getTagData(_this, vars, type, start, bodyFn) {
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
      getTagData(_this, vars, parts[2 + n] || '', parts[1 + n], null));
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
