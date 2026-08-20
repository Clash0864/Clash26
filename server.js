const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const CATS = ['Country','Pop Star','Actor','TV Programme','Film'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function code(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out=''; for(let i=0;i<4;i++) out+=chars[Math.floor(Math.random()*chars.length)];
  return rooms.has(out)?code():out;
}
function publicRoom(r){
  return {
    code:r.code,
    hostId:r.hostId,
    phase:r.phase,
    round:r.round,
    letter:r.letter,
    chooserIndex:r.chooserIndex,
    players:[...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,finished:p.finished})),
    categories:CATS,
    finalCountdownEndsAt:r.finalCountdownEndsAt || null
  };
}
function emitRoom(r){ io.to(r.code).emit('roomState', publicRoom(r)); }
function endAnswers(r){
  if(r.phase !== 'answers') return;
  r.phase='review'; r.finalCountdownEndsAt=null;
  const sheets={}; for(const [id,p] of r.players) sheets[id]={name:p.name,answers:p.answers||[]};
  io.to(r.code).emit('reviewState',{room:publicRoom(r),sheets});
  emitRoom(r);
}

io.on('connection', socket=>{
  socket.on('createRoom', ({name}, cb)=>{
    const roomCode=code();
    const r={code:roomCode,hostId:socket.id,phase:'lobby',round:1,letter:null,chooserIndex:0,players:new Map(),finalCountdownEndsAt:null};
    r.players.set(socket.id,{id:socket.id,name:(name||'Host').trim().slice(0,20),score:0,answers:[],finished:false});
    rooms.set(roomCode,r); socket.join(roomCode); socket.data.room=roomCode;
    cb?.({ok:true,code:roomCode,id:socket.id}); emitRoom(r);
  });

  socket.on('joinRoom', ({code:roomCode,name}, cb)=>{
    roomCode=(roomCode||'').toUpperCase(); const r=rooms.get(roomCode);
    if(!r) return cb?.({ok:false,error:'Room not found'});
    if(r.phase!=='lobby') return cb?.({ok:false,error:'Game already started'});
    if(r.players.size>=8) return cb?.({ok:false,error:'Room is full'});
    r.players.set(socket.id,{id:socket.id,name:(name||'Player').trim().slice(0,20),score:0,answers:[],finished:false});
    socket.join(roomCode); socket.data.room=roomCode; cb?.({ok:true,code:roomCode,id:socket.id}); emitRoom(r);
  });

  socket.on('startGame', cb=>{
    const r=rooms.get(socket.data.room); if(!r||r.hostId!==socket.id) return;
    if(r.players.size<2) return cb?.({ok:false,error:'Need at least 2 players'});
    r.phase='letter'; r.letter=null; for(const p of r.players.values()){p.answers=[];p.finished=false;} emitRoom(r); cb?.({ok:true});
  });

  socket.on('revealLetter', ()=>{
    const r=rooms.get(socket.data.room); if(!r||r.hostId!==socket.id||r.phase!=='letter') return;
    r.letter=LETTERS[Math.floor(Math.random()*LETTERS.length)]; r.phase='answers';
    r.finalCountdownEndsAt=null; for(const p of r.players.values()){p.answers=[];p.finished=false;}
    emitRoom(r); io.to(r.code).emit('roundStarted',{letter:r.letter,categories:CATS});
  });

  socket.on('submitAnswers', ({answers}, cb)=>{
    const r=rooms.get(socket.data.room); if(!r||r.phase!=='answers') return cb?.({ok:false});
    const p=r.players.get(socket.id); if(!p) return cb?.({ok:false});
    p.answers=CATS.map((_,i)=>String((answers||[])[i]||'').trim().slice(0,80)); p.finished=true;
    if(!r.finalCountdownEndsAt){
      r.finalCountdownEndsAt=Date.now()+10000;
      io.to(r.code).emit('finalCountdown',{endsAt:r.finalCountdownEndsAt,finisher:p.name});
      setTimeout(()=>{ const latest=rooms.get(r.code); if(latest) endAnswers(latest); },10050);
    }
    emitRoom(r); cb?.({ok:true});
  });

  socket.on('scoreRound', ({decisions}, cb)=>{
    const r=rooms.get(socket.data.room); if(!r||r.hostId!==socket.id||r.phase!=='review') return;
    for(let ci=0;ci<CATS.length;ci++){
      const freq={};
      for(const [id,p] of r.players){
        const a=(p.answers||[])[ci]||''; const key=`${id}|${ci}`;
        const valid = decisions && key in decisions ? !!decisions[key] : (!!a && a[0].toUpperCase()===r.letter);
        if(valid) freq[a.toLowerCase()] = (freq[a.toLowerCase()]||0)+1;
      }
      for(const [id,p] of r.players){
        const a=(p.answers||[])[ci]||''; const key=`${id}|${ci}`;
        const valid = decisions && key in decisions ? !!decisions[key] : (!!a && a[0].toUpperCase()===r.letter);
        if(valid) p.score += freq[a.toLowerCase()]>1 ? 5 : 10;
      }
    }
    r.phase='scores'; emitRoom(r); cb?.({ok:true});
  });

  socket.on('nextRound', ()=>{
    const r=rooms.get(socket.data.room); if(!r||r.hostId!==socket.id) return;
    r.round++; r.chooserIndex=(r.chooserIndex+1)%r.players.size; r.phase='letter'; r.letter=null; r.finalCountdownEndsAt=null;
    for(const p of r.players.values()){p.answers=[];p.finished=false;} emitRoom(r);
  });

  socket.on('disconnect', ()=>{
    const roomCode=socket.data.room, r=rooms.get(roomCode); if(!r) return;
    r.players.delete(socket.id);
    if(r.players.size===0){rooms.delete(roomCode);return;}
    if(r.hostId===socket.id) r.hostId=[...r.players.keys()][0];
    emitRoom(r);
  });
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`CLASH 26 running on port ${PORT}`));
