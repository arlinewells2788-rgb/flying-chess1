// 经典十字形飞行棋 · 双人版
const CONFIG = { CELL_WIDTH: 84, CELL_HEIGHT: 42, BOARD_SIZE: 1040 };
const gamePath = [], playerRunways = { 1: [] };
let P2_START, P1_END, P2_END;

let gameState = {
    currentPlayer: 1, diceValue: 0, isRolling: false, gameOver: false,
    players: { 1: { position: -1, skipTurn: false }, 2: { position: -1, skipTurn: false } },
    cellEffects: {}, cellPopups: {},
    pieceIcon1: '🔴', pieceIcon2: '🔵', pieceImage1: null, pieceImage2: null
};

// 十字形路径（臂长6，臂宽5格，共48格）
function initPaths() {
    gamePath.length = 0;
    const cellW = CONFIG.CELL_WIDTH, cellH = CONFIG.CELL_HEIGHT;
    const A = 7, W = 2, s = 50;

    // 生成十字形外轮廓路径点（网格坐标）
    const pts = [];
    // 上臂上边
    for (let x = -W; x <= W; x++) pts.push([x, -A]);
    // 右上连接段
    for (let y = -A+1; y <= -W; y++) pts.push([W, y]);
    // 右臂右侧上段
    for (let x = W+1; x <= A; x++) pts.push([x, -W]);
    // 右臂右侧下段
    for (let y = -W+1; y <= W; y++) pts.push([A, y]);
    // 右臂下侧
    for (let x = A-1; x >= W+1; x--) pts.push([x, W]);
    // 右下连接段
    for (let y = W+1; y <= A-1; y++) pts.push([W, y]);
    // 下臂下边
    for (let x = W; x >= -W; x--) pts.push([x, A]);
    // 左下连接段
    for (let y = A-1; y >= W+1; y--) pts.push([-W, y]);
    // 左臂下侧
    for (let x = -W-1; x >= -A+1; x--) pts.push([x, W]);
    // 左臂左侧
    for (let y = W-1; y >= -W+1; y--) pts.push([-A, y]);
    // 左臂上侧
    for (let x = -A+1; x <= -W-1; x++) pts.push([x, -W]);
    // 左上连接段
    for (let y = -W-1; y >= -A+1; y--) pts.push([-W, y]);

    // 计算包围盒并居中
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(([gx, gy]) => {
        minX = Math.min(minX, gx*s); maxX = Math.max(maxX, gx*s);
        minY = Math.min(minY, gy*s); maxY = Math.max(maxY, gy*s);
    });
    const bw = maxX - minX + cellW, bh = maxY - minY + cellH;
    const ox = (CONFIG.BOARD_SIZE - bw)/2 - minX;
    const oy = (CONFIG.BOARD_SIZE - bh)/2 - minY;

    // 转换为像素坐标
    pts.forEach(([gx, gy], i) => {
        gamePath.push({
            x: Math.round(gx*s + ox), y: Math.round(gy*s + oy),
            type: 'path', number: i
        });
    });

    // 编号、起点、终点
    gamePath[0].type = 'player1-start';
    P2_START = Math.floor(gamePath.length/2);
    P1_END = P2_START - 1;
    P2_END = gamePath.length - 1;
    gamePath[P1_END].type = 'center';
    gamePath[P2_END].type = 'center';

    window.spiralCenterX = CONFIG.BOARD_SIZE/2;
    window.spiralCenterY = CONFIG.BOARD_SIZE/2;
}

// 创建棋盘
function initBoard() {
    initPaths();
    const board = document.getElementById('board');
    board.innerHTML = '';
    board.style.background = '#f5f5dc';
    drawLines();

    // 格子（格子宽度匹配步长50px，避免重叠）
    for (let i = 0; i < gamePath.length; i++) {
        const p = gamePath[i];
        const cell = document.createElement('div');
        cell.className = `cell ${p.type}`;
        cell.dataset.index = i;
        cell.style.left = p.x + 'px';
        cell.style.top = p.y + 'px';
        cell.style.width = '50px';
        if (i === P1_END) { cell.style.width='80px';cell.style.height='50px';cell.innerHTML='<span style="font-size:1em">🔴终点</span>'; }
        else if (i === P2_END) { cell.style.width='80px';cell.style.height='50px';cell.innerHTML='<span style="font-size:1em">🔵终点</span>'; }
        else cell.innerHTML = `<span class="cell-number">${p.number}</span>`;
        cell.addEventListener('click', ()=>openCellEditor(i));
        board.appendChild(cell);
    }

    // 骰子
    const dice = document.createElement('div');
    dice.id = 'boardDice';
    dice.style.cssText = `position:absolute;left:${CONFIG.BOARD_SIZE/2-40}px;top:${CONFIG.BOARD_SIZE/2-40}px;width:80px;height:80px;background:linear-gradient(145deg,#fff,#f0f0f0);border:3px solid #444;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:2.5em;font-weight:bold;color:#333;box-shadow:0 4px 15px rgba(0,0,0,0.2);z-index:20;cursor:pointer;user-select:none;`;
    dice.innerHTML = '<span id="diceDisplay">?</span>';
    dice.addEventListener('click', rollDice);
    board.appendChild(dice);

    gameState.players[2].position = P2_START;
    createPieces();
    placePiece(1, -1);
    placePiece(2, P2_START);
}

