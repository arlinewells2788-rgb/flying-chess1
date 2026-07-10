const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 托管静态文件
app.use(express.static(__dirname));

// ===== 房间系统 =====
const rooms = {}; // { roomId: { players: [{id, name, color}], gameState, hostId } }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const PLAYER_COLORS = ['🔴','🔵','🟢','🟡'];
const PLAYER_NAMES = ['红方','蓝方','绿方','黄方'];

// ===== WebSocket =====
io.on('connection', (socket) => {
  console.log(`玩家连接: ${socket.id}`);

  // --- 创建房间 ---
  socket.on('createRoom', (playerName, callback) => {
    let roomId;
    do { roomId = generateRoomCode(); } while (rooms[roomId]);

    rooms[roomId] = {
      id: roomId,
      hostId: socket.id,
      players: [{
        id: socket.id,
        name: playerName || '玩家1',
        color: PLAYER_COLORS[0],
        index: 0,
        ready: false
      }],
      gameStarted: false,
      gameState: null
    };

    socket.join(roomId);
    console.log(`房间 ${roomId} 创建成功，房主: ${socket.id}`);

    callback({ success: true, roomId, players: rooms[roomId].players });
    socket.emit('roomUpdate', rooms[roomId].players);
  });

  // --- 加入房间 ---
  socket.on('joinRoom', ({ roomId, playerName }, callback) => {
    const room = rooms[roomId];
    if (!room) {
      return callback({ success: false, error: '房间不存在' });
    }
    if (room.gameStarted) {
      return callback({ success: false, error: '游戏已开始' });
    }
    if (room.players.length >= 4) {
      return callback({ success: false, error: '房间已满' });
    }

    const idx = room.players.length;
    room.players.push({
      id: socket.id,
      name: playerName || `玩家${idx+1}`,
      color: PLAYER_COLORS[idx],
      index: idx,
      ready: false
    });

    socket.join(roomId);
    console.log(`${playerName} 加入房间 ${roomId}`);

    callback({ success: true, roomId, players: room.players });
    io.to(roomId).emit('roomUpdate', room.players);
  });

  // --- 开始游戏 ---
  socket.on('startGame', (callback) => {
    const room = findRoom(socket.id);
    if (!room) return callback?.({ success: false, error: '不在房间中' });
    if (room.hostId !== socket.id) return callback?.({ success: false, error: '只有房主能开始' });
    if (room.players.length < 2) return callback?.({ success: false, error: '至少需要2个玩家' });

    room.gameStarted = true;
    room.gameState = {
      currentPlayer: 0, // 索引
      players: room.players.map((p, i) => ({
        index: i,
        pos: 0,
        skipTurn: false,
      })),
      diceValue: 0,
      isRolling: false,
      gameOver: false,
      winner: null
    };

    io.to(room.id).emit('gameStart', {
      players: room.players,
      gameState: room.gameState
    });
    callback?.({ success: true });
  });

  // --- 掷骰子 ---
  socket.on('rollDice', (callback) => {
    const room = findRoom(socket.id);
    if (!room || !room.gameState) return;

    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    const gs = room.gameState;

    if (gs.gameOver) return;
    if (gs.currentPlayer !== playerIdx) return;
    if (gs.isRolling) return;

    gs.isRolling = true;
    const diceValue = Math.floor(Math.random() * 6) + 1;
    gs.diceValue = diceValue;

    // 通知所有玩家掷骰结果（前端处理动画和移动）
    io.to(room.id).emit('diceRolled', {
      player: playerIdx,
      value: diceValue,
      gameState: gs
    });

    callback?.({ value: diceValue });
  });

  // --- 移动完成（客户端通知服务器） ---
  socket.on('moveDone', ({ player, newPos, gameOver, winner }) => {
    const room = findRoom(socket.id);
    if (!room || !room.gameState) return;

    const gs = room.gameState;
    gs.players[player].pos = newPos;
    gs.isRolling = false;

    if (gameOver) {
      gs.gameOver = true;
      gs.winner = winner;
      io.to(room.id).emit('gameOver', { winner, playerName: room.players[winner]?.name });
      return;
    }

    // 切换到下一个玩家
    let next = (gs.currentPlayer + 1) % room.players.length;
    gs.currentPlayer = next;

    io.to(room.id).emit('turnChange', {
      currentPlayer: next,
      gameState: gs
    });
  });

  // --- 断开连接 ---
  socket.on('disconnect', () => {
    console.log(`玩家断开: ${socket.id}`);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        if (room.gameStarted) {
          io.to(roomId).emit('playerLeft', { index: idx });
        }
        room.players.splice(idx, 1);
        io.to(roomId).emit('roomUpdate', room.players);
        if (room.players.length === 0) {
          delete rooms[roomId];
        } else if (room.hostId === socket.id) {
          room.hostId = room.players[0].id;
        }
        break;
      }
    }
  });
});

function findRoom(socketId) {
  for (const id in rooms) {
    if (rooms[id].players.some(p => p.id === socketId)) return rooms[id];
  }
  return null;
}

// ===== 启动服务器 =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎲 飞行棋在线服务器启动！`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   局域网其他设备: http://你的IP:${PORT}`);
});
