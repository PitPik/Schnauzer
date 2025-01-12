# {{schnauzer.js}} - Handlebars templates with JavaScript

Schanuzer is a Handlebars parser/renderer that lets you build **semantic templates** effectively with no frustration.

Schanuzer is largely compatible with Mustache and Handlebars templates. In most cases it is possible to swap out Mustache or Handlebars with Schanuzer and continue using your current templates.

Schanuzer is also very small and fast. It has the power of Handlebars but is almost the size of Mustage (10.90KB minified, ~4.6KB compressed) and therefore also perfectly suitable for mobile applications.
Rendering with Schnauzer is about ~33% faster than Handlebars, and parsing is around as fast a rendering.

## Where to use schnauzer.js?

You can use schnauzer.js to render templates anywhere you can use JavaScript. This includes web browsers (even Internet Explorer), server-side environments such as [node](http://nodejs.org/), and [CouchDB](http://couchdb.apache.org/) views.

schnauzer.js ships with support for both the [CommonJS](http://www.commonjs.org/) module API and the [Asynchronous Module Definition](https://github.com/amdjs/amdjs-api/wiki/AMD) API, or AMD.

### Dynamic rendering, keeps you template alive.

Schnauzer has 2 optional functions that get triggered with every single tag that gets rendered so the template can be kept alive even after the initial rendering.
`renderHook()` and `loopHelper()`. With those functions it's possible to keep track of all the rendered variables and rendering functions including a special character `%` set in front of every variable. This way, when used in the DOM, it's possible to overwrite parts of the rendered template after it was first rendered without having to re-render the whole template.
This is perfect for developing MVC like libraries/frameworks that need to partially update HTML on the fly.

* * *

## Usage

Below is a quick example how to use schnauzer.js:

```js
var template = `
  <p>Hello, my name is {{name}}.
    I am from {{hometown}}.
    I have 
    {{kids.length}} kids:
  </p>
  <ul>
    {{#kids}}<li>{{name}} is {{age}}</li>{{/kids}}
  </ul>
`;
var schnauzer = new Schnauzer(template);
var data = {
  "name": "Peter",
  "hometown": "Somewhere, CA",
  "kids": [
    {"name": "Jimmy", "age": "7"},
    {"name": "Sally", "age": "4"}
  ]};
var result = schnauzer.render(data);

// Would render:
// <p>Hello, my name is Peter. I am from Somewhere, CA. I have 2 kids:</p>
// <ul>
//   <li>Jimmy is 7</li>
//   <li>Sally is 4</li>
// </ul>
```

In this example `Schnauzer()` is initialised with the template as first argument (options would be the second optional argument) and `render()` that takes one parameters: the `viewModel` object that contains the data and code needed to render the template.

## API

```js
new Schnauzer(templateOrOptions?: String | { [key: String]: any }, options?: { [key: String]: any }) {
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
    self: 'self', // name of initial partial
    limitPartialScope: true, // sets limiting of scope inside partials (like in HBS)
    strictArguments: true, // sets all arguments from a helper automatically to strict (model value before helper)
    renderHook: Function // called every time an inline | block element renders
    loopHelper: Function // Loop cycle callback for Array | Object inside #each or #myArray
})
.render(data: { [key: String]: any }, extraData: any): string
.parse(text: String): [] // returns a partial for re-cycling, re-usage in other instance
.registerHelper(name: String, func: Function): void
.unregisterHelper(name: String): void
.registerPartial(name: String, html: String | []): [] // parsed tree
.unregisterPartial(name: String): void
```
`parse()` is only needed if the template was not passed to `new Schnauzer()` in the first place. This might be handy if you're not sure if this template will ever be used...

In `render(data, extraData)` you can pass some extra data source needed for parsing your template. If renderer doesn't find the required data in `data` then it looks inside `extraData`.
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

## Precompiling Templates
Schnauzer allows templates to be precompiled and included as a JSON tree rather than the Schnauzer template allowing for faster startup time.

```js
var template = `
  {{#*inline 'myInlinePartial'}}
    {{foo}} ...
  {{/inline}}

  {{> myInlinePartial}}
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
  self: [{…}, {…}, {…}] // main partial
}
```
You could now use `JSON.stringify()` to convert this to a text file.
When received by the browser as a regular JSON again it then can be registered back like `new Schnauzer({ partials: partials })` in one go for all 3 partials.
This explains also why `.registerPartial(name, template)` can receive an array as 2nd argument. You can do: `.registerPartial('another', another)` and pass the array containing the tree of the `another` partial.


## How Schnauzer templates works

All basic features of Schnauzer are explained in the [Handlebars documentation](https://handlebarsjs.com/guide/).


### New in 3.x.x

The new version 3.x.x is completely re-programmed, has a new parser that is 2.6 times faster than in version 2.x.x, renders faster than ever and uses less memory. It is now also possible to pre-compile.