// 🕉️ 卐字螺旋 · 四独立支路
const CONFIG = { BOARD_SIZE: 1040 };
const NUM_PLAYERS = 4;
const COLORS = ['#ff4444','#4488ff','#44bb44','#ffaa00'];
const BORDERS = ['#cc0000','#0055cc','#008800','#cc8800'];
const COLOR_EMOJI = ['🔴','🔵','🟢','🟡'];
const DEF_ICONS = ['👠','🚗','🐱','🎯'];

const CELL_SIZE = 40, STEP = 52, GAP = STEP - CELL_SIZE; // 12px间隙
const playerPaths = {1:[],2:[],3:[],4:[]};

let gameState = {
    currentPlayer:1, diceValue:0, isRolling:false, gameOver:false,
    players:{1:{pos:0},2:{pos:0},3:{pos:0},4:{pos:0}},
    cellEffects:{}, cellPopups:{},
    pieceIcons:{}, pieceImages:{}
};
for(let p=1;p<=4;p++) gameState.pieceIcons[p]=DEF_ICONS[p-1];

function initPaths() {
    const cx=CONFIG.BOARD_SIZE/2, cy=CONFIG.BOARD_SIZE/2;
    const A=8, W=3, s=STEP;

    // 卐字型路径：四臂带90度钩子，从外端到中心
    // 每条路径三段：垂直段→水平段→垂直/水平段到中心
    const segments = [
        // 臂1(右上→中心): (A,-W)→(A,W)→(0,W)→(0,0)
        {sx:A, sy:-W, ex:A, ey:W},
        {sx:A, sy:W, ex:0, ey:W},
        {sx:0, sy:W, ex:0, ey:0},
        // 臂2(右下→中心): (W,A)→(-W,A)→(-W,0)→(0,0)
        {sx:W, sy:A, ex:-W, ey:A},
        {sx:-W, sy:A, ex:-W, ey:0},
        {sx:-W, sy:0, ex:0, ey:0},
        // 臂3(左下→中心): (-A,W)→(-A,-W)→(0,-W)→(0,0)
        {sx:-A, sy:W, ex:-A, ey:-W},
        {sx:-A, sy:-W, ex:0, ey:-W},
        {sx:0, sy:-W, ex:0, ey:0},
        // 臂4(左上→中心): (-W,-A)→(W,-A)→(W,0)→(0,0)
        {sx:-W, sy:-A, ex:W, ey:-A},
        {sx:W, sy:-A, ex:W, ey:0},
        {sx:W, sy:0, ex:0, ey:0}
    ];

    for(let p=1; p<=4; p++) {
        const path = [];
        const start = (p-1)*3;
        for(let seg=start; seg<start+3; seg++) {
            const {sx,sy,ex,ey} = segments[seg];
            if(sx===ex) {
                // 垂直段
                const step = sy<ey?1:-1;
                for(let y=sy; y!==ey+step; y+=step) path.push([sx,y]);
            } else {
                // 水平段
                const step = sx<ex?1:-1;
                for(let x=sx; x!==ex+step; x+=step) path.push([x,ey]);
            }
        }
        // 去重（相邻重复点）
        const unique = [path[0]];
        for(let i=1; i<path.length; i++) {
            if(path[i][0]!==path[i-1][0]||path[i][1]!==path[i-1][1])
                unique.push(path[i]);
        }
        playerPaths[p] = unique;
    }

    // 居中（计算所有格子边界）
    let all=[];
    for(let p=1;p<=4;p++) all=all.concat(playerPaths[p]);
    let mnX=Infinity,mxX=-Infinity,mnY=Infinity,mxY=-Infinity;
    all.forEach(([gx,gy])=>{mnX=Math.min(mnX,gx*s);mxX=Math.max(mxX,gx*s);mnY=Math.min(mnY,gy*s);mxY=Math.max(mxY,gy*s);});
    const ox=(CONFIG.BOARD_SIZE-(mxX-mnX+CELL_SIZE))/2-mnX;
    const oy=(CONFIG.BOARD_SIZE-(mxY-mnY+CELL_SIZE))/2-mnY;

    for(let p=1;p<=4;p++){
        playerPaths[p]=playerPaths[p].map(([gx,gy])=>({
            x:Math.round(gx*s+ox), y:Math.round(gy*s+oy)
        }));
    }
    window.spiralCenterX=cx; window.spiralCenterY=cy;
}

