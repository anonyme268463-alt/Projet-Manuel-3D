import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Visualiseur autonome : scène, géométrie, navigation et état visuel. */
export class AssemblyViewer {
  constructor(host){
    this.host=host;this.scene=new THREE.Scene();this.parts=new Map();this.exploded=false;this.highlighted=true;this.focus=[];
    this.camera=new THREE.PerspectiveCamera(42,1,.1,100);this.camera.position.set(3.8,2.8,4.5);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    host.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.target.set(0,1,0);this.controls.minDistance=2;this.controls.maxDistance=10;
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x8395ac,2.6));
    const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(3,7,4);this.scene.add(key);
    const grid=new THREE.GridHelper(8,16,0xc8d4df,0xe1e8ee);grid.position.y=-.02;this.scene.add(grid);
    this.buildModel();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();this.render();
  }
  box(id,size,position,color){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.65,metalness:id==='sink'?.45:0,transparent:true}));
    mesh.position.set(...position);mesh.castShadow=true;this.scene.add(mesh);this.parts.set(id,{mesh,origin:mesh.position.clone(),color});return mesh;
  }
  tube(id,x,color){
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(x,1.62,-.1),new THREE.Vector3(x,1.05,-.12),new THREE.Vector3(x,.62,-.24)]);
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,24,.022,8,false),new THREE.MeshStandardMaterial({color,roughness:.35,transparent:true}));
    this.scene.add(mesh);this.parts.set(id,{mesh,origin:mesh.position.clone(),color});
  }
  buildModel(){
    this.box('bottom',[1.9,.09,.8],[0,.22,0],0xc39c6c);
    this.box('sideL',[.09,1.45,.8],[-.94,1,0],0xc39c6c);
    this.box('sideR',[.09,1.45,.8],[.94,1,0],0xc39c6c);
    this.box('back',[1.75,1.45,.06],[0,1,-.37],0xa78157);
    this.box('top',[2.08,.10,.98],[0,1.79,0],0xe0c29b);
    this.box('sink',[.64,.04,.48],[-.48,1.86,.04],0xb8c7d0);
    this.box('hob',[.67,.04,.48],[.48,1.86,.04],0x263b4c);
    this.box('drawer',[.77,.30,.08],[-.46,1.38,.46],0xdab789);
    this.box('shutter',[.80,.79,.08],[.47,.80,.46],0xb48b60);
    this.box('network',[.65,.38,.16],[-.46,.67,.29],0x63879c);
    this.tube('hot',-.62,0xd86e62);this.tube('cold',-.43,0x368fc8);this.tube('gas',.55,0xd6b04e);
  }
  setFocus(ids){this.focus=ids;this.updateAppearance()}
  toggleHighlight(){this.highlighted=!this.highlighted;this.updateAppearance();return this.highlighted}
  toggleExplode(){this.exploded=!this.exploded;this.updateAppearance();return this.exploded}
  updateAppearance(){
    for(const [id,part] of this.parts){
      const selected=this.focus.includes(id),dim=this.highlighted&&this.focus.length>0&&!selected;
      part.mesh.material.opacity=dim?.17:1;part.mesh.material.depthWrite=!dim;
      part.mesh.material.color.setHex(part.color);
      part.mesh.material.emissive.setHex(this.highlighted&&selected?0x1b6856:0);
      part.mesh.material.emissiveIntensity=.35;
      part.mesh.position.copy(part.origin);
      if(this.exploded){part.mesh.position.x+=Math.sign(part.origin.x||1)*.3;if(['top','sink','hob'].includes(id))part.mesh.position.y+=.4;}
    }
  }
  zoom(factor){this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);this.controls.update()}
  reset(){this.camera.position.set(3.8,2.8,4.5);this.controls.target.set(0,1,0);this.controls.update()}
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix()}
  render(){this.controls.update();this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(()=>this.render())}
  dispose(){cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.dispose();this.renderer.dispose()}
}
