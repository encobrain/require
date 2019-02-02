
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

        window.require = function () { }
        return;
    }

    var head = document.head || document.getElementsByTagName('head')[0];

    function appendChild(child) {
        head.appendChild(child);
    }

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

    function AwaitDone(path) {
        this.path = path;
        this._awaits = [];
        this._isDone = false;
        this._doneArgs = [];
    }

    AwaitDone.prototype.add = function (cb) {
        if (this._isDone) return cb.call(window, this.path, this._exports);

        this._awaits.push(cb);
    }

    AwaitDone.prototype.done = function (exports) {
        if (this._isDone)
            throw new Error("Already done");

        this._isDone = true;
        this._exports = exports;

        for (var i = 0; i < this._awaits.length; i++)
            this._awaits[i].call(window, this.path, exports);
    }

    /**
     * Describe module with requires
     * @param {string[]} [paths]   Required modules paths. Can be:
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
     * @returns {AwaitDone}
     */
    function require(paths, processFn) {
        if (typeof paths === 'function') {
            processFn = paths;
            paths = [];
        }

        if (!(paths instanceof Array))
            throw new Error("Incorrect use. modules should have string[] type");

        if (processFn && typeof processFn !== 'function')
            throw new Error("Incorrect use. processFn shuld have Function type");

        var awaits = new AwaitDone();

        var modules = [];
        var waits = paths.length;

        function gotModule(path, exports) {
            modules[paths.indexOf(path)] = exports;

            if (--waits > 0) return;

            exports = processFn && processFn.apply(window, modules);

            if (exports instanceof AwaitDone) exports.add(function (path, exports) {
                awaits.done(exports);
            });
            else awaits.done(exports);
        }

        for (var pi = 0; pi < paths.length; pi++) {
            var path = paths[pi];

            if (path.indexOf(basePath) !== 0 && !/^http/.test(path))
                path = basePath + (path[0] == '/' ? '' : '/') + path;

            paths[pi] = path;

            getModule(path, gotModule);
        }

        if (!paths.length) setTimeout(gotModule, 0);

        return awaits;
    }

    require.Error = Error;

    window.require = require;

    //  ======================================

    var modulesCache = {};

    function getModule(path, cb) {
        var awaits = modulesCache[path];

        if (!awaits) {
            awaits = modulesCache[path] = new AwaitDone(path);

            getModuleDone(awaits);
        }

        awaits.add(cb);
    }


    function getModuleDone(awaits) {

        var path = awaits.path;

        if (/\.css$/.test(path)) {
            var link = document.createElement('link');

            link.rel = 'stylesheet';
            link.href = path;
            link.setAttribute('created-by', 'require');

            appendChild(link);

            awaits.done(null);

            return;
        }

        (console.debug || console.log)("[require] " + path + ' ...');

        if (/^http.*\.js$/.test(path)) {
            var script = document.createElement('script');
            script.setAttribute("created-by", "require");
            script.src = path;

            script.onload = function () {
                (console.debug || console.log)("[require] ... " + path + " : OK ");
                awaits.done(null);
            };

            script.onerror = function () {
                console.error("[require] ... " + path + " : ERROR ");
                awaits.done(null);
            };

            appendChild(script);

            return;
        }

        var xhr = getXmlHttp();

        xhr.open('GET', path, true);

        xhr.send(null);

        checkState();

        function checkState() {
            if (xhr.readyState != 4) return setTimeout(checkState, 0);

            (console.debug || console.log)("[require] ... " + path + " : " + xhr.status + " " + xhr.statusText);

            if (xhr.status != 200) {
                var err = new Error("Fail get module " + path);

                err.statusCode = xhr.statusCode;
                err.statusText = xhr.statusText;
                err.responseText = xhr.responseText;

                awaits.done(err);
                return
            }

            if (!/\.js$/.test(path)) {
                awaits.done(xhr.responseText);
                return;
            }

            let dir = path.substr(0, path.lastIndexOf('/'));

            var evalFn = new Function(/^http/.test(path) ? '' : 'require', "// module: " + path + "\n\n" + xhr.responseText);

            function resolveRequire(modules, processFn) {
                if (typeof modules === "function") {
                    processFn = modules;
                    modules = [];
                }

                if (modules instanceof Array) {
                    for (var i = 0; i < modules.length; i++) {
                        var relative =
                            !/^http/.test(modules[i]) &&
                            /^((?:\.\/)?(?:\.\.\/)*)([^\/].*)$/.exec(modules[i]);

                        if (relative) {
                            var parts = dir.split("/");
                            var steps = relative[1].split("/"); steps.pop();
                            while (steps.pop() == "..") parts.pop();
                            modules[i] = parts.join("/") + "/" + relative[2];
                        }
                    }
                }

                var cb = resolveRequire.called ? processFn : function () {
                    var exports = processFn && processFn.apply(window, arguments);

                    if (exports instanceof AwaitDone) exports.add(function (path, exports) {
                        awaits.done(exports);
                    });
                    else awaits.done(exports);
                };

                resolveRequire.called = true;

                return require(modules, cb);
            }

            evalFn.call(window, resolveRequire);

            // try {  } 
            // catch (e) { console.error("[require] " + path, e); }

            if (!resolveRequire.called) awaits.done(null);
        }
    }

})();

