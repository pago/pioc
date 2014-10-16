var path = require('path'),
    servicePropertyPrefix = '$$service-';

function parseFunctionArguments(func) {
    // TODO: Either parse or ignore any comments that are contained in the argument list
//return func.toString().match(/function\s*\w*\s*\((.*?)\)/)[1].split(/\s*,\s*/);
    var args = func.toString ().match (/^\s*function\s+(?:\w*\s*)?\((.*?)\)/);
    args = args ? (args[1] ? args[1].trim ().split (/\s*,\s*/) : []) : null;
    return args;
}

function isArrayNotation(service) {
    var result = true,
        len = service.length;
    for(var i = 0; i < len-1; i++) {
        if(toString.call(service[i]) !== '[object String]') {
            result = false;
            break;
        }
    }
    return result && toString.call(service[len-1]) === '[object Function]';
}

function getDependencyList(service) {
    var toString = Object.prototype.toString,
        type = toString.call(service);
    if(type === '[object Function]') {
        return service.$requires || parseFunctionArguments(service);
    } else if(type === '[object Array]') {
        if(isArrayNotation(service)) {
            return service.slice(0, service.length-1);
        }
    }
    return [];
}

function getFactory(service) {
    var toString = Object.prototype.toString,
        type = toString.call(service);
    if(type === '[object Function]') {
        return service;
    } else if(type === '[object Array]' && isArrayNotation(service)) {
        return service[service.length-1];
    }
    return function() { return service; };
}

function resolve(service, provider) {
    var args = service.dependencies.map(function(arg) {
        return provider.get(arg);
    });
    return service.factory.apply(null, args);
}

var ToObject = {
    $type: 'singleton',
    $module: null,
    $name: null,
    to: function(service) {
        switch(this.$type) {
            case 'singleton':
                this.$module.bind(this.$name, service);
                break;
            case 'value':
                this.$module.value(this.$name, service);
                break;
            case 'factory':
                this.$module.bindFactory(this.$name, service);
                break;
        }

        return this.$module;
    },

    toFile: function(filename) {
        var servicePath = path.join(this.$module.__dirname, filename);
        return this.to(this.$name, require(servicePath));
    }
};

var Module = {
    value: function(name, service) {
        if(arguments.length === 1) {
            return Object.create(ToObject, {
                $type: 'value',
                $module: { value: this },
                $name: { value: name }
            });
        }
        this[servicePropertyPrefix+name] = {
            factory: function() { return service; },
            singleton: true,
            dependencies: []
        };
        return this;
    },
    bind: function(name, service) {
        if(arguments.length === 1) {
            return Object.create(ToObject, {
                $module: { value: this },
                $name: { value: name }
            });
        }
        this[servicePropertyPrefix+name] = {
            factory: getFactory(service),
            singleton: true,
            dependencies: getDependencyList(service)
        };
        return this;
    },
    bindFactory: function(name, service) {
        if(arguments.length === 1) {
            return Object.create(ToObject, {
                $type: 'factory',
                $module: { value: this },
                $name: { value: name }
            });
        }
        this[servicePropertyPrefix+name] = {
            factory: getFactory(service),
            singleton: false,
            dependencies: getDependencyList(service)
        };
        return this;
    },
    load: function(name, filename) {
        if(arguments.length === 1) {
            filename = name;
            name = null;
        }
        var servicePath = path.join(this.__dirname, filename),
            service = require(servicePath);
        this.bind(name || (service && service.$serviceName) || path.basename(filename, '.js'), service);
        return this;
    },
    loadValue: function(name, filename) {
        if(arguments.length === 1) {
            filename = name;
            name = null;
        }
        var servicePath = path.join(this.__dirname, filename),
            service = require(servicePath);
        this.value(name || (service && service.$serviceName) || path.basename(filename, '.js'), service);
        return this;
    },
    loadFactory: function(name, filename) {
        if(arguments.length === 1) {
            filename = name;
            name = null;
        }
        var servicePath = path.join(this.__dirname, filename),
            service = require(servicePath);
        this.loadFactory(name || (service && service.$serviceName) || path.basename(filename, '.js'), service);
        return this;
    },
    create: function() {
        return Object.create(this);
    }
};

