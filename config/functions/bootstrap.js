'use strict';
const blockgrabber = require('./blockgrabber.js');

/**
 * An asynchronous bootstrap function that runs before
 * your application gets started.
 *
 * This gives you an opportunity to set up your data model,
 * run jobs, or perform some special logic.
 *
 * See more details here: https://strapi.io/documentation/3.0.0-beta.x/concepts/configurations.html#bootstrap
 */

module.exports = () => {
    //add random masternode function
    strapi.config.lamden.masternode = () => {return strapi.config.lamden.masternodes[Math.floor(Math.random() * strapi.config.lamden.masternodes.length)]}

    //Start background block grabber
    blockgrabber()
};


