
var AWS = require('aws-sdk');
var fs = require('fs');
var async = require('async');
var ffmpeg = require('fluent-ffmpeg');
var s3;
var os = require('os');
var tmpDirectory = null;

module.exports = {

  /**
   * initialize
   *
   * params:
   *  @options
   *    - awsCredentials
   *      > accessKeyId
   *      > secretAccessKey
   *    - tmpDirectory
   */
  initialize : function(options) {

    if (!options.tmpDirectory) {
      // use system tmp directory
      tmpDirectory = os.tmpDir();
      console.log('tmpDirectory is a required option. YMMV from this point...');
    } else {
      tmpDirectory = options.tmpDirectory;  
      console.log('using tmp dir: ' + tmpDirectory);
    }

    if (options.awsCredentials) {
      // initialize S3 with awsCredentials passed in
      AWS.config.update(options.awsCredentials);
      s3 = new AWS.S3();      
    } else {
      console.log('you have not specified AWS awsCredentials. YMMV from this point...');
    }

  },

  /**
   * addVideoOperation
   *
   * params:
   *  @videoOperation
   *    - sourcePath
   *    - ffmpegOperation
   *      > type ['transcodeMP4', 'stillShot']
   *    - s3Options
   *      > Bucket (e.g. 'bridge-video-staging')
   *      > Key (filename. e.g. '00003SprintCrossNodeFluent.mp4')
   *      > ACL (e.g. 'public-read')
   *      > ContentType (e.g. 'video/mp4')
   *  @cb
   *    - error
   *    - result
   */
  addVideoOperation : function(videoOperation, cb) {
    console.log('videoOperation: ' + videoOperation.ffmpegOperation.type);
    q.push(videoOperation, function(err, results) {
      // return immediately if there is no cb function
      if (!cb) {
        return;
      }
      if (err) {
        console.log(err);
        return cb(err);
      }
      cb(null, results);
    });
  },
};


// create queue to be managed by this module 'performVideoOperation' function defined below
var q = async.queue(function(videoOperation, callback) {
  if (!videoOperation) {
    return callback('no operation obj provided');
  }
  if (!videoOperation.ffmpegOperation || !videoOperation.ffmpegOperation.type) {
    return callback('ffmpegOperation and ffmpegOperation.type must be set on videoOperation');
  }

  // choose operation task based on ffmpegOperation type
  if (videoOperation.ffmpegOperation.type === 'transcodeMP4') {  // trancodeMP4
    performTranscodeVideoOperation(videoOperation, callback);
  } else if (videoOperation.ffmpegOperation.type === 'stillShot') { //stillShot
    performStillshotVideoOperation(videoOperation, callback);
  } else {
    return callback(videoOperation.ffmpegOperation.type + ' type not yet supported');
  }
}, 1);

// q.drain = function() {
//   console.log('all items have been processed from the queue');
// };



/**
   * performTranscodeVideoOperation
   *
   * params:
   *  @videoOperation
   *    - sourcePath
   *    - ffmpegOperation
   *      > type ['transcodeMP4', 'stillShot']
   *    - s3Options
   *      > Bucket (e.g. 'bridge-video-staging')
   *      > Key (filename. e.g. '00003SprintCrossNodeFluent.mp4')
   *      > ACL (e.g. 'public-read')
   *      > ContentType (e.g. 'video/mp4')
   *  @cb
   *    - error
   *    - result
   */
function performTranscodeVideoOperation(videoOperation, queueCallback) {
  console.log('processing: ' + videoOperation.sourcePath);
  async.auto({

    transcodeVideo : function(cb) {

      var tmpFileName = generateUUID();
      var tmpFilePath = tmpDirectory + '/' + tmpFileName + '.mp4';

      var transcodeResult = {
        transcodedFilePath : tmpFilePath
      };

      // make sure you set the correct path to your video file
      var proc = ffmpeg(videoOperation.sourcePath)
        .withVideoCodec('libx264')
        .withAudioCodec('libfaac')
        
        // callback when ffmpeg job finished successfully
        .on('end', function() {
          console.log('file has been converted successfully');
          cb(null, transcodeResult);
        })
        .on('error', function(err) {
          console.log(err);
          cb(err);
        })
        .save(transcodeResult.transcodedFilePath);
    },

    uploadVideo : ['transcodeVideo', function(cb, results) {
      //console.log(results);

      fs.readFile(results.transcodeVideo.transcodedFilePath, function(err, data) {
        if (err) {
          console.log(err);
          cb(err);
        } else {          

          console.log('about to try s3 request');

          var req = s3.putObject({
            Bucket : videoOperation.s3Options.Bucket,
            Key : videoOperation.s3Options.Key,
            ACL : videoOperation.s3Options.ACL,
            ContentType: videoOperation.s3Options.ContentType,
            Body : data
          }).on('success', function(response) {
            cb(null, response);
          }).on('error', function(err) {
            console.log(err);
            cb(err);
          }).on('httpUploadProgress', function(progress) {

          });

          req.send();
        }
      });
    }],

  }, function(err, results) {

    // make sure we clean up files we created (even if S3 upload failed)
    if (results && results.transcodeVideo && results.transcodeVideo.transcodedFilePath) {
      console.log('cleanUpFiles');
      fs.unlink(results.transcodeVideo.transcodedFilePath, function (fileError) {
        if (fileError) {
          console.log(fileError);
        } else {
          console.log('successfully deleted file');
        }
      });      
    } 

    queueCallback(err, results);
  });
}


/**
   * performStillshotVideoOperation
   *
   * params:
   *  @videoOperation
   *    - sourcePath
   *    - time
   *    - ffmpegOperation
   *      > type ['transcodeMP4', 'stillShot']
   *    - s3Options
   *      > Bucket (e.g. 'bridge-video-staging')
   *      > Key (filename. e.g. '00003SprintCrossNodeFluent.mp4')
   *      > ACL (e.g. 'public-read')
   *      > ContentType (e.g. 'video/mp4')
   *  @cb
   *    - error
   *    - result
   */
function performStillshotVideoOperation(videoOperation, queueCallback) {

  if (!videoOperation.sourcePath || !videoOperation.time) {
    return queueCallback('sourcePath and time are required arguments on videoOperation');
  }

  async.auto({

    stillShot : function(cb) {

      var tmpFileName = generateUUID() + '.jpg';
      var tmpFilePath = tmpDirectory + tmpFileName;

      var stillShotResult = {
        stillShotFilePath : tmpFilePath
      };

      var proc = ffmpeg(videoOperation.sourcePath)
        // setup event handlers
        .on('end', function(files) {
          //console.log('screenshots were saved');
          console.log('file created at: ' + tmpFilePath);
          cb(null, {
            imageFileName : tmpFileName,
            imageFilePath : tmpFilePath
          });
        })
        .on('error', function(err, stdout, stderr) {
          console.log(" =====Stillshot op Failed======");
          console.log(err);
          console.log("stdout: " + stdout);
          console.log("stderr: " + stderr);
          cb(err);
        })
        // take 1 screenshots at predefined timemarks
        .takeScreenshots({ count: 1, timemarks: [ String(videoOperation.time) ], filename : tmpFileName}, tmpDirectory);
    },

  }, function(err, results) {
    queueCallback(err, results.stillShot);
  });
}

/**
 * generateUUID util
 */
function generateUUID(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
};