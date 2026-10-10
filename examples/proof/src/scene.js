const root=document.getElementById('film');
const W=Number(root.dataset.width),H=Number(root.dataset.height),U=Math.min(W,H)/1080,P=H>W;
document.documentElement.style.fontSize=`${16*U}px`;
const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];
const E=window.PROOF_EVIDENCE;
gsap.registerPlugin(CustomEase,DrawSVGPlugin,MorphSVGPlugin,SplitText);
CustomEase.create('proofMove','0.65,0,0.35,1');CustomEase.create('proofEnter','0.16,1,0.3,1');
const tl=gsap.timeline({paused:true});
const number=n=>Number(n).toFixed(1).replace('-','−');
if(E.before){$('#before-lufs').textContent=`${number(E.before.integrated)} LUFS`;$('#after-lufs').textContent=`${number(E.after.integrated)} LUFS`;$('#peak-value').textContent=`${number(E.after.truePeak)} dBTP`;$('#source-value').textContent=number(E.after.integrated);$('#report-value').textContent=Number(E.after.integrated).toFixed(1);}
if(E.grid){$('.grid-cuts').textContent=`${E.grid.cuts} cuts`;$('.grid-off').textContent=`${E.grid.off} off grid`;$('.grid-bpm').textContent=`${E.grid.bpm} BPM`;}
if(E.defect){$('.hook-frame').textContent=`frame ${E.defect.frame}`;$('#defect-reading').textContent=`frame ${E.defect.frame}\n${E.defect.at.toFixed(3)} s`;}
const wave=E.wave||[];const path=wave.map((v,i)=>`${i?'L':'M'}${(i/(wave.length-1)*1400).toFixed(2)} ${(140-v*120).toFixed(2)}`).join(' ');
$('#wave').setAttribute('d',path);$('.wave-shadow').setAttribute('d',path);
$('.ticks').innerHTML=Array.from({length:19},(_,i)=>`<i class="${i%2===0?'major':''}"></i>`).join('');
const splitMotion=SplitText.create('.end-motion',{type:'chars',autoSplit:false});
const splitMania=SplitText.create('.end-mania',{type:'chars',autoSplit:false});
const enter=(s,t,d=.65)=>tl.fromTo(s,{opacity:0,y:24*U},{opacity:1,y:0,duration:d,ease:'proofEnter',immediateRender:false},t);
const exit=(s,t,d=.3)=>tl.to(s,{opacity:0,y:-16*U,duration:d,ease:'power3.in'},t);
const origin=P?{x:208,y:816,w:704}:{x:976,y:128,w:864};
const actor=(x,y,w,t,d=.65)=>tl.to('.ribbon-holder',{x:(x-origin.x)*U,y:(y-origin.y)*U,scale:w/origin.w,scaleX:w/origin.w,scaleY:w/origin.w,rotation:0,duration:d,ease:'proofMove'},t);
const ring='M160 170 C30 350 160 580 385 585 C580 590 715 445 625 235 L555 315 C610 465 485 505 385 495 C235 485 155 360 215 275 Z';
const ringBack='M160 170 C240 70 520 70 625 235 L555 315 C475 190 290 180 215 275 Z';
const fold='M130 130 C250 70 530 80 650 180 L570 260 C470 170 300 170 220 215 L620 440 C720 520 610 610 490 600 L150 600 L150 510 L490 510 C550 510 560 495 510 470 L150 280 C75 225 75 165 130 130 Z';
const foldBack='M130 130 C200 95 270 90 350 100 L310 190 C275 185 235 190 220 215 L150 280 C75 225 75 165 130 130 Z';
const aperture='M80 130 H720 V600 H80 Z M94 144 V586 H706 V144 Z';
const apertureCorner='M80 130 H260 V144 H94 V280 H80 Z';
// Immediate headline; the scan exposes a real captured controlled candidate by 1.4s.
tl.set('.hook-copy',{opacity:1},0);
tl.fromTo('.ribbon-holder',{rotation:-18,scale:.86},{rotation:0,scale:1,duration:1.05,ease:'proofMove'},0);
tl.fromTo('#ribbon-edge',{drawSVG:'0%'},{drawSVG:'100%',duration:.9,ease:'proofMove'},.1);
tl.fromTo('.hook-line',{scaleX:.2,transformOrigin:'left'},{scaleX:1,duration:.8,ease:'proofMove'},.2);
tl.fromTo('.inspection-light',{opacity:0,x:0},{opacity:1,x:(P?790:760)*U,duration:.7,ease:'proofMove',immediateRender:false},.65);
enter('.hook-evidence',1.05,.4);
tl.to('.ribbon-holder',{opacity:0,duration:.25},1.1);
tl.to('.inspection-light',{opacity:0,duration:.2},1.4);
// A deliberate magnifier push adds scale while the candidate label stays outside it.
tl.fromTo('.hook-evidence img',{scale:1},{scale:1.045,duration:2.4,ease:'sine.inOut',immediateRender:false},1.5);
exit('.hook-evidence',4.15,.35);
tl.to('.ribbon-holder',{opacity:1,duration:.3},4.2);
tl.to('.hook-copy',{opacity:0,y:-60*U,duration:.4,ease:'power3.in'},4.5);
tl.to('.ribbon-holder',{x:P?-130*U:-480*U,y:P?-190*U:80*U,rotation:0,scaleX:P?1.2:1.55,scaleY:.035,duration:.8,ease:'proofMove'},4.5);
tl.to('.ribbon-holder',{opacity:0,duration:.2},5.15);
enter('#sound .chapter',5);enter('.sound-graph',5.05);
tl.fromTo('#wave,.wave-shadow',{drawSVG:'0%'},{drawSVG:'100%',duration:1.4,ease:'proofMove'},5.15);
tl.fromTo('.measure-rail>div',{opacity:0,y:24*U},{opacity:1,y:0,duration:.6,stagger:.22,ease:'proofEnter',immediateRender:false},6.5);
tl.fromTo('.sound-graph',{scaleY:.94},{scaleY:1,duration:3,ease:'sine.inOut',immediateRender:false},7);
exit('#sound .chapter',10.5);
tl.to('.sound-graph',{scaleY:.02,opacity:0,y:70*U,duration:.6,ease:'proofMove'},10.5);
// One folded ribbon survives every beat-triggered change. The white fold is the identity marker.
enter('#beat .chapter',10.95,.5);enter('.beat-rail',11,.4);
tl.to('.blue-wash',{opacity:1,duration:.7,ease:'proofMove'},10.5);
tl.set('#ribbon-main',{morphSVG:ring},10.5);tl.set('#ribbon-back-path',{morphSVG:ringBack},10.5);
tl.set('#ribbon-edge,#ribbon-inner',{opacity:0},10.5);
tl.set('.ribbon-holder',{transformOrigin:'top left',x:(P?85-origin.x:1000-origin.x)*U,y:(P?500-origin.y:160-origin.y)*U,scale:P?920/origin.w:800/origin.w,scaleX:P?920/origin.w:800/origin.w,scaleY:P?920/origin.w:800/origin.w,opacity:0,rotation:0},10.5);
tl.to('.ribbon-holder',{opacity:1,duration:.3},11);
for(const [s,t] of [['.g1',11],['.g2',12],['.g3',13.5]]){
 tl.fromTo(s,{opacity:0,scale:.4},{opacity:1,scale:1,duration:.18,ease:'proofEnter',immediateRender:false},t);
 tl.to(s,{opacity:0,scale:1.6,duration:.35,ease:'proofMove'},t+.18);
}
// motion-mania-ignore linear_spatial_ease: the marker is a uniform 120 BPM clock; crossing the gates triggers the ribbon states
 tl.fromTo('#beat-pointer',{x:0},{x:(P?920:1680)*U,duration:4.5,ease:'none',immediateRender:false},11);
