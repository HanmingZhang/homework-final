import {vec2, vec3, vec4, mat4} from 'gl-matrix';
import Drawable from './Drawable';
import Texture from './Texture';
import {gl} from '../../globals';

var activeProgram: WebGLProgram = null;

export class Shader {
  shader: WebGLShader;

  constructor(type: number, source: string) {
    this.shader = gl.createShader(type);
    gl.shaderSource(this.shader, source);
    gl.compileShader(this.shader);

    if (!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(this.shader);
    }
  }
};

class ShaderProgram {
  prog: WebGLProgram;

  attrPos: number;
  attrNor: number;
  attrCol: number;
  attrUV: number;
  attrDep: number;

  unifModel: WebGLUniformLocation;
  unifModelInvTr: WebGLUniformLocation;
  unifViewProj: WebGLUniformLocation;
  unifView: WebGLUniformLocation;
  unifProj: WebGLUniformLocation;
  unifColor: WebGLUniformLocation;
  unifTime: WebGLUniformLocation;

  unifWidth: WebGLUniformLocation;
  unifHeight: WebGLUniformLocation;

  unifOriWeight: WebGLUniformLocation;
  unifHighLightWeight: WebGLUniformLocation;

  unifGodrayScreenSpaceLightPos: WebGLUniformLocation;
  unifGodrayDensity: WebGLUniformLocation;
  unifGodrayWeight: WebGLUniformLocation;
  unifGodrayDecay: WebGLUniformLocation;
  unifGodrayExposure: WebGLUniformLocation;
  unifGodrayNumSamples: WebGLUniformLocation;

  unifEnableTexture: WebGLUniformLocation;

  unifFadeLevel: WebGLUniformLocation;

  unifGridSize: WebGLUniformLocation;
  unifDivision: WebGLUniformLocation;
  unifCameraPos: WebGLUniformLocation;

  unifRoughness: WebGLUniformLocation;
  unifShininess: WebGLUniformLocation;
  unifAmbient: WebGLUniformLocation;
  unifBrightness: WebGLUniformLocation;
  unifLevel: WebGLUniformLocation;

  unifSandEdge: WebGLUniformLocation;
  unifSandSteep: WebGLUniformLocation;
  unifFlowEdge: WebGLUniformLocation;
  unifFlowSpeed: WebGLUniformLocation;

  unifSandDiffuse: WebGLUniformLocation;
  unifSandSpecular: WebGLUniformLocation;
  unifFogDensity: WebGLUniformLocation;

  unifCloudEdge: WebGLUniformLocation;
  unifCloudSize: WebGLUniformLocation;
  unifCloudSpeed: WebGLUniformLocation;
  unifCloudSpeed2: WebGLUniformLocation;
  unifCloudNoise: WebGLUniformLocation;

  unifAmount: WebGLUniformLocation;
  unifAmount2: WebGLUniformLocation;
  unifAmount3: WebGLUniformLocation;

  unifTexUnits: Map<string, WebGLUniformLocation>;

  unifLightViewProj: WebGLUniformLocation;
  unifShadowTexture: WebGLUniformLocation;
  
  unifBgTexture: WebGLUniformLocation;

  unifSkyboxSunPos: WebGLUniformLocation;
  unifSkyboxLuminance: WebGLUniformLocation;
  unifSkyboxTurbidity: WebGLUniformLocation;

  unifDeferredMaterialType: WebGLUniformLocation;

  unifWorldReflectionViewProjection: WebGLUniformLocation;

  unifWaterReflectionTexture: WebGLUniformLocation;
  unifWaterEyePos: WebGLUniformLocation;
  unifWaterSunDirection: WebGLUniformLocation;
  unifWaterSize: WebGLUniformLocation;
  unifWaterDistortionScale: WebGLUniformLocation;

  constructor(shaders: Array<Shader>) {
    this.prog = gl.createProgram();

    for (let shader of shaders) {
      gl.attachShader(this.prog, shader.shader);
    }
    gl.linkProgram(this.prog);
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw gl.getProgramInfoLog(this.prog);
    }

