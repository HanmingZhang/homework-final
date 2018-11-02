#version 300 es
precision highp float;

uniform mat4 u_Model;
uniform mat4 u_ModelInvTr;  

uniform mat4 u_View;   
uniform mat4 u_Proj; 
uniform float u_octaves;
uniform float u_Division;

uniform float u_Time;

uniform float u_CloudEdge;
uniform float u_CloudSize;
uniform float u_CloudNoise;
uniform float u_CloudSpeed;
uniform float u_CloudSpeed2;

in vec4 vs_Pos;
in vec4 vs_Nor;
in vec4 vs_Col;
in vec2 vs_UV;
in float vs_Dep;

out vec4 fs_Pos;
out vec4 fs_Nor;            
out vec4 fs_Col;           
out vec2 fs_UV;
out vec4 old_Nor;
out vec4 old_Pos;
out float fs_Dep;
out float fs_Shadow;

//https://www.shadertoy.com/view/4djSRW
#define HASHSCALE1 .1031
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

// Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

vec2 rotate2(vec2 uv)
{
    uv = uv + noise(uv*0.2)*0.005;
    float rot = 3.0;
    float sinRot=sin(rot);
    float cosRot=cos(rot);
    mat2 rotMat = mat2(cosRot,-sinRot,sinRot,cosRot);
    return uv * rotMat;
}

#define OCTAVES 6
#define HEIGHT 50.0
#define SIZE 4.0
float FBM (in vec2 st, int octaves) {
    // Initial values
    vec2 newpos =st * SIZE;
    float value = 0.0;
    float amplitude = .5;
    float frequency = 0.;
    //
    // Loop of octaves
    vec2 temppos = newpos;
    for (int i = 0; i < octaves; i++) {
        value += amplitude * noise(temppos + u_Time * u_CloudSpeed2);
        temppos *= 2.;
        temppos = rotate2(temppos);
        amplitude *= .5;
    }
    return value;
}

vec3 computenormal(vec2 pos, float e)
{
    return normalize(vec3(FBM(pos - vec2(e, 0.0), OCTAVES) - FBM(pos + vec2(e, 0.0), OCTAVES), 
                0.0,
                FBM(pos - vec2(0.0, e), OCTAVES) - FBM(pos + vec2(0.0, e), OCTAVES)));
}

//# P.xy store the position for which we want to calculate the normals
  // # height() here is a function that return the height at a point in the terrain

  // read neightbor heights using an arbitrary small offset
// vec3 returnnormal(vec2 pxz)
// {
//     vec3 off = vec3(u_CloudNoise / u_Division, 0.0, u_CloudNoise / u_Division);
//     float hL = FBM((pxz - off.xy)/ u_CloudNoise, OCTAVES);
//     float hR = FBM((pxz + off.xy)/ u_CloudNoise, OCTAVES);
//     float hD = FBM((pxz - off.yz)/ u_CloudNoise, OCTAVES);
//     float hU = FBM((pxz + off.yz)/ u_CloudNoise, OCTAVES);
//     // deduce terrain normal
//     vec3 N;
//     N.x = (hL - hR) * HEIGHT;
//     N.z = (hD - hU) * HEIGHT;
//     N.y = 2.0;
//     N = normalize(N);
//     return N;
// }

void main()
{
    fs_Col = vs_Col;
    fs_UV = vs_UV;
    fs_UV.y = 1.0 - fs_UV.y;

    // fragment info is in view space
    mat3 invTranspose = mat3(u_ModelInvTr);
    mat3 view = mat3(u_View);
    fs_Pos = vs_Pos;
    fs_Shadow = clamp(FBM(vs_Pos.xz / u_CloudNoise + u_CloudSpeed * u_Time, OCTAVES) - u_CloudSize, 0.0, 1.0);
    fs_Shadow = pow(fs_Shadow, u_CloudEdge);
    //fs_Pos.y = FBM(vs_Pos.xz / u_CloudNoise, OCTAVES) * HEIGHT;
    old_Pos = fs_Pos;
    //vec3 newnor = returnnormal(fs_Pos.xz);
    old_Nor = vs_Nor;
    fs_Nor = vec4(view * invTranspose * (vs_Nor.xyz), 0.0);
    gl_Position = u_Proj * u_View * u_Model * fs_Pos;

    fs_Pos = u_View * u_Model * fs_Pos;
    fs_Dep = vs_Dep;
}
