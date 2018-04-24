#version 300 es

// These consts should be consistent with those in OpenGLRneder.ts & Particle.ts
#define POSITION_LOCATION 8
// #define VELOCITY_LOCATION 9
#define COLOR_LOCATION 10
// #define TIME_LOCATION 11
// #define ID_LOCATION 12

precision highp float;
precision highp int;
precision highp sampler3D;


uniform mat4 u_Model;       

uniform mat4 u_View;    

uniform mat4 u_ViewProj;    

uniform mat3 u_CameraAxes; 


layout(location = POSITION_LOCATION) in vec3 a_position;
layout(location = COLOR_LOCATION) in vec3 a_color;


in vec4 vs_Pos; // Non-instanced; each particle is the same quad drawn in a different place

out vec4 fs_Pos;
out vec3 fs_Col;
out float fs_CameraSpaceDepth;

void main()
{
    // object space position
    fs_Pos = vs_Pos;

    // particle color
    fs_Col = a_color;

    // get particle postion
    vec3 offset = a_position;

    // model space position
    vec4 modelPos = u_Model * vs_Pos;

    // move billboard to partice position
    vec3 billboardPos = offset + modelPos.x * u_CameraAxes[0] + modelPos.y * u_CameraAxes[1];

    vec4 tmp = u_View * vec4(billboardPos, 1.0);
    fs_CameraSpaceDepth = tmp.z;

    gl_Position = u_ViewProj * vec4(billboardPos, 1.0);
}