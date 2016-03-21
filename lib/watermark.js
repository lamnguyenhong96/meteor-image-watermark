WatermarkConfig = {};

const url = /^data:([^;]+);base64,(.*)$/;

/**
 * Return a function that executes a sequence of functions from left to right,
 * passing the result of a previous operation to the next
 *
 * @param {...funcs}
 * @return {Function}
 */
function sequence(...funcs) {
    return function (value) {
        return funcs.reduce((val, fn) => fn.call(null, val), value);
    }
}

/**
 * Return the argument passed to it
 *
 * @param {Mixed} x
 * @return {Mixed}
 */
function identity(x) {
    return x;
}


/**
 * Split a data url into a content type and raw data
 *
 * @param {String} dataUrl
 * @return {Array}
 */
function split(datURL) {
    return url.exec(datURL).splice(1);
}

/**
 * Decode a base64 string
 *
 * @param {String} base64
 * @return {String}
 */

function decode(base64) {
    return window.atob(base64);
}

/**
 * Return a string of raw data as a Uint8Array
 *
 * @param {String} data
 * @return {UInt8Array}
 */

function uint8(data) {
    const length = data.length;
    const uints = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
        uints[i] = data.charCodeAt(i);
    }

    return uints;
}

/**
 * Turns a data url into a blob object
 *
 * @param {String} dataUrl
 * @return {Blob}
 */
const mapToBlob = sequence(
    split,
    parts => [decode(parts[1]), parts[0]],
    blob => new Blob([uint8(blob[0])], {
        type: blob[1]
    })
);

/**
 * Get the data url of a canvas
 *
 * @param {HTMLCanvasElement}
 * @return {String}
 */
function mapToDataUrl(canvas) {
    return canvas.toDataURL();
}

/**
 * An immutable canvas pool allowing more efficient use of canvas resources
 *
 * @typedef {Object} CanvasPool
 * @property {Function} pop - return a promise that will evaluate to a canvas
 * @property {Number} length - the number of available canvas elements
 * @property {HTMLCanvasElement[]} elements - the canvas elements used by the pool
 * @property {Function} clear - empty the pool of canvas elements
 * @property {Function} release - free a pool up for release and return the data url
 */

/**
 * Create a CanvasPool with the given size
 *
 * @param {Number} size
 * @param {HTMLCanvasElement[]} elements
 * @param {EventEmitter} eventEmitter
 * @return {CanvasPool}
 */
function CanvasPool() {
    const canvases = [];

    return {
        /**
         * Get the next available canvas from the pool
         *
         * @return {HTMLCanvasElement}
         */
        pop() {
                if (this.length === 0) {
                    canvases.push(document.createElement('canvas'));
                }

                return canvases.pop();
            },

            /**
             * Return the number of available canvas elements in the pool
             *
             * @return {Number}
             */
            get length() {
                return canvases.length;
            },

            /**
             * Return a canvas to the pool. This function will clear the canvas for reuse
             *
             * @param {HTMLCanvasElement} canvas
             * @return {String}
             */
            release(canvas) {
                const context = canvas.getContext('2d');
                context.clearRect(0, 0, canvas.width, canvas.height);
                canvases.push(canvas);
            },

            /**
             * Empty the pool, destroying any references to canvas objects
             */
            clear() {
                canvases.splice(0, canvases.length);
            },

            /**
             * Return the collection of canvases in the pool
             *
             * @return {HTMLCanvasElement[]}
             */
            get elements() {
                return canvases;
            }
    }
}

const shared = CanvasPool();

/**
 * Set the src of an image object and call the resolve function
 * once it has loaded
 *
 * @param {Image} img
 * @param {String} src
 * @param {Function} resolve
 */
function setAndResolve(img, src, resolve) {
    img.onload = () => resolve(img);
    img.src = src;
}

/**
 * Given a resource, return an appropriate loading function for it's type
 *
 * @param {String|File|Image} resource
 * @return {Function}
 */
function getLoader(resource) {
    const type = typeof (resource);

    if (type === 'string') {
        return loadUrl;
    }

    if (resource instanceof Image) {
        return identity;
    }

    return loadFile;
}

