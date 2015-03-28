module.exports = function () {
    return {
        files: [
            'index.js',
            'lib/*.js'
        ],

        tests: [
            'test/*Spec.js'
        ],

        env: {
            type: 'node',
            runner: 'node'
        },

        testFramework: 'mocha@2.1.0',
        preprocessors: {
            '**/*Spec.js': file => require('babel').transform(file.content, {sourceMap: true, experimental: true})
        }
    };
};