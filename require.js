
(function () {

    if (!Function.prototype.bind) {
        // from MDN
        Function.prototype.bind = function (oThis) {
            if (typeof this !== "function") {
                // closest thing possible to the ECMAScript 5 internal IsCallable function
                throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
            }

            var aArgs = Array.prototype.slice.call(arguments, 1),
                fToBind = this,
                fNOP = function () { },
                fBound = function () {
                    return fToBind.apply(this instanceof fNOP && oThis
                        ? this
                        : oThis,
                        aArgs.concat(Array.prototype.slice.call(arguments)));
                };

            fNOP.prototype = this.prototype;
            fBound.prototype = new fNOP();

            return fBound;
        };
    }

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
        alert("Your browser doesn't support XMLHttpRequest technology. Please update your browser");

        window.require = function () { }
        return;
    }

    function UniqueKey() {
        if (!(this instanceof UniqueKey)) return new UniqueKey();
        this.key = "__UniqueKey_" + Date.now() + "_" + UniqueKey.id++;
    }

    UniqueKey.id = 0;

    UniqueKey.prototype.valueOf = UniqueKey.prototype.toString = function () {
        return this.key;
    };


    var head = document.head || document.getElementsByTagName('head')[0];

    var basePath = window.location.pathname.substr(0, window.location.pathname.lastIndexOf("/"));

    /**                               
     * @param {string} path   Required module path. Can be:
     *                        - relative path (path, /path, ./path, ../path). Relative will be towards to current module dir
     *                        - global path (http://path, https://path)                                               
     * @param {...ModuleExports} waitForModulesExports Wait for modules before exec module body and init it                               
     * @returns {ModuleExports} Exports of module. May be:
     *                          - .js => 
     *                              - object with exports. if module style
     *                              - empty. If not module style
     *                          - .css => empty
     *                          - other => object with .text property
     */
    function require(path, waitForModulesExports) {
        if (typeof path !== "string")
            throw new Error("Incorrect use. path should have <string> type");

        if (path.indexOf(basePath) !== 0 && !/^http/.test(path))
            path = basePath + (path[0] == '/' ? '' : '/') + path;

        waitForModulesExports = Array.prototype.slice.call(arguments, 1);

        var module;

        var wl = waitForModulesExports.length;

        if (wl) {
            module = Module();

            while (--wl >= 0) {
                var me = waitForModulesExports[wl]
                if (!(me instanceof ModuleExports))
                    throw new Error("Incorrect use. waitForModules[i] should have <ModuleExports> type");

                module.waitForModule(me[MODULE_KEY]);
            }

            module.onDone(waitsDone);

            module = Module();

            function waitsDone() {
                var origModule = Module(path);

                origModule.onDone(copyExports);
            }

            function copyExports(origModule) {
                module.setExports(origModule.exports);
                module.init();
            }

        } else {
            module = Module(path);
        }

        return module.exports;
    }

    function GroupRequire() {
        this._waitExports = [];
    }

    GroupRequire.prototype = {
        constructor: GroupRequire,

        require: function (path, waitForModules) {
            var exports = require.apply(window, arguments);

            this._waitExports.push(exports);

            return exports;
        },

        init: function (initFn) {
            if (typeof initFn !== "function")
                throw new Error("initFn should have <Function> type");

            var waitExports = this._waitExports;

            var wl = waitExports.length;

            while (--wl >= 0) {
                waitExports[wl][MODULE_KEY].onDone(checkAllDone);
            }

            var doneExports = 0;

            function checkAllDone() {
                doneExports++;

                if (doneExports == waitExports.length) initFn();
            }
        }
    };

    require.group = function () {
        return new GroupRequire();
    };

    window.require = require;

    //  ======================================

    var modulesCache = {};

    var MODULE_KEY = UniqueKey();

    function ModuleExports(module) {
        this[MODULE_KEY] = module;
    }

    function Module(path) {
        if (path && modulesCache[path]) return modulesCache[path];
        if (!(this instanceof Module)) return new Module(path);

        if (path) modulesCache[path] = this;

        this.path = path;
        this.bodyCode = null;
        this.initFn = null;
        this.waitForModules = [];
        this.waiters = [];
        this.exports = new ModuleExports(this);

        this.start();
    }

    Module.prototype = {
        constructor: Module,

        waitForModule: function (module) {
            var self = this;

            this.waitForModules.push(module);

            module.onDone(function (module) {
                self.init();
            });
        },

        setExports: function (exports) {
            if (exports.constructor !== Object && exports.constructor !== ModuleExports)
                throw new Error("Incorrect exports type");

            for (var pn in exports) if (pn != MODULE_KEY) this.exports[pn] = exports[pn];
        },

        isDone: function () {
            return this.waiters == null;
        },

        onDone: function (cb) {
            if (this.isDone()) return setTimeout(function () { cb(this) }, 0);

            this.waiters.push(cb);
        },

        start: function () {
            if (this.path) this._loadBodyCode();
        },

        _loadBodyCode: function () {
            var self = this;

            var path = this.path;

            (console.debug || console.log)("[require] " + path + ' ...');

            var element;

            if (/\.css$/.test(path)) {
                element = document.createElement('link');

                element.rel = 'stylesheet';
                element.href = path;
            } else if (/^http.*\.js$/.test(path)) {
                element = document.createElement('script');
                element.src = path;
            }

            if (element) {
                element.setAttribute('created-by', 'require');

                element.onload = function () {
                    (console.debug || console.log)("[require] ... " + path + " : OK ");

                    self._execBodyCode();
                }

                element.onerror = function () {
                    console.error("[require] ... " + path + " : ERROR ");

                    self._execBodyCode();
                };

                head.appendChild(element);

                return;
            }

            var xhr = getXmlHttp();

            xhr.open('GET', path, true);

            xhr.send(null);

            checkState();

            function checkState() {
                if (xhr.readyState != 4) return setTimeout(checkState, 0);

                (console.debug || console.log)("[require] ... " + path + " : " + xhr.status + " " + xhr.statusText);

                if (xhr.status == 200) {
                    self.bodyCode = xhr.responseText;
                }

                self._execBodyCode();
            }
        },

        _execBodyCode: function () {
            var self = this;

            var path = this.path;

            if (/\.js$/.test(path) && this.bodyCode) {

                var bodyFn = new Function(
                    'require,exports,init',
                    "// module: " + path + "\n\n" +
                    this.bodyCode + "\n\n" +
                    "return {init: init, exports: exports};"
                );

                let dir = path.substr(0, path.lastIndexOf('/'));

                function addRequireToWaitModules(path) {
                    var relative =
                        !/^http/.test(path) &&
                        /^((?:\.\/)?(?:\.\.\/)*)([^\/].*)$/.exec(path);

                    if (relative) {
                        var parts = dir.split("/");
                        var steps = relative[1].split("/"); steps.pop();
                        while (steps.pop() == "..") parts.pop();
                        arguments[0] = parts.join("/") + "/" + relative[2];
                    }

                    var exports = require.apply(window, arguments);

                    self.waitForModule(exports[MODULE_KEY]);

                    return exports;
                }

                addRequireToWaitModules.group = function () {
                    throw new Error("Group require in module not allowed");
                };

                var ret = bodyFn(addRequireToWaitModules, {});

                if (!ret.exports || ret.exports.constructor !== Object)
                    console.warn("[require] " + path + " : Invalid exports. Should be simple object. Ignoring");
                else self.setExports(ret.exports);

                if (!ret.init || typeof ret.init !== "function")
                    console.warn("[require] " + path + " : Invalid type of 'init'. Should be function. Ignoring");
                else if (self.initFn != null && ret.init !== self.initFn)
                    throw new Error("'init' function in require and in definition not same");
                else self.initFn = ret.init;

            } else this.exports.text = this.bodyCode;

            this.init();
        },

        init: function () {
            if (this.isDone()) return;

            var l = this.waitForModules.length;

            while (l--) {
                if (!this.waitForModules[l].isDone()) return;
            }

            this.initFn && this.initFn();

            var waiters = this.waiters;

            this.waiters = null;

            for (var i = 0; i < waiters.length; i++) {
                waiters[i](this);
            }
        }
    };

})();

