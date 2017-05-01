// basic API tests
describe("Schnauzer late initialized", function() {
	var Schnauzer = require('../../schnauzer');
	var schnauzer = new Schnauzer();
	var data = { foo: 'some text' };
	var out = '';

	it("should be able to initialize a template", function() {
		schnauzer.parse('--{{foo}}--');
		expect(schnauzer.partials.self).toBeDefined();
	});

	it("should be able to render", function() {
		out = schnauzer.render(data);
		expect(out).toBe('--some text--');
	});
});
// basic API tests
describe("Schnauzer initialized", function() {
	var Schnauzer = require('../../schnauzer');
	var schnauzer;

	beforeEach(function() {
		schnauzer = new Schnauzer('--{{foo}}--{{> partial}}');
	});

	it("should not overwrite initial template", function() {
		var test = schnauzer.partials.self;
		// it should not be possible to overwrite initial template
		expect(schnauzer.partials.self).toBeDefined();
		schnauzer.parse('{{new}}');
		expect(schnauzer.partials.self).toBe(test); // first proove
		expect(schnauzer.render({ foo: 'some text' })).toEqual('--some text--'); // second proove
	});

	it("should be able to register helpers", function() {
		schnauzer.registerHelper('foo', function(text, $1) {
			return 'helper installed';
		});
		expect(schnauzer.options.helpers.foo).toBeDefined();
		expect(schnauzer.render({ foo: 'some text' })).toEqual('--helper installed--');
	});

	it("should be able to unregister a helper", function() {
		schnauzer.unregisterHelper('foo');
		expect(schnauzer.options.helpers.foo).toBeUndefined();
		expect(schnauzer.render({ foo: 'some text' })).toEqual('--some text--');
	});

	it("should be able to register a partial", function() {
		schnauzer.registerPartial('partial', 'I\'m a partial--{{foo}}');
		expect(schnauzer.partials.partial).toBeDefined();
		// need to re-initialize main template
		delete schnauzer.partials.self;
		schnauzer.parse('--{{foo}}--{{> partial}}');

		expect(schnauzer.partials.partial({foo: 'lll'})).toEqual('I\'m a partial--lll');
		expect(schnauzer.render({ foo: 'some text' })).toEqual('--some text--I\'m a partial--some text');
	});

	it("should be able to register a partial", function() {
		schnauzer.unregisterPartial('partial');
		expect(schnauzer.partials.partial).toBeUndefined();
		expect(schnauzer.render({ foo: 'some text' })).toEqual('--some text--');
	});

	it("should be able to switch tags", function() {
		schnauzer.setTags(['<%', '%>']);
		// need to re-initialize main template
		delete schnauzer.partials.self;
		schnauzer.parse('--<%foo%>--<%> partial%>');

		expect(schnauzer.render({ foo: 'some text' })).toEqual('--some text--');
	});
});
// The following test will be split into little tests...
describe("Schnauzer in template test", function() {
	var Schnauzer = require('../../schnauzer');
	var schnauzer = new Schnauzer(`<li id="{{id}}" class="todo-list-item{{#done}}  {{#done}}ff{{#done}}{{text}}{{/done}}{{/done}} completed{{/done}}">
			--dot--{{dot.notation}}--notation--
			{{#dot.notation}}
				--DOT--{{dot.notation}}
			{{/dot.notation}}
			{{#tadaa}}YEStadaa{{/tadaa}}
			{{^tadaa}}NOtadaa{{/tadaa}}
			{{#tadaa2}}YEStadaa2{{#tadaa2}}YEStadaa2{{/tadaa2}}gg{{/tadaa2}}
			{{^tadaa2}}NOtadaa2{{/tadaa2}}{{tadaa}}
			{{#tadaa3}}YEStadaa3{{/tadaa3}}
			{{^tadaa3}}NOtadaa3{{/tadaa3}}
			{{#tadaa4}}YEStadaa4{{/tadaa4}}
			{{^tadaa4}}NOtadaa4{{/tadaa4}}
			{{#func}}---some func---{{/func}}
			{{> tinytemplate}}
			<input class="toggle" type="checkbox"{{#done}}  checked=""{{/done}}>
			<label>{{{text}}}{{text}}{{! this should go}}</label>
			{{#loop}}
				<div>
					{{#helper}}+++helper{{firstName}}+++{{/helper}}
					{{firstName}}
					{{#lastName}}
						{{lastName}}
						{{#foo}}--dot--{{dot.notation}}--notation--11{{tadaa}}
							<div>{{> tinytemplate}}
							{{foo}}
							{{#fii}}
								{{#lastName}}
									{{fiis}}<-->{{fiis}}
								{{/lastName}}
							{{/fii}}
							</div>
						{{/foo}}
					{{/lastName}}
				</div>
			{{/loop}}
			<button class="destroy"></button>
			<input class="edit" value="{{text}}">
		</li>`);
	var data = {
		tadaa: 1,
		tadaa3: [1, 2, 3],
		tadaa4: [],
		dot: {
			notation: 'dor-notation'
		},
		text: '<div>some text</div>',
		done: true,
		bar: 'another bar',
		id: function(data, text, tree, key) {
			return '00';
		},
		func: function(text, key1, key2) {
			return text + 'oooooooooo';
		},
		test: [{
			name: true,
		}, {
			name: false,
		}, {
			name: true,
		}],
		loop: [{
			firstName: 'foo',
			lastName: 'fLastname',
			foo: '###foo',
			bar: '###barrrr',
			fii: [{
				fiis: 'fiis01'
			}, {
				fiis: 'fiis02'
			}, {
				fiis: 'fiis03'
			}]
		}, {
			firstName: 'bar',
			lastName: 'bLastname',
			foo: '###bar',
			fii: [{
				fiis: 'fiis2'
			}]
		}, {
			firstName: 'fee',
			lastName: 'xLastname',
			foo: '###fee',
			fii: [{
				fiis: 'fiis3'
			}]
		}]
	};
	var out = '';

	it("should render correctly", function() {
		expect(schnauzer.render(data)).toBe(`<li id="00" class="todo-list-item  ff&lt;div&gt;some text&lt;&#x2F;div&gt; completed">
			--dot--dor-notation--notation--
			
				--DOT--dor-notation
			
			YEStadaa
			
			
			NOtadaa21
			YEStadaa3YEStadaa3YEStadaa3
			
			
			NOtadaa4
			---some func---oooooooooo
			
			<input class="toggle" type="checkbox"  checked="">
			<label><div>some text</div>&lt;div&gt;some text&lt;&#x2F;div&gt;</label>
			
				<div>
					
					foo
					
						fLastname
						--dot--dor-notation--notation--111
							<div>
							###foo
							
								
									fiis01<-->fiis01
								
							
								
									fiis02<-->fiis02
								
							
								
									fiis03<-->fiis03
								
							
							</div>
						
					
				</div>
			
				<div>
					
					bar
					
						bLastname
						--dot--dor-notation--notation--111
							<div>
							###bar
							
								
									fiis2<-->fiis2
								
							
							</div>
						
					
				</div>
			
				<div>
					
					fee
					
						xLastname
						--dot--dor-notation--notation--111
							<div>
							###fee
							
								
									fiis3<-->fiis3
								
							
							</div>
						
					
				</div>
			
			<button class="destroy"></button>
			<input class="edit" value="&lt;div&gt;some text&lt;&#x2F;div&gt;">
		</li>`);
	});
});
