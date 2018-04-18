import {vec3, vec4, mat4} from 'gl-matrix';
import Drawable from '../rendering/gl/Drawable';
import {gl} from '../globals';

class Grid extends Drawable {
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

  constructor(width: number, height: number, widthSegments: number, heightSegments: number, model: mat4) {
    super(); // Call the constructor of the super class. This is required.
    //this.center = vec4.fromValues(center[0], center[1], center[2], 1);
    this.width = width;
    this.height = height;
    this.widthSegments = widthSegments;
    this.heightSegments = heightSegments;
    this.model = mat4.clone(model);
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
    
          vertices.push( x, 0, - y, 1 );
          normals.push( 0, 1, 0, 0 );
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

    console.log(`Created Grid`);
  }
};

export default Grid;
