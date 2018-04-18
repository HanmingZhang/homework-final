import {vec2, vec3, vec4, mat4} from 'gl-matrix';
import * as Stats from 'stats-js';
import * as DAT from 'dat-gui';
import Square from './geometry/Square';
import Mesh from './geometry/Mesh';
import Icosphere from './geometry/Icosphere';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import {setGL} from './globals';
import {readTextFile} from './globals';
import ShaderProgram, {Shader} from './rendering/gl/ShaderProgram';
import Texture from './rendering/gl/Texture';
import { GUI } from 'dat-gui';
import Water from './material/Water';


// ----------------------------------------------------------------
// Demo Camera stuff
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

const camera = new Camera(vec3.fromValues(0, 45, 120), vec3.fromValues(0, 25, 0));
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

// ----------------------------------------------------------------
// controls object is for GUI
// Define an object with application parameters and button callbacks
const controls = {
  // Post-process type
  PostProcessingType: 'Null',

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

  // Fade Effect
  DemoMode: startDemoCam, 

  // Print camera info
  PrintCamInfo: printCamInfo,

  // Triggle debug shadow map
  debugShadow: false,

  // Sky box paras
  distance: 400,
  inclination: 0.49,
  azimuth: 0.205,
  luminance: 1.0,
  turbidity: 6.0,

  // Water
  Size: 0.8,
  DistortionScale: 3.7,
};


// ----------------------------------------------------------------
// Geometry used in our scene
let square: Square; // For ground
let quad: Square;   // For shadow map debug scene
let sphere: Icosphere; // For God ray sphere
let water: Water; 


// TODO :
// Adjust this sun position for a better scene effect

// this position shoule be consistent with 
// 1. directional light direction in deferred-render.glsl
// 2. sun position in shadow map
// 3. God ray light source position
const sun_pos = vec3.fromValues(0, 50.0, -50.0);


// TODO: add scene's stuff here
let obj0: string;
let mesh0: Mesh;
let tex0: Texture;

var timer = {
  deltaTime: 0.0,
  startTime: 0.0,
  currentTime: 0.0,
  updateTime: function() {
    var t = Date.now();
    t = (t - timer.startTime) * 0.001;
    timer.deltaTime = t - timer.currentTime;
    timer.currentTime = t;
  },
}

function loadOBJText() {
  obj0 = readTextFile('resources/obj/wahoo.obj');
}


function loadScene() {
  square && square.destroy();
  mesh0 && mesh0.destroy();
  sphere && sphere.destroy();
  quad && quad.destroy();

  let modelMatrix = mat4.create();

  // Plane to cast shadow on
  mat4.identity(modelMatrix);
  mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(12.0, 1.0, 16.0));  
  mat4.rotateX(modelMatrix, modelMatrix, -0.5 * 3.1415926);
  mat4.translate(modelMatrix, modelMatrix, vec3.fromValues(0.0, -0.5, -0.5));
  square = new Square(vec3.fromValues(0, 0, 0), modelMatrix);
  square.create();

  // Shadow map debug quad
  mat4.identity(modelMatrix);
  quad = new Square(vec3.fromValues(0, 0, 0), modelMatrix);
  quad.create();

  // Wahoo!
  mat4.identity(modelMatrix);
  mesh0 = new Mesh(obj0, vec3.fromValues(0, 0, 0), modelMatrix);
  mesh0.create();

  // God ray sphere(it should be consistent with the sun in the scene)
  mat4.identity(modelMatrix);
  sphere = new Icosphere(sun_pos, 10.0, 6.0, modelMatrix);
  sphere.create();

  water = new Water(vec2.fromValues(10000, 10000), vec3.fromValues(0, 0.0, -1.0), 'resources/textures/waternormals.jpg');

  // Wahoo obj abledo texture
  tex0 = new Texture('resources/textures/wahoo.bmp');
}

