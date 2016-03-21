Meteor watermark.js
===================


A functional library for watermarking images in the browser. Written with ES6, and made available to current browsers via [Babel](https://babeljs.io/). Supports urls, file inputs, blobs, and on-page images.

##Tested Browsers

Any browser supporting [File](https://developer.mozilla.org/en-US/docs/Web/API/File#Browser_compatibility) and [FileReader](https://developer.mozilla.org/en-US/docs/Web/API/FileReader#Browser_compatibility) should work. The following browsers have been
tested and work:

* IE10 (Windows 7)
* Chrome 42 (OS X 10.10.3)
* Firefox 38 (OS X 10.10.3)
* Safari 8.0.6 (OS X 10.10.3)
* Opera 29.0 (OS X 10.10.3)

Please feel free to update this list or submit a fix for a particular browser via a pull request.

##Installing

watermark.js is available via npm and bower:

```
$ meteor add contribute:image-watermark
```
##Usage

```js
// watermark by local path
WatermarkConfig.watermark(['img/photo.jpg', 'img/logo.png'])
  .image(WatermarkConfig.watermark.image.lowerRight(0.5))
  .then(img => document.getElementById('container').appendChild(img));

// load a url and file object
const upload = document.querySelector('input[type=file]').files[0];
WatermarkConfig.watermark([upload, 'img/logo.png'])
  .image(WatermarkConfig.watermark.image.lowerLeft(0.5))
  .then(img => document.getElementById('container').appendChild(img));

// watermark from remote source
const options = {
  init(img) {
    img.crossOrigin = 'anonymous'
  }
};
WatermarkConfig.watermark(['http://host.com/photo.jpg', 'http://host.com/logo.png'], options)
  .image(WatermarkConfig.watermark.image.lowerRight(0.5))
  .then(img => document.getElementById('container').appendChild(img));
```
##Examples
The examples demonstrate using watermark images and text, as well as a demonstration
of uploading a watermarked image to Amazon S3. It is the same content hosted at
[http://brianium.github.io/watermarkjs/](http://brianium.github.io/watermarkjs/).

##Author
Author: https://github.com/brianium