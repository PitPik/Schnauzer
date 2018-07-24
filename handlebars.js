(function defineHandlebars(root, factory) {
  if (typeof exports === 'object') module.exports = factory(root, require('schnauzer'));
  else if (typeof define === 'function' && define.amd) define('handlebars', ['schnauzer'],
    function(Schnauzer) { return factory(root, Schnauzer); });
  else root.Handlebars = factory(root, root.Schnauzer);
}(this, function HandlebarsFactory(root, Schnauzer, undefined) { 'use strict';
var Handlebars = function() {
  var schnauzer = this.schnauzer = new Schnauzer('', {
    tools: function(_this, findData, getSource, fn, name, params, data, parts, body, altBody) {
      var key = {};
      var hash = {};
      var value;

      for (var n = params.length; n--;) {
        key = parts.rawParts[params[n]] || { value: params[n], keys: [params[n]], depth: 0 };
        hash[params[n]] = params[n] = key.isString ?
          key.value : findData(data, key.value, key.keys, key.depth);
      }

      value = parts.isInline ?
        fn.call(_this, function() { return body || '' }, {}, this, {
          args: params,
          name: name,
          hash: hash,
          data: { root: data.path[0] },
        }) :
        fn.apply(data.path[0], params.concat({
          name: name,
          hash: hash,
          fn: function(_data) {
            _data = _data !== data.path[0] ? getSource(data, undefined, _data, {}) : data;
            return body && body(_data);
          },
          inverse: function(_data) {
            _data = _data !== data.path[0] ? getSource(data, undefined, _data, {}) : data;
            return altBody && altBody(_data);
          },
          data: { root: data.path[0] },
        }));

      return typeof value === 'function' && !parts.isInline ? value() : value; // SafeString()
    }
  });

  this.helpers = schnauzer.helpers;
  this.decorators = schnauzer.decorators;
  this.partials = schnauzer.partials;
};

Handlebars.prototype = {
  constructor: Handlebars,
  registerPartial: function(name, template) { this.schnauzer.registerPartial(name, template) },
  unregisterPartial: function(name) { this.schnauzer.unregisterPartial(name) },
  registerHelper: function(name, fn) { this.schnauzer.registerHelper(name, fn) },
  unregisterHelper: function(name, fn) { this.schnauzer.unregisterHelper(name) },
  registerDecorator: function(name, fn) { this.schnauzer.registerDecorator(name, fn) },
  unregisterDecorator: function(name, fn) { this.schnauzer.unregisterDecorator(name) },
  compile: function(template) {
    var schnauzer = this.schnauzer;

    delete schnauzer.partials[schnauzer.options.recursion];
    schnauzer.parse(template);
    return function(data) { return schnauzer.render.call(schnauzer, data) }
  }
};

function create() {
  var hbs = new Handlebars();

  hbs.createFrame = function(obj) {
    var frame = Object.extend({}, obj);

    frame._parent = obj;
    return frame;
  };
  hbs.escapeExpression = function(string) {
    return String(string).replace(hbs.schnauzer.entityRegExp, function(char) {
      return hbs.schnauzer.options.entityMap[char];
    });
  };
  hbs.SafeString = function(string) { return function() { return string } };
  hbs.create = create;
  hbs.default = hbs;
  hbs.Utils = {
    createFrame: hbs.createFrame,
    escapeExpression: hbs.escapeExpression,
  };

  return hbs;
}

return create();
}));
