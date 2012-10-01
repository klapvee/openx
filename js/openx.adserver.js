/**
 *
 * Openx adLoader object for openx
 *
 * Load and check for timeout of the openx Single Page Call.
 * Banner loading on completion of all scripts loaded.
 * Handles HTML and JS/Flash Banners
 *
 * @author: Willem Daems
 * @version: 1.0
 * @todo: merge onready/oncomplete functions
 * @todo cleanup  and improve proxyWrite script
 *
 * Copyright 2011(C) Willem Daems.
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *
 * The general idea:
 *
 * This is script is intended to stop locking up your website when an ad server is not reachable.
 * The first step is to start the ad loading with the onload of the body. Next overload
 * the document.write with our own function so we have control over the process.
 * Then process everything in batches: don't start a batch if another batch isn't loaded fully yet.
 * Finally: show the banners and release the document.write function
 *
 */

/**
 * SCRIPT URL FETCHER
 *
 */


myUrls = [];

function loader(options)
{
    this.config = options,
    this.timer = 0,
    this.callback = function(object) {
        clearTimeout(object.timer);
    },
    this.construct = function(url)
    {
        var script;


        openx.debug.write('load: ' + url);


        for (f = 0; f < myUrls.length; f++) {
            if (myUrls[f] == url) {
                return;
            }
        }

        myUrls.push(url);

        script = document.createElement('SCRIPT');
        script.src = url.replace(/\&amp;/gi, '&');
        script.type = 'text/javascript';

        script.timer = setTimeout(function() {
            window.stop();
       }, this.config.timeout);

        if (script.readyState) {

            script.superClass = this;
            script.onreadystatechange = function()
            {
                if (script.readyState == 'complete' || script.readyState == 'loaded') {
                    script.superClass.callback(script);
                }
            }
        } else {
            script.onload = this.callback(script);
        }


       document.getElementsByTagName('HEAD')[0].appendChild(script);


    }

    this.construct(this.config.url);
}



/**
 *  DEBUGGER UTILITY
 *
 */
function debug()
{
    this.debug = true;
    this.write = function(line)
    {
        if (this.debug) {
            if (typeof console !== 'undefined') {
                console.log(line);
            }
        }
    }
}


/**
 *  LAZY DELAYED WRITING
 *
 */
var lazyWrite = {
    writeInterval: 0,
    code: '',
    codeLength: 0,
    codeCycles: 0,
    hasWriteActivity: function(c) {

        clearTimeout(lazyWrite.writeInterval);
        lazyWrite.writeInterval = 0;

        parser.parse(c);


    },
    write: function(stuff) {

        lazyWrite.code += stuff;

        // reset/start
        if (lazyWrite.writeInterval === 0) {

            lazyWrite.codeLength = 0;
            openx.debug.write('setting new lazy interval');
            lazyWrite.writeInterval = setTimeout(function() {
                var c = lazyWrite.code.replace(/\&amp;/gi,'&');

                lazyWrite.code = '';
                lazyWrite.hasWriteActivity(c);

            }, 4);
        }
    }
}

var parser = {

    parse: function(code) {

        // declare variables
        var zoneName, fragment, script, div, eval_script, i;

        // set timestamp for watch comparison
        this.writeTime();

        // get the current zone name
        zoneName = openx.zones[openx.currentZone];

        // create empty fragment
        fragment = document.createDocumentFragment();

        // create empty div
        div = document.createElement('DIV');

        // IE6 needs some content
        div.innerHTML = '&nbsp;';

        code = code.replace(/&amp;/gi, '&');

        // add the code
        div.innerHTML += code;

        // append it to the empty fragment
        fragment.appendChild(div);

        // count the scripts found
        numberOfScripts = div.getElementsByTagName('SCRIPT').length;

        if (typeof zoneName !== 'undefined') {

            addInnerHTML(document.getElementById(zoneName), div);

        } else {
            addInnerHTML(document.getElementsByTagName('HEAD')[0], div);
        }
    },
    writeTime: function() {

        var dateObject;
        dateObject = new Date();
        openx.writeLogtime = dateObject.getTime();


    }
}

