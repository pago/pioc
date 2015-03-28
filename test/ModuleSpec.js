var expect = require('chai').expect,
    pioc = require('../index');

describe('Module', function() {
    it('can be created through pioc', function() {
        var module = pioc.createModule();
        expect(module).to.exist;
    });

    it('bindings can be chained', function() {
        var module = pioc.createModule();
        var returnValue = module.bind('myService', function() {
            return 'foo';
        });
        expect(returnValue === module).to.be.true;
    });

    it('should create a child module in its prototype chain', function() {
        var module = pioc.createModule(),
            child = module.create(),
            grandchild = child.create();
        expect(module.isPrototypeOf(child)).to.be.true;
        expect(module.isPrototypeOf(grandchild)).to.be.true;
    });

    it('should allow multiple service definitions to be specified at once', function() {
        var module = pioc.createModule();
        module.bind({
            foo: function() {},
            bar: function() {}
        });
        expect(module.has('foo')).to.be.true;
        expect(module.has('bar')).to.be.true;
    });
});