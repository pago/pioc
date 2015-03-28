var expect = require('chai').expect,
    pioc = require('../index');

describe('Injector', function() {
    var module, injector;
    beforeEach(function() {
        var singletonCounter = 0, factoryCounter = 0;
        module = pioc.createModule();
        module.value('message', 'Hello World')
            .bind('greeting', function(message) {
                return message+'!';
            })
            .bind('singleton', function() {
                return ++singletonCounter;
            })
            .bindFactory('factory', function() {
                return ++factoryCounter;
            })
            .bind('object', function() {
                return {};
            });
        injector = pioc.createInjector(module);
    });

    it('should execute the service it is resolving', function() {
        var test = null;
        injector.resolve(function(message) {
            test = message;
        });
        expect(test).to.equal('Hello World');
    });

    it('should provide all dependencies', function() {
        injector.resolve(function(greeting) {
            expect(greeting).to.equal('Hello World!');
        });
    });

    it('should inject the same instance of a service to all services it resolves', function() {
        injector.resolve(function(object) {
            object.foo = 'test';
        });
        injector.resolve(function(object) {
            expect(object.foo).to.equal('test');
        });
    });

    it('should inject a sub-module', function() {
        injector.resolve(function($module) {
            expect(module.isPrototypeOf($module)).to.be.true;
        });
    });

    it('should inject a provider for its module', function() {
        injector.resolve(function($provider) {
            expect(!!$provider).to.be.true;
        });
    });

    it('should inject the same provider', function() {
        injector.resolve(function(object, $provider) {
            var providedObject = $provider.get('object');
            object.bar = 'foo';
            providedObject.foo = 'test';
        });
        injector.resolve(function($provider) {
            var object = $provider.get('object');
            expect(object.foo).to.equal('test');
            expect(object.bar).to.equal('foo');
        });
    });

    it('should not inject the same module into siblings', function() {
        injector.resolve(function($pioc, $module, $provider) {
            $module.value('message', 'Hello Universe');
            $pioc.createInjector($module, $provider).resolve(function(greeting) {
                expect(greeting).to.equal('Hello Universe!');
            });
        });

        injector.resolve(function($pioc, $module, $provider) {
            $pioc.createInjector($module, $provider).resolve(function(greeting) {
                expect(greeting).to.equal('Hello World!');
            });
        });
    });

    it('should inject itself', function() {
        injector.resolve(function(object, $injector) {
            object.test = 'bar';
            $injector.resolve(function(object) {
                expect(object.test).to.equal('bar');
            });
        });
    });

    it('should inject when using array-notation', function() {
        injector.resolve([
            'object',
            function(obj) {
                expect(obj).to.exist;
            }
        ]);
    });

    it('should return a list of prefixed services if no module is registered for the name', function() {
        module.bind('routes/api', function(message) { return message; });
        module.bind('routes/auth', function(greeting) { return greeting; });

        injector.resolve(function(routes) {
            expect(routes.length).to.equal(2);
            expect(routes[0]).to.equal('Hello World');
            expect(routes[1]).to.equal('Hello World!');
        });
    });

    it('should ignore comments in dependency declaration', function() {
        injector.resolve(function(/* some stupid stuff */message, /** @type Foobar */ greeting) {
            expect(message).to.equal('Hello World');
        });
    });
});
