'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require('strapi-utils');
const http = require('http');

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
    find: async ctx => {
        const count = await strapi.query('transactions').count()
        let limit = parseInt(ctx.query.limit) || 100

        const defaulOffset = count - limit < 0 ? 0 : count - limit;
        let offset = typeof ctx.query.offset === 'undefined' ?  defaulOffset : parseInt(ctx.query.offset);

        const results = await strapi.query('transactions').model.find({}, { "id": 0, "_id": 0, "__v": 0})
            .skip(offset)
            .limit(limit)
        
        const data = results.map(result => {
            result = removeID(sanitizeEntity(result, { model: strapi.models.transactions }))
            result = parseJSON(result, 'transaction')
            result = parseJSON(result, 'state')
            result = parseJSON(result, 'kwargs')
            return result
        })
        return { data, count };
    },

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
    getTopWallets: async (ctx) => {
        var match = { $match : { contractName : "currency", variableName : "balances", keyIsAddress : { $eq : true }}}
        var sort1 = { $sort: { key: 1, blockNum: -1 }}
        var group = { $group: { _id: "$key", "value": {$first: "$value"}}}
        var sort2 = { $sort: { value: -1 }}
        var project = { $project: {key: "$_id", value: 1, "_id": 0}}
        let pipeline = [match, sort1, group, sort2, project]
        let count = { $count : "count"}
        let facet = { $facet: {data: pipeline, "count": [...pipeline, count]}}
        let collation = { locale : "en_US", numericOrdering : true }

        //let countRecs = await strapi.query('state').model.aggregate(pipeline)
        //let count = countRecs.length

        
        let limit = parseInt(ctx.query.limit) || 100
        let offset = typeof ctx.query.offset === 'undefined' ?  0 : parseInt(ctx.query.offset);

        let data = await strapi.query('state').model
            .aggregate([facet])
            .collation(collation)
            .skip(offset)
            .limit(limit)

       return data[0];
    },
    getTotalAddresses: async () => {
        let results = await strapi.query('state').model.find({keyIsAddress: true}).distinct("key")
        return {count: results.length}
    }
};