tl.to('#ribbon-main',{morphSVG:fold,duration:.6,ease:'proofMove'},12);
tl.to('#ribbon-back-path',{morphSVG:foldBack,duration:.6,ease:'proofMove'},12);
tl.to('.ribbon-holder',{rotation:-12,duration:.6,ease:'proofMove'},12);
tl.to('#ribbon-main',{morphSVG:aperture,duration:.75,ease:'proofMove'},13.5);
tl.to('#ribbon-back-path',{morphSVG:apertureCorner,duration:.75,ease:'proofMove'},13.5);
tl.to('.ribbon-holder',{rotation:0,duration:.75,ease:'proofMove'},13.5);
enter('#grid-result',13.65,.45);
// The aperture becomes the actual candidate boundary, rather than dissolving to another object.
actor(P?70:528.4,P?467.25:184.6,P?940:864,14.8,1.2);
tl.to('.blue-wash',{opacity:0,duration:.7,ease:'proofMove'},15.5);
exit('#beat .chapter',15.45);exit('#grid-result,.beat-rail',15.5,.25);
enter('#defect .chapter',16,.55);
enter('.candidate',16,.3);enter('.prev,.next',16.2,.5);enter('#defect-reading',16.5,.4);
tl.to('.ribbon-holder',{opacity:0,duration:.18},16.22);
tl.set('.candidate .repair',{opacity:0},0);
tl.fromTo('.scan-rule',{opacity:0,x:0},{opacity:1,x:(P?896:691)*U,duration:1.2,ease:'proofMove',immediateRender:false},16.3);
tl.to('.scan-rule',{opacity:0,duration:.2},17.5);
// Repair is an opaque underlay. Only the defective top layer fades; unchanged pixels never dim.
tl.set('.candidate .repair',{opacity:1},20.35);
tl.to('.candidate .bad',{opacity:0,duration:.45,ease:'proofMove'},20.35);
tl.set('.candidate-label',{opacity:0},20.55);tl.set('.repair-label',{opacity:1},20.55);
exit('#defect .chapter',22.4,.3);exit('.prev,.next,#defect-reading',22.4,.3);
// The same aperture grows into the receipt. Clear the specimen before the claim arrives.
tl.set('.ribbon-holder',{opacity:1},22.65);
tl.to('.candidate',{opacity:0,duration:.2},22.65);
tl.to('#ribbon-main',{morphSVG:P?'M80 130 H720 V511 H80 Z M82 132 V509 H718 V132 Z':'M80 130 H720 V537.27 H80 Z M82 132 V535.27 H718 V132 Z',duration:.7,ease:'proofMove'},22.65);
actor(P?-20:711,P?666:91.375,P?1120:1210,22.65,.7);
enter('#source .chapter',23.05,.55);enter('.claim',23.05,.65);
enter('.receipt',23.35,.5);tl.to('.ribbon-holder',{opacity:0,duration:.2},23.65);
enter('.report-parent',23.85,.35);enter('.report-after',24.6,.35);enter('.report-line',25.35,.35);enter('.report-close',25.6,.35);
// These paths terminate at the actual report value, in native layout coordinates.
tl.set('#source-trace',{drawSVG:'0%'},0);
const d=P?'M720 614 L1000 614 L1000 1130 L655 1130':'M608 630 L770 630 L770 250 L1720 250 L1720 670 L1700 670';
$('.trace').setAttribute('viewBox',`0 0 ${W} ${H}`);$('#source-trace').setAttribute('d',d);
$('.trace-start').setAttribute('cx',P?'720':'608');$('.trace-start').setAttribute('cy',P?'614':'630');
$('.trace-end').setAttribute('cx',P?'655':'1700');$('.trace-end').setAttribute('cy',P?'1130':'670');
tl.fromTo('#source-trace',{drawSVG:'0%'},{drawSVG:'100%',duration:1.5,ease:'proofMove',immediateRender:false},25.8);
tl.to('.trace-start',{opacity:1,duration:.2},25.8);tl.to('.trace-end',{opacity:1,duration:.2},27.05);
tl.fromTo('.report-line b',{backgroundColor:'transparent'},{backgroundColor:'#294a31',duration:.3,immediateRender:false},27.05);
// Receipt edges open into the real aspect-ratio previews. No outgoing/incoming type overlap.
exit('#source .chapter',28.35,.3);exit('.claim,.trace,.receipt>*',28.4,.25);
tl.to('.receipt',{x:P?-12*U:-712*U,y:P?144*U:32*U,scaleX:P?400/896:1056/968,scaleY:P?225/536:594/616,transformOrigin:'top left',duration:.65,ease:'proofMove'},28.5);
enter('#layouts .chapter',29,.5);enter('.format.land,.format.vert',29,.4);
tl.to('.receipt',{opacity:0,duration:.15},29.3);
enter('.seek-readout',29.15,.4);enter('.seek-rail',29.15,.4);
// Exact frame crops are a sprite atlas from this project's rendered draft, 11.0–15.5s.
// Timeline sets are deterministic for fresh forward/reverse seeks, with no accumulating callbacks.
const applyFrame=(index,at)=>{
 const x=index%8,y=Math.floor(index/8),pos=`${x/7*100}% ${y/5*100}%`;
 tl.set('.screen',{backgroundPosition:pos},at);
 tl.set('#seek-time',{textContent:`${(11+index/10).toFixed(3)} s`},at);
};
applyFrame(0,28.5);
for(let i=0;i<=45;i++)applyFrame(i,29.5+i/45*2.25);
for(let i=44;i>=0;i--)applyFrame(i,32+(45-i)/45*2.25);
tl.set('#seek-direction',{textContent:'Reverse ←'},32);
// motion-mania-ignore linear_spatial_ease: this inspection playhead follows the exact frame sequence in the captured atlas
 tl.fromTo('.seek-rail i',{x:0},{x:(P?920:1680)*U,duration:2.25,ease:'none',immediateRender:false},29.5);
