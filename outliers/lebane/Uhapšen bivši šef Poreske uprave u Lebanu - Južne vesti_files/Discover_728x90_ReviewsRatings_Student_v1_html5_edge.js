
(function(compId){var _=null,y=true,n=false,x1='6.0.0',x2='5.0.0',x29='155px',x25='25px',g='image',e37='${shine}',x32='81px',x18='bg',x35='rgba(255,255,255,0.50)',x36='hidden',m='rect',x4='rgba(255,255,255,1.00)',i='none',x3='6.0.0.400',x34='rgb(153, 153, 153)',lf='left',x22='90px',x33='shine',x31='78px',x30='-32px',x26='mycta',x28='-39',x23='auto',x19='rgb(255, 255, 255)',x5='rgba(0,0,0,0)',x17='rgba(255,255,255,1)',x24='140px',x15='rgba(255,255,255,0.00)',x21='728px',x20='0px',x16='solid';var g14='card.png',g10='c3.png',g6='bg1.jpg',g7='t1_silver.png',g27='mycta.png',g13='t2a.png',g9='c2.png',g8='c1.png',g11='review.png',g12='stars.png';var im='images/',aud='media/',vid='media/',js='js/',fonts={},opts={'gAudioPreloadPreference':'auto','gVideoPreloadPreference':'auto'},resources=[],scripts=[],symbols={"stage":{v:x1,mv:x2,b:x3,stf:i,cg:i,rI:n,cn:{dom:[{id:'white',t:m,r:['0px','0px','728px','90px','auto','auto'],f:[x4],s:[1,"rgb(153, 153, 153)",i]},{id:'bg1',t:g,r:['0','0','728px','90px','auto','auto'],f:[x5,im+g6,'0px','0px']},{id:'t1',t:g,r:['317px','32px','209px','25px','auto','auto'],f:[x5,im+g7,'0px','0px']},{id:'c1',t:g,r:['9px','-114px','316px','316px','auto','auto'],f:[x5,im+g8,'0px','0px']},{id:'c2',t:g,r:['421px','-106px','298px','298px','auto','auto'],f:[x5,im+g9,'0px','0px']},{id:'c3',t:g,r:['166px','-153px','396px','396px','auto','auto'],f:[x5,im+g10,'0px','0px']},{id:'review',t:g,r:['379px','52px','172px','27px','auto','auto'],f:[x5,im+g11,'0px','0px']},{id:'stars',t:g,r:['383px','15px','163px','27px','auto','auto'],f:[x5,im+g12,'0px','0px']},{id:'cta',symbolName:'cta',t:m,r:['572px','34px','140','25','auto','auto']},{id:'t2',t:g,r:['0','0','281px','90px','auto','auto'],f:[x5,im+g13,'0px','0px']},{id:'card',t:g,r:['175px','7px','121px','75px','auto','auto'],f:[x5,im+g14,'0px','0px']},{id:'border',t:m,r:['0px','0','726px','88px','auto','auto'],o:'1',f:[x15],s:[1,"rgba(153,153,153,1.00)",x16]},{id:'hotspot',symbolName:'bg_728x90',t:m,r:['0','0','728','90','auto','auto'],cu:'pointer',o:'0'}],style:{'${Stage}':{isStage:true,r:['null','null','728px','90px','auto','auto'],overflow:'hidden',f:[x17]}}},tt:{d:1000,a:y,data:[]}},"bg_728x90":{v:x1,mv:x2,b:x3,stf:i,cg:i,rI:n,cn:{dom:[{t:m,id:x18,s:[5,x19,i],r:[x20,x20,x21,x22,x23,x23],f:[x17]}],style:{'${symbolSelector}':{r:[_,_,x21,x22]}}},tt:{d:0,a:y,data:[]}},"cta":{v:x1,mv:x2,b:x3,stf:i,cg:i,rI:n,cn:{dom:[{r:[x20,x20,x24,x25,x23,x23],id:x26,t:g,f:[x5,im+g27,x20,x20]},{tf:[[],[],[x28],[1,1,1]],r:[x29,x30,x31,x32,x23,x23],id:x33,s:[1,x34,i],t:m,f:[x15,[180,[[x15,0],[x35,51],[x15,100]]]]}],style:{'${symbolSelector}':{overflow:x36,r:[_,_,x24,x25]}}},tt:{d:1000,a:y,data:[["eid1",lf,0,1000,"linear",e37,'-98px','155px']]}}};AdobeEdge.registerCompositionDefn(compId,symbols,fonts,scripts,resources,opts);})("EDGE-60541698");
(function($,Edge,compId){var Composition=Edge.Composition,Symbol=Edge.Symbol;Edge.registerEventBinding(compId,function($){
//Edge symbol: 'stage'
(function(symbolName){Symbol.bindElementAction(compId,symbolName,"${hotspot}","mouseout",function(sym,e){});
//Edge binding end
Symbol.bindElementAction(compId,symbolName,"${hotspot}","mouseover",function(sym,e){sym.getSymbol("cta").play();});
//Edge binding end
Symbol.bindElementAction(compId,symbolName,"document","compositionReady",function(sym,e){var t1=sym.$("t1");var t2=sym.$("t2");var c1=sym.$("c1");var c2=sym.$("c2");var c3=sym.$("c3");var stars=sym.$("stars");var review=sym.$("review");var cta=sym.$("cta");var card=sym.$("card");var bg1=sym.$("bg1");var timeline;function animation(){var tl=new TimelineMax();tl.from(card,.75,{x:-400,ease:Power4.easeInOut},0.25).from(t1,.75,{x:"728",ease:Power4.easeInOut},0.25).to(t1,.75,{alpha:0,ease:Power4.easeInOut},1.75).to(card,.75,{left:-600,ease:Power4.easeInOut},2).from(bg1,.75,{alpha:0,ease:Power4.easeInOut},2).from(c1,.75,{scale:0,ease:Elastic.easeOut.config(1,0.75)},2.5).to(c1,.75,{scale:0,ease:Elastic.easeIn.config(1,0.75)},4.5).from(c2,.75,{scale:0,ease:Elastic.easeOut.config(1,0.75)},5.5).to(c2,.75,{scale:0,ease:Elastic.easeIn.config(1,0.75)},8).from(c3,.75,{scale:0,ease:Elastic.easeOut.config(1,0.75)},9).to(c3,.75,{scale:0,ease:Elastic.easeIn.config(1,0.75)},11).to(bg1,.75,{alpha:0,ease:Power4.easeInOut},11.5).to(card,.75,{left:240,ease:Power4.easeInOut},11.5).from(t2,.75,{alpha:0,ease:Power4.easeInOut},12).from(stars,.75,{alpha:0,ease:Power4.easeInOut},12.5).from(review,.75,{alpha:0,ease:Power4.easeInOut},12.6).from(cta,.75,{alpha:0,ease:Power4.easeInOut},12.7)
TweenMax.delayedCall(13.2,playBtn);return tl;}
function playBtn(){sym.getSymbol("cta").play();}
function playCard(){TweenMax.to(myshine,1,{x:500});}
function playCard2(){TweenMax.to(myshine2,1,{x:400});}
function init(){timeline=new TimelineMax();timeline.add(animation(),0)
timeline.timeScale(1)}
sym.myReplay=function(){timeline.restart();};window.onload=init();});
//Edge binding end
})("stage");
//Edge symbol end:'stage'

//=========================================================

//Edge symbol: 'bg_728x90'
(function(symbolName){})("bg_728x90");
//Edge symbol end:'bg_728x90'

//=========================================================

//Edge symbol: 'cta'
(function(symbolName){})("cta");
//Edge symbol end:'cta'
})})(AdobeEdge.$,AdobeEdge,"EDGE-60541698");