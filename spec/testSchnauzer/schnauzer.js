/**! @license schnauzer v1.5.0; Copyright (C) 2017-2020 by Peter Dematté */
(function(root, factory) {
  if (typeof exports === 'object') module.exports = factory(root);
  else if (typeof define === 'function' && define.amd)
    define('schnauzer', [], function() { return factory(root); });
  else root.Schnauzer = factory(root);
}(this, function(root, undefined) { 'use strict';

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
  };
  initSchnauzer(this, options || {}, template);
};

var initSchnauzer = function(_this, options, template) {
  for (var option in options) {
    _this.options[option] = options[option];
  }
  options = _this.options;
  switchTags(_this, options.tags);
  _this.entityRegExp = new RegExp('[' + getKeys(options.entityMap).join('') + ']', 'g');
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

  _this.inlineRegExp = new RegExp(tgs[0] + '([>!&=])*\\s*([\\w\\' +
    chars + '\\.]+)\\s*([\\w' + chars + '|\\.\\s]*)' + tgs[1], 'g');
  _this.sectionRegExp = new RegExp(tgs[0] + '([#^][*%]*)\\s*([\\w' +
    chars + ']*)(?:\\s+([\\w$\\s|./' + chars + ']*))*' + tgs[1] +
    '((?:(?!' + tgs[0] + '[#^])[\\S\\s])*?)(' + blockEnd + ')', 'g');
  _this.elseSplitter = new RegExp(tgs[0] + '(?:else|^)\\s*(.*?)' + tgs[1]);
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

function findScope(scope, path) {
  for (var n = 0, l = path.length, out = [scope]; n < l; n++) {
    out.unshift(scope = scope[path[n]]);
  }
  return out;
}

function getScope(data, tag) {
  var tagScope = tag.scope;
  var scopes = [];

  if (tagScope === undefined || tagScope.variable === undefined) {
    return { result: undefined, extra: tag, scopes: [{
      scope: data,
      helpers: [],
    }]};
  }

  scopes = findScope(data.scopes[0].scope, tagScope.variable.path || []);
  for (var n = 0, l = scopes.length; n < l; n++) { // TODO: inside findScope
    scopes[n] = { scope: scopes[n], helpers: [] };
  }

  return {
    result: scopes[0].scope[tagScope.variable.value],
    extra: data.extra,
    scopes: concat([data.scopes[0]], scopes.splice(0, 1)),
  };
}

function renderInline(_this, tagData, model) {
  if (tagData.isPartial) { // partial // TODO: previous function??

  } // else helpers and regular stuff

  console.log(999, tagData, model);
  return model.result || '';
}

function renderBlock(_this, tagData, model, bodyFns) {
  var resultData = model.result;
  var ifHelper = tagData.helper === 'if' || tagData.helper === 'unless';
  var bodyFn = bodyFns[resultData ? 0 : 1];

  // console.log('---', model)
  console.log(bodyFns, bodyFn);
  if (ifHelper) {
    return bodyFn ? bodyFn.bodyFn(model) : '';
  } else if (tagData.helper) {
    return bodyFn ? bodyFn.bodyFn(model) : '';
  }
  if (isArray(model.data) || typeof model.data === 'object') {
    
  }
}

// ---- parse (pre-render) helpers

function trim(parts, start, end) {
  var regExp = '^\\s*|\\s*$';

  if (!start && !end) return parts;
  regExp = !start ? '\\s*$' : !end ? '^\\s*' : regExp;

  return parts.replace(new RegExp(regExp, 'g'), '');
}

function getTrims(start, end) {
  return [
    start.indexOf('~') !== -1 ? '~' : '',
    end.indexOf('~') !== -1 ? '~' : '',
  ];
}

function convertValue(text, obj) {
  if (text.charAt(0) === '"' || text.charAt(0) === "'") {
    obj.isString = true;
    return text.substr(1, text.length - 2);
  }
  return text === 'true' ? true : text === 'false' ? false : isNaN(text) ? text : +text;
}

function cleanText(text, obj) {
  return text.replace(/^(?:this|\.)?\/*/, function($) {
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
  var parts = isString ? text.split('../') : [];
  var pathParts = isString ? parts.pop().split(/[.\/]/) : [text];

  return !isString ? { value: text, isLiteral: true } : {
    name: name,
    value: pathParts.pop(),
    path: pathParts,
    parentDepth: parts.length,
  }
}

function getVar(item, isAlias) {
  var out = {
    variable: {},
    isAlias: isAlias,
    aliasKey: '',
    isString: false, // if value else variable
    isStrict: false,
    active: 0,
  };
  var split = [];

  item = cleanText(item, out).substr(out.active = getActiveState(item));
  if (item.charAt(0) === '(') {
    item = item.substr(1, item.length - 2);
    split = splitVars(item, []);
    out.variable = { scope: split.shift(), vars: processVars(split, []) };
    return out;
  }
  split = item.split('=');
  out.variable = split[1] ?
    parseScope(convertValue(split[1], out), split[0]) :
    parseScope(convertValue(split[0], out), '');

  return out;
}

function processVars(vars, collection) {
  var out = {};
  var isAs = false;
  var aliasKey = '';
  var hasAliasKey = false;

  for (var n = 0, l = vars.length; n < l; n++) {
    isAs = vars[n] === 'as';
    if (isAs && ++n) {
      aliasKey = (vars[n + 1] || '');
      hasAliasKey = aliasKey.charAt(aliasKey.length - 1) === '|';
    }
    out = getVar(vars[n], isAs);
    out.aliasKey = hasAliasKey && ++n ? cleanText(aliasKey) : '';
    collection.push(out);
  }

  return collection;
}

function getTagData(_this, scope, vars, type, start, bodyFn) {
  var varsArr = splitVars(scope + (vars ? ' ' + vars : ''), []);
  var _scope = varsArr.shift() || '';
  var helper = /if|each|with|unless/.test(_scope) ? _scope : '';
  var active = getActiveState(_scope = helper ? varsArr.shift() : _scope);

  return {
    scope: getVar(_scope.substr(active), false), // varsArr[0] === 'as',
    isPartial: type === '>',
    isNot: type === '^',
    isEscaped: start.lastIndexOf(_this.options.tags[0]) < 1,
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
    function($, start, type, scope, vars, end) {
      trims.push(getTrims(start, end));
      return /^(?:!|=)/.test(type || '') ? '' :
        tags.push(scope === '-block-' ? { blockIndex: +vars } :
          getTagData(_this, scope, vars, type || '', start)),
        _this.options.splitter;
     }
  ).split(_this.options.splitter);

  for (var n = glues.length; n--; ) glues[n] = trim(
    glues[n],
    trims[n - 1] ? trims[n - 1][1] : '',
    trims[n] ? trims[n][0] : ''
  );

  return function executeInlines(data, extra) {
    return loopInlines(_this, tags, glues, blocks, extra ?
      getScope(data, extra || []) : data);
  }
}

// ---- sizzle blocks

function processBodyParts(_this, body, bodyFns, blocks, mainTag) {
  var parts = body.split(_this.elseSplitter);
  var trims = [];
  var prevIf = '';
  var prevTrim = '';
  var vars = [];

  for (var n = 0, l = parts.length; n < l; n += 4) {
    prevIf = parts[2 + n - 4] || '';
    prevTrim = trims[1] || '';
    if (parts[1 + n]) trims = getTrims(parts[1 + n], parts[3 + n]);
    bodyFns.push(getTagData(
      _this,
      prevIf ? (vars = splitVars(prevIf, [])).shift() : '',
      vars.join(' '),
      '',
      n ? parts[1 + n - 4] || '' : mainTag,
      sizzleInlines(_this, trim(parts[n], prevTrim, trims[0]), blocks, []),
    ));
  }
}

function replaceBlock(_this, blocks, start, end, close, body, type, scope, vars) {
  var bodyFns = [];
  var isComment = type === '#*';
  var tagData = !isComment ? getTagData(_this, scope, vars, type || '', start) : {};
  var closeParts = close.split(scope);
  var trims = getTrims(end, closeParts[0]);

  if (isComment) {
    _this.partials[vars.replace(/['"]/g, '')] = sizzleBlocks(_this, body, []);
    return '';
  }
  processBodyParts(_this, trim(body, trims[0], trims[1]), bodyFns, blocks, start);
  blocks.push(function executeBlock(data) {
    return renderBlock(_this, tagData, getScope(data, tagData), bodyFns);
  });

  return (start + '-block- ' + (blocks.length - 1) + closeParts[1]);
}

function sizzleBlocks(_this, text, blocks) {
  var replaceCb = function($, start, type, scope, vars, end, body, _, close) {
    return replaceBlock(_this, blocks, start, end, close, body, type, scope, vars);
  };

  while (text !== (text = text.replace(_this.sectionRegExp, replaceCb)));

  return sizzleInlines(_this, text, blocks, []);
}

}));
