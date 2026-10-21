const button = document.querySelector('button');
let start = null;
let dragged = false;
button.addEventListener('pointerdown', event => {
  if(event.button !== 0) return;
  start = {x:event.screenX,y:event.screenY}; dragged = false;
  button.setPointerCapture(event.pointerId);
});
button.addEventListener('pointermove', event => {
  if(!start) return;
  const x=event.screenX-start.x,y=event.screenY-start.y;
  if(Math.abs(x)+Math.abs(y)>3 || dragged){dragged=true;window.bubble.move(x,y);start={x:event.screenX,y:event.screenY};}
});
button.addEventListener('pointerup', () => {if(!start)return;start=null;if(dragged)window.bubble.snap();});
button.addEventListener('click', () => {if(!dragged)window.bubble.open();dragged=false;});
button.addEventListener('contextmenu', event => {event.preventDefault();window.bubble.menu();});
