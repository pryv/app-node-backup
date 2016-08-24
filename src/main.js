var pryv = require('Pryv'),
  fs = require('fs'),
  https = require('https'),
  async = require('async'),
  mkdirp = require('mkdirp'),
  read = require('read');




var outDir, attDir, eventsFile;
function createDirs() {
  // humm.. could be better
  outDir = './out/' + settings.username + '.' + settings.domain + '/';
  attDir = outDir + 'attachments/';
  eventsFile = outDir + 'events.json';

  mkdirp(outDir, function (/*err*/) {
    mkdirp(attDir, function (/*err*/) {

      // path was created unless there was error

    });
    // path was created unless there was error

  });
}







// -- go
var  settings = {
    appId: 'pryv-backup',
    username: null,
    auth: null,
    port: 443,
    ssl: true,
    domain: false
  },
  connection = null;


async.series([
  function (done) {
    read({ prompt: 'Domain (default: pryv.me): ', silent: false }, function (er, domain) {
      settings.domain = domain || 'pryv.me';
      settings.origin = 'https://sw.' + settings.domain;
      done(er);
    });
  },
  function (done) {
    read({ prompt: 'Username : ', silent: false }, function (er, username) {
      settings.username = username;
      done(er);
    });
  },
  function (done) {
    read({ prompt: 'Password : ', silent: true }, function (er, password) {
      settings.password = password;
      done(er);
    });
  },
  function (done) {
    console.log('Connecting to ' + settings.username + '.' + settings.domain);

    createDirs();

    pryv.Connection.login(settings, function (err, conn) {
      if (err) {
        console.log('Connection failed with Error:', err);
        return done(err);
      }
      connection = conn;
      done();
    });
  },
  function (done) {
    if (fs.existsSync(eventsFile)) {
      read({ prompt: eventsFile + ' exists, restart attachments sync only? Y/N\n'
        + 'N will delete current events.json file and backup everything',
        silent: false }, function (er, resetQ) {
        if (resetQ === 'N') {
          console.log('TODO here we should delete events');
        }
        done(er);
      });
    }  else {
      done();
    }
  },
  function (done) {
    console.log('Starting Backup');

    done();
  },
  function (done) {
    if (fs.existsSync(eventsFile)) { // skip
      return done();
    }
    async.map(['streams', 'accesses', 'followed-slices', 'profile/public',
    'events?limit=2'],
      apiToJSONFile, function (err) { 
      done(err);
    });
  },
  parseEvents
], function (err) {
  if (err) {
    console.log('Failed in process with error', err);
  }
});

//  '/events?fromTime=0&toTime=2350373077.359'


function saveToFile(key, myData, done) {
  var outputFilename = key.replace('/', '_').split('?')[0] + '.json';
  fs.writeFile(outDir + outputFilename, JSON.stringify(myData, null, 4), function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log('JSON saved to ' + outDir + outputFilename);
    }
    done(err);
  });
}



function getAttachment(att, done) {
  var attFile = attDir + att.eventId + '_' + att.fileName;

  if (fs.existsSync(attFile)) {
    console.log('Skipping: ' + attFile);
    return done();
  }

  var options = {
    host: connection.username + '.' + connection.settings.domain,
    port: settings.port,
    path: '/events/' +
      att.eventId + '/' + att.id + '?readToken=' + att.readToken
  };

  console.log(attFile, options.path);

  https.get(options, function (res) {
    var binData = '';
    res.setEncoding('binary');

    res.on('data', function (chunk) {
      binData += chunk;
    });

    res.on('end', function () {
      fs.writeFile(attFile, binData, 'binary', function (err) {
        if (err) { throw err; }
        console.log('File saved.' + attFile);
        done();
      });
    });
  });


}


function parseEvents(done) {
  console.log(eventsFile);
  var events = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
  var attachments = [];

  events.events.forEach(function (event) {
    if (event.attachments) {
      event.attachments.forEach(function (att) {
        if (att.id) {
          att.eventId = event.id;
          attachments.push(att);
        } else {
          console.log('att.id missing', event);
        }
      });
    }
  });

  async.mapLimit(attachments, 10, getAttachment, function (error, res) {
    if (error) {
      console.log('################### ERROR', error, '#############');
      return;
    }

    console.log('done');
  }, function (err) {
    done(err);
  });
}


function apiToJSONFile (call, done) {
  console.log('Fetching: ' + call)
  connection.request({
    method: 'GET',
    path: '/' + call,
    callback: function (error, result) {
      if (error) {
        return done(error);
      }
      saveToFile(call,  result, done);
    },
    progressCallback: function ()  {
      console.log('.');
    }
  });
}
