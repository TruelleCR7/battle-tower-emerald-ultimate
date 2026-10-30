import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TowerEngine,validateTeam,statsFor,effectiveness,soundproofBlocks,multiHitCount} from '../web/engine.mjs';
const D=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
const fresh=(s)=>JSON.parse(JSON.stringify(D.sets[s]));
const config=(mode,team)=>({mode,team:team.map(fresh),levelMode:'50',seed:123456});
test('data: 386 espèces et séparation Gen IV',()=>{
 assert.equal(Object.keys(D.sets).length,386);
 assert.equal(D.moveData.SHADOW_BALL.category,'special');
 assert.equal(D.moveData.DRAGON_CLAW.category,'physical');
 assert.equal(D.moveData.ICE_PUNCH.category,'physical');
 assert.equal(D.moveData.THUNDERBOLT.category,'special');
 assert.equal(D.moveData.SLUDGE_BOMB.category,'special');
});
test('validateur de règles',()=>{
 const good=['METAGROSS','SWAMPERT','LATIOS'].map(fresh);
 assert.deepEqual(validateTeam(good,'single','50',D),[]);
 let bad=JSON.parse(JSON.stringify(good));bad[1].species='METAGROSS';assert.ok(validateTeam(bad,'single','50',D).some(x=>x.includes('double')));
 bad=JSON.parse(JSON.stringify(good));bad[1].item=bad[0].item;assert.ok(validateTeam(bad,'single','50',D).some(x=>x.includes('Objets')));
 bad=JSON.parse(JSON.stringify(good));bad[1].evs=[252,252,252,0,0,0];assert.ok(validateTeam(bad,'single','50',D).some(x=>x.includes('EV')));
 bad=JSON.parse(JSON.stringify(good));bad[1].level=52;assert.ok(validateTeam(bad,'single','50',D).some(x=>x.includes('niveau')));
});
test('calcul de statistiques: nature Modeste réduit attaque',()=>{
 const st=fresh('LATIOS');let timid={...st,nature:'TIMID'},mod={...st,nature:'MODEST'};
 assert.ok(statsFor(mod,D).spa>statsFor(timid,D).spa);
 assert.ok(statsFor(mod,D).atk===statsFor(timid,D).atk);
});
test('immunités Pokémon Gen III',()=>{
 const a={species:'FLYGON',ability:'LEVITATE'},b={species:'METAGROSS',ability:'CLEAR_BODY'};
 assert.equal(effectiveness('GROUND',a,D),0);
 assert.equal(effectiveness('GROUND',b,D),2);
 assert.equal(effectiveness('NORMAL',{species:'GENGAR',ability:'LEVITATE'},D),0);
});
test('mode Solo : tour jouable contre IA',()=>{
 const e=new TowerEngine(D,config('single',['METAGROSS','SWAMPERT','LATIOS']));
 assert.equal(e.active('player').length,1);
 let act=e.aiAction(e.active('player')[0]);let r=e.turnActions([act]);assert.equal(r.turn,1);assert.ok(r.player.party[0].hp>=0);
});
test('mode Duo : deux décisions par tour',()=>{
 const e=new TowerEngine(D,config('double',['SALAMENCE','METAGROSS','STARMIE','SNORLAX']));
 assert.equal(e.active('player').length,2);
 assert.throws(()=>e.turnActions([e.aiAction(e.active('player')[0])]),/chaque Pokémon/);
 const r=e.turnActions(e.active('player').map(m=>e.aiAction(m)));assert.equal(r.turn,1);
});
test('Multi IA : partenaire autonome + adversaires',()=>{
 const e=new TowerEngine(D,config('multi',['METAGROSS','LATIOS']));
 assert.equal(e.player.party.length,4);
 assert.equal(e.required().length,1);
 assert.equal(e.player.party[2].owner,'partner');
 const r=e.turnActions([e.aiAction(e.active('player')[0])]);assert.equal(r.turn,1);
});
test('Multi local : deux contrôles humains distincts',()=>{
 const c=config('link',['METAGROSS','LATIOS']);c.partner=[fresh('MILOTIC'),fresh('SALAMENCE')];
 const e=new TowerEngine(D,c);assert.equal(e.required().length,2);
 const r=e.turnActions(e.active('player').map(m=>e.aiAction(m)));assert.equal(r.turn,1);
});
test('dégâts du split : Ball’Ombre spéciale exploitant l’attaque spéciale',()=>{
 const e=new TowerEngine(D,config('single',['GENGAR','SNORLAX','MILOTIC']));
 const g=e.player.party[0],target=e.opponent.party[0];const base=e.damagePreview(g,target,D.moveData.SHADOW_BALL).damage;
 g.stats.spa*=3;const buffed=e.damagePreview(g,target,D.moveData.SHADOW_BALL).damage;assert.ok(buffed>base);
});
test('simulation en chaîne sans crash sur 50 tours',()=>{
 for(const mode of ['single','double','multi','link']){
  const arr=mode==='double'?['METAGROSS','SALAMENCE','SWAMPERT','GENGAR']:mode==='single'?['METAGROSS','SWAMPERT','LATIOS']:['METAGROSS','LATIOS'];
  const c=config(mode,arr);if(mode==='link')c.partner=[fresh('SNORLAX'),fresh('MILOTIC')];
  const e=new TowerEngine(D,c);
  for(let i=0;i<50&&e.status==='active';i++){
   while(e.pendingReplacements?.length&&e.status==='active'){const r=e.pendingReplacements[0];e.replaceFainted(r.fainted,e.bench(r.side,r.owner)[0].id);}
   if(e.status!=='active')break;
   const acts=e.active('player').filter(m=>m.owner==='human'||m.owner==='human2').map(m=>e.aiAction(m));
   e.turnActions(acts);
  }
  assert.ok(['active','won','lost'].includes(e.status),mode);
 }
});

