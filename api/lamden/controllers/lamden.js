'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const CoinpaprikaAPI = require('@coinpaprika/api-nodejs-client');
const client = new CoinpaprikaAPI();

var lastcalled;
var priceRes;

module.exports = {
    getPrice: async () => {
        let results = priceRes;
        if (!priceRes || new Date() - lastcalled > 300000) {
            console.log("refreshing price info")
            lastcalled = new Date()
            results = await client.getTicker({coinId: 'tau-lamden'})
            priceRes = results
        }
        return results
    },
    getStamps: async () => {
        let results = await strapi.query('state').model.findOne({ 
            contractName: "stamp_cost",
            variableName:  "S",
            key: "value"
        }, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: -1, txNonce: -1})

        return {value: results.value}
    }
}