/**
 * Used for loading image resources asynchronously and maintaining
 * the supplied order of arguments
 *
 * @param {Array} resources - a mixed array of urls, File objects, or Image objects
 * @param {Function} init - called at the beginning of resource initialization
 * @return {Promise}
 */
function load(resources, init) {
    let promises = [];
    for (var i = 0; i < resources.length; i++) {
        const resource = resources[i];
        const loader = getLoader(resource);
        const promise = loader(resource, init);
        promises.push(promise);
    }
    return Promise.all(promises);
}

/**
 * Load an image by its url
 *
 * @param {String} url
 * @param {Function} init - an optional image initializer
 * @return {Promise}
 */
function loadUrl(url, init) {
    const img = new Image();
    (typeof (init) === 'function') && init(img);
    return new Promise(resolve => {
        img.onload = () => resolve(img)
        img.src = url;
    });
}

/**
 * Return a collection of images from an
 * array of File objects
 *
 * @param {File} file
 * @return {Promise}
 */
function loadFile(file) {
    const reader = new FileReader();
    return new Promise(resolve => {
        const img = new Image();
        reader.onloadend = () => setAndResolve(img, reader.result, resolve);
        reader.readAsDataURL(file);
    });
}

/**
 * Create a new image, optionally configuring it's onload behavior
 *
 * @param {String} url
 * @param {Function} onload
 * @return {Image}
 */
function createImage(url, onload) {
    const img = new Image();
    if (typeof (onload) === 'function') {
        img.onload = onload;
    }
    img.src = url;
    return img;
}

/**
 * Draw an image to a canvas element
 *
 * @param {Image} img
 * @param {HTMLCanvasElement} canvas
 * @return {HTMLCanvasElement}
 */
function drawImage(img, canvas) {
    const ctx = canvas.getContext('2d');

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    return canvas;
}

/**
 * Convert an Image object to a canvas
 *
 * @param {Image} img
 * @param {CanvasPool} pool
 * @return {HTMLCanvasElement}
 */
function imageToCanvas(img, pool) {
    const canvas = pool.pop();
    return drawImage(img, canvas);
}

/**
 * Convert an array of image objects
 * to canvas elements
 *
 * @param {Array} images
 * @param {CanvasPool} pool
 * @return {HTMLCanvasElement[]}
 */
function mapToCanvas(images, pool) {
    return images.map(img => imageToCanvas(img, pool));
}

/**
 * Extend one object with the properties of another
 *
 * @param {Object} first
 * @param {Object} second
 * @return {Object}
 */
function extend(first, second) {
    const secondKeys = Object.keys(second);
    secondKeys.forEach(key => first[key] = second[key]);
    return first;
}

/**
 * Create a shallow copy of the object
 *
 * @param {Object} obj
 * @return {Object}
 */
function clone(obj) {
    return extend({}, obj);
}

/**
 * Return a function for positioning a watermark on a target canvas
 *
 * @param {Function} xFn - a function to determine an x value
 * @param {Function} yFn - a function to determine a y value
 * @param {Number} alpha
 * @return {Function}
 */
function atPosImage(xFn, yFn, alpha) {
    alpha || (alpha = 1.0);
    return function (target, watermark) {
        const context = target.getContext('2d');
        context.save();

        context.globalAlpha = alpha;
        context.drawImage(watermark, xFn(target, watermark), yFn(target, watermark));

        context.restore();
        return target;
    }
}

var image = {

    /**
     * Place the watermark in the lower right corner of the target
     * image
     *
     * @param {Number} alpha
     * @return {Function}
     */
    lowerRight: function () {
        return atPosImage(
            (target, mark) => target.width - (mark.width + 10), (target, mark) => target.height - (mark.height + 10),
            alpha
        );
    },
    /**
     * Place the watermark in the upper right corner of the target
     * image
     *
     * @param {Number} alpha
     * @return {Function}
     */
    upperRight: function (alpha) {
        return atPosImage(
            (target, mark) => target.width - (mark.width + 10), (target, mark) => 10,
            alpha
        );
    },
    /**
     * Place the watermark in the lower left corner of the target
     * image
     *
     * @param {Number} alpha
     * @return {Function}
     */
    lowerLeft: function (alpha) {
        return atPosImage(
            (target, mark) => 10, (target, mark) => target.height - (mark.height + 10),
            alpha
        );
    },
    /**
     * Place the watermark in the upper left corner of the target
     * image
     *
     * @param {Number} alpha
     * @return {Function}
     */
    upperLeft: function (alpha) {
        return atPosImage(
            (target, mark) => 10, (target, mark) => 10,
            alpha
        );
    },
    /**
     * Place the watermark in the center of the target
     * image
     *
     * @param {Number} alpha
     * @return {Function}
     */
    center: function (alpha) {
        return atPosImage(
            (target, mark) => (target.width - mark.width) / 2, (target, mark) => (target.height - mark.height) / 2,
            alpha
        );
    }
};

