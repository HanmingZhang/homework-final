import * as CameraControls from '3d-view-controls';
import {vec3, mat4} from 'gl-matrix';
import {CAMERA_MODE, CAMERA_SEQUENCE} from './main';

// for demo camera movement 
// the very intial fade effect length
const VERY_INITIAL_FADE_LENGTH = 4;
// the very final fade effect length
const VERY_FINAL_FADE_LENGTH = 6;


function lerpCamPos(startPos: vec3, endPos: vec3, t: number): vec3{
  var resultPos = vec3.create();

  resultPos[0] = (1.0 - t) * startPos[0] + t * endPos[0];
  resultPos[1] = (1.0 - t) * startPos[1] + t * endPos[1];
  resultPos[2] = (1.0 - t) * startPos[2] + t * endPos[2];

  return resultPos;
}


class Camera {
  controls: any;
  projectionMatrix: mat4 = mat4.create();
  viewMatrix: mat4 = mat4.create();
  fovy: number = 45 * 3.1415962 / 180.0;
  aspectRatio: number = 1;
  near: number = 0.1;
  far: number = 30000.0;
  position: vec3 = vec3.create();
  direction: vec3 = vec3.create();
  target: vec3 = vec3.create();
  up: vec3 = vec3.create();
  right: vec3 = vec3.create();
  forward: vec3 = vec3.create();

  // Demo camera paras
  camMode: CAMERA_MODE;

  demoCamTime: number;

  demoCamPosSequence: CAMERA_SEQUENCE[];
  demoCamTargetSequence: CAMERA_SEQUENCE[];
  demoCamPos: vec3 = vec3.create();
  demoCamTarget: vec3 = vec3.create();
  demoCamStageTotal: number;
  demoCamTotalLength: number;

  fadeEffectStartTime: number[];
  fadeEffectEndTime: number[];
  fadeLevel: number;
  fadeStageTotal: number;

  constructor(position: vec3, target: vec3) {
    this.controls = CameraControls(document.getElementById('canvas'), {
      eye: position,
      center: target,
    });
    this.controls.mode = 'turntable';
    vec3.add(this.target, this.position, this.direction);
    mat4.lookAt(this.viewMatrix, this.controls.eye, this.controls.center, this.controls.up);


    // -------------------------------------------------
    // Demo camera paras
    this.fadeEffectStartTime = [0.0]; // for the first fade in/out
    this.fadeEffectEndTime  = [VERY_INITIAL_FADE_LENGTH];  // for the first fade in/out

    this.demoCamPosSequence = [];     // key frame camera positions
    this.demoCamTargetSequence = [];  // key frame camera targets

    this.camMode = CAMERA_MODE.INTERACTIVE_MODE;

    // --------------------------------------------------
    // Particle billboard effects
    this.up = vec3.fromValues(0, 1, 0);
    vec3.subtract(this.forward, target, position);
    vec3.normalize(this.forward, this.forward);
    vec3.cross(this.right, this.forward, this.up);
    vec3.normalize(this.right, this.right);
  }

  setAspectRatio(aspectRatio: number) {
    this.aspectRatio = aspectRatio;
  }

  updateProjectionMatrix() {
    mat4.perspective(this.projectionMatrix, this.fovy, this.aspectRatio, this.near, this.far);
  }

