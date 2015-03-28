var expect = require('chai').expect,
    pioc = require('../index'),
    React = require('react');
// A simple example for how to define a react service
describe('Resolver', function() {
    it('can resolve dependencies of a React class', function() {
        var $module = pioc.createModule()
                .value('message', 'Hello World')
                .bind('MessageProvider', {
                    message: pioc.inject('message'),

                    get: function() {
                        return this.message;
                    }
                })
                .bind('UI', function(MessageProvider) {
                    var Label = React.createClass({
                        displayName: 'Label',

                        render: function() {
                            return React.createElement('h1', null, MessageProvider.get());
                        }
                    });
                    return Label;
                }),
            provider = pioc.createProvider($module);
        var MyLabel = React.createFactory(provider.get('UI')),
            MessageProvider = provider.get('MessageProvider');
        expect(function() {
            MyLabel(null);
        }).not.to.throw(Error);
    });
});
