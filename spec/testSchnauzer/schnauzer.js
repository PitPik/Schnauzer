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
var getObjectKeys = Object.keys || function(obj) {
  var keys = [];
  for (var key in obj) obj.hasOwnProperty(key) && keys.push(key);
  return keys;
};
var cloneObject = function(obj, newObj) {
  for (var key in obj) newObj[key] = obj[key];
  return newObj;
}
var concatArrays = function(array, host) {
  for (var n = 0, l = array.length; n < l; n++) {
    host[host.length] = array[n];
  }
  return host;
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
    useHandlebarsScoping: true,
    render: null, // hook for shadow-DOM engines
  };
  initSchnauzer(this, options || {}, template);
};

var initSchnauzer = function(_this, options, template) {
  for (var option in options) _this.options[option] = options[option];
  options = _this.options;
  switchTags(_this, options.tags);
  _this.entityRegExp =
    new RegExp('[' + getObjectKeys(options.entityMap).join('') + ']', 'g');
  _this.helpers = options.helpers;
  _this.registerHelper('lookup', function() { /* TODO... */ });
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

function escapeHtml(string, _this, doEscape) {
  return doEscape ? String(string).replace(_this.entityRegExp, function(char) {
    return _this.options.entityMap[char];
  }) : string;
}

function createHelper(idx, key, len, value, extra) {
  var out = {
    '@index': idx,
    '@last': idx === len - 1,
    '@first': idx === 0,
    '@length': len,
    '@key': key,
    'this': value,
    '.': value,
  };
  if (extra) for (var n in extra)
    if (out[n] === undefined) out[n] = extra[n];

  return out;
}

function shiftScope(model, data, helpers) {
  var parentDepth = data.parentDepth;
  var path = data.path;
  var scopes = model.scopes;

  if (parentDepth && path.length && !scopes[0].scope[path[0]] && // TODO
    (scopes[0].helpers[path[0]] || model.extra[path[0]])) return scopes;
  
  scopes = concatArrays(model.scopes, []); // copy
  while (scopes.length && parentDepth--) scopes.shift();
  for (var n = 0, l = path.length, scope = scopes[0].scope; n < l; n++) {
    scope = scope[path[n]]; // skip: HBS scoping
    if (!data.skip || n) scopes.unshift({ scope: scope, helpers: helpers });
  }
  return scopes;
}

function getScope(data, tagData, isInline) {
  var tagRoot = tagData.root || {};
  var model = { extra: data.extra, scopes: data.scopes };

  return tagRoot.variable === undefined ?
    { extra: tagData, scopes: [{ scope: data, helpers: { '@root': data } }] } :
    { extra: data.extra, scopes: isInline ?
      data.scopes : shiftScope(model, tagRoot.variable || {}, {}) };
}

function getDeepData(data, mainVar) {
  for (var n = 0, l = mainVar.path.length; n < l; n++) {
    data = data[mainVar.path[n]];
    if (!data) return;
  }
  return data[mainVar.value];
}

function getHelperData(_this, model, root) { // TODO: integrate with other fns
  var key = root.variable.root;
  var data = { key: key, value: _this.helpers[key], type: 'helper' };
  var value = getValue(_this, data, model, { vars: root.variable.vars }, null);

  return { key: key, value: value, type: '' };
}

function getData(_this, model, root) {
  var variable =  root.variable;
  var scope = model.scopes && model.scopes[variable.parentDepth] || {};
  var scopeData = scope.scope || {};
  var key = variable.value;
  var helper = !root.isStrict && _this.helpers[key] || null;
  var partial = root.isPartial && _this.partials[key] || null;
  var tmp = '';
  var value = variable.root ? getHelperData(_this, model, root) : 
    root.isString || variable.isLiteral ? key :
    helper || partial || (scopeData[key] !== undefined ? scopeData[key] :
    (tmp = getDeepData(scopeData, variable)) !== undefined ? tmp :
    (tmp = getDeepData(scope.helpers || {}, variable)) !== undefined ? tmp : 
    getDeepData(model.extra || {}, variable));

  return {
    key: key || '',
    value: value,
    type: value === undefined ? '' : helper ? 'helper' : partial ? 'partial' :
      typeof value === 'object' ? 'object' : 'literal',
  };
}

function getValue(_this, data, model, tagData, bodyFn) {
  return data.type === 'helper' ?
    renderHelper(_this, data, model, tagData, [{bodyFn: bodyFn}]) : data.value;
}

function collectValues(_this, data, model, vars, carrier, coll) {
  for (var n = vars.length, item = {}, key = '', scp = null, iVar = ''; n--; ) {
    item = vars[n];
    iVar = item.variable;
    scp = !!iVar.root ? getValue(_this, data, model, iVar, null) : null;
    key = scp || item.isString || (iVar.isLiteral && !iVar.name) ? ('$' + n) :
      iVar.name || iVar.value;
    carrier[key] = scp || getData(_this, model, item).value;
    coll.push(carrier[key]);
    if (item.isAlias) model.scopes[0].helpers[key] = carrier[key];
  }
  return { obj: carrier, arr: coll };
}

function pushAlias(tagData, variable, obj, key, value) {
  if (tagData.hasAlias) {
    obj[variable.name || variable.value] = value;
    obj[tagData.root.aliasKey] = key;
  }
}

// ---- render blocks and inlines

function render(_this, tagData, model, isBlock, out) {
  return _this.options.render ?
    _this.options.render.call(_this, out, tagData, model, isBlock) : out;
}

function renderHelper(_this, data, model, tagData, bodyFns) {
  return escapeHtml(data.value.apply({
    name: data.key,
    getBody: function getBody() {
      return bodyFns[0] ? bodyFns[0].bodyFn(model) : '';
    },
    getAltBody: function getAltBody() { // TODO: check if ever available
      return bodyFns[1] ? bodyFns[1].bodyFn(model) : '';
    },
    escape: function escape(string) { return escapeHtml(string, _this, true) },
    scope: model.scopes[0].scope,
    rootScope: model.scopes[model.scopes.length - 1].scope,
    getData: function getIntData(key) {
      return getData(_this, model, getVar(key)).value;
    }},
    collectValues(_this, data, model, tagData.vars, {}, []).arr
  ), _this, !!bodyFns[0].escape);
}

function renderIfUnless(_this, data, model, tagData, bodyFns) {
  var idx = 0;
  var item = bodyFns[idx];
  var cond = !tagData.helper || tagData.helper === 'if' ? true : false;
  var result = false;
  var value = getValue(_this, data, model, tagData, item.bodyFn);

  while (!(result = cond && value || !cond && !value) && bodyFns[idx + 1]) {
    item = bodyFns[++idx];
    cond = !item.helper || item.helper === 'if' ? true : false;
    data = item.root ? getData(_this, model, item.root) : { value: cond };
    value = getValue(_this, data, model, item, item.bodyFn);
  }
  return result ? escapeHtml(item.bodyFn(model), _this, item.isEscaped) : '';
}

function renderEach(_this, data, model, tagData, bodyFn) {
  var out = '';
  var isArr = isArray(data.value);
  var _data = isArr ? data.value || [] : getObjectKeys(data.value || {});
  var helpers = cloneObject(model.scopes[0].helpers, {});
  var variable = tagData.root.variable;
  var depth = _this.options.useHandlebarsScoping ? 1 : 2; // Whaaaat? bad HBS

  for (var n = 0, l = _data.length, key = ''; n < l; n++) {
    key = isArr ? n : _data[n];
    pushAlias(tagData, variable, helpers, key, data.value);
    model.scopes = shiftScope(
      model,
      { parentDepth: n ? depth : 0, path: [data.key, key], skip: depth === 1 },
      createHelper(n, key, l, isArr ? _data[n] : data.value[key], helpers)
    );
    out += bodyFn.bodyFn(model);
  }
  return escapeHtml(out, _this, bodyFn.isEscaped);
}

function renderWith(_this, data, model, tagData, bodyFn) {
  var helpers = cloneObject(model.scopes[0].helpers, {});
  var variable = tagData.root.variable;

  pushAlias(tagData, variable, helpers, variable.value, data.value);
  model.scopes = shiftScope(model, {parentDepth: 0, path: [data.key]}, helpers);

  return escapeHtml(bodyFn.bodyFn(model), bodyFn.isEscaped);
}

function renderInline(_this, tagData, model) {
  var data = getData(_this, model, tagData.root);
  var out = '';

  if (tagData.isPartial) {
    if (!data.value) return '';
    collectValues(_this, data, model, tagData.vars, model.scopes[0].helpers,[]);
    out = data.value(model);
  } else {
    out = data.type === 'helper' ?
      renderHelper(_this, data, model, tagData, []) :
      data.value !== undefined ? data.value : '';
    }
  return render(_this, tagData, model, false,
    escapeHtml(out, _this, tagData.isEscaped));
}

function renderInlines(_this, tags, glues, blocks, data) {
  for (var n = 0, l = glues.length, out = ''; n < l; n++) {
    out += glues[n];
    if (!tags[n]) continue;
    out += tags[n].blockIndex > -1 ? blocks[tags[n].blockIndex](data) :
      renderInline(_this, tags[n], getScope(data, tags[n], true));
  }
  return out;
}

function renderBlock(_this, tagData, model, bodyFns) {
  var data = getData(_this, model, tagData.root);
  var helper = tagData.helper;
  var ifHelper = helper === 'if' || helper === 'unless';
  var isHelperFn = data.type === 'helper' || isFunction(data.type);
  var bodyFn = bodyFns[0];

  return render(_this, tagData, model, true, ifHelper ?
    renderIfUnless(_this, data, model, tagData, bodyFns) : isHelperFn ?
    renderHelper(_this, data, model, tagData, bodyFns) :
    helper === 'with' ? renderWith(_this, data, model, tagData, bodyFn) :
    renderEach(_this, data, model, tagData, bodyFn));
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

function convertValue(text, obj) {
  if (text.charAt(0) === '"' || text.charAt(0) === "'") {
    obj.isString = true;
    return text.substr(1, text.length - 2);
  }
  if (/\.|\|/.test(text)) obj.isStrict = true;
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
    if (match) collection.push(match); // TODO: regexp
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

function getVar(item) {
  var split = [];
  var out = {
    variable: {},
    isAlias: false,
    aliasKey: '',
    isString: false, // if value else variable
    isStrict: false,
    active: 0,
  };

  item = cleanText(item, out).substr(out.active = getActiveState(item));
  if (item.charAt(0) === '(') {
    item = item.substr(1, item.length - 2);
    split = splitVars(item, []);
    return { variable: {
      root: split.shift(), vars: processVars(split, [], {}), path: []
    }};
  }
  split = item.split('='); // item.split(/([=!<>]+)/);
  out.variable = split[1] ?
    parseScope(convertValue(split[2], out), split[0]) :
    parseScope(convertValue(split[0], out), '');
  return out;
}

function processAlias(out, vars, n, key) { // TODO: clean up
  if (vars[n] === '|') n++;
  key = vars[n + 1] || '';
  key = key.indexOf('|') !== -1 || vars[n + 2] === '|' ? cleanText(key) : '';
  out.variable.name = cleanText(vars[n]);
  out.aliasKey = key;
  out.isAlias = true;
  if (vars[n + 2] === '|') n++;
  if (key) n++;
  return n;
}

function processVars(vars, collection, root) {
  var out = root || {};

  for (var n = 0, l = vars.length; n < l; n++) {
    if (vars[n] === 'as') {
      n = processAlias(out, vars, ++n, '');
      continue;
    }
    out = getVar(vars[n]);
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
  var root = getVar(_root.substr(active));

  return bodyFn && !_root ? { bodyFn: bodyFn, isEscaped: isEscaped } : {
    root: root,
    isPartial: type === '>',
    isNot: type === '^',
    isEscaped: isEscaped,
    hasAlias: varsArr[0] === 'as',
    helper: helper,
    vars: processVars(varsArr, [], root),
    active: active,
    bodyFn: bodyFn || null,
  };
}

// ---- sizzle inlines

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
    return renderInlines(_this, tags, glues, blocks, data);
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
      sizzleInlines(_this, trim(parts[n], prevTrim, trims[0]), blocks, [])
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