    this.attrPos = gl.getAttribLocation(this.prog, "vs_Pos");
    this.attrNor = gl.getAttribLocation(this.prog, "vs_Nor");
    this.attrCol = gl.getAttribLocation(this.prog, "vs_Col");
    this.attrUV = gl.getAttribLocation(this.prog, "vs_UV");
    this.attrDep = gl.getAttribLocation(this.prog, "vs_Dep");
    this.unifModel = gl.getUniformLocation(this.prog, "u_Model");
    this.unifModelInvTr = gl.getUniformLocation(this.prog, "u_ModelInvTr");
    this.unifViewProj = gl.getUniformLocation(this.prog, "u_ViewProj");
    this.unifView = gl.getUniformLocation(this.prog, "u_View");
    this.unifProj = gl.getUniformLocation(this.prog, "u_Proj");
    this.unifColor = gl.getUniformLocation(this.prog, "u_Color");
    this.unifTime = gl.getUniformLocation(this.prog, "u_Time")
    this.unifHeight = gl.getUniformLocation(this.prog, "u_Height");
    this.unifWidth  = gl.getUniformLocation(this.prog, "u_Width");

    this.unifOriWeight = gl.getUniformLocation(this.prog, "u_OriginalSceneWeight");
    this.unifHighLightWeight = gl.getUniformLocation(this.prog, "u_HighLightWeight");

    this.unifGodrayScreenSpaceLightPos = gl.getUniformLocation(this.prog, "u_screenSpaceLightPos");
    this.unifGodrayDensity = gl.getUniformLocation(this.prog, "u_Density");
    this.unifGodrayWeight = gl.getUniformLocation(this.prog, "u_Weight");
    this.unifGodrayDecay = gl.getUniformLocation(this.prog, "u_Decay");
    this.unifGodrayExposure = gl.getUniformLocation(this.prog, "u_Exposure");
    this.unifGodrayNumSamples = gl.getUniformLocation(this.prog, "u_NumSamples");

    this.unifEnableTexture = gl.getUniformLocation(this.prog, "u_EnableTexture");

    this.unifFadeLevel = gl.getUniformLocation(this.prog, "u_fadeLevel");


    this.unifGridSize = gl.getUniformLocation(this.prog, "u_GridSize");
    this.unifDivision = gl.getUniformLocation(this.prog, "u_Division");
    this.unifCameraPos = gl.getUniformLocation(this.prog, "u_CameraPos");

    this.unifRoughness = gl.getUniformLocation(this.prog, "u_Roughness");
    this.unifShininess = gl.getUniformLocation(this.prog, "u_Shininess");
    this.unifAmbient = gl.getUniformLocation(this.prog, "u_Ambient");
    this.unifBrightness = gl.getUniformLocation(this.prog, "u_Brightness");
    this.unifLevel = gl.getUniformLocation(this.prog, "u_Level");

    this.unifSandEdge = gl.getUniformLocation(this.prog, "u_SandEdge");
    this.unifSandSteep = gl.getUniformLocation(this.prog, "u_SandSteep");
    this.unifFlowEdge = gl.getUniformLocation(this.prog, "u_FlowEdge");
    this.unifFlowSpeed = gl.getUniformLocation(this.prog, "u_FlowSpeed");

    this.unifSandDiffuse = gl.getUniformLocation(this.prog, "u_SandDiffuse");
    this.unifSandSpecular = gl.getUniformLocation(this.prog, "u_SandSpecular");
    this.unifFogDensity = gl.getUniformLocation(this.prog, "u_FogDensity");

    this.unifCloudEdge = gl.getUniformLocation(this.prog, "u_CloudEdge");
    this.unifCloudSize = gl.getUniformLocation(this.prog, "u_CloudSize");
    this.unifCloudNoise = gl.getUniformLocation(this.prog, "u_CloudNoise");
    this.unifCloudSpeed = gl.getUniformLocation(this.prog, "u_CloudSpeed");
    this.unifCloudSpeed2 = gl.getUniformLocation(this.prog, "u_CloudSpeed2");

    this.unifAmount = gl.getUniformLocation(this.prog, "u_Amount");
    this.unifAmount2 = gl.getUniformLocation(this.prog, "u_Amount2");
    this.unifAmount3 = gl.getUniformLocation(this.prog, "u_Amount3");

    this.unifLightViewProj = gl.getUniformLocation(this.prog, "u_lightViewProj");
    this.unifShadowTexture = gl.getUniformLocation(this.prog, "u_shadowTexture");
    
    this.unifBgTexture = gl.getUniformLocation(this.prog, "u_BgTexutre");
    
    this.unifSkyboxSunPos = gl.getUniformLocation(this.prog, "u_SunPosition");
    this.unifSkyboxLuminance = gl.getUniformLocation(this.prog, "u_Luminance");
    this.unifSkyboxTurbidity = gl.getUniformLocation(this.prog, "u_Turbidity");
    
    this.unifDeferredMaterialType = gl.getUniformLocation(this.prog, "u_MaterialType");

