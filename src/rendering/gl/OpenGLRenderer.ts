import {mat3, mat4, vec4, vec3, vec2} from 'gl-matrix';
import Drawable from './Drawable';
import Camera from '../../Camera';
import {gl} from '../../globals';
import ShaderProgram, {Shader} from './ShaderProgram';
import PostProcess from './PostProcess'
import Square from '../../geometry/Square';
import Icosphere from '../../geometry/Icosphere';
import Cube from '../../geometry/Cube';
import Texture from '../../rendering/gl/Texture';
import {CAMERA_MODE} from '../../main';
import Water from '../../material/Water';
import Plane from '../../material/Plane';
import Particle from '../../particles/Particle';

// Particle System parameters
// These consts should be consistent with those in Particle.ts & particle-transform-vert.glsl
const POSITION_LOCATION = 8;
const VELOCITY_LOCATION = 9;
const COLOR_LOCATION = 10;
const TIME_LOCATION = 11;
const ID_LOCATION = 12;

const NUM_LOCATIONS = 5;

var currentSourceIdx = 0; // ping-pong buffer index


const ParticleNum = 100000;

const shadowDepthTextureSize = 1024; // This one should be consistent with that in deferred-render.glsl

// Sky box/cube
let SkyBox: Cube;

// Particles
let particle: Particle;
let particle_square: Square; // this is billboard square

function lerp(x: number, y: number, a: number)
{
  //x×(1−a)+y×a
  var b = a / 0.50;
  return y * (1.0 - b) + x * b;
}

class OpenGLRenderer {
  gBuffer: WebGLFramebuffer; // framebuffer for deferred rendering

  gbTargets: WebGLTexture[]; // references to different 4-channel outputs of the gbuffer
                             // Note that the constructor of OpenGLRenderer initializes
                             // gbTargets[0] to store 32-bit values, while the rest
                             // of the array stores 8-bit values. You can modify
                             // this if you want more 32-bit storage.

  depthTexture: WebGLTexture; // You don't need to interact with this, it's just
                              // so the OpenGL pipeline can do depth sorting

  camMode: CAMERA_MODE;

  // --------------------------------                          
  // post-processing buffers pre-tonemapping (32-bit color)
  post32Buffers: WebGLFramebuffer[];
  post32Targets: WebGLTexture[];

  // original buffer render from g-buffer
  originalBufferFromGBuffer: WebGLFramebuffer;
  originalTargetFromGBuffer: WebGLTexture;

  // God-ray temp buffer
  godrayBuffer: WebGLFramebuffer;
  godrayTarget: WebGLTexture;

  // post-processing buffers post-tonemapping (8-bit color)
  post8Buffers: WebGLFramebuffer[];
  post8Targets: WebGLTexture[];

  // post processing shader lists, try to limit the number for performance reasons
  post8Passes: PostProcess[];
  post32Passes: PostProcess[];

  // add extra post 32 passes shaders
  // post32PassesBloom: PostProcess[];
  // post32PassesGodRay: PostProcess[];

  currentTime: number; // timer number to apply to all drawing shaders

  // shadow map
  shadowDepthTexture: WebGLTexture;

