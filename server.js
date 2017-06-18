var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');

app.listen(8080);

function handler (req, res) {
}

io.on('connection', function (socket) {
  console.log("here");
  console.log(socket)
  socket.emit('news', { hello: 'world' });
  socket.on('file transfer', function (data) {
    socket.broadcast.emit('news', { hello: 'world' })
    console.log(data);
  });

  socket.on('begin transfer', function (data) {
    socket.emit('create file', data)
    socket.broadcast.emit('create file', data)
  });

  socket.on('processing transfer', function (val, size) {
    socket.emit('write file', val, size)
    socket.broadcast.emit('write file', val, size)
  });

  socket.on('end transfer', function (data) {
    socket.emit('transfer finished', data)
    socket.broadcast.emit('transfer finished', data)
  });

  socket.on('begin streaming', function (data) {
    socket.emit('start streaming', data)
    socket.broadcast.emit('start streaming', data)
  });

  socket.on('processing streaming', function (val) {
    console.log(val.length)
    socket.emit('display streaming', val)
    socket.broadcast.emit('display streaming', val)
  });

  socket.on('end streaming', function (data) {
    socket.emit('stop streaming', data)
    socket.broadcast.emit('transfer streaming', data)
  });

});
