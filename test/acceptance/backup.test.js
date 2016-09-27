/*global describe, it, before, after */

var backup = require('../../src/main'),
    credentials = require('../helpers/testuser').credentials,
    async = require('async'),
    fs = require('fs'),
    should = require('should'),
    pryv = require('pryv');

describe('backup', function () {

  var settings = null,
      resources = null,
      connection = null;

  before(function (done) {
    settings = {
      username: credentials.username,
      domain: credentials.domain,
      password: credentials.password,
      includeTrashed: true,
      includeAttachments: true
    };

    settings.backupDirectory = new backup.Directory(settings.username, settings.domain);
    var eventsRequest = 'events?fromTime=-2350373077&toTime=' + new Date() / 1000 + '&state=all';
    var streamsRequest = 'streams?state=all';
    resources = ['account', streamsRequest, 'accesses', 'followed-slices', 'profile/public', eventsRequest];

    connection = new pryv.Connection(credentials);

    done();
  });

  after(function (done) {
    settings.backupDirectory.deleteDirs(done);
  });

  it('should backup the correct folders and files', function (done) {
    async.series([
        function startBackup(stepDone) {
          backup.start(settings, stepDone);
        },
        function checkFiles(stepDone) {
          resources.forEach(function(resource){
            var outputFilename = resource.replace('/', '_').split('?')[0] + '.json';
            fs.existsSync(settings.backupDirectory.baseDir + outputFilename).should.equal(true);
          });
          stepDone();
        },
        function checkAttachments(stepDone) {
          var events = JSON.parse(fs.readFileSync(settings.backupDirectory.eventsFile, 'utf8'));
          events.events.forEach(function (event) {
            if (event.attachments) {
              event.attachments.forEach(function (att) {
                var attFile = settings.backupDirectory.attachmentsDir + event.id + '_' + att.fileName;
                fs.existsSync(attFile).should.equal(true);
              });
            }
          });
          stepDone();
        },
        function checkContent(stepDone) {
          async.each(resources,
              function (resource, callback) {
                connection.request({
                  method: 'GET',
                  path: '/' + resource,
                  callback: function (error, result) {
                    if(error) {
                      return callback(error);
                    }
                    var outputFilename = resource.replace('/', '_').split('?')[0];
                    result.should.equal(require(settings.backupDirectory.baseDir + outputFilename));
                    callback();
                  }
                });
              }, stepDone);
        }
    ], function(err) {
      should.not.exist(err);
      done(err);
    });
  });
});