function initBoard(){
    initPaths();
    const board=document.getElementById('board');
    board.innerHTML='';
    board.style.background='#2d2d2d';
    board.style.position='relative';

    // 中心高亮标记
    const centerGlow=document.createElement('div');
    centerGlow.style.cssText=`position:absolute;left:${playerPaths[1][playerPaths[1].length-1].x-30}px;top:${playerPaths[1][playerPaths[1].length-1].y-30}px;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(255,215,0,0.4),transparent);z-index:0;pointer-events:none;`;
    board.appendChild(centerGlow);

    // 路径连线（先绘制在格子下层）
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 1040 1040');
    svg.setAttribute('width','1040');svg.setAttribute('height','1040');
    svg.style.cssText='position:absolute;top:0;left:0;pointer-events:none;z-index:0;';
    for(let p=1;p<=4;p++){
        const path=playerPaths[p];
        for(let i=0;i<path.length-1;i++){
            const line=document.createElementNS('http://www.w3.org/2000/svg','line');
            line.setAttribute('x1',path[i].x+CELL_SIZE/2);
            line.setAttribute('y1',path[i].y+CELL_SIZE/2);
            line.setAttribute('x2',path[i+1].x+CELL_SIZE/2);
            line.setAttribute('y2',path[i+1].y+CELL_SIZE/2);
            line.setAttribute('stroke',COLORS[p-1]);
            line.setAttribute('stroke-width','3');
            line.setAttribute('stroke-linecap','round');
            line.setAttribute('opacity','0.6');
            svg.appendChild(line);
        }
    }
    board.appendChild(svg);

    // 格子
    for(let p=1;p<=4;p++){
        const path=playerPaths[p];
        path.forEach((pos,i)=>{
            const cell=document.createElement('div');
            cell.className='cell';
            cell.style.cssText=`position:absolute;left:${pos.x}px;top:${pos.y}px;width:${CELL_SIZE}px;height:${CELL_SIZE}px;border:2px solid ${BORDERS[p-1]};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.7em;background:linear-gradient(145deg,#fff,#f0f0f0);z-index:2;box-shadow:1px 2px 4px rgba(0,0,0,0.15);`;

            const isEnd = (pos.x===playerPaths[1][playerPaths[1].length-1].x && pos.y===playerPaths[1][playerPaths[1].length-1].y);
            if(isEnd){
                cell.style.width='60px';cell.style.height='60px';
                cell.style.background='linear-gradient(135deg,#ffd700,#ffaa00)';
                cell.style.border='4px solid #ff6600';
                cell.style.boxShadow='0 0 30px rgba(255,215,0,0.6)';
                cell.style.fontSize='1.2em';cell.style.fontWeight='bold';
                cell.style.zIndex='5';
                cell.innerHTML='🏆终点';
            }else if(i===0){
                cell.style.background=COLORS[p-1];
                cell.style.color='white';
                cell.style.fontWeight='bold';
                cell.style.fontSize='0.8em';
                cell.innerHTML=COLOR_EMOJI[p-1]+'起';
            }else{
                cell.innerHTML='<span style="color:#999">'+i+'</span>';
            }
            board.appendChild(cell);
        });
    }

    // 骰子（放在右下角独立区域）
    const dice=document.createElement('div');
    dice.id='boardDice';
    dice.style.cssText=`position:absolute;left:${CONFIG.BOARD_SIZE-110}px;top:${CONFIG.BOARD_SIZE-110}px;width:80px;height:80px;background:linear-gradient(145deg,#fff,#e8e8e8);border:3px solid #555;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:2.5em;font-weight:bold;color:#333;box-shadow:0 6px 25px rgba(0,0,0,0.3);z-index:30;cursor:pointer;user-select:none;`;
    dice.innerHTML='<span id="diceDisplay">?</span>';
    dice.addEventListener('click',rollDice);
    board.appendChild(dice);

    for(let p=1;p<=4;p++) gameState.players[p].pos=0;
    createPieces();
    for(let p=1;p<=4;p++) placePiece(p,0);
}

