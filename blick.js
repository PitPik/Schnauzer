/**! @license blick v0.0.1; Copyright (C) 2018 by Peter Dematté */
(function defineBlick(root, factory) {
  if (typeof exports === 'object') module.exports = factory(root, require('schnauzer'));
  else if (typeof define === 'function' && define.amd) define('blick', ['schnauzer'],
    function (Schnauzer) { return factory(root, Schnauzer); });
  else root.Blick = factory(root, root.Schnauzer);
}(this, function BlickFactory(root, Schnauzer) { 'use strict';

var Blick = function(template, options) {
    this.version = '0.0.1';
    this.options = {
      registerProperty: dummy,
      unregisterProperty: dummy,
      attributes: {
        disabled: disableAttribute,
      }
    };
    init(this, options || {}, template);
  },
  init = function(_this, options, template) {
    for (var option in options) {
      if (option === 'attributes') {
        for (var attr in options[option]) {
          _this.options[option][attr] = options[option][attr];
        }
      } else {
        _this.options[option] = options[option];
      }
    }
    options.render = renderHook;
    _this.schnauzer = new Schnauzer(template, options);
  },
  dump = [],
  dummy = function(){},
  disableAttribute = function(node, value) {
    if (value === true || value === 'true') {
      node.ownerElement.setAttribute(node.name, '');
    } else {
      node.ownerElement.removeAttribute(node.name);
    }
  },
  tester = document.createElement('tbody');

Blick.prototype = {
  render: function(data, extra) {
    var fragment = document.createDocumentFragment();
    var html = this.schnauzer.render(data, extra);

    return resolveReferences(this, dump, html, null, fragment);
  }
};

return Blick;

function findNode(container, pattern) {
  return document.evaluate('//text()[contains(., "' + pattern + '")]',
      container, null, XPathResult.FIRST_ORDERED_NODE_TYPE , null).singleNodeValue ||
    document.evaluate('//@*[contains(., "' + pattern + '")]',
      container, null, XPathResult.FIRST_ORDERED_NODE_TYPE , null).singleNodeValue;
}

function renderHook(data) {
  var index = dump.length;

  if (!data.fn || !data.name || !data.isActive || data.partial ||
      data.type === 'decorator' || data.type === 'helper' ||
      data.name.charAt(0) === '@' || data.name === '.' || data.name === 'this') {
    return data.text + data.value;
  }
  data.isSection = checkSection(data);
  dump[index] = data;
  return data.text + '{{#' + index + '}}' + data.value + '{{/'+ index +'}}';
}

function textNodeSplitter(node, first, last) {
  node.splitText(node.textContent.lastIndexOf(last) + last.length).textContent;
  return node.splitText(node.textContent.indexOf(first));
}

function checkSection(part) {
  tester.innerHTML = part.value; // TODO: less expensive
  if (tester.children.length) return true;
  return part.section && !part.type && part.value.indexOf('{{#') !== -1;
}

function clearMemory(array) { // TODO: check for better
  var a = true;
  var keep = { replacer: a, lastNode: a, fn: a, children: a, unregister: a, data: a };

  for (var n = array.length; n--; ) {
    for (var key in array[n]) if (!keep[key]) delete array[n][key];
    array[n] = null;
  }
  return null;
}

function render(_this, container, helperContainer, fragment) {
  // TODO: use _this on how to render...
  while (helperContainer.childNodes.length) {
    fragment.appendChild(helperContainer.childNodes[0]);
  }
  if (container) { // internal only
    if (container.nextSibling) {
      container.parentNode.insertBefore(fragment, container.nextSibling);
    } else {
      container.parentNode.appendChild(fragment);
    }
  } else {
    return fragment;
    // container.appendChild(fragment); // return fragment
  }
}

function checkSectionChild(node, child, sections, options) {
  if (sections.length !== 0) {
    for (var n = sections.length; n--; ) {
      sections[n].children.push({
        unregister: (function(item) {
          return function unregister() {
            options.unregisterProperty(item.name, item);
          }
        })(child)
      });
      if (node.textContent.indexOf(sections[n].search) !== -1) {
        node.textContent = node.textContent.replace(sections[n].search, '');
        sections.pop(); //splice(n, 1);
      }
    }
  }
  return sections;
}

function resolveReferences(_this, memory, html, container, fragment) {
  var search = new RegExp('{{#\\d+}}[\\S\\s]*{{/\\d+}}');
  var helperContainer = document.createElement('tbody');
  var first = '';
  var last = '';
  var part = {};
  var foundNode = {};
  var lastNode = {};
  var options = _this.options;
  var registerProperty = options.registerProperty;
  var original = '';
  var newMemory = [];
  var openSections = [];
  var out;

  helperContainer.innerHTML = html || '';

  for (var n = memory.length; n--; ) { // must revers
    first = '{{#' + n + '}}';
    last = '{{/' + n + '}}';
    part = memory[n];
    foundNode = findNode(helperContainer, first);

    if (!foundNode) { // error

    } else if (foundNode.ownerElement) { // attribute
      part.replacer = (function(elm, search, orig, item) { // TODO: no part.replacer...
        return function updateAttribute() { // TODO: respect attributes' behaviours
          var value = item.fn(item.data);
          if (value === undefined) value = '';
          if (options.attributes[elm.name]) {
            elm.ownerElement && options.attributes[elm.name](elm, value);
          } else if (value !== undefined) {
            elm.textContent = orig.replace(search, value);
          }
        }
      })(foundNode, search, foundNode.textContent, part);
      registerProperty(part.name, part.replacer, part.data.path[0]);
      openSections = checkSectionChild(foundNode.ownerElement.previousSibling,
        part, openSections, options);
      part.replacer();
    } else if (!checkSection(part)) { // inline var - inline section
      foundNode = textNodeSplitter(foundNode, first, last);
      part.replacer = (function(elm, item) {
        return function updateTextNode() {
          var value = item.fn(item.data);
          helperContainer.innerHTML = value; // TODO: less expensive
          if (helperContainer.children.length) {
            newMemory = resolveReferences(_this, dump, value, elm, fragment);
            item.children = clearMemory(newMemory);
            return;
          } else {
            elm.textContent = item.fn(item.data);
          }
        }
      })(foundNode, part);
      foundNode.textContent = part.value;
      registerProperty(part.name, part.replacer, part.data.path[0]);
      openSections = checkSectionChild(foundNode, part, openSections, options);
    } else { // section
      openSections = checkSectionChild(foundNode, part, openSections, options);
      openSections.push({ search: first, children: part.children = [] });
      lastNode = findNode(foundNode.parentNode, last);
      part.lastNode = lastNode = lastNode.splitText(lastNode.textContent.lastIndexOf(last));
      lastNode.textContent = '';
      foundNode = foundNode.splitText(foundNode.textContent.indexOf(first));
      foundNode.textContent = foundNode.textContent.replace(first, '');
      part.replacer = (function(elm, item) {
        return function updateSection() {
          while (item.lastNode.previousSibling && item.lastNode.previousSibling !== elm) {
            elm.parentNode.removeChild(item.lastNode.previousSibling);
          }
          for (var n = item.children.length; n--; ) {
            item.children[n].unregister();
          }
          newMemory = resolveReferences(_this, dump, item.fn(item.data), elm, fragment);
          item.children = clearMemory(newMemory); // possible new children to be deleted...
        }
      })(foundNode, part);
      registerProperty(part.name, part.replacer, part.data.path[0]);
    }
  }

  out = render(_this, container, helperContainer, fragment); // todo
  if (!container) memory = clearMemory(memory);
  dump = [];
  return container ? memory : out;
}
}));
