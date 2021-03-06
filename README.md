# {{schnauzer.js}} - (almost) Logic-less templates with JavaScript

[Schanuzer](http://github.com/PitPik/schnauzer) Schanuzer is largely compatible with Mustache and Handlebars templates. In most cases it is possible to swap out Mustache or Handlebars with Schanuzer and continue using your current templates.

Schanuzer is also very small and fast. It has the power of Handlebars but is almost the size of Mustage (7.70KB minified, ~3.4KB gZip) and therefore also perfectly suitable for mobile applications.
Renderin with Schnauzer is about 2x faster than with Handlebars, when using inline partials, up to 10x faster. Parsing blasting fast, almost as fast as rendering.

## Where to use schnauzer.js?

You can use schnauzer.js to render templates anywhere you can use JavaScript. This includes web browsers, server-side environments such as [node](http://nodejs.org/), and [CouchDB](http://couchdb.apache.org/) views.

schnauzer.js ships with support for both the [CommonJS](http://www.commonjs.org/) module API and the [Asynchronous Module Definition](https://github.com/amdjs/amdjs-api/wiki/AMD) API, or AMD.

## Main differences to Handlebars

Schnauzer and Handlebars do almost the same thing, but there is a difference in size (10x) and performance. Schnauzer has almost the same power as Handlebars but the size of Mustache and a higher performance.
Schnauzer does not throw errors when markup is not valid.


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
new Schnauzer(template: string, options: { [key: string]: any }) {
    tags: ['{{', '}}'], // used tags: default is {{}}
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
    escapeHTML: true, // if set to false it reacts like {{{}}}
    helpers: {}, // name:function pair defining helpers
    partials: {}, // name:String pair defining partials
    self: 'self', // name of initial partial
    nameCharacters: '', // whitelist of chars for variables inside helpers, partials, functions...
    renderHook: Function // every time an inline or block element renders, this function will be called
    loopHelper: Function // Every loop cycle of an Array inside #each calls this function
})
.render(data { [key: string]: any }, extraData { [key: string]: any }): string
.parse(text: string): Function
.registerHelper(name: string, func: Function): void
.unregisterHelper(name: string): void
.registerPartial(name: string, html: string): Function
.unregisterPartial(name: string): void
.setTags(tags: [string, string]): void
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
    blockParams: [], // not yet clear what this should be used for
    data: {root: {…}},
    hash: {}, // keeps all the parameters as a hash
    name: "", // name of the helper
    fn: ƒ (context, options), // only on block helpers; same as with Handlebars
    inverse: ƒ noop(), // only on block helpers; same as with Handlebars
    utils: { // some extra in Schnauzer implementation
      escapeExpression: ƒ(), // like Handlebars.escapeExpression
      SafeString: ƒ(), // like Handlebars.SafeString
      keys: ƒ(), // like window.Object.keys()
      extend: ƒ(newObject, hostObject), // like Handlebars.Utils.extend
      concat: ƒ(newArray, hostArray), // Concats 2 arrays
    }
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