function createPieces(){
    document.querySelectorAll('.piece').forEach(el=>el.remove());
    for(let p=1;p<=4;p++){
        const el=document.createElement('div');
        el.id='piece'+p; el.className='piece';
        el.style.cssText=`position:absolute;width:30px;height:30px;background:rgba(255,255,255,0.9);border:3px solid ${BORDERS[p-1]};border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:15;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-size:16px;`;
        const img=gameState.pieceImages?.[p];
        el.innerHTML=img?`<img src="${img}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">`:gameState.pieceIcons[p];
        el.style.display='none';
        document.getElementById('board').appendChild(el);
    }
}

function placePiece(player,idx){
    const el=document.getElementById('piece'+player);if(!el)return;
    const path=playerPaths[player];if(!path||idx<0||idx>=path.length)return;
    const pos=path[idx];if(!pos)return;
    const off=Math.round((CELL_SIZE-30)/2);
    el.style.left=(pos.x+off)+'px'; el.style.top=(pos.y+off)+'px'; el.style.display='flex';
}

function rollDice(){
    if(gameState.isRolling||gameState.gameOver)return;
    if(document.getElementById('rollBtn').disabled)return;
    const player=gameState.currentPlayer;
    if(gameState.players[player].skipTurn){gameState.players[player].skipTurn=false;updateMessage(`${COLOR_EMOJI[player-1]}P${player}跳过`);gameState.isRolling=false;setTimeout(()=>switchPlayer(),600);return;}
    gameState.isRolling=true;
    const d=document.getElementById('boardDice'),ds=document.getElementById('diceDisplay');
    document.getElementById('rollBtn').disabled=true;
    let c=0;
    const iv=setInterval(()=>{
        ds.textContent=Math.floor(Math.random()*6)+1;
        d.style.transform=`scale(${1+Math.random()*0.3}) rotate(${Math.random()*20-10}deg)`;
        c++;if(c>=10){clearInterval(iv);
            gameState.diceValue=Math.floor(Math.random()*6)+1;
            ds.textContent=gameState.diceValue;d.style.transform='scale(1) rotate(0deg)';
            updateMessage(`${COLOR_EMOJI[player-1]}P${player} 投出 ${gameState.diceValue}`);
            setTimeout(()=>movePiece(player,gameState.diceValue),300);
        }
    },100);
}

function movePiece(player,steps){
    const pd=gameState.players[player];
    const path=playerPaths[player];if(!path)return;
    let sp=pd.pos, endIdx=path.length-1;
    let tp=sp+steps, win=false, over=0;
    if(tp>=endIdx){over=tp-endIdx;if(over>0){tp=endIdx-over;}else{tp=endIdx;win=true;}}
    const el=document.getElementById('piece'+player);if(!el)return;
    const sc=path[sp],ec=path[tp];if(!sc||!ec)return;
    const off=Math.round((CELL_SIZE-30)/2);
    const sx=sc.x+off,sy=sc.y+off,ex=ec.x+off,ey=ec.y+off;
    const dur=500,start=performance.now();
    function anim(t){
        const p=Math.min((t-start)/dur,1),e=1-Math.pow(1-p,3);
        const arc=Math.sin(p*Math.PI)*45;
        el.style.left=(sx+(ex-sx)*e)+'px'; el.style.top=(sy+(ey-sy)*e-arc)+'px';
        if(p<1)requestAnimationFrame(anim); else {
            el.style.left=ex+'px'; el.style.top=ey+'px';
            el.style.transform='scale(1.2)';setTimeout(()=>el.style.transform='scale(1)',100);
            pd.pos=tp;
            if(win){updateMessage(`🎉${COLOR_EMOJI[player-1]}P${player}获胜！🎉`);gameOver(player);return;}
            finishMove();
        }
    }
    requestAnimationFrame(anim);
}

