(function (t) {
    var e = (t._PageAccelerator = t._PageAccelerator || {});
    // Define ajax object for making GET requests
    e.ajax = {
        get: function (e) {
            // Return a promise for GET request
            return new t.Promise(function (t, r) {
                var n = new XMLHttpRequest();
                n.open("GET", e, true);
                n.onload = function () {
                    if (n.status >= 200 && n.status < 400) {
                        t(n.response); // Resolve promise with response
                        return;
                    }
                    r(n.response); // Reject promise with response
                };
                n.onerror = function () {
                    r(Error("Network Error")); // Reject promise with network error
                };
                n.send();
            });
        },
    };
})(window);

(function (t, e) {
    // Determine the environment (browser or Node.js)
    if (typeof exports === "object" && exports) {
        e(exports); // Export the module for Node.js
    } else if (typeof define === "function" && define.amd) {
        define(["exports"], e); // Define the module for AMD
    } else {
        e(t); // Define the module for the browser
    }
})(this, function (t) {
    var e = t === window;
    var r = e ? t : window;
    var n = document;
    var a = (r._PageAccelerator = r._PageAccelerator || {});
    
    // Constructor function for PageAccelerator
    a.PageAccelerator = function () {
        this.url = n.location.href;
        this.beforeLoading = function () {};
        this.afterLoading = function () {};
        this.metaKeyIsPressed = false;
    };
    
    // Methods for PageAccelerator prototype
    a.PageAccelerator.prototype = {
        // Helper function to update an object with attributes
        _updateObject: function (t, e) {
            var r = e.attributes;
            for (var n = 0, a = r.length; n < a; n++) {
                t.attrs[r[n].name] = r[n].value;
            }
            return t;
        },
        // Helper function to update history state
        _updateHistory: function (t, e) {
            var n = this._updateObject({ head: t.innerHTML.trim(), content: e.innerHTML.trim(), attrs: {} }, e);
            r.history.pushState(n, "", this.url);
            r.addEventListener("popstate", this._updateBody.bind(this), false);
        },
        // Helper function to parse HTML string into DOM
        _DOMParser: function (t) {
            var e = new DOMParser();
            return e.parseFromString(t, "text/html");
        },
        // Helper function to update body attributes
        _updateBodyAttributes: function (t) {
            Object.keys(t).forEach(function (e) {
                var r = t[e];
                n.body.setAttribute(e, r);
            });
        },
        // Helper function to update body content and title
        _updateBody: function (t) {
            this.beforeLoading();
            var e = t.state;
            this._updateBodyAttributes(e.attrs);
            n.body.innerHTML = e.content;
            var a = this._DOMParser(e.head);
            n.title = a.head.querySelector("title").innerText;
            this.url = r.location.href;
            this.start();
            this.afterLoading();
        },
        // Helper function to load stylesheets asynchronously
        _loadStyles: function (t, e) {
            var n = [].map.call(t.querySelectorAll('link[rel="stylesheet"]'), function (t) {
                return a.ajax.get(t.getAttribute("href"));
            });
            r.Promise.all(n).then(e.bind(this));
        },
        // Helper function to update the page content
        _update: function (t) {
            var e = this._DOMParser(t);
            var a = e.head;
            this._loadStyles(
                a,
                function () {
                    var t = e.body;
                    n.body = t;
                    n.head = a;
                    n.title = a.querySelector("title").innerText;
                    this._updateHistory(a, t);
                    this.afterLoading();
                    r.scrollTo(0, 0);
                    this.start();
                }.bind(this)
            );
        },
        // Event handler for link clicks
        _onClick: function (t) {
            this.beforeLoading();
            this.url = t.href;
            a.ajax.get(this.url).then(this._update.bind(this)).catch(this._update.bind(this));
        },
        // Helper function to replace history state
        _replaceHistory: function () {
            var t = n.body;
            var e = this._updateObject({ head: n.head.innerHTML.trim(), content: t.innerHTML.trim(), attrs: {} }, t);
            r.history.replaceState(e, "", this.url);
        },
        // Event listeners for meta key presses
        _events: function () {
            var t = this;
            r.addEventListener("keydown", function (e) {
                if (e.metaKey || e.ctrlKey) {
                    t.metaKeyIsPressed = true;
                }
            });
            r.addEventListener("keyup", function (e) {
                if (e.metaKey || e.ctrlKey) {
                    t.metaKeyIsPressed = false;
                }
            });
        },
        // Method to start PageAccelerator
        start: function (t) {
            var e = t || {};
            this.beforeLoading = e.beforeLoading || this.beforeLoading;
            this.afterLoading = e.afterLoading || this.afterLoading;
            var a = this;
            var i = n.querySelectorAll('a:not([data-pageAccelerator="false"]):not([target=_blank])');
            [].forEach.call(i, function (t) {
                if (t.hostname !== r.location.hostname || t.protocol !== r.location.protocol || /#/.test(t.href)) {
                    return;
                }
                t.addEventListener(
                    "click",
                    function (t) {
                        if (!a.metaKeyIsPressed) {
                            t.preventDefault();
                            a._onClick.call(a, this);
                        }
                    },
                    false
                );
            });
            this._events();
            this._replaceHistory();
        },
    };
    
    // Expose pageAccelerator function
    t.pageAccelerator = function (t) {
        new a.PageAccelerator().start(t);
    };
});