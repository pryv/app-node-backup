var mkdirp = require('mkdirp'),
    fs = require('fs'),
    rmdir = require('rmdir'),
    async = require('async');

/**
 * Object containing backup directories and files object as well as the function to generate them
 *
 * @param username
 * @param domain
 */
var BackupDirectory = module.exports = function (username, domain) {
  this.baseDir = './backup/' + username + '.' + domain + '/';
  this.attachmentsDir = this.baseDir + 'attachments/';
  this.eventsFile = this.baseDir + 'events.json';
};

/**
 * Creates the directories where the backup files will be stored:
 *
 * out/
 *  username.domain/
 *    attachments/
 *    events.json
 *    *.json
 *
 * @param callback
 */
BackupDirectory.prototype.createDirs = function (callback) {
  async.series([
    function createBaseDir(stepDone) {
      mkdirp(this.baseDir, function (err) {
        if (err) {
          console.error('Error while creating base dir: ' + this.baseDir, err);
          stepDone(err);
        }
        stepDone();
      });
    }.bind(this),
    function createAttachmentsDir(stepDone) {
      mkdirp(this.attachmentsDir, function (err) {
        if (err) {
          console.error('Error while creating attachments dir: ' + this.attachmentsDir, err);
          stepDone(err);
        }
        stepDone();
      }.bind(this));
    }.bind(this)
  ], callback);
};

/**
 * Delete backup directories
 * @param callback
 */
BackupDirectory.prototype.deleteDirs = function (callback) {
  if(fs.existsSync(this.baseDir)) {
    rmdir(this.baseDir, callback);
  } else {
    callback();
  }
};