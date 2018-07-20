(function defineHandlebars(root, factory) {
  if (typeof exports === 'object') module.exports = factory(root, require('schnauzer'));
  else if (typeof define === 'function' && define.amd) define('handlebars', ['schnauzer'],
    function(Schnauzer) { return factory(root, Schnauzer); });
  else root.Handlebars = factory(root, root.Schnauzer);
}(this, function HandlebarsFactory(root, Schnauzer, undefined) { 'use strict';
var Handlebars = function() {
  var schnauzer = this.schnauzer = new Schnauzer('', {
    tools: function(_this, findData, fn, name, params, data, parts, body, altBody) {
      var key = {};
      var hash = {};
      var value;

      for (var n = params.length; n--;) {
        key = parts.rawParts[params[n]] || { value: params[n], keys: [params[n]], depth: 0 };
        hash[params[n]] = params[n] = key.isString ?
          key.value : findData(data, key.value, key.keys, key.depth);
      }

      value = fn.apply(data.path[0], params.concat({
        name: name,
        hash: hash,
        fn: function(_data) { return body && (data.path[0] = _data) && body(data) },
        inverse: function(_data) { return altBody && (data.path[0] = _data) && altBody(data) },
        data: { root: data.path[0] },
      }));

      return typeof value === 'function' ? value() : value; // SafeString()
    }
  });

  this.helpers = this.schnauzer.options.helpers;
  this.partials = this.schnauzer.partials;
  this.decorators = {};
};


Handlebars.prototype = {
  constructor: Handlebars,
  registerPartial: function(name, template) { this.schnauzer.registerPartial(name, template) },
  unregisterPartial: function(name) { this.schnauzer.unregisterPartial(name) },
  registerHelper: function(name, fn) { this.schnauzer.registerHelper(name, fn) },
  unregisterHelper: function(name, fn) { this.schnauzer.unregisterHelper(name) },
  compile: function(template) {
    var schnauzer = this.schnauzer;

    schnauzer.parse(template);
    return function(data) { return schnauzer.render.call(schnauzer, data) }
  }
};

function create() {
  var hb = new Handlebars();

  hb.createFrame = function(obj) {
    var frame = Object.extend({}, obj);

    frame._parent = obj;
    return frame;
  };
  hb.escapeExpression = function(string) {
    return String(string).replace(hb.schnauzer.entityRegExp, function(char) {
      return hb.schnauzer.options.entityMap[char];
    });
  };
  hb.SafeString = function(string) { return function() { return string } };
  hb.create = create;
  hb.default = hb;
  hb.Utils = {
    createFrame: hb.createFrame,
    escapeExpression: hb.escapeExpression,
  };

  return hb;
}

return create();
}));