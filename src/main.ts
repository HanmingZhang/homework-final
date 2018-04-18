import {vec3, vec4, mat4} from 'gl-matrix';
import * as Stats from 'stats-js';
import * as DAT from 'dat-gui';
import Square from './geometry/Square';
import Grid from './geometry/Grid';
import Terrain from './geometry/Terrain'; 
import Mesh from './geometry/Mesh';
import Scatter from './geometry/Scatter';
import Icosphere from './geometry/Icosphere';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import {setGL} from './globals';
import {readTextFile} from './globals';
import ShaderProgram, {Shader} from './rendering/gl/ShaderProgram';
import Texture from './rendering/gl/Texture';
import { GUI } from 'dat-gui';


export enum CAMERA_MODE {
  INTERACTIVE_MODE,
  DEMO_MODE,
}

export interface CAMERA_SEQUENCE{
  startTime: number;
  endTime: number;
  startPos: vec3;
  endPos: vec3;
};

const camera = new Camera(vec3.fromValues(0, 20, 50), vec3.fromValues(0, 0, 0));
//const camera = new Camera(vec3.fromValues(37.907327145400544,-4.677375415062954,-219.96961545785845), 
//                          vec3.fromValues(42.74449312341487,23.357502528180277,3.9124481030706217));
const cameraDemoModeLength = 66000; // milliseconds (66 seconds)
var renderer: OpenGLRenderer;

function startDemoCam(){
  camera.launchDemoCam(0.001 * cameraDemoModeLength);
  renderer.camMode = CAMERA_MODE.DEMO_MODE;
  console.log('Start demo camera!');

  setTimeout(function(){
    camera.endDemoCam();
    renderer.camMode = CAMERA_MODE.INTERACTIVE_MODE;
    console.log('End demo camera!');
  }, cameraDemoModeLength);
};

function printCamInfo(){
  console.log('This is camera position: ');
  console.log(camera.controls.eye);
  console.log('This is camera target: ');
  console.log(camera.controls.center);
}

// Define an object with application parameters and button callbacks
const controls = {
  // Extra credit: Add interactivity
  BackgroundType: 'Background1',
  PostProcessingType: 'GodRay',

  // Bloom
  BloomOriWeight: 0.8,
  BloomHighLightWeight: 2.5,

  // God ray
  Density: 0.91,
  Weight: 0.01,
  Decay: 0.97,
  Exposure: 2.05,
  NumSamples: 100,
  GodRayOriWeight: 0.8,
  GodRayHighLightWeight: 1.7,

  // Cartoon
  EdgeThickness: 1.3,
  KuwaharaRadius: 5.0,


  // Fade Effect
  DemoMode: startDemoCam, 

  // Print camera info
  PrintCamInfo: printCamInfo,

  // Terrain
  GridSize: 300,
  Division: 300,
  Octaves: 6,
  Depth: 400,
  NoiseSize: 0.25,
  Seed: 3.0,

  GridSize2: 2000,

  // Material
  Roughness: 0.2,
  Shininess: 20.0,
  Ambient: 0.15,
  Brightness: 7.0,
  Level: 0.54,
  Specular: 1.0,

  SandEdge: 3.0,
  SandSteep: 0.2,
  FlowEdge: 0.2,
  FlowSpeed: 0.05,

  SandDiffuse: [255, 196, 155],//[237.0, 201.0, 175.0],
  SandSpecular: [255, 225, 155], //[155, 237, 255],//[255.0, 245.0, 231.0],
  MounDiffuse: [32, 22, 20],
  FogColor: [255, 192, 199],
  FogDensity: 0.0005,

  MounEdge: 0.2,

  CloudEdge: 0.8,
  CloudSize: 0.35,
  CloudSpeed: 0.02,
  CloudSpeed2: 0.15,
  CloudNoise: 300,
  CloudStrength: 2.4,
  CloudLight: 0.15,

  RibbonDiffuse: [237, 48, 59], //[195, 59, 44],
  RibbonEdge: 0.0,
  RibbonAmount: 1.0,
  RibbonAmount2: 6.2,
  RibbonAmount3: 3.4,
};

