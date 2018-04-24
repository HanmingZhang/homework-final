import {gl} from '../globals';


// These consts should be consistent with those in OpenGLRneder.ts & particle-vert.glsl
const POSITION_LOCATION = 8;
const VELOCITY_LOCATION = 9;
const COLOR_LOCATION = 10;
const TIME_LOCATION = 11;
const ID_LOCATION = 12;

const NUM_LOCATIONS = 5;


class Particle{
    numParticles: number;
    particlePositions: Float32Array;
    particleVelocities: Float32Array;
    particleColors: Float32Array;
    particleTime: Float32Array;
    particleIDs: Float32Array;


    // vertex arrays and buffers
    particleVAOs: WebGLVertexArrayObject[];
    particleTransformFeedbacks: WebGLTransformFeedback[];
    particleVBOs: WebGLBuffer[][];

    constructor(_numParticles: number){
        this.numParticles = _numParticles;

        // Construct particle data
        this.particlePositions  = new Float32Array(this.numParticles * 3);
        this.particleVelocities = new Float32Array(this.numParticles * 3);
        this.particleColors     = new Float32Array(this.numParticles * 3);
        this.particleTime   = new Float32Array(this.numParticles * 2);
        this.particleIDs        = new Float32Array(this.numParticles);
       
        // Init Vertex Arrays and Buffers
        this.particleVAOs = [gl.createVertexArray(), gl.createVertexArray()];
         
        // Transform feedback objects track output buffer state
        this.particleTransformFeedbacks = [gl.createTransformFeedback(), gl.createTransformFeedback()];
    }

    create(){
        // Initialize particle values
        for (let p = 0; p < this.numParticles; ++p) {
            this.particlePositions[p * 3] = 0.0;
            this.particlePositions[p * 3 + 1] = 0.8;
            this.particlePositions[p * 3 + 2] = 0.0;
            
            this.particleVelocities[p * 3] = 0.0;
            this.particleVelocities[p * 3 + 1] = 0.0;
            this.particleVelocities[p * 3 + 2] = 0.0;
            
            this.particleColors[p * 3] = 0.0;
            this.particleColors[p * 3 + 1] = 0.0;
            this.particleColors[p * 3 + 2] = 0.0;

            this.particleTime[p * 2] = 0.0;
            this.particleTime[p * 2 + 1] = 0.0;
            
            this.particleIDs[p] = p;
        }

       
        this.particleVBOs = new Array(this.particleVAOs.length);

        for (let i = 0; i < this.particleVAOs.length; ++i) {
            this.particleVBOs[i] = new Array(NUM_LOCATIONS);

            gl.bindVertexArray(this.particleVAOs[i]);

            this.particleVBOs[i][POSITION_LOCATION] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVBOs[i][POSITION_LOCATION]);
            gl.bufferData(gl.ARRAY_BUFFER, this.particlePositions, gl.STREAM_COPY);
            gl.vertexAttribPointer(POSITION_LOCATION, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(POSITION_LOCATION);
    
            this.particleVBOs[i][VELOCITY_LOCATION] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVBOs[i][VELOCITY_LOCATION]);
            gl.bufferData(gl.ARRAY_BUFFER, this.particleVelocities, gl.STREAM_COPY);
            gl.vertexAttribPointer(VELOCITY_LOCATION, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(VELOCITY_LOCATION);

            this.particleVBOs[i][COLOR_LOCATION] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVBOs[i][COLOR_LOCATION]);
            gl.bufferData(gl.ARRAY_BUFFER, this.particleVelocities, gl.STREAM_COPY);
            gl.vertexAttribPointer(COLOR_LOCATION, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(COLOR_LOCATION);

            this.particleVBOs[i][TIME_LOCATION] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVBOs[i][TIME_LOCATION]);
            gl.bufferData(gl.ARRAY_BUFFER, this.particleTime, gl.STREAM_COPY);
            gl.vertexAttribPointer(TIME_LOCATION, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(TIME_LOCATION);
     
            this.particleVBOs[i][ID_LOCATION] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVBOs[i][ID_LOCATION]);
            gl.bufferData(gl.ARRAY_BUFFER, this.particleIDs, gl.STATIC_READ);
            gl.vertexAttribPointer(ID_LOCATION, 1, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(ID_LOCATION);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            
            // Set up output
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.particleTransformFeedbacks[i]);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.particleVBOs[i][POSITION_LOCATION]);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.particleVBOs[i][VELOCITY_LOCATION]);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, this.particleVBOs[i][COLOR_LOCATION]);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 3, this.particleVBOs[i][TIME_LOCATION]);
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        }
    }

    getVAO(idx: number): WebGLVertexArrayObject{
        return this.particleVAOs[idx];
    }

    getTransformFeedbacks(idx: number): WebGLTransformFeedback{
        return this.particleTransformFeedbacks[idx];
    }

    getVBO(idx: number): WebGLBuffer[]{
        return this.particleVBOs[idx];
    }
}

export default Particle;