function finishMove(){gameState.isRolling=false;setTimeout(()=>switchPlayer(),600);}
function switchPlayer(){if(gameState.gameOver)return;gameState.currentPlayer=(gameState.currentPlayer%4)+1;updatePlayerDisplay();document.getElementById('rollBtn').disabled=false;updateMessage(`轮到${COLOR_EMOJI[gameState.currentPlayer-1]}P${gameState.currentPlayer}`);}
function updatePlayerDisplay(){document.querySelectorAll('.player').forEach(p=>p.classList.remove('active'));document.querySelector('.player'+gameState.currentPlayer).classList.add('active');for(let p=1;p<=4;p++){const s=document.querySelector(`.player${p} .player-status`);if(s)s.textContent='步'+gameState.players[p].pos+'/'+(playerPaths[p]?.length-1||0);}}
function updateMessage(m){const el=document.getElementById('gameMessage');if(el)el.textContent=m;}
function gameOver(w){gameState.gameOver=true;document.getElementById('rollBtn').disabled=true;updateMessage(`🎉${COLOR_EMOJI[w-1]}P${w}获胜！🎉`);setTimeout(()=>alert(`🎉${COLOR_EMOJI[w-1]}P${w}获胜！🎉`),500);}
function restartGame(){
    const si={},sim={};
    for(let p=1;p<=4;p++){si[p]=gameState.pieceIcons[p];sim[p]=gameState.pieceImages?.[p];}
    gameState={currentPlayer:1,diceValue:0,isRolling:false,gameOver:false,players:{1:{pos:0},2:{pos:0},3:{pos:0},4:{pos:0}},cellEffects:{},cellPopups:{},pieceIcons:si,pieceImages:sim};
    document.querySelectorAll('.piece').forEach(p=>p.style.display='none');
    for(let p=1;p<=4;p++){gameState.players[p].pos=0;placePiece(p,0);}
    document.getElementById('diceDisplay').textContent='?';document.getElementById('rollBtn').disabled=false;
    updatePlayerDisplay();updateMessage('点击"掷骰子"开始');
}
function clearAllData(){initBoard();updateMessage('已清除');}
function setupCustom(p){const sel=document.getElementById('pieceIcon'+p),file=document.getElementById('pieceImage'+p);sel.addEventListener('change',function(){if(this.value==='image'+p){file.style.display='inline-block';file.click();}else{file.style.display='none';gameState.pieceIcons[p]=this.value;gameState.pieceImages[p]=null;updatePieceIcon(p);localStorage.setItem('g5_icon'+p,this.value);localStorage.removeItem('g5_img'+p);}});file.addEventListener('change',function(){const f=this.files[0];if(f){const r=new FileReader();r.onload=function(e){gameState.pieceImages[p]=e.target.result;updatePieceIcon(p,'image');localStorage.setItem('g5_img'+p,e.target.result);};r.readAsDataURL(f);}});}
function updatePieceIcon(p,t){const el=document.getElementById('piece'+p);if(!el)return;const img=gameState.pieceImages?.[p];el.innerHTML=img&&t==='image'?`<img src="${img}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">`:gameState.pieceIcons[p];}

document.getElementById('rollBtn').addEventListener('click',rollDice);
document.getElementById('restartBtn').addEventListener('click',restartGame);
document.getElementById('closePopup')?.addEventListener('click',closePopup);
document.getElementById('clearBtn')?.addEventListener('click',clearAllData);
document.getElementById('boardImage')?.addEventListener('change',function(e){const f=e.target.files[0];if(f){const r=new FileReader();r.onload=function(ev){document.getElementById('board').style.backgroundImage='url('+ev.target.result+')';document.getElementById('board').style.backgroundSize='cover';};r.readAsDataURL(f);}});
for(let p=1;p<=4;p++)setupCustom(p);
function closePopup(){document.getElementById('popupOverlay')?.classList.remove('show');}
function showPopup(t){const o=document.getElementById('popupOverlay');if(!o)return;document.getElementById('popupText').textContent=t;o.classList.add('show');setTimeout(()=>o.classList.remove('show'),3000);}

initBoard();
for(let p=1;p<=4;p++){const si=localStorage.getItem('g5_icon'+p);const sim=localStorage.getItem('g5_img'+p);if(sim){gameState.pieceImages[p]=sim;updatePieceIcon(p,'image');}else if(si){gameState.pieceIcons[p]=si;document.getElementById('pieceIcon'+p).value=si;updatePieceIcon(p);}}
updatePlayerDisplay();updateMessage('点击"掷骰子"开始');