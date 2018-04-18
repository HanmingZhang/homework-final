import {vec3, vec4, mat4} from 'gl-matrix';
import Drawable from '../rendering/gl/Drawable';
import {gl} from '../globals';
import * as Loader from 'webgl-obj-loader';
import Terrain from '../geometry/Terrain';

class Scatter extends Drawable {
  indices: Uint32Array;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  uvs: Float32Array;
  deps: Float32Array;
  center: vec4;
  num: number[];
  objString: string;
  terrain: Terrain;

  constructor(objString: string, center: vec3, model: mat4, num: number[], terrain: Terrain) {
    super(); // Call the constructor of the super class. This is required.
    this.center = vec4.fromValues(center[0], center[1], center[2], 1);

    this.objString = objString;

    this.model = mat4.clone(model);
    this.num = num;
    this.terrain = terrain;
  }

  computeRotationMatrix(original: vec3, endpoint: vec3){
    var rotated = endpoint;
    vec3.normalize(rotated, rotated);
    var axis = vec3.create();
    vec3.cross(axis, original, rotated);
    var dotproduct = vec3.dot(original, rotated);
    var angle = Math.acos(dotproduct);
    var matrix = mat4.create();
    mat4.fromRotation(matrix, angle, axis);
    return matrix;
  }

  create() {  
    let posTemp: Array<number> = [];
    let norTemp: Array<number> = [];
    let uvsTemp: Array<number> = [];
    let depsTemp: Array<number> = [];
    let idxTemp: Array<number> = [];

    var loadedMesh = new Loader.Mesh(this.objString);
    //console.log("positions" + this.terrain.positions);
    for(var j = 0; j < this.num.length; j++)
    {
      //var rand = Math.floor(Math.random() * this.terrain.positions.length / 4.0);
      var rand = this.num[j];
      var verticeslength = posTemp.length / 4;
      var translate = vec3.fromValues(this.terrain.positions[rand * 4.0], this.terrain.positions[rand * 4.0+1], this.terrain.positions[rand * 4.0+2]);
      var rotate = vec3.fromValues(this.terrain.normals[rand * 4.0] * 0.1, this.terrain.normals[rand * 4.0+1] * 0.1, this.terrain.normals[rand * 4.0+2] * 0.1);
      var rotation = this.computeRotationMatrix(vec3.fromValues(0, 1, 0), rotate);
      var vertex;
      var normal;
      //posTemp = loadedMesh.vertices;
      for (var i = 0; i < loadedMesh.vertices.length; i+=3) {

        vertex = vec3.fromValues(loadedMesh.vertices[i], loadedMesh.vertices[i+1], loadedMesh.vertices[i+2]);
        //depsTemp.push((vertex[1]+2.0) / 14.0);
        //console.log("depsTemp" + (vertex[1]+2.0) / 14.0);
        vec3.transformMat4(vertex, vertex, rotation);
        depsTemp.push((vertex[1]+2.0) / 14.0);
        posTemp.push( vertex[0] + translate[0], vertex[1] + translate[1], vertex[2] + translate[2], 1);
        normal = vec3.fromValues( loadedMesh.vertexNormals[i], loadedMesh.vertexNormals[i+1], loadedMesh.vertexNormals[i+2]);
        vec3.transformMat4(normal, normal, rotation);
        vec3.normalize(normal, normal);
        norTemp.push( normal[0], normal[1], normal[2], 0);
      }

      for(let i = 0; i < loadedMesh.indices.length; i++)
      {
        idxTemp.push(loadedMesh.indices[i] + verticeslength);
      }

      for(let i = 0; i < loadedMesh.textures.length; i++)
      {
        uvsTemp.push(loadedMesh.textures[i] + verticeslength);
      }

      // white vert color for now
      this.colors = new Float32Array(posTemp.length);
      for (var i = 0; i < posTemp.length; ++i){
        this.colors[i] = 1.0;
      }
    }


    this.indices = new Uint32Array(idxTemp);
    this.normals = new Float32Array(norTemp);
    this.positions = new Float32Array(posTemp);
    this.uvs = new Float32Array(uvsTemp);
    this.deps = new Float32Array(depsTemp);

    this.generateIdx();
    this.generatePos();
    this.generateNor();
    this.generateUV();
    this.generateCol();
    this.generateDep();

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

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufDep);
    gl.bufferData(gl.ARRAY_BUFFER, this.deps, gl.STATIC_DRAW);

