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
        const count = await strapi.query('blocks').count()
        const raw = parseInt(ctx.query.raw) || 0
        const offset = parseInt(ctx.query.offset) || 0
        let limit = parseInt(ctx.query.limit) || 100
        let sort = parseInt(ctx.query.sort) || -1

        const results = await strapi.query('blocks').model.find({}, { "id": 0, "_id": 0, "__v": 0})
            .sort({blockNum: sort})
            .skip(offset)
            .limit(limit)
        
        const data = results.map(result => {
            
            result = removeID(sanitizeEntity(result, { model: strapi.models.blocks }))
            result = parseJSON(result, 'transactions')
            if (!raw) delete result.rawBlock
            return result
        })
        return { data, count };
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
