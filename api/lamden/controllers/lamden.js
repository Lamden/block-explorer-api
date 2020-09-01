'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const https = require('https');
const CoinpaprikaAPI = require('@coinpaprika/api-nodejs-client');
const client = new CoinpaprikaAPI();

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
    getPrice: async () => {
        let results = await client.getTicker({coinId: 'tau-lamden'})
        return results
    },
    getStamps: async () => {
        let results = await send(`${strapi.config.lamden.masternode()}/contracts/stamp_cost/S?key=value`);
        return results
    }
}