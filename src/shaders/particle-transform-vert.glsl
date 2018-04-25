#version 300 es

// These consts should be consistent with those in OpenGLRneder.ts & Particle.ts
#define POSITION_LOCATION 8
#define VELOCITY_LOCATION 9
#define COLOR_LOCATION 10
#define TIME_LOCATION 11
#define ID_LOCATION 12

#define HASHSCALE1 0.1031
#define HASHSCALE3 vec3(.10317512, .10304682, .09734537)

precision highp float;
precision highp int;
precision highp sampler3D;


const float PI = 3.14159;
const float TWO_PI = 6.2831;

const vec3 ParticleCol = vec3(0.1, 1.0, 0.1);

const float terrainSegement = 300.0;
const float terrainSize = 300.0;
const float terrainYOffset = 100.0;
const float terrainDepth = 400.0;
const float terrainNoiseSize = 0.25;
const float terrainBoundaryMin = -150.0;
const float terrainBoundaryMax = 150.0;
const int terrainOctaves = 6;

uniform float u_Time;

uniform float u_CloudEdge;
uniform float u_CloudSize;
uniform float u_CloudNoise;
uniform float u_CloudSpeed;
uniform float u_CloudSpeed2;

uniform vec4 u_Color;

layout(location = POSITION_LOCATION) in vec3 a_position;
layout(location = VELOCITY_LOCATION) in vec3 a_velocity;
layout(location = COLOR_LOCATION) in vec3 a_color;
layout(location = TIME_LOCATION) in vec2 a_time; // vec.x is spawn time, vec.y is lifetime
layout(location = ID_LOCATION) in float a_ID;

out vec3 v_position;
out vec3 v_velocity;
out vec3 v_color;
out vec2 v_time; // vec.x spawn time, vec.y lifetime


float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float hash11(float p)
{
	vec3 p3  = fract(vec3(p) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash21(float p)
{
	vec3 p3 = fract(vec3(p) * HASHSCALE3);
	p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx+p3.yz)*p3.zy);
}

//https://www.shadertoy.com/view/4djSRW
float hash12(vec2 p) {
    vec3 p3;
    float p3x = fract(p[0] * HASHSCALE1);
    float p3y = fract(p[1] * HASHSCALE1);
    p3 = vec3(p3x, p3y, p3x);
    vec3 p3yzx = vec3(p3y + 19.19, p3x + 19.19, p3x + 19.19);
    float dotp3 = dot(p3, p3yzx);
    p3 = vec3(p3x + dotp3, p3y + dotp3, p3x + dotp3);
    return fract((p3.x + p3.y) * p3.z);  
}

float thintw(float f) {
    return f * f * (3.0 - 2.0 * f);
}


// Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float genNoise (vec2 st) {
  
  vec2 i = vec2(floor(st[0]), floor(st[1]));
  vec2 f = vec2(fract(st[0]), fract(st[1]));

  // Four corners in 2D of a tile
  vec2 tv2;
  float a = hash12(i);
  tv2 = i + vec2(1.0, 0.0);

  float b = hash12(tv2);
  tv2 = i + vec2(0.0, 1.0);

  float c = hash12(tv2);
  tv2 = i + vec2(1.0, 1.0);

  float d = hash12(tv2);
  vec2 u = vec2(thintw(f.x), thintw(f.y));

  float n = mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;

  return n;
}


float FBM (vec2 st) {
    // Initial values
    vec2 newpos;
    newpos = terrainNoiseSize * st;
    newpos = newpos + vec2(3.0, 3.0);
   
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 0.;
    float n;
    
    // Loop of octaves
    for (int i = 0; i < terrainOctaves; i++) {
      n = 1.0 - abs(genNoise(newpos) * 2.0 - 1.0);
      n = pow(n, 4.0);
      value += amplitude * n;
      newpos = 2.0 * newpos;
      amplitude *= 0.5;
    }

    return value;
}

float FBM2 (vec2 st) {
    // Initial values
    vec2 newpos;
    newpos = terrainNoiseSize * st;
    newpos = newpos + vec2(3.0, 3.0);
   
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 0.;
    float n;
    
    // Loop of octaves
    for (int i = 0; i < terrainOctaves; i++) {
      n = genNoise(newpos);
      //n = pow(n, 4.0);
      value += amplitude * n;
      newpos = 2.0 * newpos;
      amplitude *= 0.5;
    }

    return value;
}

vec2 rotate2(vec2 uv)
{
    uv = uv + genNoise(uv*0.2)*0.005;
    float rot = 3.0;
    float sinRot=sin(rot);
    float cosRot=cos(rot);
    mat2 rotMat = mat2(cosRot,-sinRot,sinRot,cosRot);
    return uv * rotMat;
}

#define OCTAVES 6
#define HEIGHT 50.0
#define SIZE 4.0
float FBM3 (in vec2 st, int octaves) {
    // Initial values
    vec2 newpos =st * SIZE;
    float value = 0.0;
    float amplitude = .5;
    float frequency = 0.;
    //
    // Loop of octaves
    vec2 temppos = newpos;
    for (int i = 0; i < octaves; i++) {
        value += amplitude * genNoise(temppos + u_Time * u_CloudSpeed2);
        temppos *= 2.;
        temppos = rotate2(temppos);
        amplitude *= .5;
    }
    return value;
}

vec3 genParticlePosOnTerreain(){
    vec2 tmp = hash21(a_ID);

    float tmp1 = terrainSize * (tmp.x - 0.5);
    float tmp2 = terrainSize * (tmp.y - 0.5);
    if(tmp1 < tmp2)
    {
        float temp = tmp1;
        tmp1 = tmp2;
        tmp2 = temp;
    }

    float z = FBM(vec2(tmp1 / terrainSegement, tmp2 / terrainSegement)) * terrainDepth;

    return vec3(tmp1, z - 0.5 * terrainDepth + terrainYOffset, -tmp2);
}

