'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');

module.exports = {
  compileResources() {
    this.resourceFunctions = [];
    this.resourcePaths = [];
    this.resourceLogicalIds = {};

    _.forEach(this.serverless.service.functions, (functionObject, functionName) => {
      functionObject.events.forEach(event => {
        if (event.http) {
          let path;

          if (typeof event.http === 'object') {
            path = event.http.path;
          } else if (typeof event.http === 'string') {
            path = event.http.split(' ')[1];
          } else {
            const errorMessage = [
              `HTTP event of function ${functionName} is not an object nor a string.`,
              ' The correct syntax is: http: get users/list',
              ' OR an object with "path" and "method" proeprties.',
              ' Please check the docs for more info.',
            ].join('');
            throw new this.serverless.classes
              .Error(errorMessage);
          }

          while (path !== '') {
            if (this.resourcePaths.indexOf(path) === -1) {
              this.resourcePaths.push(path);
              this.resourceFunctions.push(functionName);
            }

            const splittedPath = path.split('/');
            splittedPath.pop();
            path = splittedPath.join('/');
          }
        }
      });
    });

    const capitalizeAlphaNumericPath = (path) => _.capitalize(path.replace(/[^0-9A-Za-z]/g, ''));

    // ['users', 'users/create', 'users/create/something']
    this.resourcePaths.forEach(path => {
      const resourcesArray = path.split('/');
      // resource name is the last element in the endpoint. It's not unique.
      const resourceName = path.split('/')[path.split('/').length - 1];
      const resourcePath = path;
      const normalizedResourceName = resourcesArray.map(capitalizeAlphaNumericPath).join('');
      const resourceLogicalId = `ApiGatewayResource${normalizedResourceName}`;
      this.resourceLogicalIds[resourcePath] = resourceLogicalId;
      resourcesArray.pop();
  
      var normalizedResourceParentName = null;
      let resourceParentId;
      var isOk = false;
      if (resourcesArray.length === 0) {
        isOk = false;
        //resourceParentId = '{ "Fn::GetAtt": ["ApiGatewayRestApi", "RootResourceId"] }';
        resourceParentId = '{ "Ref": "ApiGatewayRestApiRootResourceId" }';
      } else {
        isOk = false;
        normalizedResourceParentName = resourcesArray
          .map(capitalizeAlphaNumericPath).join('');
        resourceParentId = `{ "Ref" : "ApiGatewayResource${normalizedResourceParentName}" }`;
      }

      const resourceTemplate = `
        {
          "Type" : "AWS::ApiGateway::Resource",
          "Properties" : {
            "ParentId" : ${resourceParentId},
            "PathPart" : "${resourceName}",
            "RestApiId" : { "Ref" : "ApiGatewayRestApi" }
          }
        }
      `;

      const resourceObject = {
        [resourceLogicalId]: JSON.parse(resourceTemplate),
      };

      
	if (isOk) {
     		 _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
       	 		resourceObject);
	}

     const extractedResourceId = resourceLogicalId.match(/ApiGatewayResource(.*)/)[1];

/*
        var tmpFunc = {};
        this.serverless.cli.log('LOGICTTT :' + extractedResourceId);
        this.serverless.cli.log('LOGICCCC :' + resourceLogicalId);
        //var tmpFu = extractedResourceId.replace(/Authentication/,"").toLowerCase();
        var tmpFu = resourceLogicalId;//extractedResourceId;//.replace(/Authentication/,"").toLowerCase();
        var ab = {};
        ab[resourceLogicalId] = JSON.parse(resourceTemplate);
        tmpFunc[tmpFu] = []
        tmpFunc[tmpFu].push(resourceObject);
        _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS,
              tmpFunc);
*/

     if (isOk) {
        var tmpParams = {};
        var apiName = resourceLogicalId;
        tmpParams[apiName] = { "Ref": resourceLogicalId, "Type" : "String" };//AWS::ApiGateway::Resource" };
        //tmpParams[apiName] = { "Fn::GetAtt": [ resourceLogicalId, "Arn" ] };
       _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_PARAMS,
              tmpParams);
     } else {
	var tmpFunc = {};
        this.serverless.cli.log('LOGICTTT :' + extractedResourceId);
        this.serverless.cli.log('LOGICCCC :' + resourceLogicalId);
        //var tmpFu = extractedResourceId.replace(/Authentication/,"").toLowerCase();
        var tmpFu = resourceLogicalId;//extractedResourceId;//.replace(/Authentication/,"").toLowerCase();
        var ab = {};
        ab[resourceLogicalId] = JSON.parse(resourceTemplate);
        tmpFunc[tmpFu] = []
        tmpFunc[tmpFu].push(resourceObject);
        _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS,
              tmpFunc);	
     }
    });

    return BbPromise.resolve();
  },
};
