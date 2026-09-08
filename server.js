const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DB_FILE = path.join(__dirname, 'db.json');

// Carrega pedidos do arquivo local para garantir persistência total
let pedidos = [];
if (fs.existsSync(DB_FILE)) {
  try {
    pedidos = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    pedidos = [];
  }
}

function salvarBD() {
  fs.writeFileSync(DB_FILE, JSON.stringify(pedidos, null, 2));
}

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect('/garcom.html');
});

io.on('connection', (socket) => {
  socket.emit('pedidos_atualizados', pedidos);

  // 1. Criar novo pedido
  socket.on('novo_pedido', (dadosPedido) => {
    dadosPedido.status = 'aberto'; // 'aberto', 'preparo', 'concluido', 'cancelado'
    dadosPedido.timestamp = Date.now();
    pedidos.push(dadosPedido);
    salvarBD();
    
    io.emit('pedidos_atualizados', pedidos);
    io.emit('novo_pedido_cozinha', dadosPedido);
  });

  // 2. Mudar status para 'Em Preparo'
  socket.on('iniciar_preparo', (idPedido) => {
    const pedido = pedidos.find(p => p.id === idPedido);
    if (pedido) {
      pedido.status = 'preparo';
      salvarBD();
      io.emit('pedidos_atualizados', pedidos);
    }
  });

  // 3. Concluir Pedido
  socket.on('concluir_pedido', (idPedido) => {
    const pedido = pedidos.find(p => p.id === idPedido);
    if (pedido) {
      pedido.status = 'concluido';
      pedido.horarioConclusao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      salvarBD();
      
      io.emit('pedidos_atualizados', pedidos);
      io.emit('notificacao_garcom', pedido);
    }
  });

  // 4. Cancelar Pedido (pelo Garçom)
  socket.on('cancelar_pedido', (idPedido) => {
    const pedido = pedidos.find(p => p.id === idPedido);
    // Só cancela se ainda não estiver em preparo ou concluído
    if (pedido && pedido.status === 'aberto') {
      pedido.status = 'cancelado';
      salvarBD();
      io.emit('pedidos_atualizados', pedidos);
    }
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Servidor rodando com Banco de Dados em http://localhost:3000');
});