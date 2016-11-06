'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');

module.exports = {
  defaultExcludes: [
    '.git',
    '.gitignore',
    '.DS_Store',
    'npm-debug.log',
    'serverless.yaml',
    'serverless.yml',
    '.serverless',
  ],

  getExcludedPaths(exclude) {
    const packageExcludes = this.serverless.service.package.exclude || [];

    // add defaults for exclude
    return _.union(exclude, packageExcludes, this.defaultExcludes);
  },

  getIncludedPaths(include) {
    const packageIncludes = this.serverless.service.package.include || [];
    return _.union(include, packageIncludes);
  },

  getServiceArtifactName() {
    return `${this.serverless.service.service}.zip`;
  },

  getFunctionArtifactName(functionObject) {
    return `${functionObject.name}.zip`;
  },

  packageService() {
    // check if the user has specified an own artifact
    this.serverless.cli.log('removing here.. debug Packaging service...');
    /*if (this.serverless.service.package.artifact) {
      return BbPromise.resolve();
    }*/

    this.serverless.cli.log('Packaging service...');

    if (this.serverless.service.package.individually) {
      const allFunctions = this.serverless.service.getAllFunctions();
      var packagePromises = _.map(allFunctions, functionName =>
        this.packageFunction(functionName));

      return BbPromise.all(packagePromises);
    }

    return this.packageAll();
  },

  packageAll() {
    const servicePath = this.serverless.config.servicePath;

    const exclude = this.getExcludedPaths();
    const include = this.getIncludedPaths();
    const zipFileName = this.getServiceArtifactName();
    if (zipFileName === null || zipFileName == '') {
	return null;
    } else {
	    this.serverless.cli.log('Packaging service.....' + zipFileName);
	    const zipFileArr = [ zipFileName  ];
	    return this.zipDirectory(servicePath, exclude, include, zipFileName).then(filePath => {
	      this.serverless.service.package.artifact = filePath;
	      return filePath;
	    });
    }
  },

  packageFunction(functionName) {
    const functionObject = this.serverless.service.getFunction(functionName);
    const funcPackageConfig = functionObject.package || {};
    this.serverless.cli.log('Packaging function ... ');
    functionObject.artifact = null; // reset the current artifact

    if (funcPackageConfig.artifact) {
      functionObject.artifact = funcPackageConfig.artifact;
      return BbPromise.resolve(funcPackageConfig.artifact);
    }

    const servicePath = this.serverless.config.servicePath;

    const exclude = _.union(funcPackageConfig.exclude, ['node_modules'], this.serverless.service.package.exclude || [], this.defaultExcludes);
    const include = this.getIncludedPaths(funcPackageConfig.include);
    const zipFileName = this.getFunctionArtifactName(functionObject);

    //const exclude = this.getExcludedPaths();
    //const include = this.getIncludedPaths();
    //const zipFileName = this.getServiceArtifactName();

    this.serverless.cli.log('WILL START PACKAGING');
    this.serverless.cli.log(zipFileName);
    this.serverless.cli.log(exclude);
    return this.zipDirectory(servicePath, exclude, include, zipFileName).then((artifactPath) => {
      functionObject.artifact = artifactPath;
      return artifactPath;
    });
  },
};