test('le journal indique le split sélectionné',()=>{
 const base=config('single',['METAGROSS','SWAMPERT','LATIOS']);
 const classic=new TowerEngine(D,{...base,splitMode:'type'});
 const modern=new TowerEngine(D,{...base,splitMode:'move'});
 assert.ok(classic.log.some(e=>e.text.includes('selon le type')));
 assert.ok(modern.log.some(e=>e.text.includes('selon chaque capacité')));
});
test('une attaque visant un ennemi ne peut pas cibler un allié en Duo',()=>{
 const e=new TowerEngine(D,config('double',['METAGROSS','SALAMENCE','SWAMPERT','GENGAR']));
 const [a,b]=e.active('player');
 const attacking=a.moves.find(k=>D.moveData[k].target==='enemy'&&D.moveData[k].power>0);
 assert.ok(attacking,'une attaque ciblée doit être disponible');
 const other=b.moves.find(k=>D.moveData[k].target==='enemy'&&D.moveData[k].power>0);
 assert.ok(other);
 assert.throws(()=>e.turnActions([{actor:a.id,type:'move',move:attacking,target:b.id},{actor:b.id,type:'move',move:other,target:a.id}]),/adversaire actif/);
 assert.equal(e.turn,0,'rejet avant toute mutation du tour');
});

test('Clonage coûte des PV et émet un événement rejouable',()=>{
 const e=new TowerEngine(D,config('single',['METAGROSS','SWAMPERT','LATIOS']));
 const m=e.player.party[0],before=m.hp;
 e.selfMove(m,{effect:'substitute',name:'Clonage'});
 const cost=Math.floor(m.maxHp/4);
 assert.equal(m.hp,before-cost);
 assert.equal(m.substitute,cost);
 assert.ok(e.log.some(x=>x.kind==='damage'&&x.actor===m.id&&x.amount===cost));
 assert.ok(e.log.some(x=>x.kind==='substitute-create'&&x.actor===m.id));
});
test('Clonage échoue sans consommer des PV si son coût ferait tomber à zéro',()=>{
 const e=new TowerEngine(D,config('single',['METAGROSS','SWAMPERT','LATIOS']));
 const m=e.player.party[0];m.hp=Math.floor(m.maxHp/4);
 e.selfMove(m,{effect:'substitute',name:'Clonage'});
 assert.equal(m.substitute,0);
 assert.equal(m.hp,Math.floor(m.maxHp/4));
});

test('Combat inversé XY : affinités simples et immunités de type',()=>{
 const rock={species:'TYRANITAR',ability:'SAND_STREAM'};
 const ghost={species:'GENGAR',ability:'CURSED_BODY'};
 assert.equal(effectiveness('FIGHTING',rock,D,false),4);
 assert.equal(effectiveness('FIGHTING',rock,D,true),.25);
 assert.equal(effectiveness('NORMAL',ghost,D,false),0);
 assert.equal(effectiveness('NORMAL',ghost,D,true),2);
 assert.equal(effectiveness('GROUND',{species:'FLYGON',ability:'LEVITATE'},D,true),0);
 assert.equal(effectiveness('FIRE',{species:'SWAMPERT',ability:'TORRENT'},D,true),2);
});
test('Combat inversé : dégâts réels et mode indépendant du split',()=>{
 const setup=config('single',['METAGROSS','SWAMPERT','LATIOS']);
 const normal=new TowerEngine(D,{...setup,inverseBattle:false});
 const inverse=new TowerEngine(D,{...setup,inverseBattle:true,splitMode:'type'});
 const target=normal.player.party[0],attacker=normal.opponent.party[0];
 assert.equal(normal.inverseBattle,false);assert.equal(inverse.inverseBattle,true);
 assert.equal(inverse.splitMode,'type');
 assert.equal(inverse.originalConfig.inverseBattle,true);
 assert.equal(inverse.snapshot().inverseBattle,true);
 const move=D.moveData.TACKLE;
 const base=normal.damagePreview(attacker,target,move);
 const reversed=inverse.damagePreview(inverse.opponent.party[0],inverse.player.party[0],move);
 assert.ok(base.mult!==reversed.mult||base.mult===1);
});

