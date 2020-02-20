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
  {{#with bar a=../../fooBar.soo.daa b=12}} -- bar -- {{/with}}
`;

var testStr_03 = `
  {{#with ../../bar.foo.saa}} -- bar -- {{/with}}
  {{#if ../@index}} -- bar -- {{/if}}
`;

var s = new Schnauzer(testStr_02, { helpers: {foo: function foo() {} } });

var out = s.render({ bar: 'bar-data'});

console.log(out);
