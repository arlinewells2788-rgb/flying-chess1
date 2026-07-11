const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(__dirname));

const rooms = {};
const COLORS = ['🔴','🔵','🟢','🟡'];
const COLOR_HEX = ['#ff4444','#4488ff','#44bb44','#ffaa00'];
const BORDERS = ['#cc0000','#0055cc','#008800','#cc8800'];

// ===== 所有模式的路径生成 =====
const PATH_GENERATORS = {
  // 双人回字（game2）
  double: () => {
    const CELL=84, STEP=96, HSTEP=78, CX=520, CY=520;
    const path=[]; let x=CX-380, y=CY-380, step=8, dir=0, remain=1, turn=0;
    const dx=[STEP,0,-STEP,0], dy=[0,HSTEP,0,-HSTEP];
    for(let i=0;i<8;i++){path.push([Math.round(x),Math.round(y)]);x+=dx[0];}
    x-=dx[0]; dir=1; step=7; remain=step;
    while(path.length<60){
      x+=dx[dir];y+=dy[dir];path.push([Math.round(x),Math.round(y)]);remain--;
      if(remain<=0){dir=(dir+1)%4;turn++;if(turn%2===0)step--;if(step<1)step=1;remain=step;}
    }
    return {paths:{1:path,2:path}, numPlayers:2, starts:{1:0,2:30}, totalSteps:59, cellSize:40};
  },

  // 双人十字（game3风格）
  cross: () => {
    const A=7,W=2,s=50,CELL=84,cx=520,cy=520;
    const g=[];const segs=[
      [-2,-7],[2,-7],[-7,-2],[-2,-2],[3,7],[7,-2],[-1,2],[7,2],[6,3],[3,3],[3,6],[3,6],[2,-2],[2,-2],[6,3],[3,3],[-3,-6],[-3,6],[1,-1],[-7,-1],[-6,-3],[-3,-3],[-3,-6],[-3,-6]
    ];
    // 直接用game3的计算方式，简化版
    const pts=[];
    for(let x=-W;x<=W;x++)pts.push([x,-A]);
    for(let y=-A+1;y<=-W;y++)pts.push([W,y]);
    for(let x=W+1;x<=A;x++)pts.push([x,-W]);
    for(let y=-W+1;y<=W;y++)pts.push([A,y]);
    for(let x=A-1;x>=W+1;x--)pts.push([x,W]);
    for(let y=W+1;y<=A-1;y++)pts.push([W,y]);
    for(let x=W;x>=-W;x--)pts.push([x,A]);
    for(let y=A-1;y>=W+1;y--)pts.push([-W,y]);
    for(let x=-W-1;x>=-A+1;x--)pts.push([x,W]);
    for(let y=W-1;y>=-W+1;y--)pts.push([-A,y]);
    for(let x=-A+1;x<=-W-1;x++)pts.push([x,-W]);
    for(let y=-W-1;y>=-A+1;y--)pts.push([-W,y]);
    let mn=Infinity,mx=-Infinity,mny=Infinity,mxy=-Infinity;
    pts.forEach(([gx,gy])=>{mn=Math.min(mn,gx*s);mx=Math.max(mx,gx*s);mny=Math.min(mny,gy*s);mxy=Math.max(mxy,gy*s);});
    const ox=(1040-(mx-mn+CELL))/2-mn, oy=(1040-(mxy-mny+CELL))/2-mny;
    const path=pts.map(([gx,gy])=>[Math.round(gx*s+ox),Math.round(gy*s+oy)]);
    return {paths:{1:path,2:path}, numPlayers:2, starts:{1:0,2:Math.floor(path.length/2)}, totalSteps:path.length-1, cellSize:84};
  },

  // 四人回字（game4）
  four: () => {
    const CELL=84, STEP=96, HSTEP=78, CX=520, CY=520;
    const path=[]; let x=CX-380, y=CY-380, step=8, dir=0, remain=1, turn=0;
    const dx=[STEP,0,-STEP,0], dy=[0,HSTEP,0,-HSTEP];
    for(let i=0;i<8;i++){path.push([Math.round(x),Math.round(y)]);x+=dx[0];}
    x-=dx[0]; dir=1; step=7; remain=step;
    while(path.length<60){
      x+=dx[dir];y+=dy[dir];path.push([Math.round(x),Math.round(y)]);remain--;
      if(remain<=0){dir=(dir+1)%4;turn++;if(turn%2===0)step--;if(step<1)step=1;remain=step;}
    }
    const seg=Math.floor(path.length/4);
    return {paths:{1:path,2:path,3:path,4:path}, numPlayers:4, starts:{1:0,2:seg,3:seg*2,4:seg*3}, totalSteps:path.length-1, cellSize:84};
  },

  // 卐字螺旋（game5）
  swastika: () => {
    const CELL=40,STEP=52,A=8,W=3;
    const segs=[
      {sx:A,sy:-W,ex:A,ey:W},{sx:A,sy:W,ex:0,ey:W},{sx:0,sy:W,ex:0,ey:0},
      {sx:W,sy:A,ex:-W,ey:A},{sx:-W,sy:A,ex:-W,ey:0},{sx:-W,sy:0,ex:0,ey:0},
      {sx:-A,sy:W,ex:-A,ey:-W},{sx:-A,sy:-W,ex:0,ey:-W},{sx:0,sy:-W,ex:0,ey:0},
      {sx:-W,sy:-A,ex:W,ey:-A},{sx:W,sy:-A,ex:W,ey:0},{sx:W,sy:0,ex:0,ey:0}
    ];
    const paths={};
    for(let p=1;p<=4;p++){
      const pts=[];const start=(p-1)*3;
      for(let s=start;s<start+3;s++){
        const {sx,sy,ex,ey}=segs[s];
        if(sx===ex){const st=sy<ey?1:-1;for(let y=sy;y!==ey+st;y+=st)pts.push([sx,y]);}
        else{const st=sx<ex?1:-1;for(let x=sx;x!==ex+st;x+=st)pts.push([x,ey]);}
      }
      const u=[pts[0]];for(let i=1;i<pts.length;i++)if(pts[i][0]!==pts[i-1][0]||pts[i][1]!==pts[i-1][1])u.push(pts[i]);
      paths[p]=u;
    }
    let all=[];for(let p=1;p<=4;p++)all=all.concat(paths[p]);
    let mn=Infinity,mx=-Infinity,mny=Infinity,mxy=-Infinity;
    all.forEach(([gx,gy])=>{mn=Math.min(mn,gx*STEP);mx=Math.max(mx,gx*STEP);mny=Math.min(mny,gy*STEP);mxy=Math.max(mxy,gy*STEP);});
    const ox=(1040-(mx-mn+CELL))/2-mn, oy=(1040-(mxy-mny+CELL))/2-mny;
    for(let p=1;p<=4;p++){paths[p]=paths[p].map(([gx,gy])=>[Math.round(gx*STEP+ox),Math.round(gy*STEP+oy)]);}
    const seg=Math.floor(Object.values(paths)[0].length/4);
    return {paths, numPlayers:4, starts:{1:0,2:seg,3:seg*2,4:seg*3}, totalSteps:Object.values(paths)[0].length-1, cellSize:40};
  }
};