// ----------------------------------------------------------------
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

  // -------------------------------------------------------------------
  renderer = new OpenGLRenderer(canvas);
  renderer.setClearColor(0, 0, 0, 1);
  gl.enable(gl.DEPTH_TEST);


  // -------------------------------------------------------------------
  const standardDeferred = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/standard-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/standard-frag.glsl')),
    ]);
  standardDeferred.setupTexUnits(["tex_Color"]);
  

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


  // Sky box paras
  var skyBox_SunPosition = vec3.create();
  function setSkyboxSun() {
    var theta = Math.PI * ( controls.inclination - 0.5 );
    var phi = 2 * Math.PI * ( controls.azimuth - 0.5 );

    skyBox_SunPosition[0] = controls.distance * Math.cos( phi );
    skyBox_SunPosition[1] = controls.distance * Math.sin( phi ) * Math.sin( theta );
    skyBox_SunPosition[2] = controls.distance * Math.sin( phi ) * Math.cos( theta );

    renderer.setSkyBoxSunPos(skyBox_SunPosition);

    // update water material sun direction here
    let tmpDir = vec3.create();
    vec3.normalize(tmpDir, skyBox_SunPosition)
    renderer.setWaterSunDirection(tmpDir);
  }
  setSkyboxSun();
  function setSkyBoxLuminance(){
    renderer.setSkyBoxLuminance(controls.luminance);
  }
  setSkyBoxLuminance();
  function setSkyBoxTurbidity(){
    renderer.setSkyBoxTurbidity(controls.turbidity);
  }
  setSkyBoxTurbidity();

  var f3 = gui.addFolder('Sky box paras');
  f3.add(controls, 'inclination', 0, 0.5).step(0.001).onChange(setSkyboxSun);
  f3.add(controls, 'azimuth', 0, 1).step(0.001).onChange(setSkyboxSun);
  f3.add(controls, "luminance", 0, 1.1).step(0.1).onChange(setSkyBoxLuminance);
  f3.add(controls, "turbidity", 0, 25.0).step(0.5).onChange(setSkyBoxTurbidity);
  f3.open();


  // Water paras
  function setWaterSize(){
    renderer.setWaterSize(controls.Size);
  }
  setWaterSize();
  function setWaterDistortionScale(){
    renderer.setWaterDistortionScale(controls.DistortionScale);
  }
  setWaterDistortionScale();

  var f4 = gui.addFolder('Water paras');
  f4.add(controls, 'Size', 0.1, 10.0).step(0.1).onChange(setWaterSize);
  f4.add(controls, 'DistortionScale', 0.1, 8).step(0.1).onChange(setWaterDistortionScale);
  f4.open();

  // -------------------------------------------------------------------
  // TODO : Add camera fade effect keys here!
  camera.addDemoCamFadeEffect(20.0, 30.0) // 20 - 30s

  // TODO : Add key frame camera info
  camera.addDemoCamPos({startTime: 2.0, endTime: 25.0, startPos: vec3.fromValues(80.0, 80.0, 100.0), endPos: vec3.fromValues(80.0, 100.0, 80.0)});
  camera.addDemoCamTarget({startTime: 2.0, endTime: 25.0, startPos: vec3.fromValues(-20.0, 0, 0), endPos: vec3.fromValues(10, 0, 0)});

  camera.addDemoCamPos({startTime: 25.0, endTime: 45.0, startPos: vec3.fromValues(0.0, -2.0, 10.0), endPos: vec3.fromValues(0.0, 15.0, 10.0)});
  camera.addDemoCamTarget({startTime: 25.0, endTime: 45.0, startPos: vec3.fromValues(0.0, -2.0, 0), endPos: vec3.fromValues(0, 15.0, 0)});

  camera.addDemoCamPos({startTime: 45.0, endTime: 63.0, startPos: vec3.fromValues(-30, 15.0, 25.0), endPos: vec3.fromValues(10, 9.0, 20.0)});
  camera.addDemoCamTarget({startTime: 45.0, endTime: 63.0, startPos: vec3.fromValues(0, 0, 0), endPos: vec3.fromValues(0, 0, 0)});

  gui.add(controls, 'DemoMode'); // click to turn on demo camera mode


  
  // -------------------------------------------------------------------
  // shadow map debug quad 
  const quadShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/quad-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/quad-frag.glsl')),
  ]);
  gui.add(controls, 'debugShadow');

  // Bake shadow map 
  renderer.renderShadow(sun_pos, window.innerWidth / window.innerHeight, [mesh0]);


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

    // Wahoo abledo texture
    standardDeferred.bindTexToUnit("tex_Color", tex0, 0);

    renderer.clear();
    renderer.clearGB();

    // debug shadow map
    if(controls.debugShadow){
      // Shadow map debug view
      renderer.render(camera, quadShader, [
          quad,
      ]);
    }
    else{
      // TODO: pass any arguments you may need for shader passes

      // forward render mesh info into gbuffers
      // renderer.renderToGBuffer(camera, standardDeferred, [mesh0, square], water);     
      renderer.renderToGBuffer(camera, standardDeferred, [mesh0], water);
       
      // sky box
      renderer.renderSkyBox(camera);

      // water layer
      renderer.renderWaterReflectionTexture(water, camera, [mesh0], tex0);

      // render from gbuffers into 32-bit color buffer
      renderer.renderFromGBuffer(camera, water, postProcessType);

      // If it's God ray post process, we need to add an extra occlusion pass
      if(postProcessType == 2){
        // renderer.renderOcculusion(camera, sphere, [mesh0, square]);  
        renderer.renderOcculusion(camera, sphere, [mesh0]);      
      }

      if(camera.camMode == CAMERA_MODE.DEMO_MODE){
        // update fade level if camera is under demo mode
        renderer.setFadeLevel(camera.fadeLevel);
      }

      if(postProcessType != -1 || camera.camMode == CAMERA_MODE.DEMO_MODE){
        // 1. apply 32-bit post 
        // 2. tonemap from 32-bit color to 8-bit color
        // 3. cinematic camera fade transition effect if necessary
        renderer.renderPostProcessHDR(postProcessType);
      }

      // ******************* DELETE ME ! **************************
      // // apply 8-bit post and draw
      // renderer.renderPostProcessLDR(postProcessType);
      // **********************************************************
    }
    stats.end();
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function() {
    renderer.setSizeAndInitBuffers(window.innerWidth, window.innerHeight, water);
    camera.setAspectRatio(window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();
  }, false);

  renderer.setSizeAndInitBuffers(window.innerWidth, window.innerHeight, water);
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
