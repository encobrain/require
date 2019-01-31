require([
    'form.html',
    'styles.css',  
    'https://code.jquery.com/jquery-3.3.1.min.js'
], processFn);

function processFn (formHtml, cssNull, jQueryNull) {
    $(formHtml).appendTo('body');

    return {
        sayHello: function () {
            alert("Hello World!");
        },

        sayBlahBlah: function () {
            alert("Blah Blah...");
        }
    }

}