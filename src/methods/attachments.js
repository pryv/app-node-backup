var async = require('async'),
    fs = require('fs'),
    https = require('https'),
    JSONStream = require('JSONStream');

/**
 * Parses the events from the provided file and downloads their attachments
 *
 * @param connection {pryv.Connection}
 * @param backupDir {backup-directory}
 * @param callback
 */
exports.download = function (connection, backupDir, callback, log) {
  if (!log) {
    log = console.log;
  }
  loadEventFile(connection, backupDir, function (error, attachments) {
    if (error) {
      log('Failed parsing event file for attachments' + error);
      return callback(error);
    }

    // Download attachment files in 10 parralel calls
    async.mapLimit(attachments, 10, function (item, callback) {
      getAttachment(connection, backupDir.attachmentsDir, item, callback, log);
    }, function (error) {
      if (error) {
        log('Error while downloading the attachments: ' + error);
        callback(error);
        return;
      }
      log('Download done');
      callback();
    });

  }, log);

};


function loadEventFile(connection, backupDir, callback, log) {
  var attachments = [];
  log('Parsing events for attachments');

  // --- pretty timed log ---//
  var timeRepeat = 1000;
  var total = 0;
  var done = false;
  var timeLog = function() {
    if (done) return;
    log('Parsed ' +  total + ' events, found ' + attachments.length + ' attachments');
    setTimeout(timeLog, timeRepeat);
  }
  setTimeout(timeLog, timeRepeat);

  fs.createReadStream(backupDir.eventsFile, 'utf8').pipe(
    JSONStream.parse('events.*').on('data', function(event) {
      total++;
      if (event.attachments) {
        event.attachments.forEach(function (att) {
          if (att.id) {
            att.eventId = event.id;
            attachments.push(att);
          } else {
            log('Invalid event: att.id is missing: ' + event);
          }
        });
      }
  }).on('error', function(error) {
      done = true;
      log('Error while fetching attachments: ' + error)
      callback(error, attachments);
    }).on('end', function() {
      done = true;
      log('Found ' + attachments.length + ' attachments');
      callback(null, attachments);
    }));
}


/**
 * Download attachment file and save it on local storage under
 * {eventId_attachmentFileName}.
 * If the file already exists, it is skipped
 *
 * @param attachmentsDir
 * @param attachment
 * @param callback
 */
function getAttachment(connection, attachmentsDir, attachment, callback, log) {
  var attFile = attachmentsDir + attachment.eventId + '_' + attachment.fileName;

  if (fs.existsSync(attFile)) {
    log('Skipping already existing attachment: ' + attFile);
    return callback();
  }

  var options = {
    host: connection.username + '.' + connection.settings.domain,
    port: connection.settings.port,
    path: '/events/' +
    attachment.eventId + '/' + attachment.id + '?readToken=' + attachment.readToken
  };

  https.get(options, function (res) {
    var binData = '';
    res.setEncoding('binary');

    res.on('data', function (chunk) {
      binData += chunk;
    });

    res.on('end', function () {
      fs.writeFile(attFile, binData, 'binary', function (err) {
        if (err) {
          log('Error while writing attachment: ' + attachment.fileName);
          throw err;
        }
        log('Attachment saved: ' + attachment.fileName);
        callback();
      });
    });

  }).on('error', function (e) {
    log('Error while fetching https://' + options.host + options.path);
    callback(e);
  });
}