  shadowShader : ShaderProgram = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('../../shaders/shadow-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('../../shaders/shadow-frag.glsl')),
  ]);
  lightViewProjMatrix: mat4;

  // the shader that renders from the gbuffers into the postbuffers
  deferredShader :  PostProcess = new PostProcess(
    new Shader(gl.FRAGMENT_SHADER, require('../../shaders/deferred-render.glsl'))
    );

  // shader that maps 32-bit color to 8-bit color
  tonemapPass : PostProcess = new PostProcess(
    new Shader(gl.FRAGMENT_SHADER, require('../../shaders/tonemap-frag.glsl'))
    );
  
  // occlusion shader used in God ray effect
  occlusionShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('../../shaders/occlusion-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('../../shaders/occlusion-frag.glsl')),
    ]);
  

  lambertShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('../../shaders/lambert-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('../../shaders/lambert-frag.glsl')),
    ]);

  // SkyBox shader
  skyBoxShader : ShaderProgram;

  // camera transition fade in/out
  fadePass : PostProcess = new PostProcess(
    new Shader(gl.FRAGMENT_SHADER, require('../../shaders/fade-frag.glsl'))
    );


  // ----------------------------------------------------------------
  // setup particle shader with transform feedback(actually, fragment shader is not used here)
  particle_transform = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('../../shaders/particle-transform-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('../..//shaders/particle-transform-frag.glsl')),
    ],
    true,
    ['v_position', 'v_velocity', 'v_color', 'v_time']
  );

  // setup particle draw shaders
  particle_draw = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('../../shaders/particle-draw-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('../../shaders/particle-draw-frag.glsl')),
  ]);


  add8BitPass(passesList: PostProcess[], pass: PostProcess) {
    // this.post8Passes.push(pass);
    passesList.push(pass);
  }

  add32BitPass(passesList: PostProcess[], pass: PostProcess) {
    // this.post32Passes.push(pass);
    passesList.push(pass);
  }


  constructor(public canvas: HTMLCanvasElement) {
    this.currentTime = 0.0;
    this.gbTargets = [undefined, undefined, undefined];
    this.post8Buffers = [undefined, undefined];
    this.post8Targets = [undefined, undefined];
    this.post8Passes = [];

    // The first buffer / target gonna be the original one from gbuffer
    // The second & thrid buffer gonna ping-pong buffer
    this.post32Buffers = [undefined, undefined];
    this.post32Targets = [undefined, undefined];

    this.post32Passes = [];

    // this.post32PassesBloom = [];
    // this.post32PassesGodRay = [];



    // --------------------------------
    // Default passes
    // this.add8BitPass(this.post8Passes, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/examplePost-frag.glsl'))));
    // this.add8BitPass(this.post8Passes, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/examplePost2-frag.glsl'))));

    // this.add32BitPass(this.post32Passes, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/examplePost3-frag.glsl'))));

    // --------------------------------
    // Post processing passes

    // 1.Godray passes
    // sample in screen space light direction
    this.add32BitPass(this.post32Passes, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/godray-frag.glsl'))));
    // combine
    this.add32BitPass(this.post32Passes, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/combineFragment-frag.glsl'))));
     
    // 2.Bloom passes
    // brightness filter
    this.add32BitPass(this.post32Passes, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/brightnessFilterRTT-frag.glsl'))));
    
    // horizontal gaussian blur
    this.add32BitPass(this.post32Passes, 
                      new PostProcess(new Shader(gl.FRAGMENT_SHADER, 
                                      require('../../shaders/blurRTT-frag.glsl')),
                                      require('../../shaders/horizontalBlurRTT-vert.glsl'), 
                                      'Bloom'));
    // vertical gaussian blur
    this.add32BitPass(this.post32Passes, 
                      new PostProcess(new Shader(gl.FRAGMENT_SHADER, 
                                      require('../../shaders/blurRTT-frag.glsl')),
                                      require('../../shaders/verticalBlurRTT-vert.glsl'), 
                                      'Bloom'));
    // combine
    this.add32BitPass(this.post32Passes, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/combineFragment-frag.glsl'))));
    

    // 3.old film effect pass
    this.add32BitPass(this.post32Passes, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/examplePost3-frag.glsl'))));

    this.add32BitPass(this.post32Passes, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/ghost-frag.glsl'))));
    
    // // --------------------------------
    // // Bloom passes
    // // brightness filter
    // this.add32BitPass(this.post32PassesBloom, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/brightnessFilterRTT-frag.glsl'))));
    
    // // horizontal gaussian blur
    // this.add32BitPass(this.post32PassesBloom, 
    //                   new PostProcess(new Shader(gl.FRAGMENT_SHADER, 
    //                                   require('../../shaders/blurRTT-frag.glsl')),
    //                                   require('../../shaders/horizontalBlurRTT-vert.glsl'), 
    //                                   'Bloom'));
    // // vertical gaussian blur
    // this.add32BitPass(this.post32PassesBloom, 
    //                   new PostProcess(new Shader(gl.FRAGMENT_SHADER, 
    //                                   require('../../shaders/blurRTT-frag.glsl')),
    //                                   require('../../shaders/verticalBlurRTT-vert.glsl'), 
    //                                   'Bloom'));
    // // combine
    // this.add32BitPass(this.post32PassesBloom, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/combineFragment-frag.glsl'))));
    

    // // --------------------------------
    // // Godray passes
    // // sample in screen space light direction
    // this.add32BitPass(this.post32PassesGodRay, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/godray-frag.glsl'))));
    // // combine
    // this.add32BitPass(this.post32PassesGodRay, new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/combineFragment-frag.glsl'))));
     

    if (!gl.getExtension("OES_texture_float_linear")) {
      console.error("OES_texture_float_linear not available");
    }

    if (!gl.getExtension("EXT_color_buffer_float")) {
      console.error("FLOAT color buffer not available");
    }

    var gb0loc = gl.getUniformLocation(this.deferredShader.prog, "u_gb0");
    var gb1loc = gl.getUniformLocation(this.deferredShader.prog, "u_gb1");
    var gb2loc = gl.getUniformLocation(this.deferredShader.prog, "u_gb2");

    this.deferredShader.use();
    gl.uniform1i(gb0loc, 0);
    gl.uniform1i(gb1loc, 1);
    gl.uniform1i(gb2loc, 2);


    // set default camera mode
    this.camMode = CAMERA_MODE.INTERACTIVE_MODE;


    // setup sky box
    this.initSkyBox();

    // setup partcles
    this.initParticle();
  }

  initSkyBox(){
    // Skybox
    let modelMatrix = mat4.create();
    mat4.identity(modelMatrix);
    mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(10000.0, 10000.0, 10000.0));  
    SkyBox = new Cube(vec3.fromValues(0, 0, 0), modelMatrix);
    SkyBox.create();

    this.skyBoxShader = new ShaderProgram([
      new Shader(gl.VERTEX_SHADER, require('../../shaders/skybox-vert.glsl')),
      new Shader(gl.FRAGMENT_SHADER, require('../../shaders/skybox-frag.glsl')),
    ]);
  }

  initParticle(){
    particle = new Particle(ParticleNum);
    particle.create();
    
    let identityModel = mat4.create();
    mat4.identity(identityModel);
  
    // size of particle
    let particleSizeScalar = 1.5;

    let billboardModelMatrix = mat4.create();
    mat4.scale(billboardModelMatrix, identityModel, vec3.fromValues(0.1 * particleSizeScalar, 0.1 * particleSizeScalar, 1.0));
    this.particle_draw.setParticleSize(0.5 * particleSizeScalar);

    particle_square = new Square(vec3.fromValues(0.0, 0.0, 0.0), billboardModelMatrix);
    particle_square.create();
  }

  // --------------------------------                          
  setBloomCombineParas(w1: number, w2: number){
    // this.post32PassesBloom[3].setOriginalSceneWeight(w1);
    // this.post32PassesBloom[3].setHighLightWeight(w2);

    this.post32Passes[5].setOriginalSceneWeight(w1);
    this.post32Passes[5].setHighLightWeight(w2);
  }

  setGodRayDensity(d: number){
    // this.post32PassesGodRay[0].setGodRayDensity(d);

    this.post32Passes[0].setGodRayDensity(d);
  }

  setGodRayWeight(w: number){
    // this.post32PassesGodRay[0].setGodRayWeight(w);

    this.post32Passes[0].setGodRayWeight(w);    
  }

  setGodRayDecay(d: number){
    // this.post32PassesGodRay[0].setGodRayDecay(d);

    this.post32Passes[0].setGodRayDecay(d);
    
  }

  setGodRayExposure(e: number){
    // this.post32PassesGodRay[0].setGodRayExposure(e);

    this.post32Passes[0].setGodRayExposure(e);
  }

  setGodRayNumSamples(n: number){
    // this.post32PassesGodRay[0].setGodRaySamples(n);

    this.post32Passes[0].setGodRaySamples(n);
  }

  setGodRayScreen(w: number, h: number, controls: any){
    // this.post32PassesGodRay[0].setGodRaySamples(n);

    this.post32Passes[0].setWidth(w);
    this.post32Passes[0].setHeight(h);
    this.post32Passes[0].setGeometryColor(vec4.fromValues(controls.FlareColor[0]/255, controls.FlareColor[1]/255, controls.FlareColor[2]/255, 1.0));
  }

  setGodRayCombineParas(w1: number, w2: number){
    // this.post32PassesGodRay[1].setOriginalSceneWeight(w1);
    // this.post32PassesGodRay[1].setHighLightWeight(w2);

    this.post32Passes[1].setOriginalSceneWeight(w1);
    this.post32Passes[1].setHighLightWeight(w2);
  }

  setFadeLevel(l: number){
    this.fadePass.setFadeLevel(l);
  }

  setSkyBoxSunPos(pos: vec3){
    this.skyBoxShader.setSkyboxSunPos(pos);
  }

  setSkyBoxLuminance(l: number){
    this.skyBoxShader.setSkyboxLuminace(l);
  }

  setSkyBoxTurbidity(t: number){
    this.skyBoxShader.setSkyboxTurbidity(t);
  }

  setSkyBoxCloud(controls: any, currentTime: number){
    this.skyBoxShader.setCloudEdge(controls.CloudEdge2);
    this.skyBoxShader.setCloudSize(controls.CloudSize2);
    this.skyBoxShader.setCloudNoise(controls.CloudNoise2);
    this.skyBoxShader.setCloudSpeed(controls.CloudSpeed);
    this.skyBoxShader.setCloudSpeed2(controls.CloudSpeed2);
    this.skyBoxShader.setAmount(controls.CloudSize3);
    this.skyBoxShader.setAmount2(controls.CloudHorizon);
    this.skyBoxShader.setAmount3(controls.CloudEdge3);
    this.skyBoxShader.setTime(currentTime);
    //this.skyBoxShader.setSandDiffuse(vec4.fromValues(controls.SkyColor[0]/255, controls.SkyColor[1]/255, controls.SkyColor[2]/255, 1.0));
    //console.log("controls.inclination" + controls.inclination);
    this.skyBoxShader.setSandDiffuse(vec4.fromValues(lerp(controls.SkyColor[0]/255, controls.SkyColorb[0]/255, controls.inclination), 
                                                        lerp(controls.SkyColor[1]/255, controls.SkyColorb[1]/255, controls.inclination),
                                                        lerp(controls.SkyColor[2]/255, controls.SkyColorb[2]/255, controls.inclination), 1.0));
  }

  setWaterSunDirection(dir: vec3){
    this.deferredShader.setWaterSunDirection(dir);
  }

  setWaterSize(size: number){
    this.deferredShader.setWaterSize(size);
  }

  setWaterDistortionScale(scale: number){
    this.deferredShader.setWaterDistortionScale(scale);
  }

  setClearColor(r: number, g: number, b: number, a: number) {
    gl.clearColor(r, g, b, a);
  }


  setSizeAndInitBuffers(width: number, height: number, water: Water) {
    console.log(width, height);
    this.canvas.width = width;
    this.canvas.height = height;

    this.deferredShader.setWidth(width);
    this.deferredShader.setHeight(height);

    // set Bloom passes size
    // this.post32PassesBloom[1].setWidth(width);   //horizontal blur pass
    // this.post32PassesBloom[2].setHeight(height); //vertical blur pass

    this.post32Passes[3].setWidth(width);   //horizontal blur pass
    this.post32Passes[4].setHeight(height); //vertical blur pass


    // --------------------------------                          
    // --- GBUFFER CREATION START ---
    // refresh the gbuffers
    this.gBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gBuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);

    for (let i = 0; i < this.gbTargets.length; i ++) {
      this.gbTargets[i] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.gbTargets[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.FLOAT, null);
      
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, this.gbTargets[i], 0);
    }

    // --------------------------------                          
    // depth attachment
    this.depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depthTexture, 0);

    var FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (FBOstatus != gl.FRAMEBUFFER_COMPLETE) {
        console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use FBO[0]\n");
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);


    // create the framebuffers for post processing
    // --------------------------------                          
    // origin buffer and texture from g-buffer
    this.originalBufferFromGBuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.originalBufferFromGBuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

    this.originalTargetFromGBuffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.originalTargetFromGBuffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.FLOAT, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.originalTargetFromGBuffer, 0);

    FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (FBOstatus != gl.FRAMEBUFFER_COMPLETE) {
      console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use 8 bit FBO\n");
    }

    // --------------------------------                          
    // tmp God ray buffer
    this.godrayBuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.godrayBuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

    this.godrayTarget = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.godrayTarget);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.FLOAT, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.godrayTarget, 0);

    FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (FBOstatus != gl.FRAMEBUFFER_COMPLETE) {
      console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use 8 bit FBO\n");
    }

    // --------------------------------                          
    for (let i = 0; i < this.post8Buffers.length; i++) {
      // --------------------------------                          
      // 8 bit buffers have unsigned byte textures of type gl.RGBA8
      this.post8Buffers[i] = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post8Buffers[i]);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

      this.post8Targets[i] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.post8Targets[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.post8Targets[i], 0);

      FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (FBOstatus != gl.FRAMEBUFFER_COMPLETE) {
        console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use 8 bit FBO\n");
      }

      // --------------------------------                                
      // 32 bit buffers have float textures of type gl.RGBA32F
      this.post32Buffers[i] = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[i]);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

      this.post32Targets[i] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.FLOAT, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.post32Targets[i], 0);

      FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (FBOstatus != gl.FRAMEBUFFER_COMPLETE) {
        console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use 8 bit FBO\n");
      }
    }


    // Water reflection texutre
    // create buffer related stuff and bind
    water.reflectRTTFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, water.reflectRTTFramebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    
    water.reflectionTexture = gl.createTexture(); // this is the reflection RTT
    gl.bindTexture(gl.TEXTURE_2D, water.reflectionTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // wrap to edge
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // wrap to edge
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, water.reflectionTextureSize[0], water.reflectionTextureSize[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, water.reflectionTextureSize[0], water.reflectionTextureSize[1], 0, gl.RGBA, gl.FLOAT, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, water.reflectionTexture, 0);

    FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (FBOstatus != gl.FRAMEBUFFER_COMPLETE) {
      console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use 8 bit FBO\n");
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }


  updateTime(deltaTime: number, currentTime: number, controls: any) {
    this.deferredShader.setTime(currentTime);
    for (let pass of this.post8Passes) pass.setTime(currentTime);
    for (let pass of this.post32Passes) pass.setTime(currentTime);
    
    this.particle_transform.setTime(currentTime);    
    this.particle_draw.setTime(currentTime);
    this.particle_transform.setCloudEdge(controls.ParticleEdge);
    this.particle_transform.setCloudSize(controls.ParticleSize);
    this.particle_transform.setCloudNoise(controls.CloudNoise);
    this.particle_transform.setCloudSpeed(controls.CloudSpeed);
    this.particle_transform.setCloudSpeed2(controls.CloudSpeed2);
    this.particle_transform.setGeometryColor(vec4.fromValues(controls.ParticleColor[0]/255, controls.ParticleColor[1]/255, controls.ParticleColor[2]/255, 1.0))

    this.currentTime = currentTime;
  }


  clear() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }


  clearGB() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gBuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }


  renderToGBuffer(camera: Camera, gbProg: ShaderProgram, drawables: Array<Drawable>, water: Water) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gBuffer);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.enable(gl.DEPTH_TEST);

    let viewProj = mat4.create();
    let view = camera.viewMatrix;
    let proj = camera.projectionMatrix;
    let color = vec4.fromValues(0.2, 0.2, 0.2, 1);

    mat4.multiply(viewProj, camera.projectionMatrix, camera.viewMatrix);
    gbProg.setViewProjMatrix(viewProj);
    gbProg.setGeometryColor(color);
    gbProg.setViewMatrix(view);
    gbProg.setProjMatrix(proj);

    gbProg.setTime(this.currentTime);
    
    gbProg.setDeferredMaterialType(51); // Defer material and later deferred shading method 

    // shadow map view project matrix
    if(this.lightViewProjMatrix != null){
      gbProg.setLightViewProjMatrix(this.lightViewProjMatrix);
    }

    let i = 0 // control which drawable use textures and which use uniform color
    let textureThreshold = 0;
    for (let drawable of drawables) {
      if(i < textureThreshold){
        gbProg.setEnableTexutre(true);
      }
      else{
        gbProg.setEnableTexutre(false);
      }
      gbProg.setModelMatrix(drawable.model);
      gbProg.draw(drawable);
      i++;
    }

    // save water layer basic info
    gbProg.setDeferredMaterialType(101);
    gbProg.setModelMatrix(water.square.model);

    // -----------------------------------------------------
    // create mirrored camera stuff
    // water.reflectedView is set here
    water.setReflectedView(camera);
  
    proj = camera.projectionMatrix;

    let reflectViewProj = mat4.create();
    mat4.multiply(reflectViewProj, proj, water.reflectedView);

    // -----------------------------------------------------
    gbProg.setWorldReflectionViewProjection(reflectViewProj);
    gbProg.draw(water.square)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }



  renderSkyBox(camera: Camera){
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[0]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    let view = camera.viewMatrix;
    let proj = camera.projectionMatrix;

    // render sky box
    this.skyBoxShader.setViewMatrix(view);
    this.skyBoxShader.setProjMatrix(proj);
    this.skyBoxShader.setModelMatrix(SkyBox.model);
    this.skyBoxShader.draw(SkyBox);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }


  processParticles(camera: Camera){
    // 1. Transform Particles
    this.transformParticles(camera, this.particle_transform, [
      particle
    ]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[1]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.DEPTH_TEST);
    // gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // 2. Render
    this.renderParticles(camera, this.particle_draw, particle_square, [particle]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }


  renderFromGBuffer(camera: Camera, water: Water, postProcessType: number, controls: any) {
    
    // if no need to post-process
    if(postProcessType == -1){
      // if it's default interactive camera mode, we render it to screen buffer
      if(this.camMode == CAMERA_MODE.INTERACTIVE_MODE){
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      // if it's in demo camera mode, we need further fade in/out post-process
      else{
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.post8Buffers[0]);
      }
    }
    // if need post-process
    else{
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.originalBufferFromGBuffer);
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);


    let view = camera.viewMatrix;
    let proj = camera.projectionMatrix;


    // render from gbuffer
    this.deferredShader.setViewMatrix(view);
    this.deferredShader.setProjMatrix(proj);

    this.deferredShader.setCameraPos(vec4.fromValues(camera.controls.eye[0], camera.controls.eye[1], camera.controls.eye[2], 1.0));
    this.deferredShader.setRoughness(controls.Roughness);
    this.deferredShader.setShininess(controls.Shininess);
    this.deferredShader.setAmbient(controls.Ambient);
    this.deferredShader.setBrightness(controls.Brightness);
    this.deferredShader.setLevel(controls.Level);
    this.deferredShader.setSandEdge(controls.Specular);
  
    this.deferredShader.setSandDiffuse(vec4.fromValues(lerp(controls.FogColor[0]/255, controls.FogColorb[0]/255, controls.inclination), 
                                                        lerp(controls.FogColor[1]/255, controls.FogColorb[1]/255, controls.inclination),
                                                        lerp(controls.FogColor[2]/255, controls.FogColorb[2]/255, controls.inclination), 1.0));
    this.deferredShader.setSandSpecular(vec4.fromValues(controls.SandSpecular[0]/255, controls.SandSpecular[1]/255, controls.SandSpecular[2]/255, 1.0)); 
    this.deferredShader.setFogDensity(controls.FogDensity); 
    this.deferredShader.setCloudSize(controls.CloudStrength); 
    this.deferredShader.setCloudEdge(controls.CloudLight); 
    this.deferredShader.setGeometryColor(vec4.fromValues(lerp(controls.LightColor[0]/255, controls.LightColorb[0]/255, controls.inclination), 
                                                        lerp(controls.LightColor[1]/255, controls.LightColorb[1]/255, controls.inclination),
                                                        lerp(controls.LightColor[2]/255, controls.LightColorb[2]/255, controls.inclination), 1.0));

    this.post32Passes[6].setAmount(controls.Aberration);
    this.post32Passes[6].setAmount2(controls.NoiseStrength);
    this.post32Passes[6].setAmount3(controls.vignetteintensity);
    this.post32Passes[6].setAmbient(controls.vignettepow);

    this.deferredShader.setLightViewProjMatrix(this.lightViewProjMatrix);


    let gbTargetsLen = this.gbTargets.length;
    
    // g-buffer textures
    for (let i = 0; i < gbTargetsLen; i ++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.gbTargets[i]);
    }

    // shadow map texture
    if(this.shadowDepthTexture !== null){
      gl.activeTexture(gl.TEXTURE0 + gbTargetsLen);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowDepthTexture);
      this.deferredShader.setShadowTexture(gbTargetsLen);
    }

    // skybox texture
    gl.activeTexture(gl.TEXTURE0 + gbTargetsLen + 1);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[0]);
    this.deferredShader.setBgTexture(gbTargetsLen + 1);
    
    // set up water
    if(water !== null){
      if(this.camMode == CAMERA_MODE.INTERACTIVE_MODE){
        this.deferredShader.setWaterEyePos(camera.controls.eye);
      }
      else{
        this.deferredShader.setWaterEyePos(camera.demoCamPos);
      }

      // water reflection texture
      gl.activeTexture(gl.TEXTURE0 + gbTargetsLen + 2);
      gl.bindTexture(gl.TEXTURE_2D, water.reflectionTexture);
      this.deferredShader.setWaterReflectionTexture(gbTargetsLen + 2);

      // water normal texture
      this.deferredShader.setupTexUnits(["u_waterNoramlTexture"]);
      this.deferredShader.bindTexToUnit("u_waterNoramlTexture", water.normal_tex, gbTargetsLen + 3);
    }

    // particle texture
    if(particle !== null){
      gl.activeTexture(gl.TEXTURE0 + gbTargetsLen + 4);
      gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[1]);
      this.deferredShader.setParticleTexture(gbTargetsLen + 4);
    }

    this.deferredShader.draw();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }


  renderPostProcessHDR(postProcessType: number) {
    
    // select which post32Passes group to use
    let thisPost32Passes: PostProcess[] = [];
    // let thisPost8Passes: PostProcess[] = [];

    thisPost32Passes = this.post32Passes;

    // switch(postProcessType){
    //   // Default post process
    //   case 0:
    //     thisPost32Passes = this.post32Passes;
    //     //thisPost8Passes  = this.post8Passes;
    //     break;
    //   // Bloom post process
    //   case 1:
    //     thisPost32Passes = this.post32PassesBloom;
    //     break;
    //   // God ray post process
    //   case 2:
    //     thisPost32Passes = this.post32PassesGodRay;
    //     break;
    //   default:
    //     break;
    // }

    if(postProcessType != -1){

      // 1. God ray scattering effect
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[1]);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[0]); // this one is from render occulusion

      thisPost32Passes[0].draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      

      // 2. God ray scattering effect combine with original view
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.godrayBuffer);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[1]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.originalTargetFromGBuffer);
      
      thisPost32Passes[1].draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);


      // 3. Bloom brightness filter
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[0]);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.godrayTarget);
      
      thisPost32Passes[2].draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      

      // 4. Bloom horizontal Gaussian Blur
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[1]);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[0]);
      
      thisPost32Passes[3].draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      

      // 5. Bloom vertical Gaussian Blur
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[0]);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[1]);
      
      thisPost32Passes[4].draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // 6. Bloom combine
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[1]);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[0]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.godrayTarget);

      thisPost32Passes[5].draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);


      // 7. Old film effect
      // Interactive camera mode : render to screen
      if(this.camMode == CAMERA_MODE.INTERACTIVE_MODE){
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      // Demo camera mode : render to buffer
      else{
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.post8Buffers[0]);
      }
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[1]);

      thisPost32Passes[6].draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // let i = 0;
    // // --------------------------------                          
    // // Single post process pipeline 
    // // for Default, Bloom, God ray post porcesses
    // for (i = 0; i < thisPost32Passes.length; i++){
    //   // If this is the last post process pass
    //   if(i == thisPost32Passes.length - 1){
    //     if(this.camMode == CAMERA_MODE.INTERACTIVE_MODE){
    //       gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    //     }
    //     // If it's in demo camera mode, we need further fade in/out post-process
    //     else{
    //       gl.bindFramebuffer(gl.FRAMEBUFFER, this.post8Buffers[0]);
    //     }
    //   }
    //   else{
    //     // Pingpong framebuffers for each pass.
    //     // In other words, repeatedly flip between storing the output of the
    //     // current post-process pass in post32Buffers[1] and post32Buffers[0].
    //     gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[(i + 1) % 2]);
    //   }


    //   gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    //   gl.disable(gl.DEPTH_TEST);
    //   // gl.enable(gl.BLEND);
    //   gl.disable(gl.BLEND);

    //   gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //   // Recall that each frame buffer is associated with a texture that stores
    //   // the output of a render pass. post32Targets is the array that stores
    //   // these textures, so we alternate reading from the 0th and 1th textures
    //   // each frame (the texture we wrote to in our previous render pass).
    //   gl.activeTexture(gl.TEXTURE0);
    //   // default / bloom rain post process passes need to start from 
    //   // the orignal G-buffer render
    //   if(i == 0 && (postProcessType == 0 || postProcessType == 1)){
    //     gl.bindTexture(gl.TEXTURE_2D, this.originalTargetFromGBuffer);        
    //   }
    //   else{
    //     gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[(i) % 2]);
    //   }

    //   // final pass of Bloom post-process
    //   // we need to bind another texture, which is the orginal render
    //   if(i == thisPost32Passes.length - 1 && postProcessType == 1){
    //     gl.activeTexture(gl.TEXTURE1);
    //     gl.bindTexture(gl.TEXTURE_2D, this.originalTargetFromGBuffer);                
    //   }

    //   // final pass of God ray post-process
    //   // we need to bind another texture, which is the orginal render
    //   if(i == thisPost32Passes.length - 1 && postProcessType == 2){
    //     gl.activeTexture(gl.TEXTURE1);
    //     gl.bindTexture(gl.TEXTURE_2D, this.originalTargetFromGBuffer);                
    //   }

    //   thisPost32Passes[i].draw();

    //   // bind default frame buffer
    //   gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // }
    
    // ******************* DELETE ME ! **************************
    // // --------------------------------                          
    // // apply tonemapping
    // // TODO: if you significantly change your framework, ensure this doesn't cause bugs!
    // // render to the first 8 bit buffer if there is more post, else default buffer

    // if(this.camMode == CAMERA_MODE.INTERACTIVE_MODE){
    //   gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // }
    // else{
    //   gl.bindFramebuffer(gl.FRAMEBUFFER, this.post8Buffers[0]);
    // }

    // gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    // gl.disable(gl.DEPTH_TEST);
    // gl.enable(gl.BLEND);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // gl.activeTexture(gl.TEXTURE0);
    // // bound texture is the last one processed before
    // if(i == 0){
    //   gl.bindTexture(gl.TEXTURE_2D, this.originalTargetFromGBuffer);      
    // }
    // else{
    //   gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[Math.max(0, i) % 2]);      
    // }
    // this.tonemapPass.draw();
    // **********************************************************


    // --------------------------------
    // Fade out / Fade in post processing                          
    // animated camera transition
    if(this.camMode == CAMERA_MODE.DEMO_MODE){
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  
      gl.disable(gl.DEPTH_TEST);
      // gl.enable(gl.BLEND);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
      gl.activeTexture(gl.TEXTURE0);
      // bound texture is the last one processed before
      gl.bindTexture(gl.TEXTURE_2D, this.post8Targets[0]);      
  
      this.fadePass.draw();
    }

  }

  // ******************* DELETE ME ! **************************
  // // TODO: pass any info you need as args
  // renderPostProcessLDR(postProcessType: number) {

  //   // select which post32Passes group to use
  //   let thisPost8Passes: PostProcess[] = [];
  //   switch(postProcessType){
  //     // default post process
  //     case 0:
  //       thisPost8Passes  = this.post8Passes;
  //       break;
  //     default:
  //       break;
  //   }

  //   // TODO: replace this with your post 8-bit pipeline
  //   // the loop shows how to swap between frame buffers and textures given a list of processes,
  //   // but specific shaders (e.g. motion blur) need specific info as textures
  //   for (let i = 0; i < thisPost8Passes.length; i++){
  //     // pingpong framebuffers for each pass
  //     // if this is the last pass, default is bound
  //     if (i < thisPost8Passes.length - 1) gl.bindFramebuffer(gl.FRAMEBUFFER, this.post8Buffers[(i + 1) % 2]);
  //     else gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  //     gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  //     gl.disable(gl.DEPTH_TEST);
  //     gl.enable(gl.BLEND);
  //     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //     gl.activeTexture(gl.TEXTURE0);
  //     gl.bindTexture(gl.TEXTURE_2D, this.post8Targets[(i) % 2]);

  //     thisPost8Passes[i].draw();

  //     // bind default
  //     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  //   }
  // }
  // **********************************************************

  
  // render an occlusion texture for God ray post processing
  renderOcculusion(camera: Camera, lightSphere: Icosphere, drawables: Array<Drawable>) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[0]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let viewProj = mat4.create();

    mat4.multiply(viewProj, camera.projectionMatrix, camera.viewMatrix);
    this.occlusionShader.setViewProjMatrix(viewProj);


    // To draw an occlusion texture, 
    // this color is important
    // set light color as white
    this.occlusionShader.setGeometryColor(vec4.fromValues(1.0, 1.0, 1.0, 1.0));

    let model = mat4.create();
    mat4.identity(model);
    this.occlusionShader.setModelMatrix(model); 

    this.occlusionShader.draw(lightSphere);    

    // update later post-process screen space light position
    let lightPos = vec4.fromValues(lightSphere.center[0],
                                   lightSphere.center[1],
                                   lightSphere.center[2],
                                   1.0);
    vec4.transformMat4(lightPos, lightPos, viewProj);
    vec4.scale(lightPos, lightPos, 1.0 / lightPos[3]);
    vec4.add(lightPos, lightPos, vec4.fromValues(1.0, 1.0, 0.0, 0.0));
    vec4.scale(lightPos, lightPos, 0.5);
    // this.post32PassesGodRay[0].setGodRayScreenSpaceLightPos(vec2.fromValues(lightPos[0], lightPos[1]));
    this.post32Passes[0].setGodRayScreenSpaceLightPos(vec2.fromValues(lightPos[0], lightPos[1]));
    

    // this is occuluded geometry color
    // we directly draw it black
    this.occlusionShader.setGeometryColor(vec4.fromValues(0.0, 0.0, 0.0, 1.0));    
    
    for (let drawable of drawables) {
      this.occlusionShader.setModelMatrix(drawable.model);      
      this.occlusionShader.draw(drawable);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }


  // render shadow map
  renderShadow(lightPos: vec3, aspectRatio: number, drawables: Array<Drawable>){

    // create shadow map buffer related stuff and bind
    var shadowFramebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

    this.shadowDepthTexture = gl.createTexture() // this is the final shadow map render
    gl.bindTexture(gl.TEXTURE_2D, this.shadowDepthTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // wrap to edge
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // wrap to edge
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadowDepthTextureSize, shadowDepthTextureSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.shadowDepthTexture, 0);
    

    let FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (FBOstatus != gl.FRAMEBUFFER_COMPLETE) {
      console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use 8 bit FBO\n");
    }


    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    

    // create light "camera"
    let lightProjectionMatrix = mat4.create();
    let orthoCamWidth = 200.0; //50.0; // TODO : adjust this value to change shadow size
    let near = 0.1;
    let far = 5000.0;
    mat4.ortho(lightProjectionMatrix, -orthoCamWidth, orthoCamWidth , -orthoCamWidth / aspectRatio, orthoCamWidth / aspectRatio, near, far);

    let lightViewMatrix = mat4.create();
    mat4.lookAt(lightViewMatrix, vec3.fromValues(lightPos[0], lightPos[1], lightPos[2]), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));

    this.lightViewProjMatrix = mat4.create();
    mat4.multiply(this.lightViewProjMatrix, lightProjectionMatrix, lightViewMatrix);  
    
    // set sun view projection matrix
    this.shadowShader.setLightViewProjMatrix(this.lightViewProjMatrix);
    

    // draw shadows to framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);

    gl.viewport(0, 0, shadowDepthTextureSize, shadowDepthTextureSize)
    gl.clearColor(0, 0, 0, 1)
    gl.clearDepth(1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    
    for (let drawable of drawables) {
      // set up model matrix
      this.shadowShader.setModelMatrix(drawable.model);
      this.shadowShader.draw(drawable);
    }

    console.log("Shadow Draw is called!");
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }



  render(camera: Camera, prog: ShaderProgram, drawables: Array<Drawable>) {
    
    let viewProj = mat4.create();

    let model = mat4.create();
    mat4.identity(model);

    mat4.multiply(viewProj, camera.projectionMatrix, camera.viewMatrix);
    prog.setModelMatrix(model);
    prog.setViewProjMatrix(viewProj);


    if(this.shadowDepthTexture != null){
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowDepthTexture);
      prog.setShadowTexture(0);
    }

    if(this.lightViewProjMatrix != null){
      prog.setLightViewProjMatrix(this.lightViewProjMatrix);
    }

    for (let drawable of drawables) {
      prog.draw(drawable);
    }
  }


  renderWaterReflectionTexture(water: Water, camera: Camera, drawables: Array<Drawable> = [], textures: Array<Texture> = []){

    // draw refection of water surface to framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, water.reflectRTTFramebuffer);
    gl.viewport(0, 0, water.reflectionTextureSize[0],  water.reflectionTextureSize[1])
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    let proj = camera.projectionMatrix;

    // render sky box from mirrored camera
    if(SkyBox !== null){
      this.skyBoxShader.setViewMatrix(water.reflectedView); // water.refectedView is set in renderToGubuffer
      this.skyBoxShader.setProjMatrix(proj);
      this.skyBoxShader.setModelMatrix(SkyBox.model);
      this.skyBoxShader.draw(SkyBox);
    }

    // Use lambert shader to render reflection so far
    if(textures.length !== 0){
      // TODO: set uniforms/textures for shader  
      this.lambertShader.setupTexUnits(["tex_Color"]);
      this.lambertShader.bindTexToUnit("tex_Color", textures[0], 0);
    }

    if(drawables.length !== 0){
      this.lambertShader.setViewMatrix(water.reflectedView); // water.refectedView is set in renderToGubuffer   
      this.lambertShader.setProjMatrix(proj);
      this.lambertShader.setGeometryColor(vec4.fromValues(0.2, 0.2, 0.2, 1.0));

      for (let drawable of drawables) {
        // set up model matrix
        this.lambertShader.setModelMatrix(drawable.model);
        this.lambertShader.draw(drawable);
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }


  transformParticles(camera: Camera, prog: ShaderProgram, particles: Array<Particle>){
    if(particles.length !== 0){
      let viewProj = mat4.create();

      mat4.multiply(viewProj, camera.projectionMatrix, camera.viewMatrix);

      let model = mat4.create();
      mat4.identity(model);
      prog.setModelMatrix(model);
      prog.setViewProjMatrix(viewProj);

      prog.use();

      var destinationIdx = (currentSourceIdx + 1) % 2;

      for(let i = 0; i < particles.length; i++){
        // Toggle source and destination VBO
        var sourceVAO = particles[i].getVAO(currentSourceIdx);
        var destinationTransformFeedback = particles[i].getTransformFeedbacks(destinationIdx);

        gl.bindVertexArray(sourceVAO);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, destinationTransformFeedback);

        // NOTE: The following four lines shouldn't be necessary, but are required to work in ANGLE
        // due to a bug in its handling of transform feedback objects.
        // https://bugs.chromium.org/p/angleproject/issues/detail?id=2051
        var vbo = particles[i].getVBO(destinationIdx);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, vbo[POSITION_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, vbo[VELOCITY_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, vbo[COLOR_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 3, vbo[TIME_LOCATION]);
        

        // -------------------------------------------------------------
        // -------------- this portion is different --------------------
        // -------------------------------------------------------------

        // Attributes per-vertex when doing transform feedback needs setting to 0 when doing transform feedback
        gl.vertexAttribDivisor(POSITION_LOCATION, 0);
        gl.vertexAttribDivisor(VELOCITY_LOCATION, 0);
        gl.vertexAttribDivisor(COLOR_LOCATION, 0);
        gl.vertexAttribDivisor(TIME_LOCATION, 0);
        
        // Turn off rasterization - we are not drawing
        gl.enable(gl.RASTERIZER_DISCARD);

        // Update position and rotation using transform feedback
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, particles[i].numParticles);
        gl.endTransformFeedback();

        // Restore state
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.useProgram(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        // -------------------------------------------------------------

        // // Draw particles using transform feedback (pure dots)
        // gl.beginTransformFeedback(gl.POINTS);
        // gl.drawArrays(gl.POINTS, 0, particles[i].numParticles);
        // gl.endTransformFeedback();
      }

      // Ping pong the buffers
      currentSourceIdx = (currentSourceIdx + 1) % 2;
    }
  }

  renderParticles(camera: Camera, prog: ShaderProgram, drawable: Drawable, particles: Array<Particle>) {
    if(particles.length !== 0){
      let viewProj = mat4.create();

      // Each column of the axes matrix is an axis. Right, Up, Forward.
      let axes = mat3.fromValues(camera.right[0], camera.right[1], camera.right[2],
                                 camera.up[0], camera.up[1], camera.up[2],
                                 camera.forward[0], camera.forward[1], camera.forward[2]);


      mat4.multiply(viewProj, camera.projectionMatrix, camera.viewMatrix);
      prog.setModelMatrix(drawable.model);
      prog.setViewMatrix(camera.viewMatrix);
      prog.setViewProjMatrix(viewProj);
      prog.setCameraAxes(axes);
      

      for(let i = 0; i < particles.length; i++){
        var sourceVAO = particles[i].getVAO(currentSourceIdx);
        gl.bindVertexArray(sourceVAO);

        // Attributes per-instance when drawing sets back to 1 when drawing instances
        gl.vertexAttribDivisor(POSITION_LOCATION, 1);
        gl.vertexAttribDivisor(COLOR_LOCATION, 1);
        
        // draw instances
        prog.draw(drawable, true, particles[i].numParticles);
      }      
    }
  }

};


export default OpenGLRenderer;
