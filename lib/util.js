var servicePropertyPrefix = '$$service-';

function parseFunctionArguments(func) {
    var args = func.toString ().match (/^\s*function\s+(?:\w*\s*)?\((.*?)\)/);
    args = args ? (args[1] ? args[1].trim ().split (/\s*,\s*/) : []) : null;
    args = args && args.map(function(arg) {
        return arg.replace(/\/\*.*\*\//g, '').trim();
    });
    return args;
}

var getKeys = (function() {
    if(Object.getOwnPropertySymbols) {
        return function getKeys(proto) {
            var keys = Object.getOwnPropertyNames(proto),
                symbols = Object.getOwnPropertySymbols(proto);
            return keys.concat.apply(keys, symbols);
        };
    } else {
        return function getKeys(proto) {
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

exports.servicePropertyPrefix = servicePropertyPrefix;
exports.getKeys = getKeys;
exports.getPropertyDescriptors = getPropertyDescriptors;
exports.parseFunctionArguments = parseFunctionArguments;
