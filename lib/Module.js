var util = require('./util'),
    servicePropertyPrefix = util.servicePropertyPrefix;

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
            factory: this.resolver.getFactory(service),
            singleton: true,
            dependencies: this.resolver.getDependencyList(service)
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
            factory: this.resolver.getFactory(service),
            singleton: false,
            dependencies: this.resolver.getDependencyList(service)
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
        this.bindFactory(name || (service && service.$serviceName) || path.basename(filename, '.js'), service);
        return this;
    },

    create: function() {
        return Object.create(this);
    }
};

module.exports = Module;
