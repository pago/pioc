require('babel/polyfill');

var expect = require('chai').expect,
    pioc = require('../index');

describe('Resolver', function() {
    it('can resolve Symbol properties', function() {
        var printer = Symbol(),
            dataObject = {
                getMessage: function() {
                    return this[printer];
                }
            };
        dataObject[printer] = pioc.inject('message');
        var $module = pioc.createModule()
            .bind('message', function() {
                return 'Hello World!';
            })
            .bind('data', dataObject),
            provider = pioc.createProvider($module);
        var test = provider.get('data');
        expect(typeof Reflect).to.equal('object');
        expect(process.version).to.equal('v0.10.35');
        expect(test[printer]).to.equal('Hello World!');
        expect(test.getMessage()).to.equal('Hello World!');
    });
});
