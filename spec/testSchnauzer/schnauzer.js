/**! @license schnauzer v1.5.0; Copyright (C) 2017-2020 by Peter Dematté */
(function(root, factory) {
  if (typeof exports === 'object') module.exports = factory(root);
  else if (typeof define === 'function' && define.amd)
    define('schnauzer', [], function() { return factory(root); });
  else root.Schnauzer = factory(root);
}(this, function(root, undefined) { 'use strict';

var isFunction = function(obj) {
  return obj && obj.constructor === Function;
};
var isArray = Array.isArray || function(obj) {
  return obj && obj.constructor === Array;
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
    doEscape: true,
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
  _this.helperRegExp = /if|each|with|unless/;
  _this.entityRegExp = new RegExp(
    '[' + getKeys(options.entityMap).join('') + ']', 'g'
  );
  _this.helpers = options.helpers;
  for (var name in options.partials) {
    _this.registerPartial(name, options.partials[name]);
  }
  if (template) _this.registerPartial(options.self, template);
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
  _this.elseSplitter = new RegExp(_tags[0] + 'else' + _tags[1]);
}

// ---- render helpers

function escapeHtml(string, _this) {
  return String(string).replace(_this.entityRegExp, function(char) {
    return _this.options.entityMap[char];
  });
}

function getScope(data, extra) {
  return data;
}

// ---- parse (pre-render) helpers

function stripString(text, obj, key) {
  if (text.charAt(0) === "'" || text.charAt(0) === '"') {
    obj[key] = true;
    text = text.substr(1, text.length - 2);
  }
  return text;
}

function parseScope(text) {
  var parts = text.replace('this.', '').split('../');
  var pathParts = parts.pop().split('.');

  return {
    name: pathParts.pop(),
    path: pathParts,
    parentDepth: parts.length,
  }
}

function getVar(item, isAlias) {
  var out = {
    name: '',
    value: [],
    valueIsNumber: false,
    valueIsString: false,
    active: false,
    isString: false,
    isAlias: !!isAlias,
    aliasKey: '',
  };
  var splitItem = [];

  out.active = item.charAt(1) === '%' ? 2 : item.charAt(0) === '%' ? 1 : 0;
  item = item.substr(out.active);
  item = stripString(item, out, 'isString');
  splitItem = item.split('=');
  out.value = parseScope(stripString(splitItem[1] || '', out, 'valueIsString'));
  out.valueIsNumber = out.value ? out.value == +out.value : false;
  out.name = splitItem[0];

  return out;
}

function processVars(vars, simple) {
  var collection = [];
  var out = {};
  var isAs = false;
  var aliasKey = '';
  var hasAliasKey = false;

  for (var n = 0, l = vars.length; n < l; n++) {
    isAs = vars[n] === 'as';
    if (isAs) {
      n++;
      aliasKey = vars[n + 1] || '';
      hasAliasKey = aliasKey.charAt(aliasKey.length - 1) === '|';
    }
    vars[n] = vars[n].replace(/\|/g, '');
    out = simple ? { name: vars[n] } : getVar(vars[n], isAs);
    out.aliasKey = aliasKey.replace('|', '');
    collection.push(out);

    if (isAs) { // skip 'as' and 'aliasKey'
      if (hasAliasKey) n++;
      continue;
    }
  }
  return collection;
}

function processTagData(_this, scope, vars, type, start) {
  var helper = scope.match(_this.helperRegExp) ? scope : '';
  var varsArr = vars ? vars.split(/\s+/) : [];
  var active = 0;
  var isHelper = false;
  var isPartial = false;
  var isBlock = false;

  scope = helper ? varsArr.shift() : scope;
  active = scope.charAt(1) === '%' ? 2 : scope.charAt(0) === '%' ? 1 : 0;
  scope = scope.substr(active);
  isBlock = scope === '-block-';
  isHelper = !!_this.helpers[scope];
  isPartial = type === '>' && !!_this.partials[scope];

  return { // tag description
    isHelper: isHelper,
    isPartial: isPartial,
    isBlock: isBlock,
    isNot: type === '^',
    isEscaped: start !== '{{{',
    hasAlias: varsArr[0] === 'as',

    helper: helper,
    scope: parseScope(scope),
    vars: processVars(varsArr, isBlock || isHelper || isPartial),
    blockIndex: isBlock ? +varsArr[0] : -1,
    active: active,
  };
}

// ---- inlines

function renderInline(_this, tagdData, glues, blocks, data, extra) {
  for (var n = 0, l = glues.length; n < l; n++) {
    if (!tagdData[n]) continue;

    // console.log(tagdData);
    if (tagdData[n].isBlock) {
      blocks[tagdData[n].blockIndex](data, extra);
    }
  }
  return 'renderInline';
}

function replaceInline(_this, start, type, scope, vars, tagdData) {
  var _type = type || '';
  var skip = /^(?:!|=)/.test(_type);

  !skip && tagdData.push(processTagData(_this, scope, vars, _type, start));

  return skip ? '' : _this.options.splitter;
}

function sizzleInlines(_this, text, blocks, tagdData) {
  var glues = text.replace(
    _this.inlineRegExp,
    function(all, start, type, scope, vars) {
      return replaceInline(_this, start, type, scope, vars, tagdData);
    },
  ).split(_this.options.splitter);

  return function(data, extra) {
    return renderInline(_this, tagdData, glues, blocks, data, extra);
  }
}

// ---- blocks

function renderBlock(_this, tagdData, bodyFns, data, extra) {
  console.log(tagdData);
  return bodyFns[0](data, extra);
}

function replaceBlock(_this, blocks, start, type, scope, vars, body) {
  var tags = _this.options.tags;
  var partialName = '';
  var bodyParts = [];

  if (type === '#*') {
    partialName = vars.replace(/['"]/g, '');
    _this.partials[partialName] = _this.partials[partialName] ||
      sizzleBlocks(_this, body, blocks);
    return '';
  }

  bodyParts = body.split(_this.elseSplitter);
  blocks.push(function(data, extra) {
    return renderBlock(
      _this,
      processTagData(_this, scope, vars, type || '', start),
      [ sizzleInlines(_this, bodyParts[0], blocks, []),
        bodyParts[1] && sizzleInlines(_this, bodyParts[1], blocks, []) ],
      data,
      extra
    );
  });

  return (tags[0] + '-block- ' + (blocks.length - 1) + tags[1]);
}

function sizzleBlocks(_this, text, blocks) {
  var tmpResult = '';
  var final = function() {};
  var replace = function(all, start, type, scope, vars, end, body) {
    return replaceBlock(_this, blocks, start, type, scope, vars, body);
  };

  while (tmpResult !== text && (tmpResult = text)) {
    text = text.replace(_this.sectionRegExp, replace);
  }
  final = sizzleInlines(_this, text, blocks, []);

  return function executor(data, extra) {
    return final(getScope(data, extra && (isArray(extra) && extra || [extra])));
  };
}

}));