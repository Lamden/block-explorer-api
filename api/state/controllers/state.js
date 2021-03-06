'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require('strapi-utils');
const https = require('https');

const removeID = (obj) => {
    try{
       delete obj.id
    }catch(e){}
    return obj
}

const send = async (url) => {
    return new Promise( (resolve) => {
        https.get(url, (resp) => {
            let data = '';
        
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
            data += chunk;
            });
        
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                try{
                    resolve(JSON.parse(data))
                }catch(err){
                    console.log("Error: " + err.message);
                    resolve(0)
                }
            });
        }).on("error", (err) => {
            console.log("Error: " + err.message);
            resolve({value: null})
        });
    });
}

module.exports = {
    getContractName: async (ctx) => {
        let reclimit = parseInt(ctx.query.limit) || 100
        let sort = parseInt(ctx.query.sort) || -1

        let stateResults = await strapi.query('state').model
        .find({ contractName: ctx.params.contractName}, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: sort, txNonce: -1})
        .limit(reclimit)

        return await Promise.all(stateResults.map(async (result) => {
            let txInfo = await strapi.query('transactions').model
            .findOne({ hash: result.hash }, { "id": 0, "_id": 0, "__v": 0})
            txInfo = removeID(sanitizeEntity(txInfo, { model: strapi.models.transactions }))
            txInfo.state = JSON.parse(txInfo.state)
            result.transaction = txInfo
            return {
                ...removeID(sanitizeEntity(result, { model: strapi.models.state })),
                transaction: JSON.parse(txInfo.transaction)}
        }))        
    },
    getVariableName: async (ctx) => {
        let reclimit = parseInt(ctx.query.limit) || 100
        let sort = parseInt(ctx.query.sort) || -1
        let stateResults = await strapi.query('state').model.find({ 
            contractName: ctx.params.contractName,
            variableName:  ctx.params.variableName
        }, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: sort, txNonce: -1})
        .limit(reclimit)

        return await Promise.all(stateResults.map(async (result) => {
            let txInfo = await strapi.query('transactions').model
            .findOne({ hash: result.hash }, { "id": 0, "_id": 0, "__v": 0})
            txInfo = removeID(sanitizeEntity(txInfo, { model: strapi.models.transactions }))
            txInfo.state = JSON.parse(txInfo.state)
            result.transaction = txInfo
            return {
                ...removeID(sanitizeEntity(result, { model: strapi.models.state })),
                transaction: JSON.parse(txInfo.transaction)}
        }))  
    },
    getKeyHistory: async (ctx) => {
        let reclimit = parseInt(ctx.query.limit) || 100
        let sort = parseInt(ctx.query.sort) || -1
        let stateResults = await strapi.query('state').model.find({ 
            contractName: ctx.params.contractName,
            variableName:  ctx.params.variableName,
            key: ctx.params.key
        }, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: sort, txNonce: -1})
        .limit(reclimit)
        
        return await Promise.all(stateResults.map(async (result) => {
            let txInfo = await strapi.query('transactions').model
            .findOne({ hash: result.hash }, { "id": 0, "_id": 0, "__v": 0})
            txInfo = removeID(sanitizeEntity(txInfo, { model: strapi.models.transactions }))
            txInfo.state = JSON.parse(txInfo.state)
            result.transaction = txInfo
            return {
                ...removeID(sanitizeEntity(result, { model: strapi.models.state })),
                transaction: JSON.parse(txInfo.transaction)}
        }))  
    },
    getKey: async (ctx) => {
        if (!ctx.params.contractName || !ctx.params.variableName || !ctx.params.key) return {value: null}
        let result = await strapi.query('current-state').model.findOne({ 
            contractName: ctx.params.contractName,
            variableName:  ctx.params.variableName,
            key: ctx.params.key
        }, { "id": 0, "_id": 0, "__v": 0})
        return {value: result ? result.value : null }
    },
    getKeys: async (ctx) => {
        const { body } = ctx.request
        if (!Array.isArray(body)) return {}

        let stateQueries = body.map(job => {
            return strapi.query('current-state').model.findOne({ 
                contractName: job.contractName,
                variableName:  job.variableName,
                key: job.key
            }, { "id": 0, "_id": 0, "__v": 0})
            .then(result => {
                if (!result) {
                    return {
                        key: `${job.contractName}.${job.variableName}:${job.key}`,
                        value: null
                    }
                }
                else {
                    return {
                        key: `${job.contractName}.${job.variableName}:${job.key}`,
                        value: result ? result.value : null
                    } 
                }
            })
        })
        let results = await Promise.all(stateQueries)
        return results || []
    },
    hasValue: async (ctx) => {
        let reclimit = parseInt(ctx.query.limit) || 100
        let sort = parseInt(ctx.query.sort) || -1
        let stateResults = await strapi.query('state').model.find({ 
            contractName: ctx.params.contractName,
            variableName:  ctx.params.variableName,
            value: ctx.params.value
        }, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: sort, txNonce: -1})
        .limit(reclimit)
        
        return await Promise.all(stateResults.map(async (result) => removeID(sanitizeEntity(result, { model: strapi.models.state }))))  
    },
    getCurrencyBalance: async (ctx) => {
        if (!ctx.params.key) return {value: null}
        let result = await strapi.query('current-state').model.findOne({ 
            contractName: 'currency',
            variableName:  'balances',
            key: ctx.params.key
        }, { "id": 0, "_id": 0, "__v": 0})

        return {value: result ? result.value : null }
    },
    getTotalContracts: async () => {
        try{
            let contracts =  await strapi.query('contracts').model.find()
            return contracts.length
        }catch (e){
            return 0;
        }
    },
    getTopWallets_old: async (ctx) => {
        let reclimit = parseInt(ctx.query.limit) || 20
        let offset = parseInt(ctx.query.offset) || 0;
        let reverse = -1
        if (typeof ctx.query.reverse !== 'undefined') {
            if (ctx.query.reverse === 'true') reverse = 1
        }
        
        var match = { $match : { contractName : "currency", variableName : "balances", keyIsAddress : { $eq : true }}}
        var sort1 = { $sort: { key: 1, blockNum: -1, txNonce: -1 }}
        var group = { $group: { _id: "$key", "value": {$first: "$value"}}}
        var sort2 = { $sort: { value: reverse }}
        var skip = { $skip: offset }
        var limit = { $limit: reclimit}
        var project = { $project: {key: "$_id", value: 1, "_id": 0}}
        let count = { $count : "count"}
        let dataPipeline = [match, sort1, group, sort2, skip, limit,  project]
        let countPipeline = [match, sort1, group, sort2, project, count]
        let facet = { $facet: {data: dataPipeline, "count": countPipeline}}
        let collation = { locale : "en_US", numericOrdering : true }

        let results = await strapi.query('state').model
            .aggregate([facet])
            .collation(collation)

        return {
            data: results[0].data,
            count: results[0].count[0] ? results[0].count[0].count : 0
        }
    },
    getTopWallets: async (ctx) => {
        let reclimit = parseInt(ctx.query.limit) || 20
        let offset = parseInt(ctx.query.offset) || 0;
        let reverse = -1
        if (typeof ctx.query.reverse !== 'undefined') {
            if (ctx.query.reverse === 'true') reverse = 1
        }
        let match = { "$match" : {"contractName" : "currency", "variableName" : "balances", "key" : {"$not" : /.*:.*/}}}
        let unwind = { "$unwind" : "$value"}
        let project1 = { "$project" : { "fixed" : { "$convert" : { "input" : "$value.__fixed__", "to" : "decimal"}}, "key" : "$key", "value" : "$value", "_id": 0}}
        let project2 = { "$project" : { "key" : "$key", "value" : { "$ifNull" : ["$fixed", "$value"]}}}
        let project3 = { "$project" : { "key" : "$key", "value" : { "$convert" : { "input" : "$value", "to" : "string"}}}}
        let sort1 = { "$sort" : { "value" : -1.0}}
        var skip = { $skip: offset }
        var limit = { $limit: reclimit}
        let count = { $count : "count"}
        let dataPipeline = [match, unwind, project1, project2, project3, sort1, skip, limit]
        let countPipeline = [match, unwind, project1, project2, project3, sort1, count]
        let facet = { $facet: {data: dataPipeline, "count": countPipeline}}
        let collation = { locale : "en_US", numericOrdering : true }

        let results = await strapi.query('current-state').model
            .aggregate([facet])
            .collation(collation)

        return {
            data: results[0].data,
            count: results[0].count[0] ? results[0].count[0].count : 0
        }
    },
    getTotalAddresses: async () => {
        let results = await strapi.query('state').model.find({keyIsAddress: true}).distinct("key")
        return {count: results.length}
    }
};