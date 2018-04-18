import {vec2, vec3, vec4, mat4} from 'gl-matrix';
import Drawable from '../rendering/gl/Drawable';
import Square from '../geometry/Square';
import Camera from '../Camera';
import Plane from '../material/Plane';
import {gl} from '../globals';
import Texture from '../rendering/gl/Texture';


function ReflectionToRef(plane: Plane, result: mat4){
  plane.normalize();
  var x = plane.normal[0];
  var y = plane.normal[1];
  var z = plane.normal[2];
  var temp = -2 * x;
  var temp2 = -2 * y;
  var temp3 = -2 * z;
  
  result[0] = (temp * x) + 1;
  result[1] = temp2 * x;
  result[2] = temp3 * x;
  result[3] = 0.0;
  result[4] = temp * y;
  result[5] = (temp2 * y) + 1;
  result[6] = temp3 * y;
  result[7] = 0.0;
  result[8] = temp * z;
  result[9] = temp2 * z;
  result[10] = (temp3 * z) + 1;
  result[11] = 0.0;
  result[12] = temp * plane.d;
  result[13] = temp2 * plane.d;
  result[14] = temp3 * plane.d;
  result[15] = 1.0;
}


class Water{
  square: Drawable;

  // reflection texture
  reflectionTexture: WebGLTexture;
  reflectRTTFramebuffer: WebGLFramebuffer;
  reflectionTextureSize: vec2;
  reflectedView: mat4;
  size: vec2;
  offset: vec3;

  worldReflectionViewProjection: mat4;

  normal_tex: Texture;


  constructor(size: vec2, offset: vec3, normalImgSource: string, reflectionRTTSize: vec2 = vec2.fromValues(512, 512)) {

    // initialize water plane geometry
    let modelMatrix = mat4.create();
    mat4.identity(modelMatrix);
    mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(size[0], 1.0, size[1]));  
    mat4.rotateX(modelMatrix, modelMatrix, -0.5 * 3.1415926);
    mat4.translate(modelMatrix, modelMatrix, offset);
    this.square = new Square(vec3.fromValues(0, 0, 0), modelMatrix);
    this.square.create();

    this.reflectionTextureSize = vec2.fromValues(reflectionRTTSize[0], reflectionRTTSize[1]);
    this.size = vec2.clone(size);
    this.offset = vec3.clone(offset);

    this.worldReflectionViewProjection = mat4.create();
    this.reflectedView = mat4.create();

    this.normal_tex = new Texture(normalImgSource);
  }

  // set reflected view matrix for current camera
  setReflectedView(camera: Camera){
    // have correct view matrix of mirrored camera
    let clipPlane = new Plane(vec3.fromValues(0, this.offset[1] - 0.05, 0), vec3.fromValues(0, -1, 0));
    
    let mirrorMat4 = mat4.create();
    ReflectionToRef(clipPlane, mirrorMat4);

    let view = camera.viewMatrix;
    
    // mat4.multiply(water.reflectedView, mirrorMat4, view);
    mat4.multiply(this.reflectedView, view, mirrorMat4);
  }

};

export default Water;