    this.unifWorldReflectionViewProjection = gl.getUniformLocation(this.prog, "u_worldReflectionViewProjection");

    this.unifWaterReflectionTexture = gl.getUniformLocation(this.prog, "u_waterReflectionTexutre");
    this.unifWaterEyePos = gl.getUniformLocation(this.prog, "u_Eye");
    this.unifWaterSunDirection = gl.getUniformLocation(this.prog, "u_SunDirection");
    this.unifWaterSize = gl.getUniformLocation(this.prog, "u_waterSize");
    this.unifWaterDistortionScale = gl.getUniformLocation(this.prog, "u_waterDistortionScale");


    this.unifTexUnits = new Map<string, WebGLUniformLocation>();
  }

  setupTexUnits(handleNames: Array<string>) {
    for (let handle of handleNames) {
      var location = gl.getUniformLocation(this.prog, handle);
      if (location !== -1) {
        this.unifTexUnits.set(handle, location);
      } else {
        console.log("Could not find handle for texture named: \'" + handle + "\'!");
      }
    }
  }

  // Bind the given Texture to the given texture unit
  bindTexToUnit(handleName: string, tex: Texture, unit: number) {
    this.use();
    var location = this.unifTexUnits.get(handleName);
    if (location !== undefined) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      tex.bindTex();
      gl.uniform1i(location, unit);
    } else {
      console.log("Texture with handle name: \'" + handleName + "\' was not found");
    }
  }

  use() {
    if (activeProgram !== this.prog) {
      gl.useProgram(this.prog);
      activeProgram = this.prog;
    }
  }

  setModelMatrix(model: mat4) {
    this.use();
    if (this.unifModel !== -1) {
      gl.uniformMatrix4fv(this.unifModel, false, model);
    }

    if (this.unifModelInvTr !== -1) {
      let modelinvtr: mat4 = mat4.create();
      mat4.transpose(modelinvtr, model);
      mat4.invert(modelinvtr, modelinvtr);
      gl.uniformMatrix4fv(this.unifModelInvTr, false, modelinvtr);
    }
  }

  setViewProjMatrix(vp: mat4) {
    this.use();
    if (this.unifViewProj !== -1) {
      gl.uniformMatrix4fv(this.unifViewProj, false, vp);
    }
  }

  setViewMatrix(vp: mat4) {
    this.use();
    if (this.unifView !== -1) {
      gl.uniformMatrix4fv(this.unifView, false, vp);
    }
  }

  setProjMatrix(vp: mat4) {
    this.use();
    if (this.unifProj !== -1) {
      gl.uniformMatrix4fv(this.unifProj, false, vp);
    }
  }

  setGeometryColor(color: vec4) {
    this.use();
    if (this.unifColor !== -1) {
      gl.uniform4fv(this.unifColor, color);
    }
  }

  setTime(t: number) {
    this.use();
    if (this.unifTime !== -1) {
      gl.uniform1f(this.unifTime, t);
    }
  }

  setWidth(w: number){
    this.use();
    if(this.unifWidth !== -1){
      gl.uniform1f(this.unifWidth, w);
    }
  }

  setHeight(h: number){
    this.use();
    if(this.unifHeight !== -1){
      gl.uniform1f(this.unifHeight, h);
    }
  }



  setOriginalSceneWeight(w: number){
    this.use();
    if(this.unifOriWeight !== -1){
      gl.uniform1f(this.unifOriWeight, w);
    }
  }

  setHighLightWeight(w: number){
    this.use();
    if(this.unifHighLightWeight !== -1){
      gl.uniform1f(this.unifHighLightWeight, w);
    }
  }

  setGodRayScreenSpaceLightPos(pos: vec2){
    this.use();
    if(this.unifGodrayScreenSpaceLightPos !== -1){
      gl.uniform2fv(this.unifGodrayScreenSpaceLightPos, pos);
    }
  }

  setGodRayDensity(density: number){
    this.use();
    if(this.unifGodrayDensity !== -1){
      gl.uniform1f(this.unifGodrayDensity, density);
    }
  }

  setGodRayWeight(weight: number){
    this.use();
    if(this.unifGodrayWeight !== -1){
      gl.uniform1f(this.unifGodrayWeight, weight);
    }
  }

  setGodRayDecay(decay: number){
    this.use();
    if(this.unifGodrayDecay !== -1){
      gl.uniform1f(this.unifGodrayDecay, decay);
    }
  }

  setGodRayExposure(exposure: number){
    this.use();
    if(this.unifGodrayExposure !== -1){
      gl.uniform1f(this.unifGodrayExposure, exposure);
    }
  }

  setGodRaySamples(samples: number){
    this.use();
    if(this.unifGodrayNumSamples !== -1){
      gl.uniform1i(this.unifGodrayNumSamples, samples);
    }
  }

  setEnableTexutre(t: boolean){
    this.use();
    if(this.unifEnableTexture !== -1){
      gl.uniform1i(this.unifEnableTexture, t ? 1 : 0);
    }
  }

  setFadeLevel(l: number){
    this.use();
    if(this.unifFadeLevel !== -1){
      gl.uniform1f(this.unifFadeLevel, l);
    }
  }

  setGridSize(t: number) {
    this.use();
    if (this.unifGridSize !== -1) {
      gl.uniform1f(this.unifGridSize, t);
    }
  }

  setDivision(t: number) {
    this.use();
    if (this.unifDivision !== -1) {
      gl.uniform1f(this.unifDivision, t);
    }
  }

  setCameraPos(t: vec4) {
    this.use();
    if (this.unifCameraPos !== -1) {
      gl.uniform4fv(this.unifCameraPos, t);
    }
  }

  setRoughness(t: number) {
    this.use();
    if (this.unifRoughness !== -1) {
      gl.uniform1f(this.unifRoughness, t);
    }
  }

  setShininess(t: number) {
    this.use();
    if (this.unifShininess !== -1) {
      gl.uniform1f(this.unifShininess, t);
    }
  }

  setAmbient(t: number) {
    this.use();
    if (this.unifAmbient !== -1) {
      gl.uniform1f(this.unifAmbient, t);
    }
  }

  setBrightness(t: number) {
    this.use();
    if (this.unifBrightness !== -1) {
      gl.uniform1f(this.unifBrightness, t);
    }
  }

  setLevel(t: number) {
    this.use();
    if (this.unifLevel !== -1) {
      gl.uniform1f(this.unifLevel, t);
    }
  }

  setSandEdge(t: number) {
    this.use();
    if (this.unifSandEdge !== -1) {
      gl.uniform1f(this.unifSandEdge, t);
    }
  }

  setSandSteep(t: number) {
    this.use();
    if (this.unifSandSteep !== -1) {
      gl.uniform1f(this.unifSandSteep, t);
    }
  }

  setFlowEdge(t: number) {
    this.use();
    if (this.unifFlowEdge !== -1) {
      gl.uniform1f(this.unifFlowEdge, t);
    }
  }

  setFlowSpeed(t: number) {
    this.use();
    if (this.unifFlowSpeed !== -1) {
      gl.uniform1f(this.unifFlowSpeed, t);
    }
  }

  setSandDiffuse(t: vec4) {
    this.use();
    if (this.unifSandDiffuse !== -1) {
      gl.uniform4fv(this.unifSandDiffuse, t);
    }
  }

  setSandSpecular(t: vec4) {
    this.use();
    if (this.unifSandSpecular !== -1) {
      gl.uniform4fv(this.unifSandSpecular, t);
    }
  }

  setFogDensity(t: number) {
    this.use();
    if (this.unifFogDensity !== -1) {
      gl.uniform1f(this.unifFogDensity, t);
    }
  }

  setCloudEdge(t: number) {
    this.use();
    if (this.unifCloudEdge !== -1) {
      gl.uniform1f(this.unifCloudEdge, t);
    }
  }

  setCloudSize(t: number) {
    this.use();
    if (this.unifCloudSize !== -1) {
      gl.uniform1f(this.unifCloudSize, t);
    }
  }

  setCloudSpeed(t: number) {
    this.use();
    if (this.unifCloudSpeed !== -1) {
      gl.uniform1f(this.unifCloudSpeed, t);
    }
  }

  setCloudSpeed2(t: number) {
    this.use();
    if (this.unifCloudSpeed2 !== -1) {
      gl.uniform1f(this.unifCloudSpeed2, t);
    }
  }

  setCloudNoise(t: number) {
    this.use();
    if (this.unifCloudNoise !== -1) {
      gl.uniform1f(this.unifCloudNoise, t);
    }
  }

  setAmount(t: number) {
    this.use();
    if (this.unifAmount !== -1) {
      gl.uniform1f(this.unifAmount, t);
    }
  }

  setAmount2(t: number) {
    this.use();
    if (this.unifAmount2 !== -1) {
      gl.uniform1f(this.unifAmount2, t);
    }
  }

  setAmount3(t: number) {
    this.use();
    if (this.unifAmount3 !== -1) {
      gl.uniform1f(this.unifAmount3, t);
    }
  }

  setLightViewProjMatrix(lvp: mat4){
    this.use();
    if (this.unifLightViewProj !== -1) {
      gl.uniformMatrix4fv(this.unifLightViewProj, false, lvp);
    }
  }

  setShadowTexture(i: number) {
    this.use();
    if (this.unifShadowTexture !== -1) {
      gl.uniform1i(this.unifShadowTexture, i);
    }
  }

  setBgTexture(i: number) {
    this.use();
    if (this.unifBgTexture !== -1) {
      gl.uniform1i(this.unifBgTexture, i);
    }
  }


  setSkyboxSunPos(pos: vec3) {
    this.use();
    if (this.unifSkyboxSunPos !== -1) {
      gl.uniform3fv(this.unifSkyboxSunPos, pos);
    }
  }

  setSkyboxLuminace(l: number){
    this.use();
    if(this.unifSkyboxLuminance !== -1){
      gl.uniform1f(this.unifSkyboxLuminance, l);
    }
  }

  setSkyboxTurbidity(t: number){
    this.use();
    if(this.unifSkyboxTurbidity !== -1){
      gl.uniform1f(this.unifSkyboxTurbidity, t);
    }
  }

  setDeferredMaterialType(type: number){
    this.use();
    if(this.unifDeferredMaterialType !== -1){
      gl.uniform1f(this.unifDeferredMaterialType, type);
    }
  }

  setWorldReflectionViewProjection(wrvp: mat4) {
    this.use();
    if (this.unifWorldReflectionViewProjection !== -1) {
      gl.uniformMatrix4fv(this.unifWorldReflectionViewProjection, false, wrvp);
    }
  }

  setWaterReflectionTexture(i: number) {
    this.use();
    if (this.unifWaterReflectionTexture !== -1) {
      gl.uniform1i(this.unifWaterReflectionTexture, i);
    }
  }

  setWaterEyePos(eye: vec3){
    this.use();
    if(this.unifWaterEyePos !== -1){
      gl.uniform3fv(this.unifWaterEyePos, eye);
    }
  }

  setWaterSunDirection(dir: vec3){
    this.use();
    if(this.unifWaterSunDirection !== -1){
      gl.uniform3fv(this.unifWaterSunDirection, dir);
    }
  }

  setWaterSize(size: number){
    this.use();
    if(this.unifWaterSize !== -1){
      gl.uniform1f(this.unifWaterSize, size);
    }
  }

  setWaterDistortionScale(scale: number){
    this.use();
    if(this.unifWaterDistortionScale !== -1){
      gl.uniform1f(this.unifWaterDistortionScale, scale);
    }
  }



  draw(d: Drawable) {
    this.use();

    if (this.attrPos != -1 && d.bindPos()) {
      gl.enableVertexAttribArray(this.attrPos);
      gl.vertexAttribPointer(this.attrPos, 4, gl.FLOAT, false, 0, 0);
    }

    if (this.attrNor != -1 && d.bindNor()) {
      gl.enableVertexAttribArray(this.attrNor);
      gl.vertexAttribPointer(this.attrNor, 4, gl.FLOAT, false, 0, 0);
    }

    if (this.attrCol != -1 && d.bindCol()) {
      gl.enableVertexAttribArray(this.attrCol);
      gl.vertexAttribPointer(this.attrCol, 4, gl.FLOAT, false, 0, 0);
    }

    if (this.attrUV != -1 && d.bindUV()) {
      gl.enableVertexAttribArray(this.attrUV);
      gl.vertexAttribPointer(this.attrUV, 2, gl.FLOAT, false, 0, 0);
    }

    if (this.attrDep != -1 && d.bindDep()) {
      gl.enableVertexAttribArray(this.attrDep);
      gl.vertexAttribPointer(this.attrDep, 1, gl.FLOAT, false, 0, 0);
    }

    d.bindIdx();
    gl.drawElements(d.drawMode(), d.elemCount(), gl.UNSIGNED_INT, 0);

    if (this.attrPos != -1) gl.disableVertexAttribArray(this.attrPos);
    if (this.attrNor != -1) gl.disableVertexAttribArray(this.attrNor);
    if (this.attrCol != -1) gl.disableVertexAttribArray(this.attrCol);
    if (this.attrUV != -1) gl.disableVertexAttribArray(this.attrUV);
    if (this.attrDep != -1) gl.disableVertexAttribArray(this.attrDep);
  }
};

export default ShaderProgram;
