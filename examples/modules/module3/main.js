var module1 = require('/modules/module1/main.js');

function init () {
    setTimeout(module1.sayBlahBlah, 1000);

    console.log('module3 inited');
}

exports = {
    sayHello: function () {
        console.log("Hello from module3");
    } 
};