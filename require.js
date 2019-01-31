
(function () {

    function getXmlHttp() {
        var xmlhttp = false;
        try {
            xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
        } catch (e) {
            try {
                xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
            } catch (e) {
                xmlhttp = false;
            }
        }
        if (!xmlhttp && typeof XMLHttpRequest != 'undefined') {
            xmlhttp = new XMLHttpRequest();
        }
        return xmlhttp;
    }

    let xhrSupport = getXmlHttp() !== false;

    if (!xhrSupport) {
        alert("Your browser don't support XMLHttpRequest technology");

        window.require = function () {}
        return;
    }

    var documentHead = document.head || document.getElementsByTagName('head')[0];
    var documentBody = document.body || document.getElementsByTagName('head')[0];

    /**
     * Creates require error
     * @param {string} message Error message 
     */
    function Error(message) {
        window.Error.call(this, message)
    }

    Error.prototype = new window.Error();
    /**
     * Request status code
     * @type number
     */
    Error.prototype.statusCode = 0;
    /**
     * Request status text
     * @type string
     */
    Error.prototype.statusText = '';

    /**
     * Request response text
     * @type string
     */
    Error.prototype.responseText = '';

    var basePath = window.location.pathname.substr(0, window.location.pathname.lastIndexOf("/"));

    function AwaitDone () {
        this.awaits = [];
    }

    AwaitDone.prototype.add = function (cb) {
        this.awaits.push(cb);
    }

    AwaitDone.prototype.done = function () {
        for (var i=0; i<this.awaits.length; i++)
            this.awaits[i].apply(window, arguments);
    }

    var globalModules = {};

    /**
     * Describe module with requires
     * @param {string[]} [modules] Required modules paths. Can be:
     *                             - relative (path, /path, ./path, ../path). Relative will be towards to current module dir
     *                             - global path (http://path, https://path) 
     * @param {Function} [processFn] Function for precessing module. May return object for interract with other modules
     *                               It calls with arguments that contains required modules:
     *                               - require.Error. If get error
     *                               - .css => null. CSS auto apply to document body
     *                               - .js => 
     *                                  - Object. if require module style 
     *                                  - null. if not require module style  
     *                               - other => String
     */
    function require (modules, processFn) {
        if (typeof modules === 'function') {
            processFn = modules;
            modules = [];
        }    

        if (!(modules instanceof Array)) 
            throw new Error("Incorrect use. modules should have string[] type");

        if (processFn && typeof processFn !== 'function')
            throw new Error("Incorrect use. processFn shuld have Function type");

        var activeReqsCount = modules.length;

        var exports = []; 

        function done (index, exportData) {
            exports[index] = exportData;

            var path = modules[index];

            var awaits = globalModules[path];
            
            globalModules[path] = exportData;

            if (awaits instanceof AwaitDone) 
                awaits.done(exportData);   

            activeReqsCount--;

            if (activeReqsCount <= 0 && processFn) 
                processFn.apply(window, exports);
        }

        for (var mi=0; mi < activeReqsCount; mi++) {

            var path = modules[mi];

            if (path.indexOf(basePath) !== 0 && !/^http/.test(path))
                path = basePath + (path[0] == '/' ? '' : '/') + path;

            modules[mi] = path;

            function get (index) {
                var xhr = getXmlHttp();

                var path = modules[index];

                if (path in globalModules) {

                    if (globalModules[path] instanceof AwaitDone) {
                        globalModules[path].add(function (exports){
                            done(index, exports);
                        });
                    } else done(index, globalModules[path]);
 
                    return;
                }

                globalModules[path] = new AwaitDone();

                xhr.open('GET', path, true);

                function checkState () {
                    if (xhr.readyState != 4) return setTimeout(checkState,10);

                    (console.debug || console.log)("[require] " + path + '. Request done: status='+xhr.status+' statusText:'+xhr.statusText);

                    if (xhr.status != 200) {
                        var err = new Error("Fail get module " + path);

                        err.statusCode = xhr.statusCode;
                        err.statusText = xhr.statusText;
                        err.responseText = xhr.responseText;

                        done(index, err);
                        return
                    }

                    if (/\.css$/.test(path)) {
                        var style = document.createElement('style');
                        style.type = 'text/css';

                        style.setAttribute('created-by','require');

                        if (style.styleSheet) {
                            // This is required for IE8 and below.
                            style.styleSheet.cssText = xhr.responseText;
                        } else {
                            style.appendChild(document.createTextNode(xhr.responseText));
                        }

                        (documentHead || documentBody).appendChild(style);

                        globalModules[path] = null;

                        done(index, null);
                        return;
                    }

                    if (/\.js$/.test(path)) {
                        let dir = path.substr(0,path.lastIndexOf('/'));

                        var evalFn = new Function('require', xhr.responseText);

                        function resolveRequire (modules, processFn) {
                            if (modules instanceof Array) {
                                for (var i=0;i<modules.length;i++) {
                                    var relative = 
                                        !/^http/.test(modules[i]) && 
                                        /^((?:\.\/)?(?:\.\.\/)*)([^\/].*)$/.exec(modules[i]);

                                    if (relative) {
                                        var parts = dir.split("/");
                                        var steps = relative[1].split("/"); steps.pop();
                                        while ( steps.pop() == ".." ) parts.pop(); 
                                        modules[i] = parts.join("/") + "/" + relative[2];
                                    }
                                }
                            }

                            var cb = resolveRequire.called ? processFn : function () {
                                done(index, processFn.apply(window, arguments));
                            };

                            resolveRequire.called = true;

                            require(modules, cb);   
                        }

                        evalFn(resolveRequire);

                        console.log(path, index, resolveRequire.called);

                        if (!resolveRequire.called) done(index, null);

                        return;
                    }

                    done(index, xhr.responseText);
                }

                (console.debug || console.log)("[require] " + path + '. Requesting...');

                xhr.send(null);

                setTimeout(checkState, 10);
            }
            
            get(mi)       
        }

        if (activeReqsCount <= 0) done(-1, null);
    }

    require.Error = Error;


    window.require = require;
})();

