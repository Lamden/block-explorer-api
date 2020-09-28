'use strict';
const { sanitizeEntity } = require('strapi-utils');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    findOne: async (ctx) => {
        const { contractName, functionName } = ctx.params
        let res = await strapi.query('stamps').model.findOne({ contractName, functionName }, { "id": 0, "_id": 0, "__v": 0}) 
        let sanny = sanitizeEntity(res, { model: strapi.models.stamps })
        delete sanny.id
        return sanny
    },
};
