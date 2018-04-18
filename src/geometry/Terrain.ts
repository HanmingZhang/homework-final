import {vec2, vec3, vec4, mat4} from 'gl-matrix';
import Drawable from '../rendering/gl/Drawable';
import {gl} from '../globals';

var HASHSCALE1 = 0.1031;

class Terrain extends Drawable {
  indices: Uint32Array;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  uvs: Float32Array;
  //center: vec4;
  width: number;
  height: number;
  widthSegments: number;
  heightSegments: number;
  octaves: number;
  depth: number;
  size: number;
  seed: number;
  gridsize2: number;

  constructor(width: number, height: number, widthSegments: number, heightSegments: number, 
    octaves: number = 6, depth: number = 50.0, size: number = 4.0, seed: number = 0.0,
    model: mat4, gridsize2: number = 0) {
    super(); // Call the constructor of the super class. This is required.
    //this.center = vec4.fromValues(center[0], center[1], center[2], 1);
    this.width = width;
    this.height = height;
    this.widthSegments = widthSegments;
    this.heightSegments = heightSegments;
    this.model = mat4.clone(model);
    this.octaves = octaves;
    this.depth = depth;
    this.size = size;
    this.seed = seed;
    this.gridsize2 = gridsize2;
  }

  fract(x: number){
    return x - Math.floor(x);
  }

  //https://www.shadertoy.com/view/4djSRW
  hash12(p: vec2) {
    var p3  = vec3.create();
    var p3x = this.fract(p[0] * HASHSCALE1);
    var p3y = this.fract(p[1] * HASHSCALE1);
    p3 = vec3.fromValues(p3x, p3y, p3x);
    var p3yzx = vec3.fromValues(p3y + 19.19, p3x + 19.19, p3x + 19.19);
    var dotp3 =  vec3.dot(p3, p3yzx);
    p3 = vec3.fromValues(p3x + dotp3, p3y + dotp3, p3x + dotp3)
    return this.fract((p3[0] + p3[1]) * p3[2]);  
  }

  thintw(f: number) {
    return f * f * (3.0 - 2.0 * f);
  }

  //x×(1−a)+y×a.
  mix(x: number, y: number, a: number) {
    return x * (1.0 - a) + y * a;
  }

  // Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
  noise (st: vec2) {
  var i = vec2.fromValues(Math.floor(st[0]), Math.floor(st[1]));
  var f = vec2.fromValues(this.fract(st[0]), this.fract(st[1]));

  // Four corners in 2D of a tile
  var tv2 = vec2.create();
  var a = this.hash12(i);
  vec2.add(tv2, i, vec2.fromValues(1.0, 0.0));
  var b = this.hash12(tv2);
  vec2.add(tv2, i, vec2.fromValues(0.0, 1.0));
  var c = this.hash12(tv2);
  vec2.add(tv2, i, vec2.fromValues(1.0, 1.0));
  var d = this.hash12(tv2);

  var u = vec2.fromValues(this.thintw(f[0]), this.thintw(f[1]));
  var n = this.mix(a, b, u[0]) + (c - a)* u[1] * (1.0 - u[0]) + (d - b) * u[0] * u[1];
  return n;
  }

  FBM (st: vec2) {
    // Initial values
    var newpos = vec2.create();
    vec2.scale(newpos, st, this.size);
    vec2.add(newpos, newpos, vec2.fromValues(this.seed, this.seed))
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 0.;
    var n;
    //
    // Loop of octaves
    for (var i = 0; i < this.octaves; i++) {
      n = 1.0 - Math.abs(this.noise(newpos) * 2.0 - 1.0);
      n = Math.pow(n, 4.0);
      value += amplitude * n;
      vec2.scale(newpos, newpos, 2.0)
      amplitude *= 0.5;
    }
    return value;
  }

