
var AWS = require('aws-sdk');
var fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');
var s3;

console.log('s3-video-tools');

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
   */
  addVideoOperation : function(videoOperation) {
    console.log('videoOperation: ' + ffmpegOperation.type);
  },
};