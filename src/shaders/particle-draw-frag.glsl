 #version 300 es
precision highp float;
precision highp int;

uniform float u_Time;
uniform float u_ParticleRadius;    // a particle radius related to the whole billboard

in vec4 fs_Pos;
in vec3 fs_Col;
in float fs_CameraSpaceDepth;

out vec4 out_Col;


void main()
{
    float dist = clamp(1.0 - (length(fs_Pos.xyz) * 1.0 / u_ParticleRadius), 0.0, 1.0);

    out_Col = vec4(vec3(dist) * fs_Col, fs_CameraSpaceDepth);
}