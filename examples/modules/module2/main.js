var module1 = require("../module1/main.js");

function init () {
    setTimeout(module1.sayHello, 2000);

    console.log('module2 inited');
}

exports.sayHello = function () {
    console.log("Hello from module2");
};