var output = document.querySelector('output');

var testStr_01 = `
<div>
  {{{> a b as (c d)}}}
  {{#z second third fourth}}zzzz zz{{/z}}
  {{foo dd as bar}}
  {{^%b}}
    hhh
    {{#with c as |foo key|}}
      cc1ccc{{foo}}{{>foo}}
    {{/with}}
  {{/%b}}
  {{#%%b}}
    hhh
    {{#if c.a.n}}
      cc2cc
      {{{#if c}}}
        cc3c
        {{#* inline "follow-button"}}
          cc4c
        {{/inline}}
      {{else}}
        {{#foo c moreVars}}
          cc4c
        {{/foo}}
        --else--
      {{{/if}}}
    {{/if}}
    hh
  {{/%%b}}
  {{{> follow-button b="ddd" c=foo d}}}
</div>
`;

var testStr_02 = `
  {{#* inline "follow-button"}} -- inline partial -- {{/inline}}
  {{foo bar}}
  {{bar bar}}
  {{bar dd=fooBar}}
  {{>follow-button data=bar}}
  {{!-- follow-button data=bar --}}
  {{= follow-button data=bar}}
  {{^someArray bar}} -- bar -- {{/someArray}}
  {{#someArray bar}} -- bar -- {{foo bar}} --- {{/someArray}}
  {{{#someArray bar="aaa"}}} -- bar -- {{{/someArray}}}
  {{#if bar}} -- bar -- {{/if}}
  {{#if foo}} -- bar -- {{/if}}
  {{#with bar}} -- bar -- {{/with}}
  {{#with %bar as |val key|}} -- bar -- {{/with}}
  {{#with ../../bar.foo.saa}} -- bar -- {{/with}}
  {{#with ../@index}} -- bar -- {{/with}}
  {{#with bar a="12"}} -- bar -- {{else}} -- bar alt -- {{/with}}
  {{#with bar a=../../fooBar/soo/daa b=12}} -- bar -- {{/with}}
`;

var testStr_03 = `
  {{#with ../../bar.foo.saa}} -- bar -- {{/with}}
  {{#if ../@index}} -- bar -- {{/if}}
  {{#with %bar as |val key|}} -- bar -- {{/with}}
  {{#with %bar as |val|}}
    {{inlineHelper "See Website" href=person.url class="person" 100 false}}
    {{>partial "See 'Website' hunter" 'See \'Website\' "hunter"' @index href=person.url class="person" 100 false}}
  {{/with}}
  {{#with bar.as.doo a=../../fooBar/soo/daa b=12}} -- bar -- {{/with}}
  {{outer-helper (inner-helper 'abc') 'def' }}
`;

  // {{outer-helper foo ("inner-helper's" 'abc') 'def' ('foo' 'bar') barBar }}
  // {{foo "bar's" nav 'bar\'s'}}

  var testStr_04 = `
  {{outer-helper foo (inner-helper "abc") "def" ("foo" "bar") barBar }}
  {{sss ("inner-helper's" "bar's sss" "abc") "def"}}
  {{sss ("inner-helper's" "bar's sss" %fff=../../abc.cde.foo) "def"}}
  {{sss "inner-helper's" "bar's sss" fooo=" abc + ll" "def"}}
`;
// var testStr_04 = `
//   {{sss 'inner-helper\'s' 'bar\'s "sss"' 'abc' 'def'}}
// `;

var testStr_all = `
  /// ------- Inline

  {{firstname}}

  {{{firstname}}}

  {{person.firstname}}
  {{person/firstname}}
  {{./name}} or {{this/name}} or {{this.name}}

  {{!-- wrong: {{array.0.item}} --}}
  {{array.[0].item}}

  {{!-- wrong: {{array.[0].item-class}} --}}
  {{array.[0].[item-class]}}

  {{!-- wrong: {{./true}}--}}
  ./[true]: {{./[true]}}

  {{inlineHelper lastname}}
  {{inlineHelper "See Website" url someMore}}
  {{inlineHelper "Finish" 100 false}}
  {{inlineHelper "See Website" href=person.url class="person"}}

  {{outer-helper (inner-helper 'abc') 'def'}}

  {{> (whichPartial) }}
  {{> (lookup . 'myVariable') }}
  {{> myPartial myOtherContext }}
  {{> myPartial parameter=value }}
  {{> myPartial name=../name }}

  /// ------- Blocks

  {{#each people}}
    {{../prefix}} {{firstname}} 
  {{/each}}
  {{#people}}
    {{../prefix}} {{firstname}} 
  {{/people}}

  {{#with story}}
    <div class="intro">{{{intro}}}</div>
    <div class="body">{{{body}}}</div>
  {{/with}}
  {{#story}}
    <div class="intro">{{{story.intro}}}</div>
    <div class="body">{{{story.body}}}</div>
  {{/story}}

  {{#listHelper nav}} !!!!!!!!!!!!!!!!!!!!
    <a href="{{url}}">{{title}}</a>
  {{/list}}

  {{#listHelper nav id="nav-bar" class="top"}} !!!!!!!!!!!!!!!!!!!!
    <a href="{{url}}">{{title}}</a>
  {{/list}}

  {{#list array}}
    {{@index}}. {{title}}
  {{/list}}

  {{#each users as |user userId|}}
    Id: {{userId}} Name: {{user.name}}
  {{/each}}

  {{#each users}}
    Id: {{@key}} Name: {{@value.name}} ???????
  {{/each}}

  {{#with users}}
    Id: {{@key}} Name: {{./name}} ???????
  {{/each}}

  {{#if test}}
    {{title}}
  {{^}}
    Empty
  {{/if}}

  {{#if test}}
    {{title}}
  {{else}}
    Empty
  {{/if}}

  {{#if isActive}}
    <img src="star.gif" alt="Active">
  {{else if isInactive}}
    <img src="cry.gif" alt="Inactive">
  {{/if}}

  // {{#each children as |child|}}
  //   {{#> childEntry}}
  //     {{child.value}}
  //   {{/childEntry}}
  // {{/each}}
`;

