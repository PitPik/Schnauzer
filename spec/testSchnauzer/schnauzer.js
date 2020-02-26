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
  _this.entityRegExp = new RegExp(
    '[' + getKeys(options.entityMap).join('') + ']', 'g'
  );
  _this.helpers = options.helpers;
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

  if (tagScope === undefined || tagScope.name === undefined) {
    return { result: undefined, extra: tag, scopes: [{
      scope: data,
      helpers: [],
    }]};
  }

  scopes = findScope(data.scopes[0].scope, tagScope.path);
  for (var n = 0, l = scopes.length; n < l; n++) { // TODO: inside findScope
    scopes[n] = { scope: scopes[n], helpers: [] };
  }

  return {
    result: scopes[0].scope[tagScope.value],
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

  // console.log(tagData.scope, model);
  if (ifHelper) {
    return bodyFn ? bodyFn(model) : '';
  } else if (tagData.helper) {
    return bodyFn ? bodyFn(model) : '';
  }
  if (isArray(model.data) || typeof model.data === 'object') {
    
  }
}

// ---- parse (pre-render) helpers

function trimParts(parts, start, end) {
  var regExp = [];

  start && regExp.push('^\\s*')
  end && regExp.push('\\s*$');

  return regExp.length === 0 ? parts :
    parts.replace(new RegExp(regExp.join('|'), 'g'), '');
}

function getWhites(start, end, close, tags) {
  return [
    start.indexOf('~') !== -1 ? '~' : '',
    end.indexOf('~') !== -1 ? '~' : '',
    close.indexOf(tags[0] + '~') !== -1 ? '~' : '',
    close.indexOf('~' + tags[1]) !== -1 ? '~' : ''
  ];
}

function convertString(text, obj) {
  if (text.charAt(0) === '"') { // || text.charAt(0) === "'"
    obj.isString = true;
    return text.substr(1, text.length - 2);
  }
  return text === 'true' ? true : text === 'false' ? false :
    isNaN(text) ? text : +text;
}

function cleanText(text) {
  return text.replace(/^(?:this|\.)?\//, '').replace(/[[\]|]/g, '');
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

  return {
    name: name,
    value: pathParts.pop(),
    path: pathParts,
    parentDepth: parts.length,
  }
}

function getVar(item, isAlias) {
  var out = {
    variable: '',
    isAlias: isAlias,
    aliasKey: '',
    active: 0,
    isString: false, // if value else variable
    innerScope: {},
  };
  var split = [];

  item = item.substr(out.active = getActiveState(item));
  if (item.charAt(0) === '(') {
    item = item.substr(1, item.length - 2);
    out.innerScope = processVars(splitVars(item, []), []);
    return out;
  }
  split = item.split('=');
  out.variable = split[1] ?
    parseScope(convertString(split[1], out), split[0]) :
    parseScope(convertString(split[0], out), '');

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
    vars[n] = cleanText(vars[n]);
    out = getVar(vars[n], isAs);
    out.aliasKey = hasAliasKey && ++n ? cleanText(aliasKey) : '';
    collection.push(out);
  }

  return collection;
}

function getTagData(scope, vars, type, start) {
  var helper = /if|each|with|unless/.test(scope) ? scope : '';
  var varsArr = splitVars(vars, []);
  var active = getActiveState(scope = helper ? varsArr.shift() : scope);

  return scope === '-block-' ? { blockIndex: +varsArr[0] } : {
    scope: parseScope(scope.substr(active), ''),
    isPartial: type === '>',
    isNot: type === '^',
    isEscaped: start !== '{{{',
    hasAlias: varsArr[0] === 'as',
    helper: helper,
    vars: processVars(varsArr, []),
    active: active,
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
  var whites = [];
  var glues = text.replace(
    _this.inlineRegExp,
    function($, start, type, socpe, vars, end) {
      whites.push(getWhites(start, end, '', _this.options.tags));
      return /^(?:!|=)/.test(type || '') ? '' :
        tags.push(getTagData(socpe, vars, type || '', start)),
        _this.options.splitter;
    }
  ).split(_this.options.splitter);

  for (var n = glues.length; n--; ) {
    if (whites[n]) {
      glues[n] = trimParts(glues[n], '', whites[n][0]);
      glues[n + 1] = trimParts(glues[n + 1], whites[n][1], '');
    }
  }

  return function executeInlines(data, extra) {
    return loopInlines(_this, tags, glues, blocks, extra ?
      getScope(data, extra || []) : data);
  }
}

// ---- sizzle blocks

function replaceBlock(_this, blocks, start, type, scope, vars, body, end, close) {
  var tags = _this.options.tags;
  var parts = [];
  var tagData = {};
  var whites = [];
  var elseWhites = [];

  if (type === '#*') {
    _this.partials[vars.replace(/['"]/g, '')] = sizzleBlocks(_this, body, []);
    return '';
  }
  
  whites = getWhites(start, end, close, tags);
  parts = trimParts(body, whites[1],  whites[2]).split(_this.elseSplitter);
  elseWhites = getWhites(parts[1] || '', parts[3] || '', '', tags);
  parts[0] = trimParts(parts[0], '', elseWhites[0]);
  parts[4] && (parts[4] = trimParts(parts[4], elseWhites[1], ''));
  parts = [ sizzleInlines(_this, parts[0], blocks, []),
    parts[4] && sizzleInlines(_this, parts[4], blocks, []) || null ];

  tagData = getTagData(scope, vars, type || '', start);
  blocks.push(function executeBlock(data) {
    return renderBlock(_this, tagData, getScope(data, tagData), parts);
  });
  return (tags[0] + whites[0] + '-block- ' + (blocks.length - 1) + whites[3] + tags[1]);
}

function sizzleBlocks(_this, text, blocks) {
  var replaceCb = function($, start, type, socpe, vars, end, body, _, close) {
    return replaceBlock(_this, blocks, start, type, socpe, vars, body, end, close);
  };

  while (text !== (text = text.replace(_this.sectionRegExp, replaceCb)));

  return sizzleInlines(_this, text, blocks, []);
}

}));
