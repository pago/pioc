module.exports = function () {
    return {
        files: [
            'index.js',
            'lib/*.js'
        ],

        tests: [
            'test/*.js'
        ],

        env: {
            type: 'node',
            runner: 'node'
        },

        testFramework: 'mocha@2.1.0'
    };
};