let square: Square;
let sphere: Icosphere;
let grid: Grid;
let terrain: Terrain;
let terrain2: Terrain;

// TODO: replace with your scene's stuff

let obj0: string;
let obj1: string;
let obj2: string;
let mesh0: Mesh;
let scatter0: Scatter;
let scatter1: Scatter;
let scatter2: Scatter;

let tex0: Texture;
let terrain_diffuse: Texture;
let terrain_normal: Texture;
let terrain_specular: Texture;
let sand_normal: Texture;
let sand_normal2: Texture;
let moun_diffuse: Texture;
let moun_normal: Texture;
let moun_specular: Texture;

var timer = {
  deltaTime: 0.0,
  startTime: 0.0,
  currentTime: 0.0,
  updateTime: function() {
    var t = Date.now();
    t = (t - timer.startTime) * 0.0005;
    timer.deltaTime = t - timer.currentTime;
    timer.currentTime = t;
  },
}


function loadOBJText() {
  obj0 = readTextFile('resources/obj/wahoo.obj');
  obj1 = readTextFile('resources/obj/monument.obj');
  obj2 = readTextFile('resources/obj/ribbon.obj');
}


function loadScene() {
  square && square.destroy();
  mesh0 && mesh0.destroy();
  scatter0 && scatter0.destroy();
  scatter1 && scatter1.destroy();
  scatter2 && scatter2.destroy();
  sphere && sphere.destroy();

  let modelMatrix = mat4.create();

  mat4.identity(modelMatrix);
  // console.log(modelMatrix);
  mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(50.0, 1.0, 50.0));  
  mat4.rotateX(modelMatrix, modelMatrix, -0.5 * 3.1415926);
  mat4.translate(modelMatrix, modelMatrix, vec3.fromValues(0.0, 0.0, -2.0));
  square = new Square(vec3.fromValues(0, 0, 0), modelMatrix);
  square.create();

  mat4.identity(modelMatrix);
  mesh0 = new Mesh(obj0, vec3.fromValues(0, 0, 0), modelMatrix);
  mesh0.create();

  mat4.identity(modelMatrix);
  sphere = new Icosphere(vec3.fromValues(50.0, 50.0, 50.0), 10.0, 6.0, modelMatrix);
  sphere.create();

  mat4.identity(modelMatrix);
  grid = new Grid(controls.GridSize, controls.GridSize, controls.Division, controls.Division, modelMatrix);
  grid.create();

  mat4.identity(modelMatrix);
  terrain = new Terrain(controls.GridSize, controls.GridSize, controls.Division, controls.Division, 
    controls.Octaves, controls.Depth, controls.NoiseSize, controls.Seed,
    modelMatrix);
  terrain.create();

  mat4.identity(modelMatrix);
  terrain2 = new Terrain(controls.GridSize2, controls.GridSize2, controls.Division, controls.Division, 
    controls.Octaves, controls.Depth, controls.NoiseSize, controls.Seed,
    modelMatrix, controls.GridSize - 10 );
  terrain2.create();

  var num = 100.0;
  var randomnums: Array<number> = [];
  for(var j = 0; j < num; j++)
  {
    var rand = Math.floor(Math.random() * terrain.positions.length / 4.0);
    randomnums.push(rand);
  }

  mat4.identity(modelMatrix);
  scatter0 = new Scatter(obj1, vec3.fromValues(0, 0, 0), modelMatrix, randomnums, terrain);
  scatter0.create();

  mat4.identity(modelMatrix);
  scatter2 = new Scatter(obj2, vec3.fromValues(0, 0, 0), modelMatrix, randomnums, terrain);
  scatter2.create2();

  num = 1000.0;
  randomnums = new Array<number>();
  for(var j = 0; j < num; j++)
  {
    var rand = Math.floor(Math.random() * terrain.positions.length / 4.0);
    randomnums.push(rand);
  }

  mat4.identity(modelMatrix);
  scatter1 = new Scatter(obj1, vec3.fromValues(0, 0, 0), modelMatrix, randomnums, terrain2);
  scatter1.create();


  tex0 = new Texture('resources/textures/wahoo.bmp');
  terrain_diffuse = new Texture('resources/textures/plaster-nk-01.png');
  terrain_normal = new Texture('resources/textures/plaster-nk-01-normal.png');
  terrain_specular = new Texture('resources/textures/grass-spec.png');
  sand_normal = new Texture('resources/textures/12527-normal.jpg');
  sand_normal2 = new Texture('resources/textures/12528-normal.jpg');
  moun_diffuse = new Texture('resources/textures/plaster-nk-01.png');
  moun_normal = new Texture('resources/textures/plaster-nk-01-normal.png');
  moun_specular = new Texture('resources/textures/plaster-nk-01-spec.png');
}