// motion-mania-ignore linear_spatial_ease: the playhead reverses through the same real frame sequence
 tl.to('.seek-rail i',{x:0,duration:2.25,ease:'none'},32);
exit('#layouts .chapter,.seek-readout,.seek-rail',34.5,.3);
tl.to('.format.land',{x:P?120*U:160*U,scale:.8,opacity:0,duration:.5,ease:'proofMove'},34.5);
tl.to('.format.vert',{x:P?-120*U:-220*U,scale:.8,opacity:0,duration:.5,ease:'proofMove'},34.5);
// Keep the original emblem and resolved reading hold.
tl.set('.ribbon-holder',{x:(P?440-origin.x:850-origin.x)*U,y:(P?360-origin.y:65-origin.y)*U,scale:.25,scaleX:.25,scaleY:.25,rotation:0,opacity:0},34.5);
tl.to('.ribbon-holder',{opacity:1,duration:.45},34.7);
tl.to('#ribbon-main',{morphSVG:'M160 170 L385 70 L625 170 L625 470 L385 585 L160 470 Z M240 220 L240 420 L385 490 L545 420 L545 220 L385 155 Z',duration:1.1,ease:'proofMove'},34.7);
tl.to('#ribbon-back-path,#ribbon-edge,#ribbon-inner',{opacity:0,duration:.3},34.7);
enter('.end-copy',35,.7);
tl.fromTo([...splitMotion.chars,...splitMania.chars],{opacity:0,y:35*U},{opacity:1,y:0,duration:.65,stagger:.028,ease:'proofEnter',immediateRender:false},35.1);
enter('.command',36,.65);
window.__timelines=window.__timelines||{};window.__timelines.proof=tl;
