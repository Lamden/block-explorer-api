'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require('strapi-utils');
const http = require('http');
const validators = require('types-validate-assert')
const { validateTypes } = validators;

const isLamdenKey = ( key ) => {
    if (validateTypes.isStringHex(key) && key.length === 64) return true;
    return false;
};

const removeID = (obj) => {
    try{
       delete obj.id
    }catch(e){}
    return obj
}

const send = async (url) => {
    return new Promise( (resolve) => {
        http.get(url, (resp) => {
            let data = '';
        
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
            data += chunk;
            });
        
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                console.log('back from masternode')
                console.log(data)
                resolve(JSON.parse(data))
            });
        }).on("error", (err) => {
            console.log("Error: " + err.message);
            resolve({value: null})
        });
    });
}

module.exports = {
    getContractName: async (ctx) => {
        let results = await strapi.query('state').model.find({
             contractName: ctx.params.contractName 
        }, { "id": 0, "_id": 0, "__v": 0})

        return results.map(result => removeID(sanitizeEntity(result, { model: strapi.models.state })));
    },
    getVariableName: async (ctx) => {
        let results = await strapi.query('state').model.find({ 
            contractName: ctx.params.contractName,
            variableName:  ctx.params.variableName
        }, { "id": 0, "_id": 0, "__v": 0})

        return results.map(result => removeID(sanitizeEntity(result, { model: strapi.models.state })));
    },
    getKey: async (ctx) => {
        console.log(ctx.params)
        let results = await strapi.query('state').model.find({ 
            contractName: ctx.params.contractName,
            variableName:  ctx.params.variableName,
            key: ctx.params.key
        }, { "id": 0, "_id": 0, "__v": 0})
        
        return results.map(result => removeID(sanitizeEntity(result, { model: strapi.models.state })));
    },
    getCurrencyBalance: async (ctx) => {
        let res = await send(`http://167.172.126.5:18080/contracts/currency/balances?key=${ctx.params.key}`)
        return res
    },
    getTotalContracts: async () => {
        let res = await send(`http://167.172.126.5:18080/contracts`)
        try{
            return res.contracts.length
        }catch (e){
            return 0;
        }
        
    },
    getTopWallets: async () => {
        var match = { $match : { contractName : "currency", variableName: 'balances'} }
        var sort = {$sort: {"key": 1, "blockNum": -1, "value": 1}}
        var group1 = { $group: { _id: "$key", "blockNum": { $first: "$blockNum" }, "value": { $first: "$value" } } }
        var project = { $project: {key: "$_id", value:1}}

        let results = await strapi.query('state').model
       .aggregate([match, sort, group1, project])
       return results
    },
    getTotalAddresses: async () => {
        let results = await strapi.query('state').model.distinct("key")
        return results.filter(result => isLamdenKey(result)).length
    }
};