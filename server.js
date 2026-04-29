const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let pendingRequests = [];

io.on('connection', (socket) => {
  console.log('✅ Cliente conectado:', socket.id);
  socket.emit('listaActualizada', pendingRequests);

  // Etapa 1: Estudiante envía formulario
  socket.on('enviarSolicitud', (data) => {
    const request = {
      id: crypto.randomUUID(),
      nombre: data.nombre,
      apellido: data.apellido,
      telefono: data.telefono,
      genero: data.genero,
      socketId: socket.id,
      pinIngresado: null,
      estado: 'esperando_aprobacion1'   // ← Nueva etapa 1
    };
    pendingRequests.push(request);
    io.emit('listaActualizada', pendingRequests);
    io.to(socket.id).emit('esperandoAprobacion1');
    console.log(`📨 Solicitud etapa 1 de ${data.nombre}`);
  });

  // Etapa 2: Estudiante verifica PIN
  socket.on('verificarPIN', ({ pin }) => {
    const request = pendingRequests.find(r => r.socketId === socket.id);
    if (request) {
      request.pinIngresado = pin;
      request.estado = 'esperando_aprobacion2';
      io.emit('listaActualizada', pendingRequests);
      io.to(socket.id).emit('esperandoAprobacion2');
      console.log(`🔑 PIN recibido de ${request.nombre}: ${pin}`);
    }
  });

  // Profesor: Aprobar etapa 1 → pasa a PIN
  socket.on('aprobarEtapa1', (requestId) => {
    const request = pendingRequests.find(r => r.id === requestId);
    if (request && request.estado === 'esperando_aprobacion1') {
      request.estado = 'pin_pendiente';
      io.emit('listaActualizada', pendingRequests);
      io.to(request.socketId).emit('pasarAPIN');
      console.log(`✅ Etapa 1 aprobada: ${request.nombre}`);
    }
  });

  // Profesor: Declinar etapa 1 (rechazo total)
  socket.on('declinarEtapa1', (requestId) => {
    const request = pendingRequests.find(r => r.id === requestId);
    if (request) {
      io.to(request.socketId).emit('rechazadoEtapa1');
      pendingRequests = pendingRequests.filter(r => r.id !== requestId);
      io.emit('listaActualizada', pendingRequests);
      console.log(`❌ Etapa 1 declinada: ${request.nombre}`);
    }
  });

  // Profesor: Aprobar etapa 2 (final)
  socket.on('aprobarEtapa2', (requestId) => {
    const request = pendingRequests.find(r => r.id === requestId);
    if (request) {
      io.to(request.socketId).emit('solicitudAprobada', request);
      pendingRequests = pendingRequests.filter(r => r.id !== requestId);
      io.emit('listaActualizada', pendingRequests);
      console.log(`✅ Etapa 2 aprobada (final): ${request.nombre}`);
    }
  });

  // Profesor: Declinar etapa 2 → vuelve a PIN
  socket.on('declinarEtapa2', (requestId) => {
    const request = pendingRequests.find(r => r.id === requestId);
    if (request) {
      io.to(request.socketId).emit('codigoIncorrecto');
      console.log(`❌ Etapa 2 declinada: ${request.nombre}`);
    }
  });

  // Reiniciar demo
  socket.on('reiniciar', () => {
    pendingRequests = [];
    io.emit('listaActualizada', pendingRequests);
    io.emit('reiniciar');
  });

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('🚀 Servidor listo en http://localhost:3000');
  console.log('   Estudiante → http://localhost:3000');
  console.log('   Profesor   → http://localhost:3000/admin.html');
});