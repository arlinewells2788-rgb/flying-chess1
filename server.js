const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(__dirname));

// ===== 房间系统 =====
const rooms = {};
const COLORS = ['🔴','🔵','🟢','🟡'];
const COLOR_HEX = ['#ff4444','#4488ff','#44bb44','#ffaa00'];
const BORDERS = ['#cc0000','#0055cc','#008800','#cc8800'];

// 路径数据（同game5的卐字型）
function generatePaths() {
  const A=8, W=3, CELL=40, STEP=52;
  const segs = [
    {sx:A, sy:-W, ex:A, ey:W}, {sx:A, sy:W, ex:0, ey:W}, {sx:0, sy:W, ex:0, ey:0},
    {sx:W, sy:A, ex:-W, ey:A}, {sx:-W, sy:A, ex:-W, ey:0}, {sx:-W, sy:0, ex:0, ey:0},
    {sx:-A, sy:W, ex:-A, ey:-W}, {sx:-A, sy:-W, ex:0, ey:-W}, {sx:0, sy:-W, ex:0, ey:0},
    {sx:-W, sy:-A, ex:W, ey:-A}, {sx:W, sy:-A, ex:W, ey:0}, {sx:W, sy:0, ex:0, ey:0}
  ];
  const paths = {};
  for(let p=1;p<=4;p++){
    const path=[]; const start=(p-1)*3;
    for(let s=start;s<start+3;s++){
      const {sx,sy,ex,ey}=segs[s];
      if(sx===ex){const step=sy<ey?1:-1;for(let y=sy;y!==ey+step;y+=step)path.push([sx,y]);}
      else{const step=sx<ex?1:-1;for(let x=sx;x!==ex+step;x+=step)path.push([x,ey]);}
    }
    const u=[path[0]];for(let i=1;i<path.length;i++)if(path[i][0]!==path[i-1][0]||path[i][1]!==path[i-1][1])u.push(path[i]);
    paths[p]=u;
  }
  // 居中
  let all=[];for(let p=1;p<=4;p++)all=all.concat(paths[p]);
  let mnX=Infinity,mxX=-Infinity,mnY=Infinity,mxY=-Infinity;
  all.forEach(([gx,gy])=>{mnX=Math.min(mnX,gx*STEP);mxX=Math.max(mxX,gx*STEP);mnY=Math.min(mnY,gy*STEP);mxY=Math.max(mxY,gy*STEP);});
  const ox=(1040-(mxX-mnX+CELL))/2-mnX, oy=(1040-(mxY-mnY+CELL))/2-mnY;
  for(let p=1;p<=4;p++){paths[p]=paths[p].map(([gx,gy])=>({x:Math.round(gx*STEP+ox),y:Math.round(gy*STEP+oy)}));}
  return {paths, pathLen: paths[1].length};
}

const pathData = generatePaths();
const TOTAL_STEPS = pathData.pathLen - 1; // 走到最后一格就赢

function genCode(){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let r='';for(let i=0;i<4;i++)r+=c[Math.floor(Math.random()*c.length)];return r;
}

io.on('connection', (socket) => {
  console.log(`玩家连接: ${socket.id}`);

  socket.on('createRoom', (name, cb) => {
    let id; do { id = genCode(); } while(rooms[id]);
    rooms[id] = {
      id, players: [{id:socket.id, name:name||'玩家1', idx:0, color:COLORS[0], hex:COLOR_HEX[0]}],
      started: false, game: null, hostId: socket.id
    };
    socket.join(id);
    cb?.({ok:true, id, players:rooms[id].players});
    io.to(id).emit('roomUpdate', rooms[id].players);
  });

  socket.on('joinRoom', ({id, name}, cb) => {
    const r = rooms[id];
    if(!r) return cb?.({ok:false, err:'房间不存在'});
    if(r.started) return cb?.({ok:false, err:'游戏已开始'});
    if(r.players.length>=4) return cb?.({ok:false, err:'房间已满'});
    const idx = r.players.length;
    r.players.push({id:socket.id, name:name||'玩家'+(idx+1), idx, color:COLORS[idx], hex:COLOR_HEX[idx]});
    socket.join(id);
    cb?.({ok:true, id, players:r.players});
    io.to(id).emit('roomUpdate', r.players);
  });

  socket.on('startGame', (cb) => {
    const r = findRoom(socket.id);
    if(!r) return cb?.({ok:false, err:'不在房间'});
    if(r.hostId!==socket.id) return cb?.({ok:false, err:'只有房主能开始'});
    if(r.players.length<2) return cb?.({ok:false, err:'至少2人'});
    r.started = true;
    r.game = {
      cur: 0, players: r.players.map((p,i)=>({idx:i, pos:0})),
      dice: 0, rolling: false, over: false, winner: null
    };
    io.to(r.id).emit('gameStart', {players:r.players, game:r.game, paths:pathData.paths});
    cb?.({ok:true});
  });

  socket.on('rollDice', () => {
    const r = findRoom(socket.id);
    if(!r||!r.game||r.game.over) return;
    const p = r.players.findIndex(p=>p.id===socket.id);
    if(p!==r.game.cur) return;
    if(r.game.rolling) return;

    r.game.rolling = true;
    const val = Math.floor(Math.random()*6)+1;
    r.game.dice = val;
    io.to(r.id).emit('diceRolled', {player:p, value:val, game:r.game});
  });

  socket.on('moveDone', ({player, targetPos}) => {
    const r = findRoom(socket.id);
    if(!r||!r.game) return;
    const g = r.game;
    // 更新位置
    g.players[player].pos = targetPos;

    // 碰撞检测：检查其他玩家是否在同一格
    for(let i=0;i<g.players.length;i++){
      if(i===player) continue;
      if(g.players[i].pos===targetPos && targetPos>0 && targetPos<TOTAL_STEPS){
        g.players[i].pos = 0; // 撞回起点
        io.to(r.id).emit('playerCrash', {crashed:i, by:player});
      }
    }

    // 检查是否到达终点
    if(targetPos >= TOTAL_STEPS){
      g.over = true;
      g.winner = player;
      io.to(r.id).emit('gameOver', {winner:player, name:r.players[player].name});
      return;
    }

    // 切换回合
    g.rolling = false;
    g.cur = (g.cur + 1) % r.players.length;
    io.to(r.id).emit('turnChange', {cur:g.cur, game:g});
  });

  socket.on('disconnect', () => {
    for(const id in rooms){
      const r = rooms[id];
      const idx = r.players.findIndex(p=>p.id===socket.id);
      if(idx!==-1){
        r.players.splice(idx,1);
        io.to(id).emit('playerLeft', {idx});
        io.to(id).emit('roomUpdate', r.players);
        if(r.players.length===0) delete rooms[id];
        else if(r.hostId===socket.id) r.hostId=r.players[0].id;
        break;
      }
    }
  });
});

function findRoom(sid){for(const id in rooms){if(rooms[id].players.some(p=>p.id===sid))return rooms[id];}return null;}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎲 飞行棋服务器启动: http://localhost:${PORT}`));
