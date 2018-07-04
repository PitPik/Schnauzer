/**! @license schnauzer v1.0.00; Copyright (C) 2017-2018 by Peter Dematté */
(function defineSchnauzer(root, factory) {
  if (typeof exports === 'object') module.exports = factory(root);
  else if (typeof define === 'function' && define.amd) define('schnauzer', [],
    function () { return factory(root); });
  else root.Schnauzer = factory(root);
}(this, function SchnauzerFactory(root, undefined, help) { 'use strict';
// Schnauzer 4.72 KB, 2.17 KB, Mustage 5.47 KB, 2.26 KB, Handlebars 74.20 KB, 21.86 KB
var Schnauzer = function(template, options) {
    this.version = '1.0.0';
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
      recursion: 'self',
      characters: '$"<>%-=@',
      splitter: '|##|'
    };
    init(this, options || {}, template);
  },
  init = function(_this, options, template) {
    for (var option in options) {
      _this.options[option] = options[option];
    }
    help = 1; // counter helper for nestings
    options = _this.options;
    _this.entityRegExp = (function(entityMap, output){
      for (var symbol in entityMap) {
        output += symbol;
      }
      return new RegExp('[' + output + ']', 'g');
    })(options.entityMap, []);
    _this.stopRegExp = new RegExp(/^°+/);
    switchTags(_this, options.tags);
    _this.partials = {};
    for (var name in options.partials) {
      _this.registerPartial(name, options.partials[name]);
    }
    template && _this.registerPartial(options.recursion, template);
  };

Schnauzer.prototype = {
  render: function(data, extra) {
    return this.partials[this.options.recursion](data, extra);
  },
  parse: function(html) {
    return this.partials[this.options.recursion] ||
      this.registerPartial(this.options.recursion, html);
  },
  registerHelper: function(name, fn) {
    this.options.helpers[name] = fn;
  },
  unregisterHelper: function(name) {
    delete this.options.helpers[name];
  },
  registerPartial: function(name, html) {
    return this.partials[name] = sizzleTemplate(this, html);
  },
  unregisterPartial: function(name) {
    delete this.options.partials[name];
  },
  setTags: function(tags) {
    switchTags(this, tags);
  },
};

return Schnauzer;

function switchTags(_this, tags) {
  var _tags = _this.options.tags = tags[0] === '{{' ? ['{{2,3}', '}{2,3}'] : tags,
    chars = _this.options.characters;

  _this.variableRegExp = new RegExp('(' + _tags[0] + ')' +
    '([>!&=]\\s*)*([\\w\\'+ chars + '\\.\\s*]+)*' + _tags[1], 'g');
  _this.sectionRegExp = new RegExp(
    _tags[0] + '(#|\\^)([\\w'+ chars + ']*)\\s*(.*?)' + _tags[1] +
    '([\\S\\s]*?)(' + _tags[0] + ')\\/\\2(' + _tags[1] + ')', 'g');
  _this.partRegExp = new RegExp(_tags[0] + '[#\^]');
  _this.escapeRegExp = new RegExp(_tags[0]);
}

function isArray(obj) { //obj instanceof Array;
  return obj && obj.constructor === Array;
}

function isFunction(obj) {
  return obj && typeof obj === 'function';
}

function getDataSource(data, extra, newData, helpers) {
  return {
    data: newData || data.data || data,
    extra: extra && [extra] || data.extra || [],
    path: [].concat(data.path !== undefined ? data.path : data, newData || []),
    helpers: helpers || {},
    __schnauzer: true,
  };
};


function crawlObjectUp(data, keys) { // faster than while
  for (var n = 0, m = keys.length; n < m; n++) {
    data = data && data[keys[n]];
  }
  return data;
}

function findData(data, key, keys, pathDepth) {
  var _keys = [],
    seachDepth = pathDepth === -1 ? 0 : (data.path.length - 1) - pathDepth,
    _data = data.path[seachDepth] || {},
    value = data.helpers[key] !== undefined ? data.helpers[key] :
      _data[key] !== undefined ? _data[key] :
      crawlObjectUp(_data, _keys = keys || key.split(/[\.\/]/));

  if (value !== undefined) return value;
  for (var n = data.extra.length; n--; ) {
    if (data.extra[n][key] !== undefined) return data.extra[n][key];
    value = crawlObjectUp(data.extra[n], _keys);
    if (value !== undefined) return value;
  }
}

function escapeHtml(string, _this) {
  return String(string).replace(_this.entityRegExp, function(char) {
    return _this.options.entityMap[char];
  });
}

function tools(_this, data, dataTree) {
  return {
    getData: function getData(key) {
      key = key.split('../');
      return findData(data, key.pop(), undefined, key.length || -1);
    },
    escapeHtml: function escape(string) { return escapeHtml(string, _this) }
  }
}

function variable(_this, html) {
  var keys = [],
    options = _this.options;

  html = html.replace(_this.variableRegExp,
    function(all, $1, $2, $3) {
      var isIgnore = $2 && ($2[0] === '!' || $2[0] === '='),
        isUnescaped = !options.doEscape ||
          (_this.escapeRegExp.test($1) && $1.length === 3) || $2 && $2[0] === '&',
        isPartial = $2 && $2[0] === '>',
        isSelf = false, name = '', path = [], isStrict = false, _data = {},
        _keys = [], val = '', isString = false, depth = 0;

      if (isIgnore) return '';

      $3 = $3.replace(/^(?:\.|this)\//, function() {
        isStrict = true;
        return '';
      }).split(/\s+/); // split variables
      name = $3.shift();

      if (!isPartial) {
        path = name.split('../'); // extract path...
        name = path.pop();
        _keys = name.split('.');
      } else { // convert variables
        for (var n = $3.length, parts = []; n--; ) {
          parts = $3[n].split('=');
          val = parts[1] || parts[0];
          isString = val[0] === '"' || val[0] === "'";
          depth = 0;

          if (isString) {
            val = val.replace(/(?:^'|^"|'$|"$)*/g, '');
          } else {
            path = val.split('../');
            if (path.length > 1) {
              val = path.pop();
              depth = path.length;
            }
            _keys = val.split('.');
          }
          _data[parts[1] ? parts[0] : '' + n] = [val, depth, isString, _keys];
        }
      }
      isSelf = name === options.recursion;
      keys.push(isPartial && (_this.partials[name] || isSelf) ?
        [_this.partials[name], _data, isPartial, isUnescaped, isSelf, undefined, isStrict] :
        [name, $3, undefined, isUnescaped, undefined, path.length, isStrict, _keys]);
      return options.splitter;
    }).split(options.splitter);

  return function fastReplace(data) {
    for (var n = 0, l = html.length, out = '', tmp, value, _data, _func, part; n < l; n++) {
      out = out + html[n];
      if (keys[n] === undefined) continue; // no other functions, just html
      part = keys[n];
      value = part[0];
      if (part[2] === true) { // partial -> executor
        data.data = JSON.parse(JSON.stringify(data.data)); // create new scope
        for (var key in part[1]) {
          _data = part[1][key];
          data.data[key] = _data[2] ? _data[0] : findData(data, _data[0], _data[3], _data[1]);
        }
        tmp = (value || _this.partials[options.recursion])(getDataSource(data.data, data.extra));
      } else {
        tmp = findData(data, value, part[7], part[5]);
        _func = !part[6] && options.helpers[value] || isFunction(tmp) && tmp;
        tmp = _func ? _func.apply(tools(_this, data), [].concat(part[1])) :
          value.isExecutor ? value(data) :
          tmp && (part[3] ? tmp : escapeHtml(tmp, _this));
      }
      if (tmp !== undefined) out = out + tmp;
    }
    return out;
  };
}

function section(_this, func, key, _key, negative) {
  var isStrict = false;
  var path = key.split('../');
  var name = path.pop().replace(/^(?:\.|this)\//, function() {
    isStrict = true;
    return '';
  });
  var pathDepth = path.length;
  var splitName = name.split('.');

  return function fastLoop(data) {
    var _data = findData(data, name, splitName, pathDepth);

    if (isArray(_data)) {
      if (negative) return !_data.length ? func(_data) : '';
      for (var n = 0, l = _data.length, out = ''; n < l; n++) {
        var helpers = {'@index': '' + n, '@last': n === l - 1,
          '@first': !n, '.': _data[n], 'this': _data[n] };

        data = getDataSource(data, data.extra, _data[n], helpers);
        out = out + func(data);
        data.path.pop();
      }
      return out;
    }

    var foundData = typeof _data === 'object' ? _data : data; // is object
    var _func = (!isStrict && _this.options.helpers[name]) || (isFunction(_data) && _data);
    if (_func) { // helpers or inline functions
      return _func.apply(tools(_this, data), [func(data)].concat(_key.split(/\s+/)));
    }
    if (negative && !_data || !negative && _data) { // regular replace
      return func(getDataSource(data, data.extra, foundData, { '.': _data, 'this': _data }));
    }
  }
}

function sizzleTemplate(_this, html) {
  var options = _this.options,
    partCollector = [],
    output = [],
    nesting = [],
    counter = -1,
    stop = '',
    parts = html.replace(_this.sectionRegExp, function(_, $1, $2, $3, $4, $5, $6) {
      var replacer = $5 + $1 + $2,
        index = $4.lastIndexOf(replacer);

      if (nesting.length) return _; // skip for next replace
      counter++;
      if (index !== -1) { // only if nesting occures
        nesting.push(counter--);
        stop = Array(++help).join('°');
        return replacer + $3 + $6 + $4.substring(0, index) + $5 + $1 + stop + $2 +
          $4.substring(index + replacer.length) + $5 + '/' + stop + $2 + $6;
      }
      $2 = $2.replace(_this.stopRegExp, '');

      partCollector.push(_this.partRegExp.test($4) ?
        section(_this, sizzleTemplate(_this, $4), $2, $3, $1 === '^') :
        section(_this, variable(_this, $4), $2, $3, $1 === '^'));
      return options.splitter;
    }).split(options.splitter);

  for (var n = 0, l = nesting.length; n < l; n++) {
    parts[nesting[n]] = sizzleTemplate(_this, parts[nesting[n]]);
  }
  for (var n = 0, l = parts.length; n < l; n++) { // rearrange
    output.push(isFunction(parts[n]) ? parts[n] : variable(_this, parts[n]));
    partCollector[n] && output.push(partCollector[n]);
  }

  return function executor(data, extra) {
    if (!data.__schnauzer || extra) { // oninit or partials
      data = getDataSource(data, extra);
    }
    executor.isExecutor = true;
    for (var n = 0, l = output.length, out = ''; n < l; n++) {
      out = out + (output[n](data) || '');
    }
    return out;
  }
}

}));