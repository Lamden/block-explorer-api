'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    create: async (ctx) => {
        console.log("create!")
        console.log(ctx)
        return "created"
    }
};