    console.log(`Created Scatter from OBJ`);
    this.objString = ""; // hacky clear
  }

  create2() {  
    let posTemp: Array<number> = [];
    let norTemp: Array<number> = [];
    let uvsTemp: Array<number> = [];
    let depsTemp: Array<number> = [];
    let idxTemp: Array<number> = [];

    var loadedMesh = new Loader.Mesh(this.objString);
    //console.log("positions" + this.terrain.positions);
    //wind direction
    var rotation2 = this.computeRotationMatrix(vec3.fromValues(1, 0, 0), vec3.fromValues(1, 0, 1));
    for(var j = 0; j < this.num.length; j++)
    {
      //var rand = Math.floor(Math.random() * this.terrain.positions.length / 4.0);
      var rand = this.num[j];
      var verticeslength = posTemp.length / 4;
      var rotate = vec3.fromValues(this.terrain.normals[rand * 4.0] * 0.1, this.terrain.normals[rand * 4.0+1] * 0.1, this.terrain.normals[rand * 4.0+2] * 0.1);
      var rotation = this.computeRotationMatrix(vec3.fromValues(0, 1, 0), rotate);
      var height = vec3.fromValues(0.0, 13.0, 0.0);
      vec3.transformMat4(height, height, rotation);
      if(height[1]<12.5)
      {
        continue;
      }
      var translate = vec3.fromValues(this.terrain.positions[rand * 4.0] + height[0], this.terrain.positions[rand * 4.0+1] + height[1], this.terrain.positions[rand * 4.0+2] + height[2]);
      var vertex;
      var normal;
      //posTemp = loadedMesh.vertices;
      for (var i = 0; i < loadedMesh.vertices.length; i+=3) {

        vertex = vec3.fromValues(loadedMesh.vertices[i], loadedMesh.vertices[i+1], loadedMesh.vertices[i+2]);
        //depsTemp.push((vertex[1]+2.0) / 14.0);
        //console.log("depsTemp" + (vertex[1]+2.0) / 14.0);
        depsTemp.push(-vertex[0] / 30.0);
        //console.log("depsTemp" + vertex[0] / 30.0);
        vec3.transformMat4(vertex, vertex, rotation2);
        posTemp.push( vertex[0] + translate[0], vertex[1] + translate[1], vertex[2] + translate[2], 1);
        normal = vec3.fromValues( loadedMesh.vertexNormals[i], loadedMesh.vertexNormals[i+1], loadedMesh.vertexNormals[i+2]);
        vec3.transformMat4(normal, normal, rotation2);
        vec3.normalize(normal, normal);
        norTemp.push( normal[0], normal[1], normal[2], 0);
      }

      for(let i = 0; i < loadedMesh.indices.length; i++)
      {
        idxTemp.push(loadedMesh.indices[i] + verticeslength);
      }

      for(let i = 0; i < loadedMesh.textures.length; i++)
      {
        uvsTemp.push(loadedMesh.textures[i] + verticeslength);
      }

      // white vert color for now
      this.colors = new Float32Array(posTemp.length);
      for (var i = 0; i < posTemp.length; ++i){
        this.colors[i] = 1.0;
      }
    }


    this.indices = new Uint32Array(idxTemp);
    this.normals = new Float32Array(norTemp);
    this.positions = new Float32Array(posTemp);
    this.uvs = new Float32Array(uvsTemp);
    this.deps = new Float32Array(depsTemp);

    this.generateIdx();
    this.generatePos();
    this.generateNor();
    this.generateUV();
    this.generateCol();
    this.generateDep();

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

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufDep);
    gl.bufferData(gl.ARRAY_BUFFER, this.deps, gl.STATIC_DRAW);

    console.log(`Created Scatter from OBJ`);
    this.objString = ""; // hacky clear
  }
};

export default Scatter;
