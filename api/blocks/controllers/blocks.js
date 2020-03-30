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
    find: async (ctx) => {
        let query = {}
        let limit = parseInt(ctx.query.limit) || 100
        let start = parseInt(ctx.query.start) || 0
        let action = ctx.query.action || ""
        let sortStr = ctx.query.sort || "-blockNum"
        if (action === "prev") {
            query = {
                $and: [
                    {blockNum: {$gte: start - limit < 0 ? 0 : start - limit}},
                    {blockNum: {$lte: start}}
                ]
            }
        }
        if (action === "next") {
            query = {
                $and: [
                    {blockNum: {$gte: start}},
                    {blockNum: {$lte: start + limit}}
                ]
            }
        }

        let results = await strapi.query('blocks').model
            .find(query, { "id": 0, "_id": 0, "__v": 0})
            .sort(sortStr)
            .limit(parseInt(limit))

        return results.map(result => {
            result = removeID(sanitizeEntity(result, { model: strapi.models.blocks }))
            result = parseJSON(result, 'transactions')
            return result
        });
    },

    findOneNumber: async ctx => {
        let results = await strapi.query('blocks').model.find({ blockNum: ctx.params.num }, { "id": 0, "_id": 0, "__v": 0})

        return results.map(result => {
            result = removeID(sanitizeEntity(result, { model: strapi.models.blocks }))
            result = parseJSON(result, 'transactions')
            return result
        });
    },
    findOneHash: async ctx => {
        let results = await strapi.query('blocks').model.find({ hash: ctx.params.hash }, { "id": 0, "_id": 0, "__v": 0})

        return results.map(result => {
            result = removeID(sanitizeEntity(result, { model: strapi.models.blocks }))
            result = parseJSON(result, 'transactions')
            return result
        });
    },
};