vec3 updateParticlePosOnTerrain(float newX, float newZ){

    float newHeight = FBM(vec2(newX/terrainSegement, -newZ/terrainSegement)) * terrainDepth;

    return vec3(newX, newHeight - 0.5 * terrainDepth + terrainYOffset, newZ);
}

vec3 ComputeCurl(vec3 pos)
{
    float x = pos.x;
    float y = pos.z;
    float eps = 1.0;
    float n1, n2, a, b;
    float size = 100.0;
    float speed = 5.0;
    n1 = FBM2((vec2(x, y + eps) + u_Time * speed) / size);
    n2 = FBM2((vec2(x, y - eps) + u_Time * speed) / size);
    a = (n1 - n2) / (2.0 * eps);
    n1 = FBM2((vec2(x + eps, y) + u_Time * speed) / size);
    n2 = FBM2((vec2(x - eps, y) + u_Time * speed) / size);
    b = (n1 - n2) / (2.0 * eps);

    return normalize(vec3(a, 0.0, -b));
}



void main()
{   

    // if(a_ID > 90000.0){
    //     // -----------------------------------------------------------------
    //     // ---------------- old version particle update --------------------
    //     // -----------------------------------------------------------------

    //     // ************ particles should emit like a fountain **************

    //     // if the particle's spawn is 0.0 or its life time exceeds its life time
    //     if (a_time.x == 0.0 || (u_Time - a_time.x > a_time.y) || a_position.y < -0.5) {
    //     // if (a_time.x == 0.0 || (u_Time - a_time.x > a_time.y)) {

    //         // Generate a new particle
    //         v_position = vec3(0.0, 0.8, 0.0);
            
    //         v_velocity = vec3(rand(vec2(a_ID, 0.0)) - 0.5, rand(vec2(a_ID, a_ID)), rand(vec2(a_ID, 2.0 * a_ID)) - 0.5);
    //         v_velocity *= 1.0;

    //         v_color = vec3(rand(vec2(a_ID, 0.0)), rand(vec2(a_ID, a_ID)), rand(vec2(a_ID, 2.0 * a_ID)));

    //         v_time.x = u_Time; // update spawn time

    //         v_time.y = 2500.0; // set life time
    //     } else {
    //         // Update status information
    //         v_velocity = a_velocity + 0.01 * u_Acceleration;
    //         v_position = a_position + 0.01 * v_velocity;

    //         v_color = a_color;

    //         v_time = a_time;
    //     }
    //     // -----------------------------------------------------------------
    // }

    // else{

        // a new particle
        if(a_time.x == 0.0){
            // setup initial position
            v_position = genParticlePosOnTerreain();
            v_position = updateParticlePosOnTerrain(v_position.x, v_position.z);
            v_position.y += 1.0;

            // velocity (random)
            // v_velocity = vec3(rand(vec2(a_ID, 0.0)) - 0.5, rand(vec2(a_ID, a_ID)) - 0.5, rand(vec2(2.0 * a_ID, 2.0 * a_ID)) - 0.5);
            // v_velocity = normalize(v_velocity);
            v_velocity = vec3(1, 0, 1);

            // color
            // Set each invidual particle color here
            float fs_Shadow = clamp(FBM3(v_position.xz / u_CloudNoise + u_CloudSpeed * u_Time, OCTAVES) - u_CloudSize, 0.0, 1.0);
            fs_Shadow = pow(fs_Shadow, u_CloudEdge);
            v_color = u_Color.xyz * fs_Shadow;

            // spawn time
            v_time.x = u_Time;

            // life time
            v_time.y = 5000.0; 
        }
        // an old particle
        // update particle information
        else{
            // update positin
            float deltaTime = 1.0;

            vec3 vel = vec3(0.0, 0.0, 0.0);

            // original random velcoity
            //float theta = FBM((vec2(a_position.x, a_position.z) + u_Time * 0.1) / 10.0) * TWO_PI;

            vel = a_velocity + 1.0 * ComputeCurl(a_position);// + vec3(cos(theta), 0.0, sin(theta)) * 2.0; //

            vec3 tmpPos = a_position + 0.25 * deltaTime * -vel;

            // tmpPos.x = mod((tmpPos.x + 150.0), 300.0) - 150.0;
            // tmpPos.z = mod((tmpPos.z + 150.0), 300.0) - 150.0;

            // calculate final position
            v_position = updateParticlePosOnTerrain(tmpPos.x, tmpPos.z);
            v_position.y += 1.0;
                
            // keep original random velcoity
            v_velocity = a_velocity; 
            
            // change each particle's color here
            float fs_Shadow = clamp(FBM3(tmpPos.xz / u_CloudNoise + u_CloudSpeed * u_Time, OCTAVES) - u_CloudSize, 0.0, 1.0);
            fs_Shadow = pow(fs_Shadow, u_CloudEdge);
            v_color = u_Color.xyz * fs_Shadow;

            // we doesn't change life time / spawn here
            v_time = a_time;

            //if out of boundary
            if(tmpPos.x < terrainBoundaryMin || tmpPos.x > terrainBoundaryMax
            || tmpPos.z < terrainBoundaryMin || tmpPos.z > terrainBoundaryMax){
                v_time.x = 0.0;
            }

            // if(temPosx == tmpPos.x || temPosz == tmpPos.z)
            // {
            //     v_time.x = 0.0;
            // }
        }

        

    // }


    // ---------------------------------------------
    // can be used for drawing dots

    // vec4 objPos = vec4(v_position, 1.0);
    // vec4 modelPos = u_Model * objPos;
    // gl_Position = modelPos;
}