  update() {
    // -------------------------------------------------
    // Interactive camera mode
    if(this.camMode == CAMERA_MODE.INTERACTIVE_MODE){
      this.controls.tick();

      vec3.add(this.target, this.position, this.direction);
      mat4.lookAt(this.viewMatrix, this.controls.eye, this.controls.center, this.controls.up);
      vec3.subtract(this.forward, this.controls.center, this.controls.eye);
    }

    // -------------------------------------------------
    // Demo camera mode
    else if(this.camMode == CAMERA_MODE.DEMO_MODE){
      
      // time fall into which fade stage
      let fadeStage = -1;
      for(let i = 0; i < this.fadeStageTotal; i++){
         if(this.demoCamTime >= this.fadeEffectStartTime[i] &&
            this.demoCamTime <= this.fadeEffectEndTime[i]){
              fadeStage = i;
              break;
          }
      }

      /// update fade level
      if(fadeStage !== -1){
        // TODO: replace cosine wave with other curves  
        // compute fade level value
        let duration = this.fadeEffectEndTime[fadeStage] - this.fadeEffectStartTime[fadeStage];
        let t = (this.demoCamTime - this.fadeEffectStartTime[fadeStage]) / duration;
        this.fadeLevel = Math.abs(Math.cos(t * 3.1415926));
        
        // clamp
        this.fadeLevel = Math.min(1.0, Math.max(0.0, this.fadeLevel));
      }

      // time fall into which cam movement stage
      let camStage = -1;
      for(let i = 0; i < this.demoCamStageTotal; i++){
        if(this.demoCamTime >= this.demoCamPosSequence[i].startTime &&
           this.demoCamTime < this.demoCamPosSequence[i].endTime){
            camStage = i;
             break;
         }
      }

      // lerp camera's position and target
      if(camStage !== -1){
        let t = (this.demoCamTime - this.demoCamPosSequence[camStage].startTime) / (this.demoCamPosSequence[camStage].endTime - this.demoCamPosSequence[camStage].startTime);
        this.demoCamPos    = lerpCamPos(this.demoCamPosSequence[camStage].startPos,    this.demoCamPosSequence[camStage].endPos, t);
        this.demoCamTarget = lerpCamPos(this.demoCamTargetSequence[camStage].startPos, this.demoCamTargetSequence[camStage].endPos, t)

        // update view matrix
        mat4.lookAt(this.viewMatrix, this.demoCamPos , this.demoCamTarget, vec3.fromValues(0, 1, 0)); 
        vec3.subtract(this.forward, this.demoCamTarget, this.demoCamPos);
        
      }

      // final fade in/out, we should back to general interactive camera
      if(camStage == -1 || this.demoCamTime >= this.demoCamTotalLength - 0.5 * VERY_FINAL_FADE_LENGTH){
        this.controls.tick();
        vec3.add(this.target, this.position, this.direction);
        mat4.lookAt(this.viewMatrix, this.controls.eye, this.controls.center, this.controls.up);
        vec3.subtract(this.forward, this.controls.center, this.controls.eye);        
      }

    }

    // -----------------------------------------------------
    // update forward, up, right directions of camera
    vec3.normalize(this.forward, this.forward);
    vec3.cross(this.right, this.forward, this.up);
    vec3.normalize(this.right, this.right);
    vec3.cross(this.up, this.right, this.forward);
    vec3.normalize(this.up, this.up);
  }

  // cinematic key framed camera paras
  updateDemoCamTime(deltaTime: number){
    this.demoCamTime += deltaTime;
  }

  launchDemoCam(totalLength: number){
    // initialize demo camera paras here
    this.demoCamTime = 0.0;

    this.camMode = CAMERA_MODE.DEMO_MODE;

    this.fadeLevel = 1.0;
    this.fadeEffectStartTime.push(totalLength - VERY_FINAL_FADE_LENGTH);
    this.fadeEffectEndTime.push(totalLength);
    this.fadeStageTotal = this.fadeEffectStartTime.length;

    this.demoCamStageTotal = this.demoCamPosSequence.length;
    this.demoCamTotalLength = totalLength;
  }

  endDemoCam(){
    // swich back to default interactive camera mode
    this.camMode = CAMERA_MODE.INTERACTIVE_MODE;
  }

  addDemoCamFadeEffect(startTime: number, endTime: number){
    this.fadeEffectStartTime.push(startTime);
    this.fadeEffectEndTime.push(endTime);
  }

  addDemoCamPos(p: CAMERA_SEQUENCE){
    this.demoCamPosSequence.push(p);
  }

  addDemoCamTarget(t: CAMERA_SEQUENCE){
    this.demoCamTargetSequence.push(t);
  }

};

export default Camera;
