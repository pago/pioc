var Injector = {
    $provider: null,
    resolve: function(service) {
        var resolver = this.$provider.$module.resolver;
        return resolver.resolve({
            factory: resolver.getFactory(service),
            singleton: true,
            dependencies: resolver.getDependencyList(service)
        }, this.$provider);
    }
};

module.exports = Injector;
