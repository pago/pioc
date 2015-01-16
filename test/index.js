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

describe('Provider', function() {
    var module, provider;
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
        provider = pioc.createProvider(module);
    });

    it('should provide values', function() {
        expect(provider.get('message')).to.equal('Hello World');
    });

    it('should provide services', function() {
        expect(provider.get('greeting')).to.exist;
    });

    it('should inject dependencies', function() {
        expect(provider.get('greeting')).to.equal('Hello World!');
    });

    it('should not create more than one instance of a service', function() {
        expect(provider.get('singleton')).to.equal(provider.get('singleton'));

        var obj = provider.get('object');
        obj.foo = 'test';
        expect(provider.get('object').foo).to.equal('test');
    });

    it('should resolve factories each time it is asked for one', function() {
        expect(provider.get('factory')).to.equal(1);
        expect(provider.get('factory')).to.equal(2);
    });

    it('should not share resolved services with another Provider', function() {
        var secondProvider = pioc.createProvider(module),
            objA = provider.get('object'),
            objB = secondProvider.get('object');
        objA.value = 'Hello';
        objB.value = 'Bye';
        expect(objA.value).to.equal('Hello');
        expect(objB.value).to.equal('Bye');
    });

    it('should inherit resolved services from a parent', function() {
        var objA = provider.get('object'),
            subModule = module.create(),
            childProvider = provider.create(subModule);
        objA.value = 'test';

        expect(childProvider.get('object').value).to.equal('test');
    });

    it('should not pollute the parents module with its own services', function() {
        var subModule = module.create(),
            childProvider = provider.create(subModule);
        subModule.value('child:value', 'foo');

        expect(childProvider.get('child:value')).to.equal('foo');
        expect(function() {
            provider.get('child:value');
        }).to.throw(Error);
    });

    it('should use its own instance if the service is different from parent', function() {
        var subModule = module.create(),
            childProvider = provider.create(subModule),
            parentMessage = provider.get('message');
        subModule.value('message', 'Hello Universe');
        expect(childProvider.get('message')).to.equal('Hello Universe');
    });

    it('should create a new instance of a service if it depends on redefined services', function() {
        var subModule = module.create(),
            childProvider = provider.create(subModule),
            parentMessage = provider.get('message');
        subModule.value('message', 'Hello Universe');
        expect(childProvider.get('greeting')).to.equal('Hello Universe!');
    });

    it('should find all services for a given prefix', function() {
        module.bind('route/api', function(message) { return message; });
        module.bind('route/auth', function(greeting) { return greeting; });

        var subModule = module.create(),
            childProvider = provider.create(subModule);

        var routes = childProvider.getAll('route');
        expect(routes.length).to.equal(2);
        expect(routes[0]).to.equal('Hello World');
        expect(routes[1]).to.equal('Hello World!');
    });

    it('should create a new instance of a class if needed', function() {
        function Post(message) {
            this.message = message;
        }
        Post.prototype = Object.create(Object.prototype, {
            constructor: { value: Post },
            deliver: {
                value: function() {
                    return this.message;
                }
            }
        });
        module.bind('post', Post);
        var post = provider.get('post');
        expect(post).to.be.instanceOf(Post);
        expect(post.deliver()).to.equal('Hello World');
    });

    it('should inject properties into an object', function() {
        var inject = pioc.inject;
        module.bind('post', {
            deliver: function() {
                return this.message;
            },
            message: inject('greeting'),
            greeting: inject('message')
        });
        var post = provider.get('post');
        expect(post.deliver()).to.equal('Hello World!');
        expect(post.greeting).to.equal('Hello World');
    });

    it('should inject properties into a constructor', function() {
        var inject = pioc.inject;
        function Post() {
            expect(this).to.be.instanceOf(Post);
            expect(this.message).to.equal('Hello World');
        }
        Post.prototype = Object.create(Object.prototype, {
            constructor: { value: Post },
            message: { value: inject('message') },
            greeting: { value: inject() },
            deliver: {
                value: function() {
                    return this.message;
                }
            }
        });
        module.bind('post', Post);
        var post = provider.get('post');
        expect(post.greeting).to.equal('Hello World!');
    });

    it('should inject properties into an object when using inject(obj, ...propNames)', function() {
        var inject = pioc.inject;
        function Post() {
            expect(this).to.be.instanceOf(Post);
            expect(this.message).to.equal('Hello World');
        }
        Post.prototype.deliver = function() { return this.message; };
        inject(Post.prototype, 'message', 'greeting');

        module.bind('post', Post);
        var post = provider.get('post');
        expect(post.greeting).to.equal('Hello World!');
    });

    it('should inject properties into an object when using inject(...propNames, constructor)', function() {
        var inject = pioc.inject;
        var Post = inject('message', 'greeting',
            function Post() {
                expect(this).to.be.instanceOf(Post);
                expect(this.message).to.equal('Hello World');
            }
        );
        Post.prototype.deliver = function() { return this.message; };

        module.bind('post', Post);
        var post = provider.get('post');
        expect(post.greeting).to.equal('Hello World!');
    });

    it('should resolve services lazy when asked to', function() {
        var inject = pioc.inject;
        module.bind('test', {
            printer: inject.lazy('printer'),
            test: function() {
                return this.printer.message;
            }
        }).bind('printer', {
            test: inject.lazy('test'),
            message: inject('message'),
            print: function() {
                // well.. we're going from this => test => this => message
                // but that should show that cyclic references work
                return this.test.printer.message;
            }
        });
        var printer = provider.get('printer');
        expect(printer.print()).to.equal(provider.get('message'));
        expect(printer.print()).to.equal(provider.get('message'));
        expect(provider.get('test').test()).to.equal(provider.get('message'));
    });
});

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