/**
 * Return a function for positioning a watermark on a target canvas
 *
 * @param {Function} xFn - a function to determine an x value
 * @param {Function} yFn - a function to determine a y value
 * @param {String} text - the text to write
 * @param {String} font - same as the CSS font property
 * @param {String} fillStyle
 * @param {Number} alpha
 * @return {Function}
 */
function atPosText(xFn, yFn, text, font, fillStyle, alpha) {
    alpha || (alpha = 1.0);
    return function (target) {
        const context = target.getContext('2d');
        context.save();

        context.globalAlpha = alpha;
        context.fillStyle = fillStyle;
        context.font = font;
        let metrics = context.measureText(text);
        context.fillText(text, xFn(target, metrics, context), yFn(target, metrics, context));

        context.restore();
        return target;
    }
}






var text = {
        /**
         * Write text to the lower right corner of the target canvas
         *
         * @param {String} text - the text to write
         * @param {String} font - same as the CSS font property
         * @param {String} fillStyle
         * @param {Number} alpha - control text transparency
         * @param {Number} y - height in text metrics is not very well supported. This is a manual value
         * @return {Function}
         */
        lowerRight: function (text, font, fillStyle, alpha, y) {
            return atPosText(
                (target, metrics) => target.width - (metrics.width + 10),
                target => y || (target.height - 10),
                text,
                font,
                fillStyle,
                alpha
            );
        },
        /**
         * Write text to the lower left corner of the target canvas
         *
         * @param {String} text - the text to write
         * @param {String} font - same as the CSS font property
         * @param {String} fillStyle
         * @param {Number} alpha - control text transparency
         * @param {Number} y - height in text metrics is not very well supported. This is a manual value
         * @return {Function}
         */
        lowerLeft: function (text, font, fillStyle, alpha, y) {
            return atPosText(
                () => 10,
                target => y || (target.height - 10),
                text,
                font,
                fillStyle,
                alpha
            );
        },
        /**
         * Write text to the upper right corner of the target canvas
         *
         * @param {String} text - the text to write
         * @param {String} font - same as the CSS font property
         * @param {String} fillStyle
         * @param {Number} alpha - control text transparency
         * @param {Number} y - height in text metrics is not very well supported. This is a manual value
         * @return {Function}
         */
        upperRight: function (text, font, fillStyle, alpha, y) {
            return atPosText(
                (target, metrics) => target.width - (metrics.width + 10), () => y || 20,
                text,
                font,
                fillStyle,
                alpha
            );
        },

        /**
         * Write text to the upper left corner of the target canvas
         *
         * @param {String} text - the text to write
         * @param {String} font - same as the CSS font property
         * @param {String} fillStyle
         * @param {Number} alpha - control text transparency
         * @param {Number} y - height in text metrics is not very well supported. This is a manual value
         * @return {Function}
         */
        function upperLeft(text, font, fillStyle, alpha, y) {
            return atPosText(
                () => 10, () => y || 20,
                text,
                font,
                fillStyle,
                alpha
            );
        },
        /**
         * Write text to the center of the target canvas
         *
         * @param {String} text - the text to write
         * @param {String} font - same as the CSS font property
         * @param {String} fillStyle
         * @param {Number} alpha - control text transparency
         * @param {Number} y - height in text metrics is not very well supported. This is a manual value
         * @return {Function}
         */
        function center(text, font, fillStyle, alpha, y) {
            return atPosText(
                (target, metrics, ctx) => {
                    ctx.textAlign = 'center';
                    return target.width / 2;
                }, (target, metrics, ctx) => {
                    ctx.textBaseline = 'middle';
                    return target.height / 2;
                },
                text,
                font,
                fillStyle,
                alpha
            );
        }
    }
    /**
     * Create a DrawResult by apply a list of canvas elements to a draw function
     *
     * @param {Function} draw - the draw function used to create a DrawResult
     * @param {HTMLCanvasElement} sources - the canvases used by the draw function
     * @return {DrawResult}
     */