  returnnormal(pxz: vec2)
  {
      var off = this.width / this.widthSegments;
      var hL = this.FBM(vec2.fromValues((pxz[0] -  off)/ this.widthSegments, pxz[1]/ this.heightSegments));
      var hR = this.FBM(vec2.fromValues((pxz[0] +  off)/ this.widthSegments, pxz[1]/ this.heightSegments));
      var hD = this.FBM(vec2.fromValues(pxz[0]/ this.widthSegments, (pxz[1] -  off)/ this.heightSegments));
      var hU = this.FBM(vec2.fromValues(pxz[0]/ this.widthSegments, (pxz[1] +  off)/ this.heightSegments));
      // deduce terrain normal
      var N = vec3.create();
      N[0] = (hL - hR) * this.depth;
      N[2] = (hD - hU) * this.depth;
      N[1] = 2.0;
      vec3.normalize(N, N);
      return N;
  }

  create() {

    var width = this.width || 1;
    var height = this.height || 1;
    var width_half = width / 2;
    var height_half = height / 2;

    var gridX = Math.floor( this.widthSegments ) || 1;
    var gridY = Math.floor( this.heightSegments ) || 1;
  
    var gridX1 = gridX + 1;
    var gridY1 = gridY + 1;
  
    var segment_width = width / gridX;
    var segment_height = height / gridY;

    var ix, iy;

    var indices = new Array<number>();
    var vertices = new Array<number>();
    var normals = new Array<number>();
    var uvs = new Array<number>();
    var colors = new Array<number>();

    	// generate vertices, normals and uvs

	for ( iy = 0; iy < gridY1; iy ++ ) {
    
        var y = iy * segment_height - height_half;
    
        for ( ix = 0; ix < gridX1; ix ++ ) {
    
          var x = ix * segment_width - width_half;

          if(x<this.gridsize2/2.0 && x>-this.gridsize2/2.0 && -y<this.gridsize2/2.0 && -y>-this.gridsize2/2.0)
          {
            vertices.push( x, - this.depth / 2.0, - y, 1 );
            normals.push(0, 1, 0, 0);
          }
          else
          {
            var z = this.FBM(vec2.fromValues(x / this.widthSegments, y / this.heightSegments)) * this.depth;
            vertices.push( x, z - this.depth / 2.0, - y, 1 );
            var nor = this.returnnormal(vec2.fromValues(x, y));
            normals.push( nor[0], nor[1], nor[2], 0 );
          }

          colors.push(1, 1, 1, 1);
    
          uvs.push( ix / gridX );
          uvs.push( 1 - ( iy / gridY ) );
    
        }
    
      }
    
      // indices
    
      for ( iy = 0; iy < gridY; iy ++ ) {
    
        for ( ix = 0; ix < gridX; ix ++ ) {
    
          var a = ix + gridX1 * iy;
          var b = ix + gridX1 * ( iy + 1 );
          var c = ( ix + 1 ) + gridX1 * ( iy + 1 );
          var d = ( ix + 1 ) + gridX1 * iy;
    
          // faces
    
          indices.push( a, b, d );
          indices.push( b, c, d );
    
        }
    
      }

  this.indices = new Uint32Array(indices);
  this.normals = new Float32Array(normals);
  this.positions = new Float32Array(vertices);

  console.log("indices" + indices.length);
  console.log("normals" + normals.length / 4.0);
  console.log("positions" + vertices.length / 4.0);
  console.log("uv" + uvs.length / 2.0);

  this.colors = new Float32Array(colors);
  this.uvs = new Float32Array(uvs);

    this.generateIdx();
    this.generatePos();
    this.generateNor();
    this.generateUV();
    this.generateCol();

    this.count = this.indices.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufNor);
    gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPos);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCol);
    gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);


    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUV);
    gl.bufferData(gl.ARRAY_BUFFER, this.uvs, gl.STATIC_DRAW);

    console.log(`Created Terrain`);
  }
};

export default Terrain;
