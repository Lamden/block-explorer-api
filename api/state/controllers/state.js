'use strict';


/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require('strapi-utils');

const removeID = (obj) => {
    try{
       delete obj.id
    }catch(e){}
    return obj
}

module.exports = {
    getContractName: async ctx => {
        let results = await strapi.query('state').model.find({
             contractName: ctx.params.contractName 
        }, { "id": 0, "_id": 0, "__v": 0})

        return results.map(result => removeID(sanitizeEntity(result, { model: strapi.models.state })));
    },
    getFunctionName: async ctx => {
        let results = await strapi.query('state').model.find({ 
            contractName: ctx.params.contractName,
            functionName:  ctx.params.functionName
        }, { "id": 0, "_id": 0, "__v": 0})

        return results.map(result => removeID(sanitizeEntity(result, { model: strapi.models.state })));
    },
    getKey: async ctx => {
        console.log(ctx.parms)
        let results = await strapi.query('state').model.find({ 
            contractName: ctx.params.contractName,
            functionName:  ctx.params.functionName,
            key: ctx.params.key
        }, { "id": 0, "_id": 0, "__v": 0})
        
        return results.map(result => removeID(sanitizeEntity(result, { model: strapi.models.state })));
    },
};