import {vec3, vec4, mat4} from 'gl-matrix';
import Drawable from '../rendering/gl/Drawable';
import {gl} from '../globals';

class Plane {
   normal: vec3;
   d: number;
  
   constructor(origin: vec3, normal: vec3) {
    this.normal = vec3.create();
    vec3.normalize(this.normal, normal);

    this.d = -(this.normal[0] * origin[0] + this.normal[1] * origin[1] + this.normal[2] * origin[2]);
   }
   
   normalize(){
    var norm = (Math.sqrt((this.normal[0] * this.normal[0]) + (this.normal[1] * this.normal[1]) + (this.normal[2] * this.normal[2])));
    var magnitude = 0.0;

    if (norm !== 0) {
        magnitude = 1.0 / norm;
    }
    this.normal[0] *= magnitude;
    this.normal[1] *= magnitude;
    this.normal[2] *= magnitude;
    this.d *= magnitude;
   }
};

export default Plane;