function genCode(){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let r='';for(let i=0;i<4;i++)r+=c[Math.floor(Math.random()*c.length)];return r;
}

io.on('connection', (socket) => {
  console.log(`玩家连接: ${socket.id}`);

  socket.on('createRoom', ({name, mode}, cb) => {
    let id; do { id = genCode(); } while(rooms[id]);
    const gen = PATH_GENERATORS[mode] || PATH_GENERATORS.swastika;
    const data = gen();
    rooms[id] = {
      id, mode,
      players: [{id:socket.id, name:name||'玩家1', idx:0, color:COLORS[0], hex:COLOR_HEX[0]}],
      started: false, hostId: socket.id,
      genData: data,
      settings: { cellEffects:{}, cellPopups:{}, pieceIcons:{}, pieceImages:{} }
    };
    socket.join(id);
    cb?.({ok:true, id, players:rooms[id].players, numPlayers:data.numPlayers});
    io.to(id).emit('roomUpdate', {players:rooms[id].players, numPlayers:data.numPlayers});
  });

  socket.on('joinRoom', ({id, name}, cb) => {
    const r = rooms[id];
    if(!r) return cb?.({ok:false, err:'房间不存在'});
    if(r.started) return cb?.({ok:false, err:'游戏已开始'});
    if(r.players.length>=r.genData.numPlayers) return cb?.({ok:false, err:'房间已满'});
    const idx = r.players.length;
    r.players.push({id:socket.id, name:name||'玩家'+(idx+1), idx, color:COLORS[idx], hex:COLOR_HEX[idx]});
    socket.join(id);
    cb?.({ok:true, id, players:r.players});
    io.to(id).emit('roomUpdate', {players:r.players, numPlayers:r.genData.numPlayers});
  });

  socket.on('startGame', (cb) => {
    const r = findRoom(socket.id);
    if(!r) return cb?.({ok:false, err:'不在房间'});
    if(r.hostId!==socket.id) return cb?.({ok:false, err:'只有房主能开始'});
    if(r.players.length<2) return cb?.({ok:false, err:'至少2人'});
    r.started = true;
    r.game = {
      cur: 0, players: r.players.map((p,i)=>({idx:i, pos:0})),
      dice: 0, rolling: false, over: false, winner: null,
      mode: r.mode
    };
    // 初始化各玩家起点
    r.players.forEach((p,i)=>{r.game.players[i].pos = r.genData.starts[i+1]||0;});
    io.to(r.id).emit('gameStart', {
      players:r.players, game:r.game, paths:r.genData.paths,
      numPlayers:r.genData.numPlayers, totalSteps:r.genData.totalSteps,
      cellSize: r.genData.cellSize || 40
    });
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
    io.to(r.id).emit('diceRolled', {player:p, value:val, game:r.game, totalSteps:r.genData.totalSteps});
  });

  // --- 房主保存设置（格子文字/弹窗/棋子等）同步给所有人 ---
  socket.on('saveCellSetting', ({key, effect, popup}) => {
    const r = findRoom(socket.id);
    if(!r) return;
    if(effect) r.settings.cellEffects[key]=effect; else delete r.settings.cellEffects[key];
    if(popup) r.settings.cellPopups[key]=popup; else delete r.settings.cellPopups[key];
    io.to(r.id).emit('cellSettingUpdate', {key, effect, popup});
    console.log(`房间 ${r.id} 格子设置更新: ${key}`);
  });

  socket.on('savePieceSetting', ({player, icon, image}) => {
    const r = findRoom(socket.id);
    if(!r) return;
    if(icon) r.settings.pieceIcons[player]=icon;
    if(image!==undefined) r.settings.pieceImages[player]=image;
    io.to(r.id).emit('pieceSettingUpdate', {player, icon, image});
    console.log(`房间 ${r.id} 棋子设置更新: P${player}`);
  });

  socket.on('getSettings', (cb) => {
    const r = findRoom(socket.id);
    if(!r) return cb?.({});
    cb?.(r.settings);
  });

  socket.on('moveDone', ({player, targetPos}) => {
    const r = findRoom(socket.id);
    if(!r||!r.game) return;
    const g = r.game, ts = r.genData.totalSteps;
    g.players[player].pos = targetPos;
    // 碰撞
    for(let i=0;i<g.players.length;i++){
      if(i===player) continue;
      if(g.players[i].pos===targetPos && targetPos>0 && targetPos<ts){
        g.players[i].pos = r.genData.starts[i+1]||0;
        io.to(r.id).emit('playerCrash', {crashed:i, by:player, start:r.genData.starts[i+1]||0});
      }
    }
    if(targetPos >= ts){
      g.over = true; g.winner = player;
      io.to(r.id).emit('gameOver', {winner:player, name:r.players[player].name});
      return;
    }
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
        io.to(id).emit('roomUpdate', {players:r.players, numPlayers:r.genData?.numPlayers||4});
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

// 调试接口
app.get('/api/test/:mode', (req, res) => {
  const gen = PATH_GENERATORS[req.params.mode];
  if(!gen) return res.json({error:'unknown mode'});
  const data = gen();
  res.json({
    mode: req.params.mode,
    numPlayers: data.numPlayers,
    cellSize: data.cellSize,
    totalSteps: data.totalSteps,
    pathCount: Object.keys(data.paths).length,
    firstPathLength: data.paths[1]?.length || 0
  });
});