function result(draw, sources) {
    const canvas = draw.apply(null, sources);
    return {
        canvas,
        sources
    };
}

// ** Export Watermark ** //

/**
 * A configuration type for the watermark function
 *
 * @typedef {Object} Options
 * @property {Function} init - an initialization function that is given Image objects before loading (only applies if resources is a collection of urls)
 * @property {Number} poolSize - number of canvas elements available for drawing,
 * @property {CanvasPool} pool - the pool used. If provided, poolSize will be ignored
 */

/**
 * @constant
 * @type {Options}
 */
const defaults = {
    init: () => {},
}

/**
 * Merge the given options with the defaults
 *
 * @param {Options} options
 * @return {Options}
 */
function mergeOptions(options) {
    return extend(clone(defaults), options);
}

/**
 * Release canvases from a draw result for reuse. Returns
 * the dataURL from the result's canvas
 *
 * @param {DrawResult} result
 * @param {CanvasPool} pool
 * @return  {String}
 */
function release(result, pool) {
    const {
        canvas, sources
    } = result;
    const dataURL = mapToDataUrl(canvas);
    sources.forEach(pool.release);
    return dataURL;
}

/**
 * Return a watermark object
 *
 *
 * @param {Array} resources - a collection of urls, File objects, or Image objects
 * @param {Options} options - a configuration object for watermark
 * @param {Promise} promise - optional
 * @return {Object}
 */
WatermarkConfig.watermark = function (resources, options = {}, promise = null) {
    const opts = mergeOptions(options);
    promise || (promise = load(resources, opts.init));

    return {
        /**
         * Convert the watermarked image into a dataUrl. The draw
         * function is given all images as canvas elements in order
         *
         * @param {Function} draw
         * @return {Object}
         */
        dataUrl(draw) {
                const promise = this
                    .then(images => mapToCanvas(images, shared))
                    .then(canvases => result(draw, canvases))
                    .then(result => release(result, shared));

                return Watermark.watermark(resources, opts, promise);
            },

            /**
             * Load additional resources
             *
             * @param {Array} resources - a collection of urls, File objects, or Image objects
             * @param {Function} init - an initialization function that is given Image objects before loading (only applies if resources is a collection of urls)
             * @return {Object}
             */
            load(resources, init) {
                const promise = this
                    .then(resource => load([resource].concat(resources), init));

                return Watermark.watermark(resources, opts, promise);
            },

            /**
             * Render the current state of the watermarked image. Useful for performing
             * actions after the watermark has been applied
             *
             * @return {Object}
             */
            render() {
                const promise = this
                    .then(resource => load([resource]));

                return Watermark.watermark(resources, opts, promise);
            },

            /**
             * Convert the watermark into a blob
             *
             * @param {Function} draw
             * @return {Object}
             */
            blob(draw) {
                const promise = this.dataUrl(draw)
                    .then(mapToBlob);

                return Watermark.watermark(resources, opts, promise);
            },

            /**
             * Convert the watermark into an image using the given draw function
             *
             * @param {Function} draw
             * @return {Object}
             */
            image(draw) {
                const promise = this.dataUrl(draw)
                    .then(createImage);

                return Watermark.watermark(resources, opts, promise);
            },

            /**
             * Delegate to the watermark promise
             *
             * @return {Promise}
             */
            then(...funcs) {
                return promise.then.apply(promise, funcs);
            }
    };
};

/**
 * Style functions
 */
WatermarkConfig.watermark.image = image;
Watermark.watermark.text = text;

/**
 * Clean up all canvas references
 */
WatermarkConfig.watermark.destroy = () => shared.clear();