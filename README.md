# {{schnauzer.js}} - (almost) Logic-less templates with JavaScript

[Schanuzer](http://github.com/PitPik/schnauzer) is largely compatible with Mustache and Handlebars templates. In most cases it is possible to swap out Mustache or Handlebars with Schanuzer and continue using your current templates.

Schanuzer is also very small and fast. It has the power of Handlebars but is almost the size of Mustage (11.4KB minified, ~4.75KB gZip) and therefore also perfectly suitable for mobile applications.
Renderin with Schnauzer is about ~30% faster than with Handlebars, when using inline partials, up to 10x faster. Parsing blasting fast, almost as fast as rendering.

## Where to use schnauzer.js?

You can use schnauzer.js to render templates anywhere you can use JavaScript. This includes web browsers, server-side environments such as [node](http://nodejs.org/), and [CouchDB](http://couchdb.apache.org/) views.

schnauzer.js ships with support for both the [CommonJS](http://www.commonjs.org/) module API and the [Asynchronous Module Definition](https://github.com/amdjs/amdjs-api/wiki/AMD) API, or AMD.

## Main differences to Handlebars

Schnauzer and Handlebars do almost the same thing, but there is a difference in size (10x) and performance. Schnauzer has almost the same power as Handlebars but the size of Mustache and a higher performance.
Schnauzer does not throw errors when markup is not valid.

### Dynamic rendering

Other than handlebars, schnauzer has 2 optional functions that get triggered with every single tag that gets rendered so the template can be kept alive even after the first rendering.
`renderHook()` and `loopHelper()`. With those functions it's possible to keep track of all the rendered variables and rendering functions including a special character `%` set infront of every variable. This way it's possible to overwrite parts of the rendered template after it was first rendered without having to re-render the whole template.
This is perfect for developing MVC like libraries/frameworks that need to partialy update HTML on the fly.


* * *

## handlebars.js [not present any more.]

Will be back soon. (Handlebars facade for Schnauzer)

## Usage

Below is a quick example how to use schnauzer.js:

```js
var viewModel = {
  title: "Joe",
  calc: function ($1) {
    return parseFloat($1) * 0.9;
  }
};

var output = new Schnauzer("{{title}} spends {{calc 200}}").render(viewModel);
```

In this example `Schnauzer()` is initialized with the template as first argument (options would be the second optional argument) and the `render()` function that takes one parameters: the `viewModel` object that contains the data and code needed to render the template.

## API

```js
new Schnauzer(template: String, options: { [key: String]: any }) {
    tags: ['{{', '}}'], // used tags: default is {{ }}
    entityMap: { // characters to be escaped
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    },
    escapeHTML: true, // if false, Schnauzer renders like all tags are set to {{{ }}}
    helpers: { [name: String]: Function }, // short-cut for registerHelper
    partials: { [name: String]: String | Function }, // short-cut for registerPartial
    self: 'self', // name of initial partial
    limitPartialScope: true, // sets limiting of scope inside partials (like in HBS)
    renderHook: Function // called every time an inline | block element renders
    loopHelper: Function // Loop cycle callback for Array | Object inside #each
})
.render(data: { [key: String]: any }, extraData: { [key: String]: any }): string
.parse(text: String): Function // returns a partial for re-cycling, re-usage in other instance
.registerHelper(name: String, func: Function): void
.unregisterHelper(name: String): void
.registerPartial(name: String, html: String | Function): Function // Function: pre-parsed
.unregisterPartial(name: String): void
.setTags(tags: [String, String]): void
```
`parse()` is only needed if the template was not passed to `Schnauzer()` in the first place. This might be handy if you're not sure if this template will ever be used...

In `render(data, extraData)` you can pass some extra data source needed for parsing your template. If renderer doesn't find the required data in `data` then it looks inside `extraData`. `extraData` can be and opbject or an array of objects.
This can be very handy if you have, for example, an array of links to render where the root of the link is always the same (stored in extraModel) but the end of the link is different (stored in the array). So you don't have to put the root inside evey item of the array.

```js
var data = {
  links: [{
     link: 'link1',
     text: 'My first link',
  }, {
     link: 'link2',
     text: 'My second link'
  }]
}
var extraData = {
  root: './some/path'
}

var output = new Schnauzer('{{#links}}<a href="{{root}}/{{link}}">{{text}}</a>{{/links}}')
   .render(data, extraData);
```

#### Functions in helpers

All the functions used inside the model or being registered or passed in options as helpers can be used as inline or block elements that have the same arguments and scope:

```handlebars
{{#helper foo}}some text with {{meaning}}{{/helper}}
or inline
{{helper foo}}
```
```js
var data = {
  meaning: 'some more meaning',
  foo: 'This would be',
  helper: helper
}

function helper([$1, $2,...]) { // can also be passed as option or registered via .registerHelper()
  var args = [];
  var options = arguments[arguments.length - 1];

  for (var i = 0; i < arguments.length - 1; i++) {
    args.push(arguments[i]);
  }

  return $1 + ' ' + options.fn(this);
}
```
In this case you would get "This would be some text with some more meaning" in the block and "This would be  " if used as inline helper.
$1 etc. represent the String passed with the block (here "foo").
```options.fn()``` is the text that was rendered if it was inside a block element (empty if inline usage), ```options.inverse()``` the block after an else (if exists, else undefined).

Options inside helper functions work almost like with Handlebars:
```js
  options: {
    data: { root: {…}, scope, parent, first, last index, key, number, length },
    hash: {}, // keeps all the parameters as a hash
    name: "", // name of the helper
    fn?: ƒ (context, options), // only on block helpers; same as with Handlebars
    inverse?: ƒ noop(), // only on block helpers; same as with Handlebars
    escapeExpression: ƒ(), // like Handlebars.escapeExpression
    SafeString: ƒ(), // like Handlebars.SafeString
    keys: ƒ(), // like window.Object.keys()
    extend: ƒ(newObject, hostObject), // like Handlebars.Utils.extend
    concat: ƒ(newArray, hostArray), // Concats 2 arrays
    getDataDetails: ƒ(), // returns details of the data (arguments)
  }
```

`options.fn()`, other than with Handlebars, doesn't need and argument unless you want to create a new scope.
So, if you're fine with the scope of `this`, you don't need to pass a parameter.

Inline helpers can be used for something like the following:

```handlebars
{{today}}
```

```js
today: function() {
    return new Date().toLocaleString();
}
```

## How Schnauzer templates works

All basic features of Schnauzer are explained at the [Handlebars decumentation](https://handlebarsjs.com/guide/).


## Pre-parsing and Caching Templates

By default, when schnauzer.js first parses a template it builds arrays of currying functions that keep all data cached. The currying functions not only already hold the parsed HTML snippets but also the right key to the JSON being passed so it can concatenate strings on the fly. The rendering functions are highly optimised therefore Schnauzer currently renders 1/3 faster than Handlebars. Parsing is about 10x faster.

The new version 2.x.x has a new parser that is faster, uses a lot less memory and allowes a more flexible way to use variables within tags.
