require(['/modules/module1/main.js'], processFn);

function processFn (module1) {
    setTimeout(module1.sayBlahBlah, 1000);
}