// 连线
function drawLines() {
    const board = document.getElementById('board');
    let svg = board.querySelector('.connection-lines');
    if(svg)svg.remove();
    svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 1040 1040');
    svg.setAttribute('width','1040');svg.setAttribute('height','1040');
    svg.style.cssText='position:absolute;top:0;left:0;pointer-events:none;z-index:0;';
    const cw=50,ch=CONFIG.CELL_HEIGHT;
    for(let i=0;i<gamePath.length-1;i++){
        const c=gamePath[i],n=gamePath[i+1],r=i/(gamePath.length-1);
        const line=document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1',c.x+cw/2);line.setAttribute('y1',c.y+ch/2);
        line.setAttribute('x2',n.x+cw/2);line.setAttribute('y2',n.y+ch/2);
        line.setAttribute('stroke',`rgb(${255-r*200},${150+r*100},${150-r*100})`);
        line.setAttribute('stroke-width','2');line.setAttribute('stroke-linecap','round');
        line.setAttribute('opacity',0.4+r*0.5);
        svg.appendChild(line);
    }
    board.insertBefore(svg,board.firstChild);
}

// 棋子
function createPieces() {
    document.querySelectorAll('.piece').forEach(p=>p.remove());
    [1,2].forEach(p=>{
        const piece=document.createElement('div');
        piece.id=`piece${p}`;piece.className='piece';
        const bc=p===1?'#ff4444':'#4488ff';
        piece.style.cssText=`position:absolute;width:32px;height:32px;background:rgba(255,255,255,0.85);border:2px solid ${bc};border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px;`;
        const img=gameState[`pieceImage${p}`];
        piece.innerHTML=img?`<img src="${img}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;">`:gameState[`pieceIcon${p}`];
        piece.style.display='none';
        document.getElementById('board').appendChild(piece);
    });
}

function placePiece(player,pos){
    const p=document.getElementById(`piece${player}`);if(!p)return;
    const cellW=50,cellH=CONFIG.CELL_HEIGHT;
    const offX=Math.round((cellW-32)/2),offY=Math.round((cellH-32)/2);
    let px,py;
    if(pos===-1){px=gamePath[0].x;py=gamePath[0].y;}
    else if(pos>=0&&pos<gamePath.length){px=gamePath[pos].x;py=gamePath[pos].y;}
    else return;
    p.style.left=(px+offX)+'px';p.style.top=(py+offY)+'px';p.style.display='flex';
}

// 掷骰子
function rollDice(){
    if(gameState.isRolling||gameState.gameOver)return;if(document.getElementById('rollBtn').disabled)return;
    const player=gameState.currentPlayer;
    if(gameState.players[player].skipTurn){gameState.players[player].skipTurn=false;updateMessage(`玩家${player}跳过`);gameState.isRolling=false;setTimeout(()=>switchPlayer(),800);return;}
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
            updateMessage(`玩家${player} 投出 ${gameState.diceValue}`);
            setTimeout(()=>movePiece(player,gameState.diceValue),300);
        }
    },100);
}

// 移动
function movePiece(player,steps){
    const pd=gameState.players[player];
    let sp=pd.position,ep=player===1?P1_END:P2_END;
    if(sp===-1)sp=player===1?0:P2_START;
    let tp=sp+steps,over=0,win=false;
    if(tp>=ep){over=tp-ep;if(over>0){tp=ep-over;updateMessage(`玩家${player}超过终点，回退${over}步`);}else{tp=ep;win=true;}}
    const piece=document.getElementById(`piece${player}`);if(!piece)return;
    const offX=Math.round((50-32)/2),offY=Math.round((CONFIG.CELL_HEIGHT-32)/2);
    const sc=gamePath[sp],ec=gamePath[tp];if(!sc||!ec)return;
    const sx=sc.x+offX,sy=sc.y+offY,ex=ec.x+offX,ey=ec.y+offY;
    const dur=500,start=performance.now();
    function anim(t){
        const p=Math.min((t-start)/dur,1),e=1-Math.pow(1-p,3);
        const arc=Math.sin(p*Math.PI)*50;
        piece.style.left=(sx+(ex-sx)*e)+'px';piece.style.top=(sy+(ey-sy)*e-arc)+'px';
        if(p<1)requestAnimationFrame(anim);
        else{
            piece.style.left=ex+'px';piece.style.top=ey+'px';
            piece.style.transform='scale(1.1)';setTimeout(()=>piece.style.transform='scale(1)',100);
            pd.position=tp;
            if(win){updateMessage(`🎉玩家${player}获胜！🎉`);gameOver(player);return;}
            setTimeout(()=>{
                const eff=gameState.cellEffects[tp];
                if(eff?.type==='forward'){pd.position=Math.min(pd.position+eff.steps,ep);placePiece(player,pd.position);}
                else if(eff?.type==='backward'){pd.position=Math.max(0,pd.position-eff.steps);placePiece(player,pd.position);}
                else if(eff?.type==='skip')pd.skipTurn=true;
                finishMove();
            },400);
        }
    }
    requestAnimationFrame(anim);
}