test('Anti-Bruit bloque les attaques sonores, pas les autres attaques',()=>{
 const actor={id:'a',ability:'NONE'},defender={id:'b',ability:'SOUNDPROOF'};
 for(const move of ['SING','SUPERSONIC','SCREECH','GROWL','ROAR','HYPER_VOICE','UPROAR','SNORE','METAL_SOUND'])
  assert.equal(soundproofBlocks(move,actor,defender),true,move);
 assert.equal(soundproofBlocks('THUNDERBOLT',actor,defender),false);
 assert.equal(soundproofBlocks('SING',actor,{...defender,ability:'LEVITATE'}),false);
 assert.equal(soundproofBlocks('SING',defender,defender),false);
});
test('Anti-Bruit empêche une attaque sonore réelle sans dépenser de PV',()=>{
 const e=new TowerEngine(D,config('single',['METAGROSS','SWAMPERT','LATIOS']));
 const a=e.active('player')[0],b=e.active('opponent')[0];
 b.ability='SOUNDPROOF';a.moves=['HYPER_VOICE'];a.pp.HYPER_VOICE=5;
 const before=b.hp;
 e.execute(a,{actor:a.id,type:'move',move:'HYPER_VOICE',target:b.id});
 assert.equal(b.hp,before);
 assert.ok(e.log.some(event=>event.ability==='SOUNDPROOF'));
});

test('coups multiples Gen III : pondération 2/3/4/5 et Multi-Coups',()=>{
 const roll=n=>()=>n/65536;
 assert.equal(multiHitCount('BULLET_SEED',roll(0),'NONE'),2);
 assert.equal(multiHitCount('BULLET_SEED',roll(2),'NONE'),2);
 assert.equal(multiHitCount('BULLET_SEED',roll(3),'NONE'),3);
 assert.equal(multiHitCount('BULLET_SEED',roll(6),'NONE'),4);
 assert.equal(multiHitCount('BULLET_SEED',roll(7),'NONE'),5);
 assert.equal(multiHitCount('BULLET_SEED',roll(0),'SKILL_LINK'),5);
 assert.equal(multiHitCount('DOUBLE_KICK',roll(0),'NONE'),2);
 assert.equal(multiHitCount('TRIPLE_KICK',roll(0),'NONE'),3);
 assert.equal(multiHitCount('THUNDERBOLT',roll(0),'SKILL_LINK'),1);
});
test('une capacité à coups multiples inflige des dégâts coup par coup et annonce le total',()=>{
 const e=new TowerEngine(D,config('single',['METAGROSS','SWAMPERT','LATIOS']));
 const actor=e.active('player')[0],foe=e.active('opponent')[0];
 actor.moves=['BULLET_SEED'];actor.pp.BULLET_SEED=10;actor.ability='SKILL_LINK';
 foe.hp=foe.maxHp;foe.ability='NONE';
 e.execute(actor,{actor:actor.id,type:'move',move:'BULLET_SEED',target:foe.id});
 const amounts=e.log.filter(x=>x.kind==='damage'&&x.actor===foe.id);
 assert.ok(amounts.length>=2,'les coups doivent produire des événements de dégâts distincts');
 assert.ok(e.log.some(x=>x.kind==='multi-hit'&&x.hits>=2));
});

test('Grelot Coque : un seul soin basé sur tous les dégâts des coups multiples',()=>{
 const e=new TowerEngine(D,config('single',['METAGROSS','SWAMPERT','LATIOS']));
 const actor=e.active('player')[0],foe=e.active('opponent')[0];
 actor.moves=['ROCK_BLAST'];actor.pp.ROCK_BLAST=5;actor.ability='SKILL_LINK';actor.item='SHELL_BELL';
 actor.hp=Math.floor(actor.maxHp/2);actor.stats.atk=2200;
 foe.hp=2000;foe.maxHp=2000;foe.stats.def=900;foe.ability='NONE';
 const before=foe.hp,original=actor.hp;
 e.execute(actor,{actor:actor.id,type:'move',move:'ROCK_BLAST',target:foe.id});
 const healEvents=e.log.filter(x=>x.kind==='heal'&&x.actor===actor.id);
 const damage=before-foe.hp;
 assert.ok(damage>=8,'la capacité inflige assez de dégâts pour le soin');
 assert.equal(healEvents.length,1,'Grelot Coque se déclenche une fois par capacité, pas par impact');
 assert.equal(actor.hp-original,Math.floor(damage/8));
});