var testStr_test = `
  <div>Hello {{person.name}}</div>
  <div>Found foo: {{foo~}}    </div>
  <div>
    {{{#if person~}}}
      <div>Hello {{person.name}}</div>
    {{~else if foo.bar.fooBar~}}
      Nothing to print!
    {{{~else if sss (inner-helper "abc")~}}}
      Nothing to print2!
    {{else}}
      Nothing to print3!
    {{{~/if}}}
    {{#if person~}}
      Just Text;
      {{#if foo~}}
        Just Text if (foo);
      {{/if}}
      {{~#if bar}}
        Just Text if (bar);
      {{else~}}
        Just Text else (bar);
      {{~/if}}
    {{~/if}}
  </div>
  {{#with person~}}
    <div>{{name}}</div>
    {{~#with lastName}}
      <div>{{name}}</div>
    {{/with~}}
  {{/with}}
  {{> (whichPartial foo bar.sss) as |foo bar| %%this.foo ./bar.sde foo.bar.de 100 false a=1000 "aaa" bb="ddd"}}
  {{> ddd as |foo bar| %%this.foo}}
`;

var testStr_test = `
{{#each nav}}
  <a href="{{url}}">
    {{#if test}}
      {{title}}
    {{else}}
      Empty
    {{/if}}
  </a>
{{~/each}}`;

var testStr_test = `
{{#if ./foo}}
  Foo
  {{/if}}
  {{/if}}
{{44}}
{{'44'}}
{{0}}
{{true}}
{{false}}
{{#if true}}55{{/if}}
{{#if extra}}
| Extra
{{/if}}
| {{#if bar}}
    Bar
  {{else if hhh}}
    no Bar
  {{/if}}
| {{#each arr}}
  {{.}}{{#unless @last}}, {{/unless}}
{{/each}}
| {{#each arrObj}}
  {{key}}({{@key}}): {{value}}{{#unless @last}}, {{/unless}}
{{/each}}
| {{foo}}
| {{persons.lastName.name foo="bar"}}`;

var testStr_test = `
{{#if foo bar dd=8 "fooooo and bar" 112 true}}
    --Foo helper content-- |
  {{else unless foo ggg}}
    no Bar
  {{else}}
    the else
{{/if}}{{12}}
{{foo}}
{{#foo}}sss{{/foo}}`;

var model = {
  person: {
    name: 'World!',
    lastName: {
      name: 'lastName'
    }
  },
  foo: true,
  arr: [1, 2, 3],
  arrObj: [
    { key: 'key1', value: 'value1'},
    { key: 'key2', value: 'value2'},
    { key: 'key3', value: 'value3'},
  ],
  hhh: true,
  bar: false
};

// var testStr_test = `
// {{#each nav}}
//   <a href="{{url}}">
//     {{#if test}}
//       {{title}}
//     {{else}}
//       Empty
//     {{/if}}
//   </a>
// {{~/each}}`;




var s = new Schnauzer('', {
  helpers: {
    // foo: function foo($1, $2, $3, $4, $5) {
    //   console.log('--helper--', this, $1, $2, $3, $4, $5);
    //   return this.getBody() || '--inline Foo--'; // block or inline
    // }, //'I\m a helper' },
    foo: function foo(getBody, escapeHTML, scope, getData) {
      console.log('--helper--', this);
      console.log(scope);
      console.log(getData('person.lastName.name'));
      return getBody() || '--inline Foo--'; // block or inline
    }, //'I\m a helper' },
    inlineHelper: function inlineHelper() {},
  },
  partials: {
    partial: function foo() {},
  }
});

// console.log(s);

// testStr_test = testStr_test.replace(/[ ]*({{2,3}(?:(?!{{2,3})[\S\s])*}{2,3})/g, '$1');
// console.log(testStr_test);
s.parse(testStr_test);

var out = s.render(model, {
  extra: true,
  persons: {
    name: 'World! extra',
    lastName: {
      name: 'lastName extra'
    }
  }
});


output.innerHTML = out;
console.log(out);