function findResponsibleProvider(startProvider, name, service) {
    var provider = startProvider,
        parent = Object.getPrototypeOf(provider);
    while(parent !== Provider) {
        if(isResponsibleFor(provider, name, service, parent)) {
            return provider;
        }
        provider = parent;
        parent = Object.getPrototypeOf(provider);
    }
    return provider;
}

function isResponsibleFor(provider, name, service, $parent) {
    var parent = $parent || Object.getPrototypeOf(provider);
    var isQuickExit = (
            provider.$responsibleFor[servicePropertyPrefix+name] ||
            parent === Provider ||
            parent.$module[servicePropertyPrefix+name] !== service
        );
    if(isQuickExit) {
        provider.$responsibleFor[servicePropertyPrefix+name] = true;
        return true;
    }
    if(provider.$responsibleFor[servicePropertyPrefix+name] === false) {
        return false;
    }

    var dependencies = service.dependencies;
    for(var i = 0, len = dependencies.length; i < len; i++) {
        var dependency = dependencies[i],
            isResponsibleForDependency = isResponsibleFor(
                provider,
                dependency,
                provider.$module[servicePropertyPrefix+dependency],
                parent
            );
        if(isResponsibleForDependency) {
            provider.$responsibleFor[servicePropertyPrefix+name] = true;
            return true;
        }
    }
    provider.$responsibleFor[servicePropertyPrefix+name] = false;
    return false;
}

var Provider = {
    $module: null,
    $cache: null,
    $resolving: null,
    $responsibleFor: null,
    get: function(name) {
        if(this.$resolving[servicePropertyPrefix+name]) {
            throw new Error('Circular dependency detected. Trying to resolve '+name+' when it is already being resolved.');
        }
        var resolved = this.$cache.hasOwnProperty(servicePropertyPrefix+name) && this.$cache[servicePropertyPrefix+name];
        if(!resolved) {
            // fail fast
            var service = this.$module[servicePropertyPrefix+name];
            if(!service) {
                throw new Error('Trying to resolve an unknown service '+name);
            }

            // find the first provider that defined this service
            var provider = findResponsibleProvider(this, name, service);
            resolved = provider !== this && provider.$cache[servicePropertyPrefix+name];
            if(!resolved) {
                provider.$resolving[servicePropertyPrefix+name] = true;
                resolved = resolve(service, provider);
                if(service.singleton) {
                    provider.$cache[servicePropertyPrefix+name] = resolved;
                    if(provider !== this) {
                        this.$cache[servicePropertyPrefix+name] = resolved;
                    }
                }
                provider.$resolving[servicePropertyPrefix+name] = false;
            }
        }
        return resolved;
    },

    create: function(subModule) {
        if(!this.$module.isPrototypeOf(subModule)) {
            throw new Error('Trying to create a child Provider for a Module that is not an ancestor of the parents Module.');
        }
        var provider = Object.create(this, {
            $module: { value: subModule },
            $cache: { value: Object.create(this.$cache) },
            $resolving: { value: Object.create(this.$resolving) },
            $responsibleFor: { value: {} }
        });
        return provider;
    }
};

var Injector = {
    $provider: null,
    resolve: function(service) {
        return resolve({
            factory: getFactory(service),
            singleton: true,
            dependencies: getDependencyList(service)
        }, this.$provider);
    }
};

var pioc = {
    createModule: function(rootDirectory) {
        return Object.create(Module, {
            __dirname: { value: rootDirectory || __dirname }
        });
    },

    createProvider: function(module) {
        return Object.create(Provider, {
            $module: { value: module },
            $cache: { value: {} },
            $resolving: { value: {} },
            $responsibleFor: { value: {} }
        });
    },

    createInjector: function(module, provider) {
        var subModule = module.create(),
            $provider = (provider && provider.create(subModule)) ||
                pioc.createProvider(subModule),
            $injector = Object.create(Injector, {
                $provider: { value: $provider }
            });

        subModule
            .value('$provider', $provider)
            .bindFactory('$module', function() {
                return subModule.create();
            })
            .bindFactory('$injector', function($module, $provider) {
                return pioc.createInjector($module, $provider);
            });

        return $injector;
    }
};

// make pioc a service that can be accessed in services
Module[servicePropertyPrefix+'$pioc'] = {
    factory: function() {
        return pioc;
    },
    singleton: true,
    dependencies: []
};

module.exports = pioc;
