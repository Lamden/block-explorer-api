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
};