function watcher(options) {

    this.cycles = 0;
    this.config = options;
    this.condition = false;
    this.watchTimeout = 0;
    this.watchInterval = 0;

    this.watch = function() {
        if (this.config.condition() === true) {
            clearInterval(this.watchTimeout);
            clearInterval(this.watchInterval);
            if (typeof this.config.success === 'function') {
                this.config.success();
            }
        }
    }
    _this = this;
    this.watchInterval = setInterval(function() {
        _this.watch()
    }, this.config.interval);

    this.watchTimeout = setTimeout(function() {
        clearInterval(_this.watchInterval);
        if (typeof _this.config.error === 'function') {
            _this.config.error();
        }

    }, this.config.timeout);
}

/**
 * The openx object
 */
var openx = {

    config: {},
    debug: new debug(),
    orgWrite: document.write,
    currentZone: -1,
    zones: [],
    writeLogtime: 0,
    init: function(options)
    {
        var i, myDate;

        for (i in OA_zones) {
            openx.zones.push(i);
        }

        this.config = options;

        myDate = new Date();
        this.writeLogtime = myDate.getTime();

        document.write = lazyWrite.write;

        new loader({
            url: this.config.url,
            timeout: 500
        });

        new watcher({
            condition: function() {

                var timeDifference, dateObject, zoneName;
                dateObject = new Date();
                timeDifference = dateObject.getTime() - openx.writeLogtime;

                // assume that there is no write activity anymore!
                if (timeDifference > 525) {

                    openx.currentZone += 1;

                    if (openx.currentZone < openx.zones.length) {
                        zoneName = openx.zones[openx.currentZone];
                        myUrls = [];
                        openx.debug.write('------------------------------ ' + zoneName + ' ------------------------------');
                        OA_show(zoneName);
                    } else {

                        return true;
                    }
                }
            },
            callback: function() {
                console.log('watchdog');
            },
            success: function() {
                console.log('all done!');
            },
            error: function() {
                console.log('aww no! :(');
            },
            timeout: 5000, // max running time
            interval: 100 //evaluate condition
        });
    }
}



function addInnerHTML(to, html) {

    var childs, tag, elem, atts, nodeName, isScript, nodeValue, it, e;

    childs = html.childNodes.length;



    for (it = 0; it < childs; it++) {

        if (typeof html.childNodes[it].tagName !== 'undefined') {

            elem = document.createElement(html.childNodes[it].tagName);

            if (html.childNodes[it].tagName.toLowerCase() === 'script') {

                if (html.childNodes[it].src !== '') {

                    new loader({
                        url: html.childNodes[it].src,
                        timeout: 500
                    });
                } else {
                    evil(html.childNodes[it].innerHTML);
                }
                 continue;
            }

            if (html.childNodes[it].attributes === null) {
                continue;
            }

            atts = html.childNodes[it].attributes.length;

            for (e = 0; e < atts; e++) {

                nodeName = html.childNodes[it].attributes[e].nodeName;
                nodeValue = html.childNodes[it].attributes[e].nodeValue;//.replace(/\&amp;/gi,'&');

                if (nodeName.toLowerCase() === 'onload') {
                    elem.setAttribute(nodeName, nodeValue);

                } else if (nodeName === 'src') {
                    elem.setAttribute(nodeName, decodeURIComponent(nodeValue));
                } else {
                    elem.setAttribute(nodeName, nodeValue);
                }
            }

            to.appendChild(elem);

            //make it recursive
            if (html.childNodes[it].hasChildNodes) {
                addInnerHTML (elem, html.childNodes[it]);
            }
        }
    }
}


function evil(s) {
    // create new script object
    eval_script = document.createElement('script');

    // add a textnode for IE, rest can use the text property
    if (navigator.appName.match(/internet explorer/gi) != null)
    {
        eval_script.text = s;
    } else {
        eval_script.appendChild( document.createTextNode(s) );
    }

    zoneName = openx.zones[openx.currentZone];

    if (zoneName == null) {
        //openx.debug.write('ZONE IS EMPTY');
        // append it to the document
        document.getElementsByTagName('HEAD')[0].appendChild(eval_script);

    } else {
        document.getElementById(zoneName).appendChild(eval_script);
    }


    try {
        // evaluate the contents of the script block
        openx.debug.write('EVALLING'+eval_script.innerHTML);
        eval(eval_script.innerHTML);
        openx.debug.write('GOOGLE AD HEIGHT'+google_ad_height);
    } catch (e) {
        // openx.debug.write('error: ' + e)
    }
}
