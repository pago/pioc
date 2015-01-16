var expect = require('chai').expect,
    pioc = require('../index');

require('6to5/polyfill');

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
        expect(test.getMessage()).to.equal('Hello World!');
    });
});
