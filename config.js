/**
 * config loader - universal defaults can go in here
 * create a local-config.js and put your sensitive parts in it
 * wait that came out wrong i mean like API keys etc
 */

 // end if no local config found
var local = require('./local-config');
if (! local) { throw "local-config.js not found - did you create one?" }

module.exports = require('underscore').extend({
    // safe, universal defaults can go here
    //lukesDad: 'Darth Vader'
}, local);