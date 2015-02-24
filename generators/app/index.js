var generators = require('yeoman-generator');
var fs    = require('fs');
var async = require('async');
var path  = require('path');
var chalk = require('chalk');
var merge = require('merge');

var plugins   = {};
var driversIn = {};

function loadModules(dir, cache) {
    var dir = path.join(__dirname, dir);

    fs.readdirSync(dir).forEach(function(file) {
        var file = dir + file;

        if (!fs.statSync(file).isFile()) {
            return;
        }

        var module = require(file);

        cache[module.name] = module;
    });
}

loadModules('../../plugins/'   , plugins);
loadModules('../../drivers-in/', driversIn);

console.log('\n' + chalk.yellow.bold(fs.readFileSync(path.join(__dirname, '../../logo.txt'), 'utf8')));

console.log('\n' + chalk.white.bold('## Plugins ##'));
Object.keys(plugins).forEach(function(elem) {
    console.log('   ' + chalk.green.bold('> ' + elem));
});

console.log('\n' + chalk.white.bold('## In Drivers ##'));
Object.keys(driversIn).forEach(function(elem) {
    console.log('   ' + chalk.cyan.bold('> ' + elem));
});

var APPGEN_CONFIG = 'app-gen.json';

module.exports = generators.Base.extend({
    _load: function() {
        var appgenFile = this.destinationRoot() + '/' + APPGEN_CONFIG;

        if (!fs.existsSync(appgenFile)) {
            this.log('The configuration file \'' + APPGEN_CONFIG + '\' does not exists!');
            process.exit(1);
            return;
        }

        this.appgen = require(appgenFile);
        this.values = {"x" : "y"};
    },

    _selectArtifact: function(next) {
        this.log();

        this.prompt({
            type: 'list',
            name: 'artifactName',
            message: 'Choose the artifact',
            choices: Object.keys(this.appgen.artifacts)
        }, function(answers) {
            this.artifactName = answers.artifactName;

            next(null);
        }.bind(this));
    },

    _loadPlugin: function(next) {
        this.artifact = this.appgen.artifacts[this.artifactName];

        this.plugin = plugins[this.artifact.type];

        if (this.plugin.isValid && this.plugin.isValid(this.artifact) !== true) {
            this.log('The supplied configs for artifact ' + artifactName + ' are incomplete.\n');
            this.log('Type: ' + plugin.name + '.\n');

            if (plugin.help) {
                this.log('Usage: \n\n' + plugin.help(this) + '\n\n');
            }

            process.exit(1);
            return;
        }

        next(null);
    },

    _readInputs: function(driverIn, next) {
        if (!driverIn) {
            next('Driver not supplied!', null);
            return;
        }

        this.driverIn = driversIn[driverIn.driver];

        if (!this.driverIn) {
            next('Driver not found: ' + driverIn.driver, null);
            return;
        }

        this.driverIn.read(this, driverIn.config || {}, function(err, values) {
            this.values = merge(this.values || {} , values || {});

            next(null);
        }.bind(this));
    },

    _loadDriver: function(next) {
        if (this.artifact.in.constructor === Array) {
            async.mapSeries(this.artifact.in, this._readInputs.bind(this), function(err, result) {
                next(null);
            });

            return;
        }

        this._readInputs(this.artifact.in, next);
    },

    prompting: function() {
        this._load();

        var done = this.async();

        var that = this;

        async.waterfall([
            this._selectArtifact.bind(this),
            this._loadPlugin.bind(this),
            this._loadDriver.bind(this)
        ], function(err, result) {
            //console.dir(this.values);

            done();
        }.bind(this));
    },

    writing: function() {
        this.log();

        this.plugin.write(this, this.artifact.template, this.artifact.out, this.values);
    }
});
