var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
var net = require('net');
var mongoose = require('mongoose');
var uuid = require('node-uuid');
var port = 8000;

mongoose.connect('mongodb://localhost:27018/slidare');

var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var TransferSchema = new Schema({
  userId: String,
  originalFileName: String,
  storedFileName: String,
  recipientId: String,
  status: String, //pending, failed, success
  date: { type: Date, default: Date.now },
});

var TransferModel = mongoose.model('TransferModel', TransferSchema);

function handler (req, res) {
}

function sendFileTransferRequests(iosocket) {
  TransferModel.find({status: 'pending'}, function (err, transfers) {
    for (var i=0; i< transfers.length; ++i) {
      console.log(transfers[i]);
      iosocket.emit(transfers[i].recipientId, transfers[i].originalFileName, ++port, transfers[i]._id);
      var server = net.createServer(function(socket) {
        console.log(this)
        var fileStream = fs.createReadStream('./' + this.transfer.storedFileName);
        fileStream.on('error', function(err){
            console.log(err);
        })

        fileStream.on('open',function() {
          console.log("sending file");
            fileStream.pipe(socket);
        });
        socket.on('close', function(data) {
          console.log('done');
          TransferModel.update({_id: this.transfer._id}, {status: 'failed'}, function (err) {
            if (!err) {
              console.log("updated successfully")
            } else {
              console.log("update failed");
            }
          });
          server.close(function () {
              console.log('server closed.');
              server.unref();
          });
        });
        socket.on('error', function (err) {
          console.log(err);
        });
      })
      server.transfer = transfers[i];
      server.listen(port);
    }
  });
}

io.on('connection', function (iosocket) {
  iosocket.on('request file transfer', function(fileName, recipientIds) {
    var server = net.createServer(function(socket) {
      console.log("server created");
      var storedFileName = uuid.v4();
      for (var i=0; i < recipientIds.length; ++i) {
        var instance = new TransferModel();
        instance.userId = 'julien@athomas.io';
        instance.originalFileName = fileName;
        instance.storedFileName = storedFileName;
        instance.recipientId = recipientIds[i];
        instance.status = "pending";
        instance.save(function (err) {
          console.log(err);
        });
      }
      var stream = fs.createWriteStream(storedFileName);
      stream.once('open', function(fd) {
      });
      socket.on('data', function (data) {
        console.log("receiving data");
        console.log(data.toString().length);
        stream.write(data);
      });
      socket.on('close', function(data) {
        console.log('done');
        sendFileTransferRequests(iosocket);
        server.close(function () {
            console.log('server closed.');
            server.unref();
        });
      });
      socket.on('error', function (err) {
        console.log(err);
      });
    });
    server.listen(++port);
    iosocket.emit("server ready", port);
  });
  iosocket.on("transfer finished", function (transferId) {
    TransferModel.update({_id: this.transfer._id}, {status: 'success'}, function (err) {
      if (!err) {
        console.log("updated successfully")
      } else {
        console.log("update failed");
      }
    });
  });
  // socket.emit('news', { hello: 'world' });
  // socket.on('file transfer', function (data) {
  //   socket.broadcast.emit('news', { hello: 'world' })
  //   console.log(data);
  // });
  //
  // socket.on('begin transfer', function (data) {
  //   socket.emit('create file', data)
  //   socket.broadcast.emit('create file', data)
  // });
  //
  // socket.on('processing transfer', function (val, size) {
  //   socket.emit('write file', val, size)
  //   socket.broadcast.emit('write file', val, size)
  // });
  //
  // socket.on('end transfer', function (data) {
  //   socket.emit('transfer finished', data)
  //   socket.broadcast.emit('transfer finished', data)
  // });
  //
  // socket.on('begin streaming', function (data) {
  //   socket.emit('start streaming', data)
  //   socket.broadcast.emit('start streaming', data)
  // });
  //
  // socket.on('processing streaming', function (idx, val) {
  //   console.log(val.length)
  //   socket.emit('display streaming', idx, val)
  //   socket.broadcast.emit('display streaming', idx, val)
  // });
  //
  // socket.on('end streaming', function (data) {
  //   socket.emit('stop streaming', data)
  //   socket.broadcast.emit('transfer streaming', data)
  // });

});

app.listen(8080);
