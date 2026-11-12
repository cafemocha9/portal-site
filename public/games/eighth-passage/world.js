import * as THREE from './vendor/three.module.js';
const clamp=THREE.MathUtils.clamp;
function canvasTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function tileTexture(floor=false){return canvasTexture(1024,1024,(x,w,h)=>{x.fillStyle=floor?'#686e69':'#b6b8a9';x.fillRect(0,0,w,h);let seed=9382;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;const size=floor?256:128;for(let y=0;y<h;y+=size)for(let i=0;i<w;i+=size){const c=(floor?116:192)+Math.floor(rand()*15);x.fillStyle=floor?`rgb(${c-5},${c},${c-3})`:`rgb(${c+7},${c+7},${c-2})`;x.fillRect(i+2,y+2,size-4,size-4);x.fillStyle=floor?'#a2a89c':'#e2e3d7';x.fillRect(i+3,y+3,size-6,1);x.fillStyle='#11111115';x.fillRect(i+2,y+size-3,size-3,1);}for(let i=0;i<90000;i++){const v=rand()>.5?255:0;x.fillStyle=`rgba(${v},${v},${v},${rand()*(floor?.12:.05)})`;x.fillRect(rand()*w,rand()*h,rand()*2+1,rand()*2+1);}});}
function shadowTexture(){return canvasTexture(128,128,(x)=>{const g=x.createRadialGradient(64,64,2,64,64,60);g.addColorStop(0,'#000000ab');g.addColorStop(.4,'#00000070');g.addColorStop(1,'#00000000');x.fillStyle=g;x.fillRect(0,0,128,128);});}
function signTexture(n,anomaly=false,end=false){return canvasTexture(1024,256,(x,w,h)=>{x.fillStyle='#e6c949';x.fillRect(0,0,w,h);x.fillStyle='#202920';x.fillRect(20,20,210,216);x.fillStyle='#f0d75b';x.font='bold 174px Arial';x.textAlign='center';x.fillText(String(n),125,191);x.textAlign='left';x.fillStyle='#16221a';x.font='bold 66px sans-serif';x.fillText(anomaly?'出口はない':end?'地上出口':'地下連絡通路',273,110);x.font='28px Arial';x.fillText(anomaly?'THERE IS NO EXIT':end?'EXIT TO STREET':'UNDERGROUND PASSAGE',278,163);x.font='18px sans-serif';x.fillText('異変があれば引き返してください',279,215);x.lineWidth=14;x.strokeStyle='#16221a';x.beginPath();x.moveTo(905,175);x.lineTo(905,72);x.moveTo(867,107);x.lineTo(905,69);x.lineTo(943,107);x.stroke();});}
function posterTexture(i){return canvasTexture(512,720,(x,w,h)=>{const bg=['#174c59','#e3c95b','#dfddd0','#153c32'][i];x.fillStyle=bg;x.fillRect(0,0,w,h);x.fillStyle=i===2?'#143b44':'#f0eee0';x.font='bold 17px sans-serif';x.fillText('八代地下鉄  /  YASHIRO METRO',35,43);if(i===0){x.font='bold 75px sans-serif';x.fillText('海の、',38,153);x.fillText('その先へ。',38,240);x.fillStyle='#719797';x.beginPath();x.moveTo(0,500);x.bezierCurveTo(180,400,290,550,512,420);x.lineTo(512,640);x.lineTo(0,640);x.fill();x.fillStyle='#a6bbad';x.beginPath();x.moveTo(0,568);x.bezierCurveTo(180,450,330,650,512,492);x.lineTo(512,640);x.lineTo(0,640);x.fill();x.fillStyle='#ecebda';x.beginPath();x.arc(385,332,61,0,Math.PI*2);x.fill();x.font='19px sans-serif';x.fillText('次の休日は、遠くへ。',38,294);}else if(i===1){x.fillStyle='#29342a';x.font='bold 87px Arial';x.fillText('PAUSE',32,179);x.font='bold 30px sans-serif';x.fillText('ひと息、つきませんか。',35,233);x.strokeStyle='#29342a';x.lineWidth=9;x.strokeRect(133,340,204,180);x.beginPath();x.arc(347,400,48,-Math.PI/2,Math.PI/2);x.stroke();x.fillStyle='#29342a';x.fillRect(107,548,263,10);x.font='22px sans-serif';x.fillText('COFFEE STAND   B1F',36,637);}else if(i===2){x.fillStyle='#253a38';x.font='bold 79px sans-serif';x.fillText('まもろう。',30,160);x.fillText('通路の',30,257);x.fillText('マナー。',30,354);x.fillStyle='#bc4c36';x.fillRect(36,411,439,8);x.font='24px sans-serif';['通路では走らない','不審物に触れない','忘れ物にご注意ください'].forEach((s,j)=>x.fillText(s,36,478+j*48));}else{x.font='bold 68px sans-serif';x.fillText('夜の植物園',34,157);x.strokeStyle='#7d9a6e';x.lineWidth=5;for(let a=0;a<7;a++){x.beginPath();x.moveTo(256,580);x.quadraticCurveTo(100+a*45,380,50+a*67,280+a%2*90);x.stroke();}x.font='25px Arial';x.fillText('BOTANICAL NIGHT',37,640);}x.fillStyle=i===1||i===2?'#263b31':'#dddcca';x.fillRect(35,679,140,2);x.font='12px Arial';x.fillText('YASHIRO CITY   •   INFORMATION 2026',35,704);});}
function doorLabel(i){return canvasTexture(256,96,(x,w,h)=>{x.fillStyle='#d0d6c8';x.fillRect(0,0,w,h);x.fillStyle='#29372e';x.font='bold 30px sans-serif';x.textAlign='center';x.fillText(i===0?'管理室':'電気室',128,42);x.font='14px Arial';x.fillText(i===0?'STAFF ONLY':'AUTHORIZED PERSONNEL',128,75);});}
const boxGeo=new THREE.BoxGeometry(1,1,1);const sphereGeo=new THREE.SphereGeometry(1,16,12);
function mat(c,r=.75){return new THREE.MeshStandardMaterial({color:c,roughness:r});}
export class Passage {
 constructor(canvas){
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.setupWorld();window.addEventListener('resize',()=>this.resize());
 }
 setupWorld(){
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#263029');this.scene.fog=new THREE.FogExp2('#263029',.032);this.camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.06,100);this.camera.rotation.order='YXZ';this.camera.position.set(-.7,1.65,1.6);
  this.static=new THREE.Group();this.dynamic=new THREE.Group();this.scene.add(this.static,this.dynamic);this.lights=[];this.posters=[];this.doors=[];this.tactile=[];this.lightPanels=[];this.signs=[];this.eyeObjects=[];this.current=null;
  this.materials={metal:mat('#646f66',.4),black:mat('#222824'),ceiling:mat('#969e91'),trim:mat('#465249'),yellow:mat('#d0ae38'),door:mat('#899c8a',.6),redDoor:mat('#81251f',.7)};
  this.wallTex=tileTexture();this.wallTex.wrapS=this.wallTex.wrapT=THREE.RepeatWrapping;this.wallTex.repeat.set(10.5,1);this.wallTex.anisotropy=8;
  this.floorTex=tileTexture(true);this.floorTex.wrapS=this.floorTex.wrapT=THREE.RepeatWrapping;this.floorTex.repeat.set(2,17);this.floorTex.anisotropy=8;
  this.wallMat=new THREE.MeshStandardMaterial({map:this.wallTex,roughness:.63});this.floorMat=new THREE.MeshStandardMaterial({map:this.floorTex,roughness:.74});this.shadowMap=shadowTexture();
  this.build();this.man=this.createMan();this.dynamic.add(this.man.group);this.twin=this.createMan();this.dynamic.add(this.twin.group);this.twinShadow=this.shadow(.8,1);this.dynamic.add(this.twinShadow);this.manShadow=this.shadow(.8,1);this.dynamic.add(this.manShadow);this.extraDoor=this.makeDoor(-19,2);this.extraDoor.visible=false;this.scene.add(this.extraDoor);this.buildAnomalies();this.reset(null,0);
 }
 box(w,h,d,x,y,z,material,parent=this.static){const m=new THREE.Mesh(boxGeo,material);m.scale.set(w,h,d);m.position.set(x,y,z);parent.add(m);return m;}
 sphere(sx,sy,sz,x,y,z,material,parent){const m=new THREE.Mesh(sphereGeo,material);m.scale.set(sx,sy,sz);m.position.set(x,y,z);parent.add(m);return m;}
 shadow(w,h){const m=new THREE.Mesh(new THREE.PlaneGeometry(w*2,h*2),new THREE.MeshBasicMaterial({map:this.shadowMap,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.015;return m;}
 panelTexture(w,h,x,y,z,texture,side=0,parent=this.static){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,roughness:.64,side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=side;parent.add(m);return m;}
 build(){
  const m=this.materials;this.box(5.8,.22,53,0,-.12,-20,this.floorMat);this.box(.2,3.7,53,-2.8,1.85,-20,this.wallMat);this.box(.2,3.7,53,2.8,1.85,-20,this.wallMat);this.box(5.8,.18,53,0,3.62,-20,m.ceiling);
  for(const x of [-2.68,2.68]){this.box(.07,.15,53,x,.08,-20,m.trim);this.box(.09,.11,53,x,3.48,-20,m.trim);this.box(.035,.035,53,x,2.72,-20,m.metal);}
  for(let z=4;z>-46;z-=.5){const tile=new THREE.Group();tile.position.z=z;this.static.add(tile);this.tactile.push(tile);this.box(.55,.026,.48,-.85,.017,0,m.yellow,tile);for(let x=0;x<4;x++)this.box(.037,.014,.39,-1.035+x*.123,.034,0,m.yellow,tile);}
  // Thresholds and cross strips signal the two physical choices.
  for(const z of [3,-42])for(let x=-2.45;x<2.6;x+=.5){this.box(.47,.03,.55,x,.02,z,m.yellow);}
  for(let z=1;z>=-43;z-=6){this.box(5.6,.16,.19,0,3.43,z,m.trim);this.box(.25,3.5,.24,-2.58,1.75,z,m.ceiling);this.box(.25,3.5,.24,2.58,1.75,z,m.ceiling);}
  this.scene.add(new THREE.HemisphereLight('#dfe5d0','#3f483a',2));this.ambient=new THREE.AmbientLight('#aebda8',.5);this.scene.add(this.ambient);
  for(let z=-1;z>=-43;z-=7){this.box(1.45,.1,.46,0,3.45,z,m.metal);const lm=new THREE.MeshStandardMaterial({color:'#e1ead7',emissive:'#e1ead7',emissiveIntensity:2});this.lightPanels.push(this.box(1.32,.045,.32,0,3.382,z,lm));const l=new THREE.PointLight('#e4f3da',18,12,2);l.position.set(0,3.12,z);this.scene.add(l);this.lights.push(l);const pool=this.shadow(2.5,1.8);pool.material.color.set('#bac1b0');pool.material.opacity=.12;pool.position.set(0,.013,z);this.static.add(pool);}
  // Narrow utility piping and ceiling vents give the repeated hall depth.
  for(const x of [1.6,1.77])this.box(.06,.06,52,x,3.4,-20,m.metal);
  for(const z of [-9,-23,-37]){this.box(.65,.025,.6,-1.6,3.5,z,m.black);for(let a=0;a<9;a++)this.box(.59,.04,.021,-1.6,3.472,z-.25+a*.063,m.metal);}
  for(let i=0;i<4;i++){const g=new THREE.Group();g.position.set(-2.675,1.65,-8-i*4.1);this.box(.075,1.82,1.31,0,0,0,m.metal,g);const p=this.panelTexture(1.2,1.69,.045,0,0,posterTexture(i),Math.PI/2,g);g.userData.poster=p;this.static.add(g);g.userData.home=g.position.clone();this.posters.push(g);}
  [-10.7,-28].forEach((z,i)=>{const door=this.makeDoor(z,i);this.static.add(door);this.doors.push(door);});
  // Fire equipment and metal base plates on the right wall.
  this.box(.15,.75,.6,2.61,.68,-18,m.metal);this.box(.035,.58,.46,2.52,.68,-18,mat('#852e21'));this.sphere(.043,.043,.043,2.48,1.14,-18, new THREE.MeshStandardMaterial({color:'#e65737',emissive:'#d02a10',emissiveIntensity:.9}),this.static);
  this.panelTexture(.54,.2,2.49,1.4,-18,canvasTexture(256,96,(x)=>{x.fillStyle='#d5d4c5';x.fillRect(0,0,256,96);x.fillStyle='#882a20';x.font='bold 50px sans-serif';x.textAlign='center';x.fillText('消火栓',128,64);}),-Math.PI/2);
  const notice=canvasTexture(512,560,(x)=>{x.fillStyle='#e5e3cb';x.fillRect(0,0,512,560);x.fillStyle='#30382d';x.font='bold 44px sans-serif';x.fillText('通路のご案内',40,75);x.fillRect(40,100,432,3);x.font='25px sans-serif';['異変を見逃さないこと。','異変があれば引き返すこと。','異変がなければ進むこと。','出口は、八つ目の先。'].forEach((s,i)=>x.fillText(s,40,174+i*77));x.font='17px sans-serif';x.fillText('八代地下鉄　施設管理課',40,514);});this.panelTexture(1.02,1.13,2.674,1.75,-4.1,notice,-Math.PI/2);
  for(const z of [-4,-35]){this.box(3.1,.85,.12,0,2.86,z,m.black);this.box(.04,.37,.04,-1,3.45,z,m.metal);this.box(.04,.37,.04,1,3.45,z,m.metal);this.signs.push(this.panelTexture(2.99,.75,0,2.86,z+.068,signTexture(0)));this.signs.push(this.panelTexture(2.99,.75,0,2.86,z-.068,signTexture(0),Math.PI));}
  // End bays turn away into darkness; walking past each threshold commits the decision.
  for(const z of [-46,6]){this.box(5.6,3.6,.2,0,1.8,z,this.wallMat);this.box(1.8,3.45,.14,1.8,1.74,z+(z<0?.15:-.15),m.black);this.box(.08,3.4,.1,.87,1.7,z+(z<0?.2:-.2),m.trim);}
  const ahead=this.panelTexture(2.1,.4,0,1.8,-45.86,canvasTexture(768,160,(x)=>{x.fillStyle='#b9c4b1';x.fillRect(0,0,768,160);x.fillStyle='#1c3125';x.font='bold 55px sans-serif';x.textAlign='center';x.fillText('この先　出口方面',384,101);}));
  const back=this.panelTexture(2.1,.4,0,1.8,5.85,canvasTexture(768,160,(x)=>{x.fillStyle='#b9c4b1';x.fillRect(0,0,768,160);x.fillStyle='#1c3125';x.font='bold 55px sans-serif';x.textAlign='center';x.fillText('引き返す',384,101);}),Math.PI);
 }
 makeDoor(z,i){const g=new THREE.Group();g.position.set(2.665,0,z);const m=this.materials;this.box(.1,2.49,1.29,0,1.245,0,m.trim,g);const face=this.box(.07,2.36,1.15,-.07,1.19,0,m.door,g);g.userData.face=face;this.panelTexture(.5,.19,-.113,1.82,0,doorLabel(i%2),-Math.PI/2,g);this.box(.038,.19,.03,-.128,1.12,.42,m.black,g);this.box(.12,.035,.15,-.17,1.12,.36,m.metal,g);for(let k=0;k<5;k++)this.box(.015,.02,.62,-.115,.3+k*.065,0,m.trim,g);return g;}
 createMan(){
  // One unbroken silhouette: sculpted torso, smooth tapered limbs and articulated joints.
  const group=new THREE.Group();
  const ink=new THREE.MeshStandardMaterial({color:'#040609',roughness:.72,metalness:0});
  const eyesMaterial=new THREE.MeshBasicMaterial({color:'#f8fbff',toneMapped:false});
  const smooth=new THREE.SphereGeometry(1,32,24);
  const form=(x,y,z,sx,sy,sz,parent)=>{const mesh=new THREE.Mesh(smooth,ink);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;};
  const segment=(top,bottom,length,parent)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,length,24),ink);mesh.position.y=-length/2;parent.add(mesh);return mesh;};
  const body=new THREE.Group();body.position.y=.96;group.add(body);
  const profile=[[.145,-.025],[.182,.025],[.175,.13],[.183,.23],[.227,.37],[.265,.45],[.244,.50],[.14,.535],[.074,.56]];
  const torso=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),40),ink);torso.scale.z=.62;body.add(torso);
  form(0,.06,0,.186,.125,.127,body);
  form(0,.566,0,.071,.115,.075,body);
  const head=new THREE.Group();head.position.set(0,.745,.012);body.add(head);
  form(0,.032,-.004,.126,.157,.115,head);
  form(0,-.068,.018,.104,.098,.092,head);
  form(0,-.022,.11,.026,.035,.021,head);
  for(const side of [-1,1]){
   form(side*.126,-.015,-.005,.018,.033,.022,head);
   // Slanted, pupil-less eye geometry hugs the curved face instead of flat decals.
   const outline=new THREE.Shape();outline.moveTo(.018,.007);outline.quadraticCurveTo(.062,.008,.113,.04);outline.quadraticCurveTo(.096,-.028,.033,-.014);outline.quadraticCurveTo(.023,-.009,.018,.007);
   const geo=new THREE.ShapeGeometry(outline,18);const pos=geo.attributes.position;
   for(let i=0;i<pos.count;i++){const x=pos.getX(i);pos.setXYZ(i,side*x,pos.getY(i),.119-.037*Math.pow(x/.125,2));}geo.computeVertexNormals();
   const eye=new THREE.Mesh(geo,eyesMaterial);eye.material.side=THREE.DoubleSide;head.add(eye);
  }
  const grin=new THREE.Group();const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.07,-.078,.092),new THREE.Vector3(0,-.115,.111),new THREE.Vector3(.07,-.078,.092));
  grin.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,.005,6,false),eyesMaterial));head.add(grin);grin.visible=false;
  const arms=[],elbows=[],legs=[],knees=[];
  for(const side of [-1,1]){
   const arm=new THREE.Group();arm.position.set(side*.245,.435,0);body.add(arm);arm.rotation.z=side*.07;arms.push(arm);
   form(0,-.07,0,.095,.115,.093,arm);segment(.083,.061,.285,arm);form(0,-.28,0,.062,.061,.063,arm);
   const elbow=new THREE.Group();elbow.position.y=-.282;arm.add(elbow);elbows.push(elbow);
   segment(.061,.037,.278,elbow);form(0,-.074,0,.063,.108,.063,elbow);
   form(0,-.315,.002,.044,.075,.034,elbow);
   for(let f=0;f<4;f++){const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.0105,.068-Math.abs(f-1.5)*.009,5,8),ink);finger.position.set((f-1.5)*.020,-.382+Math.abs(f-1.5)*.009,.007);finger.rotation.z=(f-1.5)*.025;elbow.add(finger);}
   const thumb=form(-side*.05,-.32,.013,.019,.045,.02,elbow);thumb.rotation.z=-side*.42;
   const leg=new THREE.Group();leg.position.set(side*.10,.96,0);group.add(leg);legs.push(leg);
   form(0,-.045,0,.102,.126,.106,leg);segment(.095,.061,.405,leg);form(0,-.12,.006,.092,.188,.096,leg);
   const knee=new THREE.Group();knee.position.y=-.405;leg.add(knee);knees.push(knee);form(0,0,.004,.064,.069,.067,knee);
   segment(.062,.040,.397,knee);form(0,-.122,-.013,.065,.139,.073,knee);form(0,-.403,0,.042,.065,.047,knee);
   form(0,-.468,.070,.067,.054,.135,knee);
  }
  group.position.set(.92,0,-27);
  return {group,body,head,arms,elbows,legs,knees,eyesMaterial,grin,mats:[ink],originals:[ink.color.clone()]};
 }
 buildAnomalies(){
  this.eyes=new THREE.Group();this.scene.add(this.eyes);const eyeTex=canvasTexture(512,256,(x)=>{x.clearRect(0,0,512,256);x.fillStyle='#c8c4b4';x.beginPath();x.moveTo(13,128);x.quadraticCurveTo(256,-38,499,128);x.quadraticCurveTo(256,295,13,128);x.fill();x.save();x.clip();x.fillStyle='#596659';x.beginPath();x.arc(256,128,92,0,Math.PI*2);x.fill();x.fillStyle='#131e19';x.beginPath();x.arc(256,128,43,0,Math.PI*2);x.fill();x.fillStyle='#d5dfca';x.beginPath();x.arc(230,98,12,0,Math.PI*2);x.fill();x.restore();});
  for(const z of [-9,-16,-23]){const e=new THREE.Mesh(new THREE.PlaneGeometry(2.25,1.2),new THREE.MeshBasicMaterial({map:eyeTex,transparent:true,side:THREE.DoubleSide}));e.position.set(0,3.48,z);e.rotation.x=Math.PI/2;this.eyes.add(e);}
  this.footprints=new THREE.Group();this.scene.add(this.footprints);for(let i=0;i<17;i++){const f=this.sphere(.085,.008,.20,(i%2?.14:-.14)+.32,.015,-9-i*.83,mat('#662b20'),this.footprints);f.rotation.y=i%2?.15:-.18;this.sphere(.064,.007,.058,(i%2?.14:-.14)+.32,.016,-9-i*.83+.25,mat('#68281e'),this.footprints);}
 
  this.props=new Map();
  const prop=id=>{const g=new THREE.Group();this.scene.add(g);this.props.set(id,g);return g;};
  const tape=prop('barrier');
  const tapeTex=canvasTexture(1024,128,(x,w,h)=>{x.fillStyle='#efd247';x.fillRect(0,0,w,h);x.fillStyle='#151711';for(let k=-150;k<1200;k+=130){x.beginPath();x.moveTo(k,0);x.lineTo(k+55,0);x.lineTo(k-20,128);x.lineTo(k-75,128);x.fill();}x.fillStyle='#efd247';x.fillRect(275,15,470,98);x.fillStyle='#141811';x.font='bold 66px sans-serif';x.textAlign='center';x.fillText('立 入 禁 止',510,87);});
  for(const y of [.82,1.5]){const t=this.panelTexture(5.3,.20,0,y,-16,tapeTex,0,tape);t.rotation.z=y===.82?-.065:.06;}
  const message=prop('wall-message');const warning=canvasTexture(1024,512,(x)=>{x.clearRect(0,0,1024,512);x.fillStyle='#86231c';x.font='bold 350px serif';x.textAlign='center';x.fillText('帰れ',512,368);});
  const wm=this.panelTexture(3.4,1.7,2.677,1.65,-15,warning,-Math.PI/2,message);wm.material.transparent=true;
  const doorEyes=prop('door-eyes');const dt=canvasTexture(512,256,(x)=>{x.clearRect(0,0,512,256);x.fillStyle='#f0fff5';for(const k of [50,288]){x.beginPath();x.moveTo(k,70);x.quadraticCurveTo(k+85,130,k+174,110);x.quadraticCurveTo(k+98,230,k,70);x.fill();}});
  const de=this.panelTexture(1,.5,2.537,1.5,-10.7,dt,-Math.PI/2,doorEyes);de.material=new THREE.MeshBasicMaterial({map:dt,transparent:true,side:THREE.DoubleSide,toneMapped:false});
  const fallen=prop('low-sign');fallen.position.set(-.1,.82,-18);fallen.rotation.set(-.12,.1,-.28);this.box(3.1,.85,.12,0,0,0,this.materials.black,fallen);this.panelTexture(3,.75,0,0,.069,signTexture(8),0,fallen);this.box(.035,1.9,.035,1.1,.6,0,this.materials.metal,fallen);
  const hole=prop('floor-hole');const ht=canvasTexture(512,512,(x)=>{const grad=x.createRadialGradient(256,256,20,256,256,245);grad.addColorStop(0,'#010204');grad.addColorStop(.84,'#010204');grad.addColorStop(.92,'#171e1b');grad.addColorStop(1,'#00000000');x.fillStyle=grad;x.fillRect(0,0,512,512);});
  const pit=new THREE.Mesh(new THREE.PlaneGeometry(4.3,5),new THREE.MeshBasicMaterial({map:ht,transparent:true,depthWrite:false}));pit.position.set(0,.057,-17);pit.rotation.x=-Math.PI/2;hole.add(pit);
 }

 reset(anomaly,stage){
  this.current=anomaly?.id||null;this.roundTime=0;const id=this.current;
  for(const actor of [this.man,this.twin]){
   actor.group.position.set(.92,0,-27);actor.group.rotation.set(0,0,0);actor.group.scale.setScalar(1);
   actor.head.rotation.set(0,0,0);actor.head.visible=true;actor.body.rotation.set(0,0,0);actor.body.position.y=.96;
   actor.eyesMaterial.color.set('#f8fbff');actor.grin.visible=false;
   actor.arms.forEach((a,i)=>{a.scale.setScalar(1);a.rotation.set(0,0,i===0?-.07:.07);});
   actor.legs.forEach(a=>a.rotation.set(0,0,0));actor.elbows.forEach(a=>a.rotation.set(0,0,0));actor.knees.forEach(a=>a.rotation.set(0,0,0));
  }
  const g=this.man.group;
  if(id==='stare')g.position.x=0;
  if(id==='backward')g.rotation.y=Math.PI;
  if(id==='giant')g.scale.setScalar(1.83);
  if(id==='tiny')g.scale.setScalar(.43);
  if(id==='red-eyes'){this.man.eyesMaterial.color.set('#ff2424');this.man.grin.visible=true;}
  if(id==='long-arms')this.man.arms.forEach(a=>a.scale.y=2.03);
  if(id==='head-backward')this.man.head.rotation.y=Math.PI;
  if(id==='headless')this.man.head.visible=false;
  if(id==='tilted-head')this.man.head.rotation.z=1.42;
  this.twin.group.visible=id==='twins';this.twinShadow.visible=id==='twins';this.twinShadow.position.set(0,.015,0);this.twin.group.position.set(-1.45,0,-28);
  this.posters.forEach((p,i)=>{p.visible=id!=='missing';p.position.copy(p.userData.home);p.rotation.set(id==='inverted'?Math.PI:0,0,0);if(id==='floating-posters'){p.position.set(-.3,.95+i*.36,-11-i*4);p.rotation.set(0,-Math.PI/2,.08*(i%2?1:-1));}});
  this.doors.forEach((d,i)=>d.userData.face.material=id==='red-door'&&i===0?this.materials.redDoor:this.materials.door);
  this.extraDoor.visible=id==='extra-door';this.eyes.visible=id==='eyes';this.footprints.visible=id==='footprints';
  this.materials.yellow.color.set(id==='red-tactile'?'#c72e20':'#d0ae38');
  this.tactile.forEach(b=>b.visible=!(id==='tactile'&&b.position.z<-8&&b.position.z>-26));
  this.props.forEach((g,key)=>g.visible=key===id);
  this.lights.forEach(l=>{l.color.set(id==='red-light'?'#ed3a24':'#e4f3da');l.intensity=id==='red-light'?28:18;});
  this.lightPanels.forEach(p=>{p.material.emissive.set(id==='red-light'?'#e62310':'#e1ead7');p.material.color.set(id==='red-light'?'#f03520':'#e1ead7');});
  this.ambient.color.set(id==='red-light'?'#bd5449':'#aebda8');this.scene.fog.color.set(id==='red-light'?'#36211b':'#263029');this.scene.background.copy(this.scene.fog.color);
  this.signs.forEach(p=>{p.material.map.dispose();p.material.map=signTexture(stage,id==='sign');p.material.needsUpdate=true;});
  this.update(0,0,false);
 }
 animateFigure(actor,t,walk){
  const phase=t*4.8;
  actor.arms.forEach((arm,i)=>{const p=phase+i*Math.PI;arm.rotation.x=walk?Math.sin(p)*.29:0;actor.elbows[i].rotation.x=walk?-.10-Math.max(0,Math.sin(p))*.20:-.08;});
  actor.legs.forEach((leg,i)=>{const p=phase+i*Math.PI;leg.rotation.x=walk?-Math.sin(p)*.32:0;actor.knees[i].rotation.x=walk?Math.max(0,Math.sin(p))*.46:0;});
  actor.body.position.y=.96+(walk?Math.cos(phase*2)*.011:0);actor.body.rotation.y=walk?Math.sin(phase)*.045:0;
 }
 update(dt,t,active=true){
  const id=this.current,g=this.man.group;this.roundTime+=dt;
  const walk=id!=='stare'&&id!=='floating';
  if(active&&id!=='stare'){g.position.z+=dt*(id==='giant'?.85:1.1);if(g.position.z>5.2)g.position.z=-42;}
  this.animateFigure(this.man,t,walk);
  g.position.y=id==='floating'?.58+Math.sin(t*2)*.075:id==='ceiling-man'?3.53:0;
  g.rotation.z=id==='ceiling-man'?Math.PI:0;
  if(id==='stare'){g.rotation.y=Math.atan2(this.camera.position.x-g.position.x,this.camera.position.z-g.position.z);this.man.head.rotation.z=Math.sin(t*.7)*.05;}
  if(id==='twins'){this.twin.group.position.z=g.position.z-.8;this.animateFigure(this.twin,t+.8,true);this.twinShadow.position.set(-1.45,.017,g.position.z-.8);}
  if(id==='floating-posters')this.posters.forEach((p,i)=>{p.position.y=.95+i*.36+Math.sin(this.roundTime*1.3+i)*.12;p.rotation.x=Math.sin(this.roundTime*.6+i)*.08;});
  this.manShadow.position.set(g.position.x,.017,g.position.z);this.manShadow.scale.setScalar(id==='giant'?1.8:id==='tiny'?.43:1);this.manShadow.material.opacity=id==='ceiling-man'?.14:id==='floating'?.4:.7;
 }
 render(){this.renderer.render(this.scene,this.camera);}
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
}
