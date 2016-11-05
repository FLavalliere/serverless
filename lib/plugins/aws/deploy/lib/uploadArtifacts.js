'use strict';

const fs = require('fs');
const path = require('path');
const BbPromise = require('bluebird');

module.exports = {
  uploadCloudFormationFile() {
    this.serverless.cli.log('Uploading CloudFormation file to S3...');
    for( var ii in this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT) {
       this.serverless.cli.log("Uploading substack " + ii);

       const cfServiceTemplateFilePath = path.join(this.serverless.config.servicePath,
      '.serverless', ii + ".json");

       var awsSubStack = this.serverless.utils.readFileSync(
        cfServiceTemplateFilePath);

       const body = JSON.stringify(awsSubStack);
       const fileName = ii + ".json";
       const params = {
           Bucket: this.bucketName,
           Key: `${this.serverless.service.package.artifactDirectoryName}/${fileName}`,
           Body: body,
       };

	this.serverless.cli.log(`Uploaded ${this.serverless.service.package.artifactDirectoryName}/${fileName} resp: 0`);

       var upRe = this.sdk.request('S3',
        'putObject',
	params,
	this.options.stage,
	this.options.region);
	this.serverless.cli.log(`Uploaded ${this.serverless.service.package.artifactDirectoryName}/${fileName} resp: ${upRe}`);
    }
    delete this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT'];

    const cfServiceTemplateFilePath = path.join(this.serverless.config.servicePath,
      '.serverless', "cloudformation-template-update-stack.json");

       var awsSubStack = this.serverless.utils.readFileSync(
        cfServiceTemplateFilePath);

       delete awsSubStack['TOSPLIT'];
       const body = JSON.stringify(awsSubStack);
       const fileName = "compiled-cloudformation-template.json";
       const params = {
           Bucket: this.bucketName,
           Key: `${this.serverless.service.package.artifactDirectoryName}/${fileName}`,
           Body: body,
       };

	this.serverless.cli.log(`Uploaded ${this.serverless.service.package.artifactDirectoryName}/${fileName} resp: 0`);

/*
       var upRe = this.sdk.request('S3',
        'putObject',
	params,
	this.options.stage,
	this.options.region);
	this.serverless.cli.log(`Uploaded ${this.serverless.service.package.artifactDirectoryName}/${fileName} resp: ${upRe}`);
    const body = JSON.stringify(this.serverless.service.provider.compiledCloudFormationTemplate);

    const fileName = 'compiled-cloudformation-template.json';

    const params = {
      Bucket: this.bucketName,
      Key: `${this.serverless.service.package.artifactDirectoryName}/${fileName}`,
      Body: body,
    };

*/
    return this.sdk.request('S3',
      'putObject',
      params,
      this.options.stage,
      this.options.region);
  },

  uploadZipFile(artifactFilePath) {
    if (!artifactFilePath) {
      throw new this.serverless.classes.Error('artifactFilePath was not supplied');
    }

    this.serverless.cli.log('Uploading .zip file to S3. for ' + artifactFilePath);

    const body = fs.readFileSync(artifactFilePath);

    const fileName = artifactFilePath.split(path.sep).pop();

    const params = {
      Bucket: this.bucketName,
      Key: `${this.serverless.service.package.artifactDirectoryName}/${fileName}`,
      Body: body,
    };

    return this.sdk.request('S3',
      'putObject',
      params,
      this.options.stage,
      this.options.region);
  },

  uploadFunctions() {
    if (!this.serverless.service.package.singlezip) {
    if (this.serverless.service.package.individually) {
      const cfServiceTemplateFilePath = this.serverless.service.package.artifact;//path.join(this.serverless.config.servicePath,
//      '.serverless', this.serverless.service.package.artifact);
      this.serverless.cli.log('Uploading service .zip file to S3... ' + cfServiceTemplateFilePath);

      //this.uploadZipFile(this.serverless.service.package.artifact);

      this.serverless.cli.log('Uploading function (DISABLED) .zip files to S3...');
      return this.uploadZipFile(cfServiceTemplateFilePath);
      /*
      const functionNames = this.serverless.service.getAllFunctions();
      const uploadPromises = functionNames.map(name => {
        const functionObject = this.serverless.service.getFunction(name);
        return this.uploadZipFile(functionObject.artifact);
      });
      */
      return BbPromise.all(uploadPromises);
    }
    }

    this.serverless.cli.log('Uploading service .zip file to S3...');
    return this.uploadZipFile(this.serverless.service.package.artifact);
  },

  uploadArtifacts() {
    if (this.options.noDeploy) {
      return BbPromise.resolve();
    }

    return BbPromise.bind(this)
      .then(this.writeUpdateTemplateToDisk)
      .then(this.uploadCloudFormationFile)
      .then(this.uploadFunctions);
  },
};
