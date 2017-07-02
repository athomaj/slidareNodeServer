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
  fileEncryptedName: String,
  filesha1: String,
  filesalt: String,
  fileiv: String,
  filekey: String,
  filesize: Number
});
var TransferModel = mongoose.model('TransferModel', TransferSchema);

function handler (req, res) {
}

function sendFileTransferRequests(iosocket, storedFileName) {
  TransferModel.find({storedFileName: storedFileName}, function (err, transfers) {
    for (var i=0; i< transfers.length; ++i) {
      console.log(transfers[i]);
      iosocket.broadcast.emit(transfers[i].recipientId, transfers[i].fileName, ++port, transfers[i]._id, transfers[i].fileEncryptedName, transfers[i].originalFileName, transfers[i].filesha1, transfers[i].filesalt, transfers[i].fileiv, transfers[i].filekey, transfers[i].filesize);
//      iosocket.emit(transfers[i].recipientId, transfers[i].originalFileName, ++port, transfers[i]._id);
//      iosocket.emit(transfers[i].recipientId, transfers[i].originalFileName, ++port, transfers[i]._id);
      var server = net.createServer(function(socket) {
        console.log(this)
        const transfer = this.transfer;
        var fileStream = fs.createReadStream('./' + transfer.storedFileName);
        fileStream.on('error', function(err){
            console.log(err);
        })

        fileStream.on('open',function() {
          console.log("sending file");
            fileStream.pipe(socket);
        });
        socket.on('close', function(data) {
          console.log('done');
          // TransferModel.update({_id: transfer._id}, {status: 'failed'}, function (err) {
          //   if (!err) {
          //     console.log("updated successfully")
          //   } else {
          //     console.log("update failed");
          //   }
          // });
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
  console.log("connection");
  iosocket.on('request file transfer', function(fileName, filePath, recipientIds, fileEncryptedName, fileName2, filesha1, filesalt, fileiv, filekey, filesize) {
    console.log(filesize)
    var server = net.createServer(function(socket) {
      console.log("server created");
      var nbDataReceived = 0;
      var storedFileName = uuid.v4();
      for (var i=0; i < recipientIds.length; ++i) {
        var instance = new TransferModel();
        instance.userId = 'julien@athomas.io';
        instance.originalFileName = fileName;
        instance.storedFileName = storedFileName;
        instance.recipientId = recipientIds[i];
        instance.fileEncryptedName = fileEncryptedName;
        instance.filesha1 = filesha1;
        instance.filesalt = filesalt;
        instance.fileiv = fileiv;
        instance.filekey = filekey;
        instance.filesize = filesize;
        instance.status = "pending";
        instance.save(function (err) {
          console.log(err);
        });
      }
      var stream = fs.createWriteStream(storedFileName);
      stream.once('open', function(fd) {
      });
      socket.on('data', function (data) {
        nbDataReceived += data.toString().length;

        iosocket.emit("receiving data", "Percentace: " + (nbDataReceived / filesize * 100.0) + "%", nbDataReceived == filesize);
        // console.log("receiving data");
        // console.log(data.toString().length);
        stream.write(data);
      });
      socket.on('close', function(data) {
        console.log('done');
        sendFileTransferRequests(iosocket, storedFileName);
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
    iosocket.emit("server ready", port, './encrypted');
  });
  iosocket.on("transfer finished", function (transferId) {
    TransferModel.update({_id: transferId}, {status: 'success'}, function (err) {
      if (!err) {
        console.log("updated successfully")
      } else {
        console.log("update failed");
      }
    });
  });
//  sendFileTransferRequests(iosocket);

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
