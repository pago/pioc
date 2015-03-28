var util = require('./util'),
    parseFunctionArguments = util.parseFunctionArguments,
    getPropertyDescriptors = util.getPropertyDescriptors;

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

module.exports = {
    resolve: resolve,
    getFactory: getFactory,
    getDependencyList: getDependencyList
};
