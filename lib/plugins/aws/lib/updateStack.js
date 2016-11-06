'use strict';

const _ = require('lodash');
const path = require('path');
const BbPromise = require('bluebird');

module.exports = {
  createFallback() {
    this.createLater = false;
    this.serverless.cli.log('Creating Stack...');

    const stackName = `${this.serverless.service.service}-${this.options.stage}`;
    let stackTags = { STAGE: this.options.stage };
    const templateUrl = `https://s3.amazonaws.com/${
      this.bucketName
      }/${
      this.serverless.service.package.artifactDirectoryName
      }/compiled-cloudformation-template.json`;
    // Merge additional stack tags
    if (typeof this.serverless.service.provider.stackTags === 'object') {
      stackTags = _.extend(stackTags, this.serverless.service.provider.stackTags);
    }

    const params = {
      StackName: stackName,
      OnFailure: 'ROLLBACK',
      Capabilities: [
        'CAPABILITY_IAM',
      ],
      Parameters: [],
      TemplateURL: templateUrl,
      Tags: Object.keys(stackTags).map((key) => ({ Key: key, Value: stackTags[key] })),
    };

    return this.provider.request('CloudFormation',
      'createStack',
      params,
      this.options.stage,
      this.options.region)
      .then((cfData) => this.monitorStack('create', cfData));
  },

  update() {
    const templateUrl = `https://s3.amazonaws.com/${
        this.bucketName
      }/${
        this.serverless.service.package.artifactDirectoryName
      }/compiled-cloudformation-template.json`;

    this.serverless.cli.log('Updating Stack…');
    const stackName = `${this.serverless.service.service}-${this.options.stage}`;
    let stackTags = { STAGE: this.options.stage };

    // Merge additional stack tags
    if (typeof this.serverless.service.provider.stackTags === 'object') {
      stackTags = _.extend(stackTags, this.serverless.service.provider.stackTags);
    }

    const params = {
      StackName: stackName,
      Capabilities: [
        'CAPABILITY_IAM',
      ],
      Parameters: [],
      TemplateURL: templateUrl,
      Tags: Object.keys(stackTags).map((key) => ({ Key: key, Value: stackTags[key] })),
    };

    // Policy must have at least one statement, otherwise no updates would be possible at all
    if (this.serverless.service.provider.stackPolicy &&
        this.serverless.service.provider.stackPolicy.length) {
      params.StackPolicyBody = JSON.stringify({
        Statement: this.serverless.service.provider.stackPolicy,
      });
    }

    return this.provider.request('CloudFormation',
      'updateStack',
      params,
      this.options.stage,
      this.options.region)
      .then((cfData) => this.monitorStack('update', cfData));
  },

  updateStack() {
    // just write the template to disk if a deployment should not be performed
    return BbPromise.bind(this)
      .then(this.writeUpdateTemplateToDisk)
      .then(() => {
        if (this.options.noDeploy) {
          return BbPromise.resolve();
        } else if (this.createLater) {
          return BbPromise.bind(this)
            .then(this.createFallback);
        }
        return BbPromise.bind(this)
          .then(this.update);
      });
  },

  // helper methods
  writeUpdateTemplateToDisk() {
    const updateOrCreate = this.createLater ? 'create' : 'update';
    const cfTemplateFilePath = path.join(this.serverless.config.servicePath,
      '.serverless', `cloudformation-template-${updateOrCreate}-stack.json`);

    if ( updateOrCreate == 'create') {

 	   this.serverless.utils.writeFileSync(cfTemplateFilePath,
     		 this.serverless.service.provider.compiledCloudFormationTemplate);

  	  return BbPromise.resolve();
    }

    this.serverless.cli.log('TEST Template info..');
    this.serverless.cli.log(this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT);


    var tmpKeys={};
    var tmpRootKeys={};
    var tmpFuncKeys={};
    for( var ii in this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT) {
       this.serverless.cli.log(ii);
       tmpFuncKeys[ii]={};
       this.serverless.cli.log('\n');
       var tmpItmParam = {};
       for(var paramItm in this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT_PARAMS']) {
  	  const incParam =
          {
            "Type" : "String",
            "Description" : "Rquired parameter"
          };
	 tmpItmParam[paramItm] = incParam;
	 if (this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT_PARAMS'][paramItm]["Type"]) {
	 	tmpItmParam[paramItm]["Type"] = this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT_PARAMS'][paramItm]["Type"];
	 }
       }
       var tmpIncludeItmParam = {};
       for(var paramItm in this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT_PARAMS']) {
	 tmpIncludeItmParam[paramItm] = {};
	 this.serverless.cli.log('TEST of... ' + paramItm);
	 if (tmpIncludeItmParam[paramItm]["Fn::GetAtt"]) {
	 	this.serverless.cli.log('TEST YES... ' + paramItm);
		delete tmpIncludeItmParam[paramItm]["Ref"];
	        tmpIncludeItmParam[paramItm] =  { "Fn::GetAtt": this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT_PARAMS'][paramItm]["Fn::GetAtt"] };
	 } else {
	    tmpIncludeItmParam[paramItm] = this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT_PARAMS'][paramItm];
	 }
	 delete tmpIncludeItmParam[paramItm]["Type"];
       }

       var awsSubStack = this.serverless.utils.readFileSync(
        path.join(this.serverless.config.serverlessPath,
          'plugins',
          'aws',
          'deploy',
          'lib',
          'include-core-cloudformation-template.json'
         )
       );

      

       var mustOutputArn = [];
       var depedenentItems = this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[ii];
       this.serverless.cli.log('TOSPLIT ELEMENTS?'  + depedenentItems);
       if (depedenentItems) {
	       var len = depedenentItems.length;
	       for(var itm = 0; itm < len; itm++){ 
		try{
       		  this.serverless.cli.log('TOSPLIT ELEMENTS? MERGE OF ' + this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[ii][itm]);

		 var recurAdd = function(t, tosplit_lments, itr, key1, acc, currItem) {
			//if (!acc[ii]) {
			 ///  acc[ii] = [];
			//}
			var lstItems = [];
		    try {
			    t.serverless.cli.log('TOSPLITAWWW TEST AAA1 ' + currItem);
			    console.error(currItem);
			    t.serverless.cli.log('TOSPLITAWWW TEST AAA2 ' + currItem["Properties"] + " WITH " + key1 + " and itr " + itr + " ii is :" + ii);
			    if (currItem["Type"] && currItem["TType"]=="AWS::ApiGateway::Authorizer") {
				return lstItems;//lstItems.push(
			    }
			    if (currItem["Properties"] && currItem["Properties"]["AuthorizerId"]) {
	  		       t.serverless.cli.log('AUTHORIZR TOSPLITAWWW TEST PT' + currItem["Properties"]["AuthorizerId"]);
			       var tmpK = currItem["Properties"]["AuthorizerId"]["Ref"];
	  		       t.serverless.cli.log('AUTHORIZR TOSPLITAWWW TEST PT A and ' + tmpK);
			       tmpFuncKeys[ii][tmpK.replace(/ApiGatewayAuthorizer/,"LambdaFunction")]=1;
			       for(var lat in t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK]) {
	  		       		t.serverless.cli.log('AUTHORIZR TOSPLITAWWW TEST PT B');
					_.merge(awsSubStack.Resources,
                      				t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK][lat]);
						for(var keys in t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK][lat]) {
							if (!acc[keys+"_"+ii]) {
								//acc[keys] = [ii];
								//acc[ii].push(keys);///keys] = [ii];
								if (!acc[keys]) {
									acc[keys] = {}
								}
								acc[keys+"_"+ii] = 1;
									
								var r = recurAdd(t, t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS, tmpK, tmpK, acc, t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK][lat][keys]);
								//console.error("DONEC from " + keys);
								console.error(r);
								//console.error(acc);
								tmpFuncKeys[ii][keys]=1;
								for (var w in r) {
									console.error("WILL MERGE USING " + keys + " from " + r[w]);
									_.merge(acc[keys],acc[r[w]]);
									tmpFuncKeys[ii][r[w]]=1;
								}
				
								lstItems.push(keys);
								t.serverless.cli.log('PUSHING A : ' + keys);
							}
								if (!acc[keys]) {
									acc[keys] = {}
								}
							acc[keys][ii]=1;
						}
			       }
				console.error("WILL ADD TMP K... " + tmpK + " on " + ii + " for 1");
				if (!acc[tmpK]) {
					acc[tmpK]={}
				}
				//console.error(tmpK);
				tmpFuncKeys[ii][tmpK] = 1;
			        acc[tmpK][ii]=1;
				//acc[ii].push(tmpK);
				//acc[tmpK] = 1;
			    }

			    if (currItem["Properties"] && currItem["Properties"]["ResourceId"]) {
	  		       t.serverless.cli.log('TOSPLITAWWW TEST PT' + currItem["Properties"]["ResourceId"]["Ref"]);
			       var tmpK = currItem["Properties"]["ResourceId"]["Ref"];
	  		       t.serverless.cli.log('TOSPLITAWWW TEST PT A');
			       for(var lat in t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK]) {
	  		       		t.serverless.cli.log('TOSPLITAWWW TEST PT B');
					_.merge(awsSubStack.Resources,
                      				t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK][lat]);
						for(var keys in t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK][lat]) {
							if (!acc[keys+"_"+ii]) {
								//acc[keys] = [ii];
								//acc[ii].push(keys);///keys] = [ii];
								if (!acc[keys]) {
									acc[keys] = {}
								}
								acc[keys+"_"+ii] = 1;
									
								var r = recurAdd(t, t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS, keys, tmpK, acc, t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK][lat][keys]);
								//console.error("DONEA from " + keys);
								console.error(r);
								//console.error(acc);
								tmpFuncKeys[ii][keys]=1;
								for (var w in r) {
									console.error("WILL MERGE USING " + keys + " from " + r[w]);
									_.merge(acc[keys],acc[r[w]]);
									tmpFuncKeys[ii][r[w]]=1;
								}
				
								lstItems.push(keys);
								t.serverless.cli.log('PUSHING A : ' + keys);
							}
								if (!acc[keys]) {
									acc[keys] = {}
								}
							acc[keys][ii]=1;
						}
			       }
				//recurAdd(t, t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS, tmpK, lat, acc, t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK]);
				if (!acc[tmpK]) {
					acc[tmpK]={}
				}
			       acc[tmpK][ii]=1;
				//acc[ii].push(tmpK);
				//acc[tmpK] = 1;
			    }
			    t.serverless.cli.log('TOSPLITAWWW TEST CC ' + currItem["Properties"]["ParentId"]);
			    if (currItem["Properties"] && currItem["Properties"]["ParentId"]) {
			       if (currItem["Properties"]["ParentId"]["Ref"] && currItem["Properties"]["ParentId"]["Ref"].indexOf("ApiGatewayRestApiRootResourceId") >= 0) {
				   tmpRootKeys[itr]=currItem;
			       } 
	  		       t.serverless.cli.log('TEST PT PARENT IDs' + currItem["Properties"]["ParentId"]["Ref"]);
			       var tmpK = currItem["Properties"]["ParentId"]["Ref"];
			       for(var lat in t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK]) {
					_.merge(awsSubStack.Resources,
                      				t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK][lat]);
						for(var keys in t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK][lat]) {
							if (!acc[keys + "_" + ii]) {
								//acc[ii].push(keys);
								if (!acc[keys]) {
									acc[keys] = {}
								}
								acc[keys][ii] = 1;
								acc[keys+"_"+ii] = 1;
								var r =recurAdd(t, t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS, keys, tmpK, acc, t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK][lat][keys]);
								console.error("DONEB from " + keys);
								//console.error(r);
								//console.error(acc);
								tmpFuncKeys[ii][keys]=1;
								for (var w in r) {
									console.error("WILL MERGE USING " + keys + " from " + r[w]);
									_.merge(acc[keys],acc[r[w]]);
									tmpFuncKeys[ii][r[w]]=1;
								}
								/*for (var w in r) {
									console.error("WILL MERGE USING " + keys + " from " + r[w]);
									_.merge(acc[keys],acc[r[w]]);
								}*/
								t.serverless.cli.log('PUSHING B : ' + keys);
								lstItems.push(keys);
							}
							if (!acc[keys]) {
								acc[keys] = {}
							}
							acc[keys][ii]=1;
						}
			       }
			       //recurAdd(t, t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS, tmpK, lat, acc, t.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[tmpK]);
				//acc[ii].push(tmpK);
				if(!acc[tmpK]) {
					acc[tmpK]={}
				}
			        acc[tmpK][ii]=1;
				//acc[tmpK] = 1;
			    }
				console.error("TEST LAT :" + key1);
				if(!acc[key1]) {
					acc[key1]={}
				}
				acc[key1][ii]=1;
			} catch (ef) {
				console.error(ef.stack);
			}
			return lstItems;
	  	 }


       		  for(var kkkk in this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[ii][itm]) {
			    this.serverless.cli.log('TOSPLITAWWW RSOURCE TEST?' + kkkk);
			    this.serverless.cli.log(kkkk);

			    recurAdd(this, this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS, ii, ii, tmpKeys, this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[ii][itm][kkkk]);
			    this.serverless.cli.log('OK TEST TOSPLITAWWW RSOURCE TEST?' + kkkk);
			    if(!tmpKeys[kkkk]) {
			       tmpKeys[kkkk]={};
			     }
			     tmpKeys[kkkk][ii]=1;
			     tmpFuncKeys[ii][kkkk]=1;
		  }
		  _.merge(awsSubStack.Resources,
               	      this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[ii][itm]);
		   for (var kz in this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[ii][itm]) {
		      if (tmpItmParam[kz]) {
			  this.serverless.cli.log('TOSPLIT DELETED OF ' + kz + " add9ing t " + ii);
                   	  //delete tmpItmParam[kz];
			  //delete tmpIncludeItmParam[kz];
			  console.error(tmpKeys);
			  if (!tmpKeys[kz]) {
				tmpKeys[kz] = {};
			  }
			  tmpKeys[kz][ii]=1;
			  tmpFuncKeys[ii][kz]=1;
			  mustOutputArn.push(kz);
         	      }
	           }

	        }catch (ee) {
			console.error(ee.stack);
		}
	       }
       }

	/*for(var resByFunc in this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT[ii].Resources) {
		var tmpI = this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT[ii].Resources[resByFunc];
		console.error("resByFunmc");
		console.error(tmpI);
	}*/
  

