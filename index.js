var path = require('path'),
    Resolver = require('./lib/Resolver'),
    Module = require('./lib/Module'),
    Provider = require('./lib/Provider'),
    Injector = require('./lib/Injector'),
    servicePropertyPrefix = require('./lib/util').servicePropertyPrefix;

var pioc = {
    resolver: Resolver,

    createModule: function(rootDirectory) {
        return Object.create(Module, {
            resolver: { value: this.resolver },
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
                this.createProvider(subModule),
            $injector = Object.create(Injector, {
                $provider: { value: $provider }
            }),
            pioc = this;

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
