var path = require('path'),
    servicePropertyPrefix = '$$service-';

function parseFunctionArguments(func) {
    var args = func.toString ().match (/^\s*function\s+(?:\w*\s*)?\((.*?)\)/);
    args = args ? (args[1] ? args[1].trim ().split (/\s*,\s*/) : []) : null;
    args = args && args.map(function(arg) {
        return arg.replace(/\/\*.*\*\//g, '').trim();
    });
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
        return {
            callInjection: service.$requires || service['@require'] || parseFunctionArguments(service),
            propertyInjection: service.prototype && getInjectableProperties(service.prototype)
        };
    } else if(type === '[object Array]') {
        if(isArrayNotation(service)) {
            return {callInjection: service.slice(0, service.length-1), propertyInjection: [] };
        }
    } else if(service === Object(service)) {
        return { callInjection: [], propertyInjection: getInjectableProperties(service) };
    }
    return {callInjection: [], propertyInjection: []};
}

function getInjectableProperties(inst) {
    var properties = [],
        propertyNames = getPropertyDescriptors(inst);
    for(var i = 0, len = propertyNames.length; i < len; i++) {
        var property = propertyNames[i],
            descriptor = property.descriptor,
            propName = property.name;
        if(descriptor.value && descriptor.value.$$inject) {
            properties[properties.length] = {
                serviceName: descriptor.value.serviceName || propName,
                propName: propName,
                lazy: !!descriptor.value.$$lazy
            };
        }
    }
    return properties;
}

var getKeys = (function() {
    if(Object.getOwnPropertySymbols) {
        return function(proto) {
            var keys = Object.getOwnPropertyNames(proto),
                symbols = Object.getOwnPropertySymbols(proto);
            return keys.concat.apply(keys, symbols);
        };
    } else {
        return function(proto) {
            return Object.getOwnPropertyNames(proto);
        };
    }
}());

function getPropertyDescriptors(obj, omitDescriptors) {
    var unique = {},
        properties = [],
        marker = {};
    for(var proto = obj; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
        var names = getKeys(proto);
        for(var i = 0, len = names.length; i < len; i++) {
            var name = names[i];
            if(unique[name] !== marker) {
                unique[name] = marker;
                properties[properties.length] = {name: name, descriptor: omitDescriptors || Object.getOwnPropertyDescriptor(proto, name)};
            }
        }
    }
    return properties;
}

function getFactory(service) {
    var toString = Object.prototype.toString,
        type = toString.call(service);
    if(type === '[object Function]') {
        return service;
    } else if(type === '[object Array]' && isArrayNotation(service)) {
        return service[service.length-1];
    } else if (service === Object(service)) {
        var factory = function() { return service; };
        factory.prototype = service;
        factory.$isObjectFactory = true;
        return factory;
    }
    return function() { return service; };
}

function defineLazyInstanceProperty(inst, propName, serviceName, provider) {
    Object.defineProperty(inst, propName, {
        get: function() {
            var service = provider.$module.has(serviceName) ?
                provider.get(serviceName) :
                provider.getAll(serviceName);
            Object.defineProperty(inst, propName, {
                value: service
            });
            return service;
        },
        configurable: true
    });
}

function defineInstanceProperty(inst, propName, serviceName, provider) {
    Object.defineProperty(inst, propName, {
        value: provider.$module.has(serviceName) ?
            provider.get(serviceName) :
            provider.getAll(serviceName)
    });
}

function resolve(service, provider) {
    var inst,
        args = service.dependencies.callInjection.map(function(serviceName) {
            return provider.$module.has(serviceName) ? provider.get(serviceName) : provider.getAll(serviceName);
        });
    if(service.factory.$isObjectFactory) {
        inst = service.factory();
    } else {
        inst = Object.create(service.factory.prototype || Object.prototype);
    }
    for(var propInjections = service.dependencies.propertyInjection, i = 0, len = propInjections.length; i < len; i++) {
        var prop = propInjections[i],
            serviceName = prop.serviceName;
        if(prop.lazy) {
            defineLazyInstanceProperty(inst, prop.propName, serviceName, provider);
        } else {
            defineInstanceProperty(inst, prop.propName, serviceName, provider);
        }
    }
    return service.factory.$isObjectFactory ? inst : (service.factory.apply(inst, args) || inst);
}

