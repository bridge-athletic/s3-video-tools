
var AWS = require('aws-sdk');
var fs = require('fs');
var async = require('async');
var ffmpeg = require('fluent-ffmpeg');
var s3;

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
  } else {
    return callback(videoOperation.ffmpegOperation.type + ' type not yet supported');
  }
}, 1);

// q.drain = function() {
//   console.log('all items have been processed from the queue');
// };


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

    // initialize S3 with awsCredentials passed in
    AWS.config.update(options.awsCredentials);
    s3 = new AWS.S3();

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
    q.push(videoOperation, function(err) {
      // return immediately if there is no cb function
      if (!cb) {
        return;
      }
      if (err) {
        console.log(err);
        return cb(err);
      }
      cb(null);
    });
  },
};



/**
   * performVideoOperation
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

  var tmpFileName = generateUUID();

  async.auto({

    transcodeVideo : function(cb) {
      console.log('tmpFileName: ' + tmpFileName);
      return cb(null);

      var options = {};

      options.outputPath = '/Users/rockfakie/Downloads/00002SprintCrossNodeFluent.mp4';

      // make sure you set the correct path to your video file
      var proc = ffmpeg('/Users/rockfakie/Downloads/00000SprintCross.wmv')
        .withVideoCodec('libx264')
        .withAudioCodec('libfaac')
        
        // callback when ffmpeg job finished successfully
        .on('end', function() {
          console.log('file has been converted successfully');
          cb(null);
        })
        .on('error', function(err) {
          console.log(err);
          cb(err);
        })
        .save(options.outputPath);
    },

    uploadVideo : ['transcodeVideo', function(cb, results) {
      console.log('uploadVideo');
      cb(null);
    }],

    cleanUpFiles : ['transcodeVideo', 'uploadVideo', function(cb, results) {
      console.log('cleanUpFiles');
      cb(null);
    }]
  }, function(err, results) {
    console.log('err = ', err);
    console.log('results = ', results);
    queueCallback(err, results);
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