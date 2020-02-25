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
  var _tags = tags[0] === '{{' ? ['{{2,3}', '}{2,3}'] : tags;
  var chars = _this.options.characters + '\\][';

  _this.inlineRegExp = new RegExp('(' + _tags[0] + ')([>!&=])*\\s*([\\w\\' +
    chars + '\\.]+)\\s*([\\w' + chars + '|\\.\\s]*)' + _tags[1], 'g');
  _this.sectionRegExp = new RegExp('(' + _tags[0] + ')([#^][*%]*)\\s*([\\w' +
    chars + ']*)(?:\\s+([\\w$\\s|./' + chars + ']*))*(' +
    _tags[1] + ')((?:(?!' + _tags[0] + '[#^])[\\S\\s])*?)\\1\\/\\3\\5', 'g');
  _this.elseSplitter = new RegExp(_tags[0] + '(?:else|^)' + _tags[1]);
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
    result: scopes[0].scope[tagScope.name],
    extra: data.extra,
    scopes: concat([data.scopes[0]], scopes.splice(0, 1)),
  };
}

function renderInline(_this, tagData, model) {
  if (tagData.isPartial) { // partial // TODO: previous function??

  } // else helpers and regular stuff

  console.log(999, tagData.scope, model);
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

function getActiveState(text) {
  return text.charAt(1) === '%' ? 2 : text.charAt(0) === '%' ? 1 : 0;
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

function splitVars(text, collection) {
  if (!text) return collection;
  text.replace(/\(.*?\)|(?:\S*?"(?:\\.|[^\"])*\")|\S+/g, function(match) {
    if (match) collection.push(match);
  });
  return collection;
}

function parseScope(text, name) {
  if (typeof text !== 'string') return {
    name: name, value: text, path: [], parentDepth: 0
  };
  var parts = text.split('../');
  var pathParts = parts.pop().split(/[.\/]/);

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

  out.active = getActiveState(item);
  item = item.substr(out.active);
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
    scope: parseScope(scope.substr(active)),
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
  var glues = text.replace(
    _this.inlineRegExp,
    function(all, start, type, scope, vars) {
      return /^(?:!|=)/.test(type || '') ? '' :
        tags.push(getTagData(scope, vars, type || '', start)),
        _this.options.splitter;
    }
  ).split(_this.options.splitter);

  return function executeInlines(data) {
    return loopInlines(_this, tags, glues, blocks, data);
  }
}

// ---- sizzle blocks

function replaceBlock(_this, blocks, start, type, scope, vars, body) {
  var tags = _this.options.tags;
  var partialName = '';
  var parts = [];
  var tagData = {};

  if (type === '#*') {
    partialName = vars.replace(/['"]/g, '');
    _this.partials[partialName] = _this.partials[partialName] ||
      sizzleBlocks(_this, body, []); // or blocks??
    return '';
  }

  parts = body.split(_this.elseSplitter);
  parts = [ sizzleInlines(_this, parts[0], blocks, []),
    parts[1] && sizzleInlines(_this, parts[1], blocks, []) || null ];
  tagData = getTagData(scope, vars, type || '', start);
  blocks.push(function executeBlock(data) {
    return renderBlock(_this, tagData, getScope(data, tagData), parts);
  });

  return (tags[0] + '-block- ' + (blocks.length - 1) + tags[1]);
}

function sizzleBlocks(_this, text, blocks) {
  var finalInlinesFn = {};
  var replaceCb = function(all, start, type, scope, vars, end, body) {
    return replaceBlock(_this, blocks, start, type, scope, vars, body);
  };

  while (text !== (text = text.replace(_this.sectionRegExp, replaceCb)));
  finalInlinesFn = sizzleInlines(_this, text, blocks, []);

  return function executeAll(data, extra) {
    return finalInlinesFn(getScope(data, extra || []));
  };
}

}));