//       _.merge(awsSubStack.Resources,
//		this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT[ii].Resources)
//       _.merge(awsSubStack.Outputs,
//		this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT[ii].Outputs)
/*
        var outputArnLen = mustOutputArn.length;
	var resp = {};
 	for (var zz = 0; zz<  outputArnLen; zz++) {
		this.serverless.cli.log('Must create output for ' +mustOutputArn[zz]);
		var outputArn = { 
      			"Description": "Lambda function info",
      			"Value": {
			"Ref": mustOutputArn[zz]
      			}
    		}
		resp[mustOutputArn[zz]] = outputArn;
	}
	_.merge(awsSubStack.Outputs,resp);

*/
       _.merge(awsSubStack.Parameters,
		tmpItmParam);


       	     this.serverless.utils.writeFileSync(path.join(this.serverless.config.servicePath,
 		      	'.serverless', ii + ".json"), 
        				  awsSubStack);
    }

	
	console.error(tmpKeys);
	console.error("AND");
	console.error(tmpFuncKeys);
	console.error("ROOT KEYS");
	console.error(tmpRootKeys);
        for(var kkkk in tmpRootKeys) {
	    var awsSubStack = this.serverless.utils.readFileSync(
	        path.join(this.serverless.config.serverlessPath,
	          'plugins',
	          'aws',
	          'deploy',
	          'lib',
	          'include-core-cloudformation-template.json'
	         )
	    );
	    /*var f = function(a,b,c,d) {
		a.serverless.cli.log('GOT KEYS OF' + b);	
		//if (c["Properties"]  && c["Properties"]["this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[ii][itm][kkkk]["Properties"] && this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[ii][itm][kkkk]["Properties"]["ResourceId"]) {
	    }	
	    f(this,kkkk, tmpRootKeys[kkkk]);
*/
		this.serverless.cli.log('GOT KEYS OF' + kkkk);	
		console.error("Need to include all of these");
		for (var key in tmpKeys[kkkk]) {
			console.error("INCLUDING :" + key);
			console.error(this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT);
		      _.merge(awsSubStack.Resources,
				this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT[key].Resources)
 		      _.merge(awsSubStack.Outputs,
				this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT[key].Outputs)
			//include its lambad functions
			var ln = this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[key].length;
			for (var z1 = 0; z1 < ln; z1++ ) {
                                        _.merge(awsSubStack.Resources,
                                                this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[key][z1])
                        }

			for (var k1 in tmpFuncKeys[key]) {
				console.error("WELL WE ALSO NEED for " + kkkk + ".json");
				console.error(k1);
				try {
				this.serverless.service.provider.compiledCloudFormationTemplate.DEPENDS[k1] = kkkk;
				if (this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[k1]) {
					var ln = this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[k1].length;
					for (var z1 = 0; z1 < ln; z1++ ) {
						console.error("YYYEEEESS " + k1);
				      		_.merge(awsSubStack.Resources,
							this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT_ELEMENTS[k1][z1])		
					}
					if (k1.indexOf("ApiGatewayMethod") >= 0) {
						console.error("YYYEEEESS 1 " + k1);
						var tmpMethod = {
							"Description": "Lambda API GatewayAccess",
							"Value": {
								"Ref": k1
							}
						};
						var methodOut = {};
						methodOut[k1] = tmpMethod;
						_.merge(awsSubStack.Outputs,
	 	                                               methodOut);
					}
				}

				if (this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT[k1]) {
			      		_.merge(awsSubStack.Resources,
						this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT[k1].Resources)		
			      		_.merge(awsSubStack.Ouputs,
						this.serverless.service.provider.compiledCloudFormationTemplate.TOSPLIT[k1].Outputs)		
				}
				}catch(ee) {
					console.error(ee.stack);
				}
			}
		}
       	     this.serverless.utils.writeFileSync(path.join(this.serverless.config.servicePath,
 		      	'.serverless', kkkk + ".json"), 
        				  awsSubStack);
	}
    delete this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT_ELEMENTS'];
    delete this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT_PARAMS'];
    delete this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT'];
    this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT']={};
    this.serverless.cli.log('OK COMPLETED');
    for(var kkkk in tmpRootKeys) {
	this.serverless.service.provider.compiledCloudFormationTemplate['TOSPLIT'][kkkk]=1;
       // merge in the includeTemplate
       var includTemplate = this.serverless.utils.readFileSync(
        path.join(this.serverless.config.serverlessPath,
          'plugins',
          'aws',
          'deploy',
          'compile',
          'functions',
          'include')
       );
       includTemplate = includTemplate.replace(/"Include"/g, '"' + kkkk+ 'CFInclude"');
       includTemplate = includTemplate.replace(/serverlessincludefile/g, `${this.serverless.service.package.artifactDirectoryName}/${kkkk}.json`);
       var obj = JSON.parse(includTemplate);
       _.merge(obj[kkkk+"CFInclude"]["Properties"]["Parameters"],tmpIncludeItmParam);
       _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
          obj);
    }

    for (var key in this.serverless.service.provider.compiledCloudFormationTemplate.Resources) {
		console.error("AGOT KEY OF");
		console.error(key);
		if (this.serverless.service.provider.compiledCloudFormationTemplate.Resources[key]["DependsOn"]) {
			var newJson={};
			for (var deps in this.serverless.service.provider.compiledCloudFormationTemplate.Resources[key]["DependsOn"]) {
				console.error(this.serverless.service.provider.compiledCloudFormationTemplate.Resources[key]["DependsOn"][deps]);
				newJson[this.serverless.service.provider.compiledCloudFormationTemplate.DEPENDS[this.serverless.service.provider.compiledCloudFormationTemplate.Resources[key]["DependsOn"][deps]] + "CFInclude"]= 1;
			}
			console.error(newJson);
			delete this.serverless.service.provider.compiledCloudFormationTemplate.Resources[key]["DependsOn"];
			this.serverless.service.provider.compiledCloudFormationTemplate.Resources[key]["DependsOn"] =  Object.keys(newJson);
		}
    }
    delete this.serverless.service.provider.compiledCloudFormationTemplate["DEPENDS"];

    this.serverless.utils.writeFileSync(cfTemplateFilePath,
      this.serverless.service.provider.compiledCloudFormationTemplate);

    return BbPromise.resolve();
  },
};
