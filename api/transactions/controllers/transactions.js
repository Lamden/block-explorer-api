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

const parseJSON = (obj, key) => {
    try{
        obj[key] = JSON.parse(obj[key])
    }catch(e){}
    return obj
}

module.exports = {
    find: async ctx => {
        const count = await strapi.query('transactions').count()
        let limit = parseInt(ctx.query.limit) || 100
        let sort = parseInt(ctx.query.sort) || -1
        const offset = parseInt(ctx.query.offset) || 0

        const results = await strapi.query('transactions').model.find({}, { "id": 0, "_id": 0, "__v": 0})
            .sort({blockNum: sort, nonce: -1})
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

    findOne: async ctx => {
        let results = await strapi.query('transactions').model.find({ hash: ctx.params.hash }, { "id": 0, "_id": 0, "__v": 0})
        try{
            var result = results[0]
        } catch (e) {
            return {error: 'Transaction hash not found'}
        }
        result = removeID(sanitizeEntity(result, { model: strapi.models.transactions }))
        result = parseJSON(result, 'transaction')
        result = parseJSON(result, 'state')
        result = parseJSON(result, 'kwargs')
        return result
    }, 

    findHistory: async (ctx) => {
        let hashes = []
        let limit = parseInt(ctx.query.limit) || 10
        let offset = parseInt(ctx.query.offset) || 0

        let stateResults = await strapi.query('state').model
            .find({key: {$regex : `.*${ctx.params.address}.*`}}, { "id": 0, "_id": 0, "__v": 0})
            stateResults.forEach(doc => {
                hashes.push(doc.hash) 
            }); 

        let txResults = await strapi.query('transactions').model
            .find( { $or: [{sender: ctx.params.address}, {hash: {$in: [... new Set(hashes)]}}] }, { "id": 0, "_id": 0, "__v": 0} )
            .sort({blockNum: -1, nonce: -1})
            .limit(limit)
            .skip(offset)

        txResults = txResults.map(result => {
            result = removeID(sanitizeEntity(result, { model: strapi.models.transactions }))
            result = parseJSON(result, 'transaction')
            result = parseJSON(result, 'state')
            result = parseJSON(result, 'kwargs')
            return result
        });
        return {data: txResults, count: stateResults.length};
    },
};
