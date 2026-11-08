/* The AP Lunch Gazette — live edition. Reads Sleeper's public API in the browser. */
(function(){
"use strict";
var LID="1387166312022704128", API="https://api.sleeper.app/v1";
var LORE={
  bdavis4208:"the man who drafts a kicker before his WR2",
  Bigbertha15:"who spent a fifth-round pick on Kyle Pitts",
  DWormie:"sender of the league's most creative trade offers",
  luketu:"who hasn't seen the playoffs since 2021 but talks like a contender",
  MasterRhino7683:"who sets his lineup Thursday and never looks back",
  MrSend:"still relitigating the 2022 trade",
  tthink3r:"who drafts like he has season tickets to one NFL team",
  YanDiazz:"our once-champion, as he will remind you"
};
var cache={}, S={};
function get(p){ if(!cache[p]) cache[p]=fetch(API+p,{cache:"no-store"}).then(function(r){ if(!r.ok) throw new Error(p+" "+r.status); return r.json(); }); return cache[p]; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function f2(n){ return (Math.round(n*100)/100).toFixed(2); }
function pl(id){ var p=(window.PLAYERS||{})[id]; if(p) return {name:p[0],pos:p[1],team:p[2]};
  if(/^[A-Z]{2,3}$/.test(id)) return {name:id+" D/ST",pos:"DEF",team:id}; return {name:"Player #"+id,pos:"?",team:""}; }
function pick(a,seed){ return a[Math.abs(seed)%a.length]; }
function shortN(n){ return n.replace(/ (Jr\.|Sr\.|II|III|IV)$/,""); }

/* ---------- data ---------- */
function teamOf(rid){ return S.teams[rid]||{user:"Team "+rid}; }
function detail(m){
  var pts=m.players_points||{}, starters=(m.starters||[]), slots=S.slots;
  var st=starters.map(function(id,i){ var empty=(!id||id==="0"); var p=empty?{name:"(empty slot)",pos:"—",team:""}:pl(id);
    return {id:id,empty:empty,name:p.name,pos:p.pos,team:p.team,slot:slots[i]||"",pts:empty?0:(pts[id]||0)}; });
  var set={}; starters.forEach(function(s){set[s]=1;});
  var bn=(m.players||[]).filter(function(id){return !set[id];}).map(function(id){ var p=pl(id); return {id:id,name:p.name,pos:p.pos,team:p.team,pts:pts[id]||0}; })
    .sort(function(a,b){return b.pts-a.pts;});
  var blunders=[];
  bn.forEach(function(b){ var worse=st.filter(function(s){return !s.empty&&s.pos===b.pos&&s.pts<b.pts;}); if(worse.length){ var w=worse.reduce(function(a,c){return c.pts<a.pts?c:a;}); blunders.push({bench:b,over:w,lost:b.pts-w.pts}); }});
  blunders.sort(function(a,b){return b.lost-a.lost;});
  var benchPts=bn.reduce(function(a,b){return a+b.pts;},0);
  var t=teamOf(m.roster_id);
  return {rid:m.roster_id,user:t.user,points:m.points||0,starters:st,bench:bn,benchPts:benchPts,blunders:blunders};
}
function games(w){
  var by={}; (S.mw[w]||[]).forEach(function(m){ if(m.matchup_id==null) return; (by[m.matchup_id]=by[m.matchup_id]||[]).push(m); });
  return Object.keys(by).filter(function(k){return by[k].length===2;}).map(function(k){
    var a=detail(by[k][0]), b=detail(by[k][1]); if(b.points>a.points){var t=a;a=b;b=t;}
    return {id:+k,winner:a,loser:b,margin:a.points-b.points,tie:a.points===b.points};
  }).sort(function(x,y){return x.id-y.id;});
}
function isFinal(w){ return w<S.curWeek || S.seasonOver; }
function season(){
  var rec={}; Object.keys(S.teams).forEach(function(r){ rec[r]={rid:+r,user:S.teams[r].user,w:0,l:0,t:0,pf:0,pa:0,res:[],scores:[]}; });
  var book={high:null,low:null,blow:null,close:null};
  for(var w=1;w<=S.lastFinal;w++){ games(w).forEach(function(g){
    [[g.winner,g.loser],[g.loser,g.winner]].forEach(function(p){ var R=rec[p[0].rid]; if(!R) return; R.pf+=p[0].points; R.pa+=p[1].points; R.scores.push(p[0].points);
      var r=p[0].points>p[1].points?"W":p[0].points<p[1].points?"L":"T"; R[r.toLowerCase()]++; R.res.push(r);
      if(!book.high||p[0].points>book.high.v) book.high={v:p[0].points,u:p[0].user,w:w};
      if(!book.low||p[0].points<book.low.v) book.low={v:p[0].points,u:p[0].user,w:w}; });
    if(!book.blow||g.margin>book.blow.v) book.blow={v:g.margin,g:g,w:w};
    if(!book.close||g.margin<book.close.v) book.close={v:g.margin,g:g,w:w};
  }); }
  var list=Object.keys(rec).map(function(k){ var R=rec[k], n=R.res.length;
    var cur=n?R.res[n-1]:"", c=0; for(var i=n-1;i>=0&&R.res[i]===cur;i--) c++; R.streak=n?cur+c:"—";
    var bw=0,bl=0,rw=0,rl=0; R.res.forEach(function(x){ if(x==="W"){rw++;rl=0;} else if(x==="L"){rl++;rw=0;} else {rw=rl=0;} bw=Math.max(bw,rw); bl=Math.max(bl,rl); });
    R.longW=bw; R.longL=bl; R.ppg=n?R.pf/n:0; return R; });
  list.sort(function(a,b){ return (b.w+b.t/2)-(a.w+a.t/2) || b.pf-a.pf; });
  return {list:list,book:book,rec:rec};
}

/* ---------- prose ---------- */
function headline(gs,w,live){
  if(!gs.length) return "No games on the board";
  var close=gs.reduce(function(a,b){return b.margin<a.margin?b:a;}), blow=gs.reduce(function(a,b){return b.margin>a.margin?b:a;});
  var W=close.winner.user, L=close.loser.user, m=f2(close.margin);
  if(live&&gs.every(function(g){return g.winner.points===0;})) return "Week "+w+" preview: lineups are in, kickoff pending";
  if(live){ var lead=gs.reduce(function(a,b){return b.winner.points>a.winner.points?b:a;}).winner; return "Week "+w+" in progress: "+lead.user+" sets the early pace with "+lead.points.toFixed(2); }
  if(close.margin<2) return pick([W+" escapes "+L+" by "+m+"; somebody check the bench",
     L+" falls "+m+" short of "+W+" in Week "+w+" heartbreaker", W+" holds off "+L+", "+close.winner.points.toFixed(2)+" to "+close.loser.points.toFixed(2)],w);
  if(blow.margin>70) return blow.winner.user+" flattens "+blow.loser.user+" by "+f2(blow.margin);
  return W+" edges "+L+" by "+m+" in the week's tightest finish";
}
function topS(t,n){ return t.starters.filter(function(s){return !s.empty;}).slice().sort(function(a,b){return b.pts-a.pts;}).slice(0,n); }
function gameStory(g,w,live){
  var W=g.winner,L=g.loser, tw=topS(W,2), tl=topS(L,1), out=[];
  if(live&&W.points===0&&L.points===0) return [W.user+" vs "+L.user+": no points on the board yet. Check back after kickoff."];
  var verb=live?(g.margin<10?"leads":"is up on"):(g.tie?"ties":g.margin<3?"squeaks past":g.margin<15?"beats":g.margin<50?"handles":"buries");
  out.push(W.user+" "+verb+" "+L.user+" "+W.points.toFixed(2)+" to "+L.points.toFixed(2)+(live?" so far":"")+". "+
    (tw.length?shortN(tw[0].name)+" ("+tw[0].pts+")"+(tw[1]?" and "+shortN(tw[1].name)+" ("+tw[1].pts+")":"")+" did the heavy lifting":"")+
    (tl.length?"; "+shortN(tl[0].name)+" ("+tl[0].pts+") was "+L.user+"'s best"+(live?" so far":"")+".":"."));
  [W,L].forEach(function(T){ var b=T.blunders[0];
    if(b&&b.lost>=8) out.push(T.user+" left "+shortN(b.bench.name)+" ("+b.bench.pts+") on the bench to start "+shortN(b.over.name)+" ("+b.over.pts+")"+(T===L&&!live&&b.lost>g.margin?", and that swap alone would have flipped the result.":", a "+f2(b.lost)+"-point lineup tax."));
    var z=T.starters.filter(function(s){return s.empty||s.pts===0;});
    if(z.length&&!live) out.push(T.user+" started "+z.map(function(s){return s.empty?"an empty slot":shortN(s.name);}).join(" and ")+" for zero. The chug rule thanks you for your service.");
  });
  var u=(g.margin<5?L:W).user, seed=w+g.id;
  if(!live&&LORE[u]){ var lore={
    MasterRhino7683: L.user==="MasterRhino7683"&&L.blunders.length?"Classic Thursday lineup: set it, forget it, regret it.":"The Thursday-only lineup method lives another week.",
    MrSend: "Look for MrSend to tie this one back to the 2022 trade somehow.",
    luketu: W.user==="luketu"?"luketu is already talking playoffs. History would like a word.":"luketu still sounds like a contender. The standings may disagree.",
    YanDiazz: W.user==="YanDiazz"?"YanDiazz will now remind you, again, that he has a title.":"Even a former champion has to set a lineup.",
    DWormie: "Expect a wildly lopsided trade offer from DWormie by Tuesday.",
    bdavis4208: "Kicker-first draft strategy: still undefeated in bdavis4208's heart.",
    Bigbertha15: "The fifth-round Pitts pick continues to echo.",
    tthink3r: "One-team draft strategy: high variance, as advertised."}[u]; if(lore&&pick([1,0,1],seed)) out.push(lore); }
  return out;
}

/* ---------- render ---------- */
function boxTable(T){
  var h='<table><tr><th class="l">Slot</th><th class="l">Player</th><th class="l">Pos</th><th>Pts</th></tr>';
  T.starters.forEach(function(s){ h+='<tr class="'+(s.pts===0?"zero":"")+'"><td class="l">'+esc(s.slot)+'</td><td class="l">'+esc(s.name)+(s.team?' <span class="small">'+esc(s.team)+'</span>':"")+'</td><td class="l">'+esc(s.pos)+'</td><td>'+(+s.pts).toFixed(2)+'</td></tr>'; });
  h+='<tr class="sep"><td class="l" colspan="3">Bench</td><td>'+f2(T.benchPts)+'</td></tr>';
  T.bench.forEach(function(s){ h+='<tr class="bench"><td class="l">BN</td><td class="l">'+esc(s.name)+(s.team?' <span class="small">'+esc(s.team)+'</span>':"")+'</td><td class="l">'+esc(s.pos)+'</td><td>'+(+s.pts).toFixed(2)+'</td></tr>'; });
  return h+'</table>';
}
function render(w){
  var live=!isFinal(w), gs=games(w), se=season(), H="";
  var teams=[]; gs.forEach(function(g){teams.push(g.winner,g.loser);});
  document.getElementById("dateline").textContent=S.league.name+" · "+S.league.season+" season · Week "+w+(live?" · scores in progress":" · final");
  H+='<section id="front"><p class="small">Week '+w+' '+(live?'<span class="live">Live</span> Scores update as Sleeper reports them; hit Refresh.':'final')+'</p>';
  if(!gs.length){ document.getElementById("paper").innerHTML=H+'<h2>No matchups posted for Week '+w+' yet</h2></section>'; return; }
  H+='<h2>'+esc(headline(gs,w,live))+'</h2>';
  var close=gs.reduce(function(a,b){return b.margin<a.margin?b:a;});
  H+='<div class="cols">'+gameStory(close,w,live).map(function(p){return "<p>"+esc(p)+"</p>";}).join("")+'</div>';
  var zeros=[]; teams.forEach(function(T){ T.starters.forEach(function(s){ if(s.empty||(!live&&s.pts===0)) zeros.push(T.user+" ("+(s.empty?"empty "+s.slot+" slot":s.name)+")"); }); });
  if(zeros.length) H+='<div class="box chug"><b>Chug rule '+(live?"watch":"invoked")+'.</b> '+(live?"Empty starting slots right now (zero-point starters are ruled on once the week is final): ":"Started a zero or left a slot empty: ")+esc(zeros.join("; "))+'.</div>';
  H+='</section><section id="box"><h3>Box scores</h3>';
  gs.forEach(function(g){ H+='<h4 style="margin:14px 0 2px">'+esc(g.winner.user)+' '+g.winner.points.toFixed(2)+', '+esc(g.loser.user)+' '+g.loser.points.toFixed(2)+' <span class="small">margin '+f2(g.margin)+'</span></h4>';
    H+='<div>'+gameStory(g,w,live).map(function(p){return "<p>"+esc(p)+"</p>";}).join("")+'</div><div class="game">';
    [g.winner,g.loser].forEach(function(T){ H+='<div class="team"><h5><span>'+esc(T.user)+'</span><span>'+T.points.toFixed(2)+'</span></h5><div class="scroll">'+boxTable(T)+'</div></div>'; });
    H+='</div>'; });
  H+='</section><section id="standings"><h3>Standings &amp; power rankings</h3><p class="small">Through Week '+S.lastFinal+' (completed weeks only). Ranked by record, then points for.</p><div class="scroll"><table><tr><th>#</th><th class="l">Manager</th><th>W-L-T</th><th>PF</th><th>PA</th><th>PPG</th><th>Streak</th><th>Wk '+w+'</th></tr>';
  se.list.forEach(function(R,i){ var cur=teams.filter(function(t){return t.rid===R.rid;})[0];
    H+='<tr><td>'+(i+1)+'</td><td class="l">'+esc(R.user)+'</td><td>'+R.w+'-'+R.l+'-'+R.t+'</td><td>'+f2(R.pf)+'</td><td>'+f2(R.pa)+'</td><td>'+f2(R.ppg)+'</td><td>'+R.streak+'</td><td>'+(cur?cur.points.toFixed(2):"—")+'</td></tr>'; });
  H+='</table></div></section>';
  var hi=teams.reduce(function(a,b){return b.points>a.points?b:a;}), lo=teams.reduce(function(a,b){return b.points<a.points?b:a;}), blow=gs.reduce(function(a,b){return b.margin>a.margin?b:a;});
  var bl=null; teams.forEach(function(T){ if(T.blunders[0]&&(!bl||T.blunders[0].lost>bl.b.lost)) bl={T:T,b:T.blunders[0]}; });
  var benchKing=teams.reduce(function(a,b){return b.benchPts>a.benchPts?b:a;});
  H+='<section id="awards"><h3>Weekly awards'+(live?" (provisional)":"")+'</h3><ul>';
  H+='<li><b>High score:</b> '+esc(hi.user)+', '+hi.points.toFixed(2)+'</li><li><b>Low score:</b> '+esc(lo.user)+', '+lo.points.toFixed(2)+'</li>';
  H+='<li><b>Biggest blowout:</b> '+esc(blow.winner.user)+' over '+esc(blow.loser.user)+' by '+f2(blow.margin)+'</li>';
  if(bl) H+='<li><b>Bench blunder:</b> '+esc(bl.T.user)+' started '+esc(bl.b.over.name)+' ('+bl.b.over.pts+') over '+esc(bl.b.bench.name)+' ('+bl.b.bench.pts+'), leaving '+f2(bl.b.lost)+' points on the bench</li>';
  H+='<li><b>Most points on the bench:</b> '+esc(benchKing.user)+', '+f2(benchKing.benchPts)+'</li>';
  var nick=[]; if(!live) gs.forEach(function(g){ if(g.tie) return; var L=g.loser, all=L.starters.filter(function(s){return !s.empty;}).concat(L.bench); if(!all.length) return;
    var best=all.reduce(function(a,b){return b.pts>a.pts?b:a;}); if(L.bench.some(function(b){return b.id===best.id;}) && !L.starters.some(function(s){return s.pts>=best.pts&&!s.empty;})) nick.push({L:L,best:best,m:g.margin}); });
  if(nick.length) nick.forEach(function(n){ H+='<li><b>The Nick Memorial:</b> '+esc(n.L.user)+' benched the roster\'s top scorer, '+esc(n.best.name)+' ('+n.best.pts+'), and lost by '+f2(n.m)+'. Nick would be proud; Nick would have done the same.</li>'; });
  else if(!live) H+='<li><b>The Nick Memorial:</b> Not awarded. Every loser at least started their best scorer. Nick remains unimpressed.</li>';
  H+='</ul></section>';
  var busts=[]; teams.forEach(function(T){ T.starters.forEach(function(s){ busts.push({T:T,s:s}); }); });
  busts.sort(function(a,b){return a.s.pts-b.s.pts;}); busts=busts.filter(function(b,i){return i<8||b.s.pts<=0;});
  var epit=["Gone too soon.","Survived by a disappointed manager.","In lieu of flowers, check the bench.","Rest in points.","Started, and regretted.","Never forget, never start again."];
  H+='<section id="obits"><h3>Obituaries</h3><ul>'+busts.map(function(b,i){ return '<li><b>'+esc(b.s.empty?"Empty "+b.s.slot+" slot":b.s.name)+'</b> ('+esc(b.T.user)+'), '+(+b.s.pts).toFixed(2)+'. '+(b.s.pts<0?"Negative points. Remarkable.":b.s.pts===0?"A zero. Chug.":epit[i%epit.length])+'</li>'; }).join("")+'</ul></section>';
  H+='<section id="wire"><h3>Wire report</h3><ul id="wirelist"><li class="small">Loading transactions…</li></ul></section>';
  var b=se.book;
  H+='<section id="records"><h3>Season record book</h3><p class="small">Weeks 1–'+S.lastFinal+', completed games only.</p><ul>';
  if(b.high) H+='<li><b>Highest score:</b> '+esc(b.high.u)+', '+f2(b.high.v)+' (Week '+b.high.w+')</li><li><b>Lowest score:</b> '+esc(b.low.u)+', '+f2(b.low.v)+' (Week '+b.low.w+')</li>'+
    '<li><b>Biggest blowout:</b> '+esc(b.blow.g.winner.user)+' over '+esc(b.blow.g.loser.user)+' by '+f2(b.blow.v)+' (Week '+b.blow.w+')</li><li><b>Closest game:</b> '+esc(b.close.g.winner.user)+' over '+esc(b.close.g.loser.user)+' by '+f2(b.close.v)+' (Week '+b.close.w+')</li>';
  var mx=function(k){return se.list.reduce(function(a,c){return c[k]>a[k]?c:a;});};
  if(se.list.length){ var pf=mx("pf"), pa=mx("pa"), lw=mx("longW"), ll=mx("longL");
    H+='<li><b>Most points for:</b> '+esc(pf.user)+', '+f2(pf.pf)+'</li><li><b>Most points against:</b> '+esc(pa.user)+', '+f2(pa.pa)+'</li><li><b>Longest win streak:</b> '+esc(lw.user)+', '+lw.longW+'</li><li><b>Longest losing streak:</b> '+esc(ll.user)+', '+ll.longL+'</li>'; }
  H+='</ul></section><section id="slate"></section>';
  document.getElementById("paper").innerHTML=H;
  wire(w); slate(w+1,se);
}
function wire(w){
  get("/league/"+LID+"/transactions/"+w).then(function(tx){
    tx=tx.filter(function(t){return t.status==="complete";}); var el=document.getElementById("wirelist"); if(!el) return;
    if(!tx.length){ el.innerHTML="<li>A quiet week on the wire.</li>"; return; }
    el.innerHTML=tx.map(function(t){ var by=(t.roster_ids||[]).map(function(r){return teamOf(r).user;});
      var adds=Object.keys(t.adds||{}), drops=Object.keys(t.drops||{});
      if(t.type==="trade") return '<li><b>Trade</b>: '+by.map(function(u,i){ var rid=t.roster_ids[i]; var got=adds.filter(function(p){return t.adds[p]===rid;}).map(function(p){return pl(p).name;});
        (t.draft_picks||[]).forEach(function(d){ if(d.owner_id===rid) got.push(d.season+" round "+d.round+" pick"); });
        return esc(u)+" gets "+esc(got.join(", ")||"nothing"); }).join("; ")+(by.indexOf("DWormie")>=0?". DWormie involved; officials are reviewing the tape.":"")+'</li>';
      var bid=(t.settings||{}).waiver_bid;
      return '<li><b>'+esc(by.join(", "))+'</b> ('+esc(t.type.replace("_"," "))+(bid!=null?", $"+bid:"")+'): '+(adds.length?"added "+esc(adds.map(function(p){return pl(p).name;}).join(", ")):"")+(adds.length&&drops.length?"; ":"")+(drops.length?"dropped "+esc(drops.map(function(p){return pl(p).name;}).join(", ")):"")+'</li>'; }).join("");
  }).catch(function(){ var el=document.getElementById("wirelist"); if(el) el.innerHTML='<li class="err">Could not load transactions from Sleeper.</li>'; });
}
function slate(n,se){
  var el=document.getElementById("slate"); if(n>S.maxWeek) return;
  get("/league/"+LID+"/matchups/"+n).then(function(ms){
    var by={}; ms.forEach(function(m){ if(m.matchup_id!=null) (by[m.matchup_id]=by[m.matchup_id]||[]).push(m.roster_id); });
    var rows=Object.keys(by).filter(function(k){return by[k].length===2;}).map(function(k){ var a=se.rec[by[k][0]], b=se.rec[by[k][1]];
      var d=a.ppg-b.ppg, fav=d>=0?a:b, dog=d>=0?b:a, line=Math.round(Math.abs(d)*2)/2;
      return '<tr><td class="l">'+esc(a.user)+' ('+a.w+'-'+a.l+(a.t?"-"+a.t:"")+')</td><td class="l">'+esc(b.user)+' ('+b.w+'-'+b.l+(b.t?"-"+b.t:"")+')</td><td>'+(line===0?"Pick 'em":esc(fav.user)+" −"+line.toFixed(1))+'</td><td>'+f2(a.ppg+b.ppg)+'</td></tr>'; });
    if(!rows.length) return;
    el.innerHTML='<h3>Week '+n+' slate</h3><div class="scroll"><table><tr><th class="l">Home</th><th class="l">Away</th><th>House line</th><th>Total</th></tr>'+rows.join("")+'</table></div><p class="small">House lines are season-average lines: the gap in each team\'s points per game through Week '+S.lastFinal+', rounded to the half point. Total is the two averages added. Just for fun; not official odds and not Sleeper projections.</p>';
  }).catch(function(){});
}
function load(w){ document.getElementById("paper").innerHTML='<p class="loading">Setting type for Week '+w+'…</p>';
  var need=[]; for(var i=1;i<=Math.max(w,S.lastFinal);i++) need.push(i);
  Promise.all(need.map(function(i){ return get("/league/"+LID+"/matchups/"+i).then(function(m){S.mw[i]=m;}); })).then(function(){ render(w); })
    .catch(function(e){ document.getElementById("paper").innerHTML='<p class="err">Could not reach Sleeper ('+esc(e.message)+'). Try Refresh.</p>'; });
  try{ history.replaceState(null,"","#week-"+w); }catch(e){}
}
function init(){
  Promise.all([get("/state/nfl"),get("/league/"+LID),get("/league/"+LID+"/users"),get("/league/"+LID+"/rosters")]).then(function(r){
    var st=r[0], lg=r[1], users={}; r[2].forEach(function(u){users[u.user_id]=u;});
    S.league=lg; S.mw={}; S.teams={}; r[3].forEach(function(ro){ var u=users[ro.owner_id]||{}; S.teams[ro.roster_id]={user:u.display_name||("Team "+ro.roster_id)}; });
    S.slots=(lg.roster_positions||[]).filter(function(p){return p!=="BN"&&p!=="IR"&&p!=="TAXI";}).map(function(p){return p==="SUPER_FLEX"?"SF":p;});
    var lastReg=((lg.settings||{}).playoff_week_start||15)-1; S.maxWeek=17;
    S.seasonOver=(lg.status==="complete")||(String(st.season)!==String(lg.season)&&st.season>lg.season);
    var cur=S.seasonOver?S.maxWeek:Math.max(1,Math.min(S.maxWeek,(st.season_type==="regular"||st.season_type==="post")?(st.display_week||st.week):1));
    S.curWeek=cur; S.lastFinal=S.seasonOver?S.maxWeek:Math.max(0,cur-1); S.lastReg=lastReg;
    var sel=document.getElementById("week"); sel.innerHTML="";
    for(var i=cur;i>=1;i--){ var o=document.createElement("option"); o.value=i; o.textContent="Week "+i+(i===cur&&!S.seasonOver?" (live)":"")+(i>lastReg?" · playoffs":""); sel.appendChild(o); }
    var hw=+((location.hash.match(/week-(\d+)/)||[])[1]||0); var w=(hw>=1&&hw<=cur)?hw:cur; sel.value=w;
    sel.onchange=function(){ load(+sel.value); };
    document.getElementById("refresh").onclick=function(){ var v=+sel.value; for(var k in cache) if(k.indexOf("/matchups/")>=0||k.indexOf("/transactions/")>=0) delete cache[k]; load(v); };
    load(w);
    setInterval(function(){ if(+sel.value===S.curWeek&&!S.seasonOver&&document.visibilityState==="visible") document.getElementById("refresh").click(); },120000);
  }).catch(function(e){ document.getElementById("paper").innerHTML='<p class="err">Could not reach Sleeper ('+esc(e.message)+'). Check your connection and reload.</p>'; });
}
if(typeof window!=="undefined"&&window.document&&!window.__TEST__) init();
if(typeof module!=="undefined") module.exports={_S:S,_games:games,_season:season,_render:render,_init:init};
})();