var Module = {
    has: function(name) {
        return !!this[servicePropertyPrefix+name];
    },
    value: function(name, service) {
        if(arguments.length === 1) {
            var names = Object.getOwnPropertyNames(name);
            for(var i = 0, len = names.length; i < len; i++) {
                var serviceName = names[i];
                this.value(serviceName, name[serviceName]);
            }
        }
        this[servicePropertyPrefix+name] = {
            factory: function() { return service; },
            singleton: true,
            dependencies: {callInjection: [], propertyInjection: []}
        };
        return this;
    },
    bind: function(name, service) {
        if(arguments.length === 1) {
            var names = Object.getOwnPropertyNames(name);
            for(var i = 0, len = names.length; i < len; i++) {
                var serviceName = names[i];
                this.bind(serviceName, name[serviceName]);
            }
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
            var names = Object.getOwnPropertyNames(name);
            for(var i = 0, len = names.length; i < len; i++) {
                var serviceName = names[i];
                this.bindFactory(serviceName, name[serviceName]);
            }
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

    var dependencies = service.dependencies.callInjection.concat(service.dependencies.propertyInjection);
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

function filterPrefix(prefix) {
    return function(str) {
        return str.length >= prefix.length && str.substring(0, prefix.length) === prefix;
    };
}

var Provider = {
    $module: null,
    $cache: null,
    $resolving: null,
    $responsibleFor: null,
    has: function(name) {
        return this.$module.has(name);
    },
    getAll: function(name) {
        var result = [],
            filter = filterPrefix(servicePropertyPrefix+name);
        for(var serviceName in this.$module) {
            if(filter(serviceName)) {
                result[result.length] = this.get(serviceName.substring(servicePropertyPrefix.length));
            }
        }
        return result;
    },
    get: function(name) {
        if(this.$resolving[servicePropertyPrefix+name]) {
            throw new Error('Circular dependency detected. Trying to resolve '+name+' when it is already being resolved.');
        }
        var resolved = this.$cache.hasOwnProperty(servicePropertyPrefix+name) && this.$cache[servicePropertyPrefix+name];
        if(!resolved) {
            // fail fast
            var service = this.$module[servicePropertyPrefix+name];
            if(!service) {
                // now service with that name exists, let's see if it is a prefix
                var services = this.getAll(name);
                if(services.length) {
                    return services;
                }
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
    },

    inject: function(serviceName) {
        if(arguments.length > 1) {
            var target, i, len, result;
            if(Object.prototype.toString.call(serviceName) === '[object String]') {
                result = target = arguments[arguments.length-1];
                target = target.prototype || target;
                i = 0;
                len = arguments.length-1;
            } else {
                result = serviceName;
                target = serviceName.prototype || serviceName;
                i = 1;
                len = arguments.length;
            }
            for(; i < len; i++) {
                var propName = arguments[i];
                Object.defineProperty(target, propName, {
                    configurable: true,
                    value: {
                        serviceName: propName,
                        $$inject: true
                    }
                });
            }
            return result;
        }
        return {
            serviceName: serviceName,
            $$inject: true
        };
    }
};

pioc.inject.lazy = function(serviceName) {
    return {
        serviceName: serviceName,
        $$inject: true,
        $$lazy: true
    };
};

// make pioc a service that can be accessed in services
Module[servicePropertyPrefix+'$pioc'] = {
    factory: function() {
        return pioc;
    },
    singleton: true,
    dependencies: {callInjection: [], propertyInjection: [] }
};

module.exports = pioc;
