require('styles.css');
require('https://code.jquery.com/jquery-3.3.1.min.js');

var formHtml = require('form.html');

function init () {
    $(formHtml.text).appendTo('body');

    console.log("module 1 inited");
}

// How do exports:

exports.someProperty = 1;

// OR

exports = {
    sayHello: function () {
        alert("Hello World!");
    },

    sayBlahBlah: function () {
        alert("Blah Blah...");
    }
};

// OR

var exports = {
    sayHello: function () {
        alert("Hello World!");
    },

    sayBlahBlah: function () {
        alert("Blah Blah...");
    }
};