function finishMove(){gameState.isRolling=false;setTimeout(()=>switchPlayer(),600);}
function switchPlayer(){if(gameState.gameOver)return;gameState.currentPlayer=gameState.currentPlayer===1?2:1;updatePlayerDisplay();document.getElementById('rollBtn').disabled=false;updateMessage(`轮到玩家${gameState.currentPlayer}`);}
function updatePlayerDisplay(){document.querySelectorAll('.player').forEach(p=>p.classList.remove('active'));document.querySelector(`.player${gameState.currentPlayer}`).classList.add('active');for(let p=1;p<=2;p++){const s=document.querySelector(`.player${p} .player-status`);if(s){const pos=gameState.players[p].position;s.textContent=pos===-1?'起点':`位置${pos}`;}}}
function updateMessage(m){const el=document.getElementById('gameMessage');if(el)el.textContent=m;}
function gameOver(w){gameState.gameOver=true;document.getElementById('rollBtn').disabled=true;updateMessage(`🎉玩家${w}获胜！🎉`);setTimeout(()=>alert(`🎉恭喜玩家${w}获胜！🎉`),500);}
function showPopup(t){const o=document.getElementById('popupOverlay');document.getElementById('popupText').textContent=t;o.classList.add('show');setTimeout(()=>o.classList.remove('show'),3000);}
function closePopup(){document.getElementById('popupOverlay').classList.remove('show');}
function openCellEditor(idx){if(idx<0||idx>=gamePath.length)return;const e=document.getElementById('cellEditor');const o=document.querySelector('.overlay')||(()=>{const d=document.createElement('div');d.className='overlay';document.body.appendChild(d);d.addEventListener('click',closeCellEditor);return d;})();document.getElementById('cellNumber').textContent=idx;const eff=gameState.cellEffects[idx];if(eff){const r=document.querySelector(`input[name="cellEffect"][value="${eff.type}"]`);if(r)r.checked=true;if(eff.steps){document.getElementById('forwardSteps').value=eff.steps;document.getElementById('backwardSteps').value=eff.steps;}document.getElementById('customText').value=eff.customText||'';}else{document.querySelector('input[name="cellEffect"][value="none"]').checked=true;document.getElementById('customText').value='';}document.getElementById('cellPopupText').value=gameState.cellPopups[idx]||'';o.classList.add('show');e.classList.add('show');e.dataset.cellIndex=idx;}
function closeCellEditor(){document.getElementById('cellEditor').classList.remove('show');document.querySelector('.overlay')?.classList.remove('show');}
function saveCellEffect(){const idx=parseInt(document.getElementById('cellEditor').dataset.cellIndex);const type=document.querySelector('input[name="cellEffect"]:checked').value;const txt=document.getElementById('customText').value.trim();const pop=document.getElementById('cellPopupText').value.trim();if(type==='none'&&!txt)delete gameState.cellEffects[idx];else{const e={type};if(txt)e.customText=txt;if(type==='forward')e.steps=parseInt(document.getElementById('forwardSteps').value);if(type==='backward')e.steps=parseInt(document.getElementById('backwardSteps').value);gameState.cellEffects[idx]=e;}if(pop)gameState.cellPopups[idx]=pop;else delete gameState.cellPopups[idx];localStorage.setItem('g3_cellEffects',JSON.stringify(gameState.cellEffects));localStorage.setItem('g3_cellPopups',JSON.stringify(gameState.cellPopups));updateCellDisplay(idx);closeCellEditor();}
function updateCellDisplay(idx){const cell=document.querySelector(`.cell[data-index="${idx}"]`);if(!cell)return;cell.querySelector('.cell-effect')?.remove();cell.querySelector('.cell-custom-text')?.remove();const eff=gameState.cellEffects[idx];if(eff){if(eff.customText){const d=document.createElement('div');d.className='cell-custom-text';d.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:0.7em;color:#333;font-weight:bold;width:90%;text-align:center;';d.textContent=eff.customText;cell.appendChild(d);const cn=cell.querySelector('.cell-number');if(cn)cn.style.display='none';}if(eff.type!=='none'){const d=document.createElement('div');d.className=`cell-effect ${eff.type}`;let t='';if(eff.type==='forward')t=`+${eff.steps}`;else if(eff.type==='backward')t=`-${eff.steps}`;else if(eff.type==='skip')t='停';d.textContent=t;cell.appendChild(d);}}else{const cn=cell.querySelector('.cell-number');if(cn)cn.style.display='';}}

// 重新开始
function restartGame(){
    const se=gameState.cellEffects,sp=gameState.cellPopups,s1=gameState.pieceIcon1,s2=gameState.pieceIcon2,im1=gameState.pieceImage1,im2=gameState.pieceImage2;
    gameState={currentPlayer:1,diceValue:0,isRolling:false,gameOver:false,players:{1:{position:-1,skipTurn:false},2:{position:-1,skipTurn:false}},cellEffects:se,cellPopups:sp,pieceIcon1:s1,pieceIcon2:s2,pieceImage1:im1,pieceImage2:im2};
    document.querySelectorAll('.piece').forEach(p=>p.style.display='none');
    gameState.players[2].position=P2_START;placePiece(1,-1);placePiece(2,P2_START);
    document.getElementById('diceDisplay').textContent='?';document.getElementById('rollBtn').disabled=false;
    updatePlayerDisplay();updateMessage('点击"掷骰子"开始游戏');
}
function clearAllData(){localStorage.clear();gameState.cellEffects={};gameState.cellPopups={};gameState.pieceIcon1='🔴';gameState.pieceIcon2='🔵';gameState.pieceImage1=null;gameState.pieceImage2=null;initBoard();updateMessage('已清除');}

function setupCustom(p){const sel=document.getElementById(`pieceIcon${p}`),file=document.getElementById(`pieceImage${p}`);sel.addEventListener('change',function(){if(this.value===`image${p}`){file.style.display='inline-block';file.click();}else{file.style.display='none';gameState[`pieceIcon${p}`]=this.value;gameState[`pieceImage${p}`]=null;updatePieceIcon(p);localStorage.setItem(`pieceIcon${p}`,this.value);localStorage.removeItem(`pieceImage${p}`);}});file.addEventListener('change',function(){const f=this.files[0];if(f){const r=new FileReader();r.onload=function(e){gameState[`pieceImage${p}`]=e.target.result;updatePieceIcon(p,'image');localStorage.setItem(`pieceImage${p}`,e.target.result);};r.readAsDataURL(f);}});}
function updatePieceIcon(p,t){const el=document.getElementById(`piece${p}`);if(!el)return;const img=gameState[`pieceImage${p}`];el.innerHTML=img&&t==='image'?`<img src="${img}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;">`:gameState[`pieceIcon${p}`];}

document.getElementById('rollBtn').addEventListener('click',rollDice);
document.getElementById('restartBtn').addEventListener('click',restartGame);
document.getElementById('saveCellEffect').addEventListener('click',saveCellEffect);
document.getElementById('closeEditor').addEventListener('click',closeCellEditor);
document.getElementById('closePopup').addEventListener('click',closePopup);
document.getElementById('clearBtn').addEventListener('click',clearAllData);
document.getElementById('boardImage').addEventListener('change',function(e){const f=e.target.files[0];if(f){const r=new FileReader();r.onload=function(ev){document.getElementById('board').style.backgroundImage=`url(${ev.target.result})`;document.getElementById('board').style.backgroundSize='cover';};r.readAsDataURL(f);}});
setupCustom(1);setupCustom(2);

initBoard();
try{const e=localStorage.getItem('g3_cellEffects');if(e){gameState.cellEffects=JSON.parse(e);for(let i=0;i<gamePath.length;i++)updateCellDisplay(i);}const p=localStorage.getItem('g3_cellPopups');if(p)gameState.cellPopups=JSON.parse(p);['g3_Icon1','g3_Icon2','g3_Image1','g3_Image2'].forEach(k=>{const v=localStorage.getItem('piece'+k);if(v){if(k.startsWith('Image')){gameState['pieceImage'+k[5]]=v;updatePieceIcon(parseInt(k[5]),'image');}else{gameState['pieceIcon'+parseInt(k[5])]=v;const sel=document.getElementById('pieceIcon'+k[5]);if(sel)sel.value=v;updatePieceIcon(parseInt(k[5]));}}});}catch(e){}
updatePlayerDisplay();updateMessage('点击"掷骰子"开始游戏');