function main() {
  // Initial display for framerate
  const stats = Stats();
  stats.setMode(0);
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = '0px';
  stats.domElement.style.top = '0px';
  document.body.appendChild(stats.domElement);

  // get canvas and webgl context
  const canvas = <HTMLCanvasElement> document.getElementById('canvas');
  const gl = <WebGL2RenderingContext> canvas.getContext('webgl2');
  if (!gl) {
    alert('WebGL 2 not supported!');
  }
  // `setGL` is a function imported above which sets the value of `gl` in the `globals.ts` module.
  // Later, we can import `gl` from `globals.ts` to access it
  setGL(gl);

  // Initial call to load scene
  loadScene();

  renderer = new OpenGLRenderer(canvas);
  renderer.setClearColor(0, 0, 0, 1);
  gl.enable(gl.DEPTH_TEST);


  // -------------------------------------------------------------------
  const standardDeferred = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/standard-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/standard-frag.glsl')),
    ]);

  standardDeferred.setupTexUnits(["tex_Color"]);
  standardDeferred.setGeometryColor(vec4.fromValues(0.2, 0.2, 0.2, 1.0));

  const terrainDeferred = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/terrain-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/terrain-frag.glsl')),
    ]);

  terrainDeferred.setupTexUnits(["tex_Color"]);
  terrainDeferred.setupTexUnits(["tex_Normal"]);
  terrainDeferred.setupTexUnits(["tex_Specular"]);
  terrainDeferred.setupTexUnits(["sand_Normal"]);  
  terrainDeferred.setupTexUnits(["sand_Normal2"]); 
  terrainDeferred.setDivision(controls.Division); 

  const mounDeferred = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/mounment-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/mounment-frag.glsl')),
    ]);

  mounDeferred.setupTexUnits(["tex_Color"]);
  mounDeferred.setupTexUnits(["tex_Normal"]);
  mounDeferred.setupTexUnits(["tex_Specular"]);

  const ribbonDeferred = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/ribbon-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/ribbon-frag.glsl')),
    ]);

  ribbonDeferred.setupTexUnits(["tex_Color"]);
  ribbonDeferred.setupTexUnits(["tex_Normal"]);
  ribbonDeferred.setupTexUnits(["tex_Specular"]);


  // -------------------------------------------------------------------
  // Add controls to the gui
  const gui = new DAT.GUI();
  gui.add(controls, 'PrintCamInfo');

  var postProcessType = 0;
  function setPostProcessType(){
    switch(controls.PostProcessingType){
      case 'Null': 
        postProcessType = -1;
        break;
      case 'Default':
        postProcessType = 0;
        break;
      case 'Bloom':
        postProcessType = 1;
        break;
      case 'GodRay':
        postProcessType = 2;
        break;
      default:
        break;
    }
  }
  gui.add(controls, 'PostProcessingType', ['Null', 'Default', 'Bloom', 'GodRay']).onChange(setPostProcessType);
  setPostProcessType();


  // Bloom paras folder
  function setBloomCombineParas(){
    renderer.setBloomCombineParas(controls.BloomOriWeight, controls.BloomHighLightWeight);
  }
  setBloomCombineParas();
  
  var f1 = gui.addFolder('Bloom Paras');
  f1.add(controls, 'BloomOriWeight', 0.0, 1.0).step(0.1).onChange(setBloomCombineParas);
  f1.add(controls, 'BloomHighLightWeight', 0.0, 5.0).step(0.1).onChange(setBloomCombineParas);  
  f1.close();  


  // God ray paras folder
  function setGodRayDensity(){
    renderer.setGodRayDensity(controls.Density);
  }
  setGodRayDensity();

  function setGodRayWeight(){
    renderer.setGodRayWeight(controls.Weight);
  }
  setGodRayWeight();

  function setGodRayDecay(){
    renderer.setGodRayDecay(controls.Decay);
  }
  setGodRayDecay();

  function setGodRayExposure(){
    renderer.setGodRayExposure(controls.Exposure);
  }
  setGodRayExposure();

  function setGodRaySamples(){
    renderer.setGodRayNumSamples(controls.NumSamples);
  }
  setGodRaySamples();

  function setGodRayCombineParas(){
    renderer.setGodRayCombineParas(controls.GodRayOriWeight, controls.GodRayHighLightWeight);
  }
  setGodRayCombineParas();

  var f2 = gui.addFolder('God Ray Paras');
  f2.add(controls, 'Density', 0.0, 2.0).step(0.01).onChange(setGodRayDensity);
  f2.add(controls, 'Weight', 0.0, 0.1).step(0.01).onChange(setGodRayWeight);  
  f2.add(controls, 'Decay', 0.95, 1.05).step(0.01).onChange(setGodRayDecay);  
  f2.add(controls, 'Exposure', 0.0, 3.0).step(0.01).onChange(setGodRayExposure);  
  f2.add(controls, 'NumSamples', 1, 100).step(1).onChange(setGodRaySamples);    
  f2.add(controls, 'GodRayOriWeight', 0.0, 1.0).step(0.1).onChange(setGodRayCombineParas);
  f2.add(controls, 'GodRayHighLightWeight', 0.0, 5.0).step(0.1).onChange(setGodRayCombineParas);  
  f2.close();  





  // -------------------------------------------------------------------
  // TODO : Add camera fade effect here!
  camera.addDemoCamFadeEffect(20.0, 30.0) // 10 - 16s

  // TODO : Add key frame camera info
  camera.addDemoCamPos({startTime: 2.0, endTime: 25.0, startPos: vec3.fromValues(80.0, 80.0, 100.0), endPos: vec3.fromValues(80.0, 100.0, 80.0)});
  camera.addDemoCamTarget({startTime: 2.0, endTime: 25.0, startPos: vec3.fromValues(-20.0, 0, 0), endPos: vec3.fromValues(10, 0, 0)});

  camera.addDemoCamPos({startTime: 25.0, endTime: 45.0, startPos: vec3.fromValues(0.0, -2.0, 10.0), endPos: vec3.fromValues(0.0, 15.0, 10.0)});
  camera.addDemoCamTarget({startTime: 25.0, endTime: 45.0, startPos: vec3.fromValues(0.0, -2.0, 0), endPos: vec3.fromValues(0, 15.0, 0)});

  camera.addDemoCamPos({startTime: 45.0, endTime: 63.0, startPos: vec3.fromValues(-30, 15.0, 25.0), endPos: vec3.fromValues(10, 9.0, 20.0)});
  camera.addDemoCamTarget({startTime: 45.0, endTime: 63.0, startPos: vec3.fromValues(0, 0, 0), endPos: vec3.fromValues(0, 0, 0)});

  gui.add(controls, 'DemoMode');

  var f3 = gui.addFolder('Deferred');
  f3.add(controls, 'Roughness', 0, 1).step(0.01);
  f3.add(controls, 'Shininess', 0, 20).step(0.01);
  f3.add(controls, 'Specular', 0, 5).step(0.01);
  f3.add(controls, 'Ambient', 0, 1).step(0.01);
  f3.add(controls, 'Brightness', 0, 20).step(0.01);
  f3.add(controls, 'Level', 0, 1).step(0.01);
  f3.add(controls, 'FogDensity', 0, 0.01).step(0.0001); 
  f3.addColor(controls, 'FogColor');
  f3.addColor(controls, 'SandSpecular');
  var f4 = gui.addFolder('Sand');
  f4.add(controls, 'SandEdge', 0, 10).step(0.01);
  f4.add(controls, 'SandSteep', -1, 1).step(0.01); 
  f4.add(controls, 'FlowEdge', -1, 1).step(0.01);
  f4.add(controls, 'FlowSpeed', 0, 1).step(0.01);
  f4.addColor(controls, 'SandDiffuse');
  var f5 = gui.addFolder('Mounments');
  f5.addColor(controls, 'MounDiffuse');
  f5.add(controls, 'MounEdge', 0, 1).step(0.01);
  var f5 = gui.addFolder('Cloud');
  f5.add(controls, 'CloudSize', -1, 1).step(0.01);
  f5.add(controls, 'CloudEdge', 0, 5).step(0.01);
  f5.add(controls, 'CloudSpeed', 0, 1).step(0.01);
  f5.add(controls, 'CloudSpeed2', 0, 1).step(0.01);
  f5.add(controls, 'CloudNoise', 0, 600).step(0.01);
  f5.add(controls, 'CloudStrength', 0, 10).step(0.01);
  f5.add(controls, 'CloudLight', 0, 1).step(0.01);
  var f6 = gui.addFolder('Ribbon');
  f6.addColor(controls, 'RibbonDiffuse');
  f6.add(controls, 'RibbonEdge', -1, 1).step(0.01);
  f6.add(controls, 'RibbonAmount', 0, 10).step(0.01);
  f6.add(controls, 'RibbonAmount2', 0, 10).step(0.01);
  f6.add(controls, 'RibbonAmount3', 0, 10).step(0.01);
  // -------------------------------------------------------------------
  function tick() {
    camera.update();
    stats.begin();
    gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    
    // update time 
    timer.updateTime();
    renderer.updateTime(timer.deltaTime, timer.currentTime);
    if(camera.camMode == CAMERA_MODE.DEMO_MODE){
      camera.updateDemoCamTime(timer.deltaTime);
    }


    standardDeferred.bindTexToUnit("tex_Color", tex0, 0);
    terrainDeferred.bindTexToUnit("tex_Color", terrain_diffuse, 1);
    terrainDeferred.bindTexToUnit("tex_Normal", terrain_normal, 2);
    terrainDeferred.bindTexToUnit("tex_Specular", terrain_specular, 3);
    terrainDeferred.bindTexToUnit("sand_Normal", sand_normal, 4);
    terrainDeferred.bindTexToUnit("sand_Normal2", sand_normal2, 5);
    terrainDeferred.setSandEdge(controls.SandEdge);
    terrainDeferred.setSandSteep(controls.SandSteep);
    terrainDeferred.setFlowEdge(controls.FlowEdge);
    terrainDeferred.setFlowSpeed(controls.FlowSpeed);
    terrainDeferred.setTime(timer.currentTime);
    terrainDeferred.setSandDiffuse(vec4.fromValues(controls.SandDiffuse[0]/255, controls.SandDiffuse[1]/255, controls.SandDiffuse[2]/255, 1.0));
    terrainDeferred.setCloudEdge(controls.CloudEdge);
    terrainDeferred.setCloudSize(controls.CloudSize);
    terrainDeferred.setCloudNoise(controls.CloudNoise);
    terrainDeferred.setCloudSpeed(controls.CloudSpeed);
    terrainDeferred.setCloudSpeed2(controls.CloudSpeed2);

    mounDeferred.bindTexToUnit("tex_Color", moun_diffuse, 6);
    mounDeferred.bindTexToUnit("tex_Normal", moun_normal, 7);
    mounDeferred.bindTexToUnit("tex_Specular", moun_specular, 8);
    mounDeferred.setSandDiffuse(vec4.fromValues(controls.MounDiffuse[0]/255, controls.MounDiffuse[1]/255, controls.MounDiffuse[2]/255, 1.0));
    mounDeferred.setSandSpecular(vec4.fromValues(controls.SandDiffuse[0]/255, controls.SandDiffuse[1]/255, controls.SandDiffuse[2]/255, 1.0));
    mounDeferred.setSandEdge(controls.MounEdge);
    mounDeferred.setCloudEdge(controls.CloudEdge);
    mounDeferred.setCloudSize(controls.CloudSize);
    mounDeferred.setCloudNoise(controls.CloudNoise);
    mounDeferred.setCloudSpeed(controls.CloudSpeed);
    mounDeferred.setCloudSpeed2(controls.CloudSpeed2);
    mounDeferred.setTime(timer.currentTime);

    ribbonDeferred.bindTexToUnit("tex_Color", moun_diffuse, 6);
    ribbonDeferred.bindTexToUnit("tex_Normal", moun_normal, 7);
    ribbonDeferred.bindTexToUnit("tex_Specular", moun_specular, 8);
    ribbonDeferred.setSandDiffuse(vec4.fromValues(controls.RibbonDiffuse[0]/255, controls.RibbonDiffuse[1]/255, controls.RibbonDiffuse[2]/255, 1.0));
    ribbonDeferred.setSandSpecular(vec4.fromValues(controls.SandDiffuse[0]/255, controls.SandDiffuse[1]/255, controls.SandDiffuse[2]/255, 1.0));
    ribbonDeferred.setSandEdge(controls.RibbonEdge);
    ribbonDeferred.setCloudEdge(controls.CloudEdge);
    ribbonDeferred.setCloudSize(controls.CloudSize);
    ribbonDeferred.setCloudNoise(controls.CloudNoise);
    ribbonDeferred.setCloudSpeed(controls.CloudSpeed);
    ribbonDeferred.setCloudSpeed2(controls.CloudSpeed2);
    ribbonDeferred.setTime(timer.currentTime);
    ribbonDeferred.setAmount(controls.RibbonAmount);
    ribbonDeferred.setAmount2(controls.RibbonAmount2);
    ribbonDeferred.setAmount3(controls.RibbonAmount3);

    renderer.clear();
    renderer.clearGB();

    // TODO: pass any arguments you may need for shader passes

    // If it's God ray post process, we need to add an extra occlusion pass
    if(postProcessType == 2){
      // renderer.renderOcculusion(camera, sphere, []);
      renderer.renderOcculusion(camera, sphere, [scatter0, scatter1, terrain, terrain2]);  
      //renderer.renderOcculusion(camera, sphere, [scatter0, terrain, scatter2]);    
    }

    // forward render mesh info into gbuffers
    terrainDeferred.setGridSize(controls.GridSize);
    renderer.renderToGBuffer(camera, terrainDeferred, [terrain]); 
    terrainDeferred.setGridSize(controls.GridSize2);
    renderer.renderToGBuffer(camera, terrainDeferred, [terrain2]);   
    renderer.renderToGBuffer(camera, mounDeferred, [scatter0, scatter1]);  
    //renderer.renderToGBuffer(camera, mounDeferred, [scatter0]);   
    renderer.renderToGBuffer(camera, ribbonDeferred, [scatter2]); 
    
    // render from gbuffers into 32-bit color buffer
    renderer.renderFromGBuffer(camera, controls);


    if(camera.camMode == CAMERA_MODE.DEMO_MODE){
      // update fade level if camera is under demo mode
      renderer.setFadeLevel(camera.fadeLevel);
    }

    // apply 32-bit post and tonemap from 32-bit color to 8-bit color
    renderer.renderPostProcessHDR(postProcessType);


    //******************* DELETE ME ! **************************
    // // apply 8-bit post and draw
    // renderer.renderPostProcessLDR(postProcessType);
    //**********************************************************

    stats.end();
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspectRatio(window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();
  }, false);

  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.setAspectRatio(window.innerWidth / window.innerHeight);
  camera.updateProjectionMatrix();

  // Start the render loop
  tick();
}


function setup() {
  timer.startTime = Date.now();
  loadOBJText();
  main();
}

setup();
