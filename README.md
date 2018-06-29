# {{schnauzer.js}} - (almost) Logic-less templates with JavaScript

[Schanuzer](http://github.com/PitPik/schnauzer) is a fairly logic-less template syntax rendering engine that provides the power necessary to let you build semantic templates effectively with no frustration.
Schanuzer is largely compatible with Mustache and Handlebars templates. In most cases it is possible to swap out Mustache or Handlebars with Schanuzer and continue using your current templates.

I call it "logic-less" because there are no if statements, else clauses, or for loops. Instead there are only tags. Some tags are replaced with a value, some nothing, and others a series of values. But as with Handlebars you can add helpers, or pass data to your partials.
Schanuzer is also very small and fast. It has the power of Handlebars but is smaller than Mustage (4KB minified, 1.75KB gZip) and therefore also perfectly suitable for mobile applications.

## Where to use schnauzer.js?

You can use schnauzer.js to render templates anywhere you can use JavaScript. This includes web browsers, server-side environments such as [node](http://nodejs.org/), and [CouchDB](http://couchdb.apache.org/) views.

schnauzer.js ships with support for both the [CommonJS](http://www.commonjs.org/) module API and the [Asynchronous Module Definition](https://github.com/amdjs/amdjs-api/wiki/AMD) API, or AMD.

* * *

## Usage

Below is a quick example how to use schnauzer.js:

```js
var view = {
  title: "Joe",
  calc: function (text, $1) {
    return parseFloat($1) * 0.9;
  }
};

var output = new Schnauzer("{{title}} spends {{calc 200}}").render(view);
```

In this example `Schnauzer()` is initialized with the template as first argument (options would be the second argument) and the `render()` function that takes one parameters:  the  `view` object that contains the data and code needed to render the template.

## API

```js
new Schnauzer(template /*String*/, options /*Object*/)
.render(data /*Object*/, extraData /*Object|Array*/) // => returns String
.parse(text /*String*/)
.registerHelper(name /*String*/, func  /*Function*/)
.unregisterHelper(name /*String*/)
.registerPartial(name /*String*/, html  /*String*/)
.unregisterPartial(name /*String*/)
.setTags(tags /*Array*/)
```
`parse()` is only needed if the template was not passed to `Schnauzer()` in the first place. This might be handy if you're not sure if this template will ever be used...

In `render(data, extraData)` you can pass some extra data source needed for parsing your template. If parser doesn't find the required data in `data` then it looks inside `extraData`. `extraData` can be and opbject or an array of objects.
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

```html
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

function helper(text[, $1, $2,...]) { // can also be passed as option or registered via .registerHelper()
  var data = this.getData($1); // $1 = 'foo'
  var txt = this.encode(data);

  return txt + ' ' + text;
}
```
In this case you would get "This would be some text with some more meaning" in the block and "This would be  " if used as inline helper.
The first argument of the helper function is the text that was rendered if it was inside a block element (empty if inline usage) and the $1 etc. represent the String passed with the block (here "foo").
```this.getData()``` takes an argument representing the key and returns the data with that key if available. ```this.encode()``` would make sure that all characters are encoded (defined by ```entityMap``` in options).

Inline helpers can be used for something like the following:

```html
{{today}}
```

```js
today: function(text) {
    return new Date().toLocaleString();
}
```

## Options
```js
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
doEscape: true, // if set to false it reacts like {{{}}}
helpers: {}, // name:function pair defining helpers
partials: {}, // name:String pair defining partials
recursion: 'self', // name of initial partial
characters: '$"<>%=@', // whitelist of chars for variables inside helpers, partials, functions...

// the following are internals and probably never need to be overwritten:
splitter: '|##|', // internal string splitter; change if this also used in template
stopper: '__' // internal string splitter for nested block names; (__1__, __2__, etc.)

```

## Templates

A Schnauzer template is a string that contains any number of schnauzer tags. Tags are indicated by the double mustaches that surround them. `{{person}}` is a tag, as is `{{#person}}`. In both examples we refer to `person` as the tag's key. There are several types of tags available in schnauzer.js, described below.

There are several techniques that can be used to load templates and hand them to schnauzer.js, here are two of them:

#### Include Templates

If you need a template for a dynamic part in a static website, you can consider including the template in the static HTML file to avoid loading templates separately. Here's a small example using `jQuery`:

```html
<!DOCTYPE HTML>
<html>
<body onload="loadUser()">
<div id="target">Loading...</div>
<script id="template" type="x-tmpl-schnauzer">
Hello {{name}}!
</script>
</body>
</html>
```

```js
function loadUser() {
  var template = $('#template').html();
  var schnauzer = new Schnauzer(template);
  var rendered = schnauzer.render({name: "Luke"});
  $('#target').html(rendered);
}
```

#### Load External Templates

If your templates reside in individual files, you can load them asynchronously and render them when they arrive. Another example using `jQuery`:

```js
var schnauzer = new Schnauzer();
var data = {name: "Luke"};
var rendered = '';

function loadUser() {
  $.get('template.mst', function(template) {
    schnauzer.parse(template);
    rendered = schnauzer.render(data);
    $('#target').html(rendered);
  });
}
```

### Variables

The most basic tag type is a simple variable. A `{{name}}` tag renders the value of the `name` key in the current context. If there is no such key, nothing is rendered.

All variables are HTML-escaped by default (option: doEscape). If you want to render unescaped HTML, use the triple mustache: `{{{name}}}`.

View:

```json
{
  "name": "Chris",
  "company": "<b>GitHub</b>"
}
```

Template:

```
* {{name}}
* {{age}}
* {{company}}
* {{{company}}}
```

Output:

```html
* Chris
*
* &lt;b&gt;GitHub&lt;/b&gt;
* <b>GitHub</b>
```

JavaScript's dot notation may be used to access keys that are properties of objects in a view.

View:

```json
{
  "name": {
    "first": "Michael",
    "last": "Jackson"
  },
  "age": "RIP"
}
```

Template:

```html
* {{name.first}} {{name.last}}
* {{age}}
```

Output:

```html
* Michael Jackson
* RIP
```

### Sections

Sections render blocks of text one or more times, depending on the value of the key in the current context.

A section begins with a pound and ends with a slash. That is, `{{#person}}` begins a `person` section, while `{{/person}}` ends it. The text between the two tags is referred to as that section's "block".

The behavior of the section is determined by the value of the key.

#### False Values or Empty Lists

If the `person` key does not exist, or exists and has a value of `null`, `undefined`, `false`, `0`, or `NaN`, or is an empty string or an empty list, the block will not be rendered.

View:

```json
{
  "person": false
}
```

Template:

```html
Shown.
{{#person}}
Never shown!
{{/person}}
```

Output:

```html
Shown.
```

#### Non-Empty Lists

If the `person` key exists and is not `null`, `undefined`, or `false`, and is not an empty list the block will be rendered one or more times.

When the value is a list (an array), the block is rendered once for each item in the list. The context of the block is set to the current item in the list for each iteration. In this way we can loop over collections.

View:

```json
{
  "stooges": [
    { "name": "Moe" },
    { "name": "Larry" },
    { "name": "Curly" }
  ]
}
```

Template:

```html
{{#stooges}}
<b>{{name}}</b>
{{/stooges}}
```

Output:

```html
<b>Moe</b>
<b>Larry</b>
<b>Curly</b>
```

When looping over an array of strings, a `.` can be used to refer to the current item in the list.

If you want to use ```{{#stooges}}foo{{/stooges}}``` just like an if statement, so you want to know if there are any items in the array but not want to render foo as many times as there are items, you can do this like following: ```{{#stooges.0}}foo{{/stooges.0}}``` or ```{{^stooges.0}}foo{{/stooges.0}}```

View:

```json
{
  "musketeers": ["Athos", "Aramis", "Porthos", "D'Artagnan"]
}
```

Template:

```html
{{#musketeers}}
* {{.}}
{{/musketeers}}
```

Output:

```html
* Athos
* Aramis
* Porthos
* D'Artagnan
```

#### Functions

If the value of a section key is a function, it is called with the section's literal block of text..

View:

```js
{
  "name": "Tater",
  "greeting": "Hi",
  "bold": function (text, $1) {
      return this.getData($1) + " <b>" + text + "</b>";
  }
}
```

Template:

```html
{{#bold greeting}}{{name}}.{{/bold}} or
{{#bold}}{{greeting}}{{name}}.{{/bold}}
```

Output:

```html
Hi <b>Tater.</b>
```

### Inverted Sections

An inverted section opens with `{{^section}}` instead of `{{#section}}`. The block of an inverted section is rendered only if the value of that section's tag is `null`, `undefined`, `false`, *falsy* or an empty list.

View:

```json
{
  "repos": []
}
```

Template:

```html
{{#repos}}<b>{{name}}</b>{{/repos}}
{{^repos}}No repos :({{/repos}}
```

Output:

```html
No repos :(
```


### Paths
Schnauzer supports simple paths, just like Mustache.
```html
<p>{{name}}</p>
Schnauzer also supports nested paths, making it possible to look up properties nested below the current context.
<div class="entry">
  <h1>{{title}}</h1>
  <h2>By {{author.name}}</h2>

  <div class="body">
    {{body}}
  </div>
</div>
```

That template works with this context

```js
var context = {
  title: "My First Blog Post!",
  author: {
    id: 47,
    name: "Yehuda Katz"
  },
  body: "My first post. Wheeeee!"
};
```
This makes it possible to use Schnauzer templates with more raw JSON objects.

Nested schnauzer paths can also include ../ segments, which evaluate their paths against a parent context.

```html
<h1>Comments</h1>

<div id="comments">
  {{#each comments}}
  <h2><a href="/posts/{{../permalink}}#{{id}}">{{title}}</a></h2>
  <div>{{body}}</div>
  {{/each}}
</div>
```

Even though the link is printed while in the context of a comment, it can still go back to the main context (the post) to retrieve its permalink.
The exact value that ../ will resolve to varies based on the helper that is calling the block. Using ../ is only necessary when context changes, so children of helpers would require the use of ../ while children of helpers such as if do not.
```html
{{permalink}}
{{#comments}}
  {{../permalink}}

  {{#title}}
    {{../permalink}}
  {{/title}}
{{/comments}}
```
In this example all of the above reference the same permalink value even though they are located within different blocks.

Schnauzer also allows for name conflict resolution between helpers and data fields via a this reference:

```html
<p>{{./name}} or {{this/name}} or {{this.name}}</p>
```

Any of the above would cause the name field on the current context to be used rather than a helper of the same name.


### Helpers

As with Handlebars you can also use helpers in Schnauzer to make your live easier. Schnauzer helpers can be accessed from any context in a template. You can register a helper with the Schnauzer.registerHelper method.
Helpers and their function are explained in the API section above.

### Comments

Comments begin with a bang and are ignored. The following template:

```html
<h1>Today{{! ignore me }}.</h1>
```

Will render as follows:

```html
<h1>Today.</h1>
```

Comments may contain newlines.

### Partials

Partials begin with a greater than sign, like {{> box}}.

Partials can be set in options or registered by ```registerPartial```:

```javascript
var schnauzer = new Schnauzer(template, {
    partials: {
        myPartial: html
    }
});
// or ...
schnauzer.registerPartial('myPartial', html);
```

Partials are pre-parsed, so they are as fast rendered as regular template items. Recursive partials are possible. Just avoid infinite loops. The name of the main partial is defined in options and defaults to "self"
`{{> self}}`

They also inherit the calling context but ignore the deeper context if 'self' (to avoid endless recursion).

Schnauzer requires only the name of the partial but can also pass some variables:

```html
{{> next_more headline="h1"}}
```

For example, this template and partial:

    // base:
    <h2>Names</h2>
    {{#names}}
      {{> user  headline="h3"}}
    {{/names}}

    // user:
    <{{headline}}>{{name}}</{{headline}}>

Can be thought of as a single, expanded template:

```html
<h2>Names</h2>
{{#names}}
  <h3>{{name}}</h3>
{{/names}}
```

In Schnauzer there is a convenient way of transporting even more kinds of variables. As above there was headline="h3" passed to the partial that could be picked up as {{headline}} inside the partial. If a variable is passed without assigning (so, like: {{> user  headline="h3" foo}}) then it can be picked up by standard variable names: \$0, \$1, ... So, ```headline``` took the first place, so \$0 is taken, so ```foo``` is passed to \$1.

Example for recursive rendering (a menu-tree):

```js
var model = {
  name: 'first Element',
  childNodes: [{
    name: 'some Element'
  },{
    name: 'some Element'
  },{
    name: 'some Element',
    childNodes: [{
    {
      name: 'some Element'
    },{
      name: 'some Element'
    }]
  }]
}
```

```html
<li>{{name}}
  {{#childNodes.0}}
    <ul>
      {{#childNodes}}{{>self}}{{/childNodes}}
    </ul>
  {{/childNodes.0}}
</li>
```

### Custom Delimiters

Custom delimiters can be used in place of `{{` and `}}` by setting the new values in JavaScript.

#### Setting delimiters for Templates

Delimiters can be set by options or by using ```setTags([String, String])```. Other than with Mustage, Schnauzer doesn't switch delimiters while parsing but only before parsing:

```html+erb
var myTemplate = new Schnauzer(template, {
    tags: ['<%', '%>']
});
// or...
myTemplate.setTags(['<%', '%>']);
```

Custom delimiters may not contain whitespace.

## Pre-parsing and Caching Templates

By default, when schnauzer.js first parses a template it builds arrays of currying functions that keep all data cached. The currying functions not only already hold the parsed HTML snippets but also the right key to the JSON being passed so it can concatenate strings on the fly.
