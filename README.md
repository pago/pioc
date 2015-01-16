# pioc - A Dependency Injection Container for node.js

Since you're already here, I suppose you know what Dependency Injection is. If not,
please take a look at [Martin Fowlers Article](http://www.martinfowler.com/articles/injection.html).
Don't be afraid, this is a tool for Javascript, not Java, so you won't need to write
XML or anything like that to configure **pioc**.

The short story is that **pioc** will allow you to write loosely coupled modules which enable you to easily switch specific implementations with something else (i.e. for tests or during natural growth of an application) without the mess that you'd normally have to work through.

**pioc** is very smart about how and *when* to initialize your services. It supports **constructor injection**, **property injection**, static values and even **module inheritance** with all the parts that are needed to make it work.

If you were writing Java, **pioc** would remove the need for the "new" keyword in your vocabulary. For Javascript, it does the same but it also removes many function invocations, *require* statements and so on.

Whether you're writing an **express.js** application or a website, **pioc** has the features you need to be more productive and it has an extensive test suite.

## License

**pioc** is *MIT* licensed.

## Installation

```
npm install --save pioc
```

## Example

Before I explain any details, let me give you an example of what can be done
with **pioc** and how it is used.

```javascript
// inside lib/db.js
var MongoClient = require('mongodb').MongoClient;
// we can write modules that require dependencies by specifying
// module.exports as a function
// This one needs a Promise constructor and the configuration for our app
module.exports = function(Promise, config) {
    // you like Promises, don't you?
    return Promise(function(resolve, reject) {
        MongoClient.connect(config.db.url, function(err, db) {
            if(err) return reject(err);
            resolve(db);
        });
    });
};
```

```javascript
// inside config/development.json
{
    "db": {
        "url": "mongodb://localhost:27017/myproject"
    }
}
```

```javascript
// inside app.js
var pioc = require('pioc'),
    // create a new module,
    // by specifying __dirname, we can load services using
    // node.js require relative to the app.js file
    module = pioc.createModule(__dirname)
        // not stricly necessary to bind bluebird as a Promise service,
        // but this offers us the option to change to a different implementation
        // easily
        .value('Promise', require('bluebird'))
        // load the config/development.json file and store it as a value service.
        .loadValue('config/development')
        // and now load our lib/db.js
        .load('lib/db'),
    // a module is not able to do anything on its own, most often, you'll
    // want an injector or provider to go with it
    injector = pioc.createInjector(module);

// Now let's resolve some dependencies
injector.resolve(function(db) {
    db.then(function(db) {
        console.log('successfully connected to the database!');
        db.close();
    }).catch(function(err) {
        console.log(err);
    });
});
```

## Changes

### Version 1.2
- **inject.lazy(serviceName)**: Specify a lazy property injection.
- **Symbol support**: Support injecting properties that are defined using ES6 Symbol.

### Version 1.1

- **Provider#getAll(servicePrefix)**: Returns a list of all services that start with the given prefix.
- **Property injection**: Constructor functions and objects can use pioc.inject to specify properties that should be injected during the resolve process.
- **Object instantiation**: Services can now be constructors instead of just simple factory functions.
- Undocumented Module#bind(serviceName).to(serviceDefinition) has been *removed*.
- **Module#bind(obj), Module#value(obj), Module#factory(obj)**: Binds all services defined in the object to their property name.
- **Module#has(serviceName)**: Returns `true`, if the service is defined in the module (or a parent module); `false`, otherwise.
- Comments in function declarations are *ignored* (would've resulted in an error previously).

## Structure

In **pioc**, a *Module* simply stores *service definitions* but it has nothing
at all to do with how they're resolved or injected into other services.

The task of resolving a *service definition* is the responsibility of the
*Provider*. The *Injector* we saw above is simply a convenient way
to start an application. Instead of doing it the way I displayed above, you
could also get a *Provider* for the *Module* and ask it to resolve a
*service definition* that acts as the starting point of your application.

What that means is simple: If a *Module* is not responsible for resolving a
service, then you can create child modules, as well as more than one *Provider*
and *Injector* from the same *Module* and each of them will provide their
own instance of your service.

## Inheritance

*Module* and *Provider* can both create children. This allows you to create only
the amount of instances of a service that you really need. Let's have a look at it.

```javascript
var pioc = require('pioc'),
    // create a module and a child module
    module = pioc.createModule(),
    childModule = module.create(),
    // create a provider and a child provider
    provider = pioc.createProvider(module),
    childProvider = provider.create(childModule);

// now let's define some services
module.value('message', 'Hello World')
    .bind('write', function() {
        return function(text) {
            console.log(text);
        };
    })
    .bind('greeting', function(message) {
        return message + '!';
    })
    .bind('logger', function(greeting, write) {
        return function() {
            write(greeting);
        };
    });

// override the definition of "message" for the child
childModule.value('message', 'Hello Universe');

// get our services
var logWorld = provider.get('logger'),
    logUniverse = childProvider.get('logger');

// prints "Hello World!"
logWorld();

// prints "Hello Universe!"
logUniverse();
```

Since a *Module* and a *Provider* can both create children and inheritance works
as expected, we can create the same service with entirely different configurations
as if it was nothing.

However, since **pioc** always tries to limit the instances of a service to the
minimum, our _write_ service is only instantiated once.

If you're application has modules that need to redefine some dependencies, you
can create a child module and a new *Provider* or *Injector* for the specifiy
module and it'll receive the proper dependencies.

## Available services in an *Injector*

When using an *Injector*, you gain free access to a few useful services:

* **$module**: A child of the current *Module*
* **$provider**: The currently used *Provider*
* **$injector**: The *Injector* instance
* **$pioc**: The **pioc** object

Using these services, you can create sub modules like this:

```javascript
injector.resolve(function($pioc, $module, $provider) {
    $module.bind('message', 'Hi World');
    var injector = $pioc.createInjector($module, $provider);
    injector.resolve(function(logger) {
        // prints "Hi World!" to console.log
        logger();
    });
});
```

By sharing an ancestoral *Provider* in you're sub module, you can be certain that
only those services are freshly instantiated which depend on modified services.

## API Documentation

### require('pioc')

#### createModule([rootDirectory: String]): Module
Creates a new *Module*. If a *rootDirectory* is specified, the new *Module*
will load all services relative to that directory.

#### createProvider(module: Module): Provider
Creates a new *Provider* for the given *Module*.

#### createInjector(module: Module[, provider: Provider]): Injector
Creates a new *Injector* for the given *Module*. The *Injector* will use
the a child of the given *Provider* or a new one.

#### inject(serviceName: String): Object
Creates an injectable annotation that signals pioc to inject the required service during the resolve process.

*Example*

```javascript
var inject = pioc.inject;
module
    .value('message', 'Hello World!')
    .bind('foo', {
        message: inject('message'),
        sayHello: function() {
            console.log(this.message);
        }
    });
provider.get('foo').sayHello(); // => Hello World!
```

#### inject.lazy(serviceName: String): Object
Creates an injectable annotation that signals pioc to inject the required service as
soon as it is accessed. Using this annotation allows circular dependencies.

*Example*

```javascript
var inject = pioc.inject;
module
    .value('message', 'Hello World!')
    .bind('test', {
        printer: inject.lazy('printer'),
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
```

#### inject(): Object
Creates an injectable annotation that signals pioc to inject the required service during the resolve process.
The service name will be inferred through the property name.

*Example*

```javascript
module
    .value('message', 'Hello World!')
    .bind('foo', {
        message: pioc.inject(), // requires the service "message"
        sayHello: function() {
            console.log(this.message);
        }
    });
provider.get('foo').sayHello(); // => Hello World!
```

#### inject(target:Function|Object, ...serviceNames): target
Defines injectable annotations for the given service name on the object or the prototype
of the function and returns the given `target`.

*Example*

```javascript
var inject = pioc.inject;
module
    .value('message', 'Hello World!')
    .bind('foo', inject({
        sayHello: function() {
            console.log(this.message);
        }
    }, 'message'));
provider.get('foo').sayHello(); // => Hello World!
```

#### inject(...serviceNames, target:Function|Object): target
Defines injectable annotations for the given service name on the object or the prototype
of the function and returns the given `target`.

*Example*

```javascript
var inject = pioc.inject;
module
    .value('message', 'Hello World!')
    .bind('foo', inject('message', function() {
        this.sayHello = function() {
            console.log(this.message);
        };
    }));
provider.get('foo').sayHello(); // => Hello World!
```

### Injector

#### resolve(service: Function|Array<String...,Function>): Any
Resolves the specified service and returns whatever the service returned.

If a dependency doesn't exist, it'll instead try to load all services with that prefix (see Provider#getAll).

*Example*

```javascript
module
    .value('config', { port: 3000 })
    .bind('routes/auth', require('./app/modules/auth'))
    .bind('routes/api', require('./app/modules/api'));
var app = injector.resolve(function(routes, config) {
    var app = express();
    routes.forEach(function(route) { app.use(routes); });
    return app.listen(config.port);
});
```

### Provider

#### get(name: String): Any|Array<Any>
Returns an instance of the specified service. If no service with the given name was found,
an error will be thrown.

**throws**: Error, if the specified *service* is not defined in the *module* or a parent of the *module* associated with the *Provider*.

#### getAll(servicePrefix: String): Array<Any>
Returns all services whose name starts with the given prefix.

*Example*

```javascript
module
    .bind('routes/auth', require('./app/modules/auth'))
    .bind('routes/api', require('./app/modules/api'));
var routes = provider.getAll('routes/');
var app = express();
routes.forEach(function(route) { app.use(routes); });
app.listen(3000);
```

#### create(module: Module): Provider
Returns a new child of this *Provider* with the specified child *Module*.

**throws**: Error, if the given *module* is not a child of the *module* of the
*Provider* it is invoked for.

### Module

#### value(name: String, service: Any): Module
Binds the specified _service_ to the given _name_. A service that is bound using
*value* will resolved as is, i.e. no dependencies will be injected into it.

Returns the module to allow method chaining.

#### value(serviceContainer: Object): Module
For each _service_ as _name_ in _serviceContainer_, it binds the specified _service_ to the given _name_.
A service that is bound using *value* will resolved as is, i.e. no dependencies will be injected into it.

Returns the module to allow method chaining.

*Example*

```javascript
module.value({
    config: { port: 3000 },
    db: { url: 'mongodb://...' }
});
provider.get('config').port === 3000;
provider.get('db').url === 'mongodb://...';
```

#### bind(name: String, service: Any): Module
Binds the specified _service_ to the given _name_. The service will be resolved
when needed (i.e. lazy) and behaves like a singleton unless Inheritance requires
a new instance (i.e. dependencies have been reconfigured for a child module).

Returns the module to allow method chaining.

#### bind(serviceContainer: Object): Module
For each _service_ as _name_ in _serviceContainer_, it binds the specified _service_ to the given _name_. The service will be resolved
when needed (i.e. lazy) and behaves like a singleton unless Inheritance requires
a new instance (i.e. dependencies have been reconfigured for a child module).

Returns the module to allow method chaining.

#### bindFactory(name: String, service: Any): Module
Binds the specified _service_ to the given _name_. The service will be resolved
when needed (i.e. lazy) and will be instantiated whenever the specified service is
requested. This is intended to be used for services that should never behave like
a singleton.

Returns the module to allow method chaining.

#### bindFactory(serviceContainer: Object): Module
For each _service_ as _name_ in _serviceContainer_, it binds the specified _service_ to the given _name_. The service will be resolved
when needed (i.e. lazy) and will be instantiated whenever the specified service is
requested. This is intended to be used for services that should never behave like
a singleton.

Returns the module to allow method chaining.

#### loadValue([name: String, ]filename: String): Module
Loads a service using require. The module.exports of the file will be bound as a
value.

If *name* is specified, the service will be bound by that name, otherwise, the
name of the service will be retrieved by using the last segment of the *filename*,
without any file extensions.

Returns the module to allow method chaining.

#### load([name: String, ]filename: String): Module
Loads a service using require. The module.exports of the file will be bound to
this module.

If *name* is specified, the service will be bound by that name, otherwise, the
name of the service will be retrieved by using the last segment of the *filename*,
without any file extensions.

Returns the module to allow method chaining.

#### loadFactory([name: String, ]filename: String): Module
Loads a service using require. The module.exports of the file will be bound to
this module as a factory.

If *name* is specified, the service will be bound by that name, otherwise, the
name of the service will be retrieved by using the last segment of the *filename*,
without any file extensions.

Returns the module to allow method chaining.

#### has(name: String): Boolean
Returns `true`, if the specified service is defined in this module or a parent module; `false`, otherwise.

#### create(): Module
Returns a new child of this *Module*.
