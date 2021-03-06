var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
var net = require('net');
var mongoose = require('mongoose');
var uuid = require('node-uuid');
var port = 8100;
var streamingIdx = 0;

mongoose.connect('mongodb://localhost:27017/slidare');

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
      iosocket.broadcast.emit(transfers[i].recipientId, transfers[i].fileName, ++port, transfers[i]._id, transfers[i].fileEncryptedName, transfers[i].originalFileName, transfers[i].filesha1, transfers[i].filesalt, transfers[i].fileiv, transfers[i].filekey, transfers[i].filesize, transfers[i].userId);
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
          // server.close(function () {
          //     console.log('server closed.');
          //     server.unref();
          // });
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

io.on('connection', function (iosocket, toto, titi, tata) {
  console.log("connection");
  iosocket.on('request file transfer', function(fileName, filePath, recipientIds, fileEncryptedName, fileName2, filesha1, filesalt, fileiv, filekey, filesize, fileSender) {
    console.log(filesize)
    var server = net.createServer(function(socket) {
      console.log("server created");
      var nbDataReceived = 0;
      var storedFileName = 'files/' + uuid.v4();
      for (var i=0; i < recipientIds.length; ++i) {
        var instance = new TransferModel();
        instance.userId = fileSender || "Unknown";
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
        nbDataReceived += data.length;
        console.log(nbDataReceived + " " + filesize);
        iosocket.emit("receiving data", "Percentace: " + parseInt(nbDataReceived / filesize * 100.0) + "%", false);
        // console.log("receiving data");
        // console.log(data.toString().length);
        stream.write(data);
      });
      socket.on('close', function(data) {
        iosocket.emit("receiving data", "Percentace: 100%", true);
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
    iosocket.emit("server ready", port, fileEncryptedName);
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
  iosocket.on("init streaming", function () {
    streamingIdx = (streamingIdx == 10 ? 0 : streamingIdx + 1);
    // console.log(username + "streaming");
    // iosocket.broadcast.emit(username + "streaming", "http://34.227.142.101:8080/streaming" + (streamingIdx == 0 ? "" : streamingIdx));
    iosocket.emit("start streaming", "rtmp://34.238.153.180:1935/myapp/test" + (streamingIdx == 0 ? "" : streamingIdx), "http://34.238.153.180:8080/streaming" + (streamingIdx == 0 ? "" : streamingIdx));
  });
  iosocket.on("send streaming", function (link, users) {
    console.log(users);
    for (var i = 0; i < users.length; i++) {
      console.log(users[i]);
      iosocket.broadcast.emit(users[i] + "streaming", link);
    }
  });
});

app.listen(8090);
