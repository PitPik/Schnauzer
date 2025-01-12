 ![coverage](https://img.shields.io/badge/version-3&#46;0&#46;1-blue) ![coverage](https://img.shields.io/badge/dependencies-0-green) ![coverage](https://img.shields.io/badge/minified-11&#46;13KB-blue) ![coverage](https://img.shields.io/badge/gzipped-~4&#46;89KB-blue)

# {{schnauzer.js}} - Handlebars templates with JavaScript

Schanuzer parses and renderes Handlebars templates. It lets you build **semantic templates** effectively with no frustration.

Schanuzer is largely compatible with Mustache and Handlebars templates. In most cases it is possible to swap out Mustache or Handlebars with Schanuzer and continue using your current templates. Schnauzer aims to be 100% compatible to Handlebars although there are some differences in how helpers work and Schnauzer is a Klass to be initialized.

Schanuzer is also very small and fast. It has the power of Handlebars but is almost the size of Mustage (11.13KB minified, ~4.89KB compressed) and therefore also perfectly suitable for mobile applications.
Rendering with Schnauzer is about ~33% faster than Handlebars, and parsing is around as fast as rendering although you can still precompile your templates (serveside and pass them to your app/page as a simple JSON).

## Where to use schnauzer.js?

You can use schnauzer.js to render templates anywhere you can use JavaScript. This includes web browsers (even Internet Explorer), server-side environments such as [node](http://nodejs.org/), and [CouchDB](http://couchdb.apache.org/) views.

schnauzer.js ships with support for both the [CommonJS](http://www.commonjs.org/) module API and the [Asynchronous Module Definition](https://github.com/amdjs/amdjs-api/wiki/AMD) API, or AMD.

### Dynamic rendering, keeps your template alive.

Schnauzer has 3 optional functions `renderHook()`, `loopHelper()` and `evaluationHook()` that get triggered with every single template tag/loop iteration so the template can be kept alive after the initial rendering.
With those functions it's possible to keep track of all the rendered variables and helpers by including a special character `%` in front of variables that need to be observed. This way, when used in the DOM, it's possible to overwrite parts of the rendered template after it was first rendered without having to re-render the whole template.
This is perfect for developing MVC like libraries/frameworks that need to partially update HTML on the fly.
Those hooks have no influence in rendering performance when not defined.

* * *

## Usage

Below is a quick example how to use schnauzer.js:

```js
var template = `
  <p>Hello, my name is {{name}}.
    I am from {{hometown}}.
    I have {{kids.length}} kids:</p>
  <ul>
    {{#kids}}<li>{{name}} is {{age}}</li>{{/kids}}
  </ul>
`;
var viewModel = {
  "name": "Tim",
  "hometown": "Somewhere, CA",
  "kids": [
    { "name": "Jimmy", "age": "7" },
    { "name": "Sally", "age": "4" }
  ]
};
var result = new Schnauzer(template).render(viewModel);

// Would render:
// <p>Hello, my name is Tim. I am from Somewhere, CA. I have 2 kids:</p>
// <ul>
//   <li>Jimmy is 7</li>
//   <li>Sally is 4</li>
// </ul>
```

In this example `Schnauzer()` is initialised with the template as first argument (options would be the second optional argument) and `render()` that takes one parameter: the `viewModel` object that contains the data and code needed to render the template.

## API

```js
new Schnauzer(
  templateOrOptions?: String | { [key: String]: any },
  options?: {
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
    helpers: { [name: String]: Function }, // short-cut for registerHelper()
    partials: { [name: String]: String | [] }, // short-cut for registerPartial()
    self: 'self', // name of initial (main) partial
    limitPartialScope: true, // sets limiting of scope inside partials (like in HBS)
    strictArguments: true, // sets arguments from a helper automatically to !helper
  }
)
.render(data: { [key: String]: any }, extraData: any): string
.parse(text: String): [] // returns a partial for re-cycling, re-usage in other instance
.registerHelper(name: String, func: Function): void
.unregisterHelper(name: String): void
.registerPartial(name: String, html: String | []): [] // parsed tree
.unregisterPartial(name: String): void
```
`parse()` is only needed if the template was not passed to `new Schnauzer()` in the first place. This might be handy if you're not sure if this template will ever be used and still a string and not a precompiled partial tree so you can save parsing time...

In `render(data, extraData)` you can pass some extra data source needed for parsing your template. If the renderer doesn't find the required data in `data` then it looks inside `extraData`.
This can be very helpful if you have, for example, an array of links to render where the root of the link is always the same (stored in extraModel) but the rest of the link is different (stored in the view model). So you don't have to put the root inside evey item of the array.

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

### Even faster helpers

When using helpers with a simple output and no `options` are needed, you can name your helper with the prefix `$` (like `$myHelper`) so that it skips building the `options` and renders therefore faster.

## Precompiling Templates
Schnauzer allows templates to be precompiled and included as a JSON tree rather than the Schnauzer template allowing for faster startup time.

```js
var template = `
  {{#*inline 'myInlinePartial'}}
    {{foo}} ...
  {{/inline}}

  {{> myInlinePartial}}
  {{> another bar='bar text'}}
`;
var schnauzer = new Schnauzer(template, {
  partials: { another: 'Simple {{bar}}' }
});
```
This would produce 3 partial trees that can be found in `schnauzer.partials` and would look like:

```js
{
  another: [{…}, {…}],
  myInlinePartial: [{…}, {…}],
  self: [{…}, {…}, {…}, {…}] // main partial
}
```
You could now use `JSON.stringify()` to convert this to a perfectly compressable text file. When received by the browser as a regular JSON again it then can be registered back like `new Schnauzer({ partials: partials })` in one go for all 3 partials.
This explains also why `.registerPartial(name, template)` can receive an array as 2nd argument. You can do: `.registerPartial('another', another)` and pass the array containing the tree of the `another` partial.


## How Schnauzer templates works

All basic features of Schnauzer are explained in the [Handlebars documentation](https://handlebarsjs.com/guide/).


### New in 3.x.x

The new version 3.x.x is completely re-programmed (minified ~3KB smaller), has a new parser that is 2.6x faster than in version 2.x.x, renders faster than ever and uses less memory. It is now also possible to pre-compile. Includes now the build in helpers `lookup` and `log`.