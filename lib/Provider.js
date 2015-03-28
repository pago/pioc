var servicePropertyPrefix = require('./util').servicePropertyPrefix;

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
                resolved = this.$module.resolver.resolve(service, provider);
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

function filterPrefix(prefix) {
    return function(str) {
        return str.length >= prefix.length && str.substring(0, prefix.length) === prefix;
    };
}

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

    var dependencies = service.dependencies.callInjection.concat(
        service.dependencies.propertyInjection.map(function(service) {
            return service.serviceName;
        })
    );
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

module.exports = Provider;
