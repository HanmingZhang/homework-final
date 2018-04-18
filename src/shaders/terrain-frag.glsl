#version 300 es
precision highp float;

in vec4 fs_Pos;
in vec4 fs_Nor;
in vec4 fs_Col;
in vec2 fs_UV;
in vec4 old_Nor;
in vec4 old_Pos;
in float fs_Shadow;

out vec4 fragColor[3]; // The data in the ith index of this array of outputs
                       // is passed to the ith index of OpenGLRenderer's
                       // gbTargets array, which is an array of textures.
                       // This lets us output different types of data,
                       // such as albedo, normal, and position, as
                       // separate images from a single render pass.

uniform sampler2D tex_Color;
uniform sampler2D tex_Normal;
uniform sampler2D tex_Specular;
uniform sampler2D sand_Normal;
uniform sampler2D sand_Normal2;

uniform float u_SandEdge;
uniform float u_SandSteep;
uniform float u_FlowEdge;
uniform float u_FlowSpeed;

uniform vec4 u_SandDiffuse;
uniform float u_Time;

uniform float u_GridSize;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normalize(normap.y * surftan + normap.x * surfbinor + normap.z * geomnor);
}

vec3 applyTriPlanar(sampler2D tex){

    vec3 col1 = texture(tex, old_Pos.xz / 100.0).rgb;
    vec3 col2 = texture(tex, old_Pos.xy / 100.0).rgb;
    vec3 col3 = texture(tex, old_Pos.yz / 100.0).rgb;
    vec3 col = vec3(0.0);
    vec3 nor = old_Nor.xyz * old_Nor.xyz;
    col += col1 * (nor.y);
    col += col2 * (nor.z);
    col += col3 * (nor.x);
    return col;
}

void main() {
    // TODO: pass proper data into gbuffers
    // Presently, the provided shader passes "nothing" to the first
    // two gbuffers and basic color to the third.

    
    vec3 Albedo = texture(tex_Color, fs_UV * 10.0 * u_GridSize / 300.0).rgb;
    vec3 Normal = texture(tex_Normal, fs_UV * 5.0).rgb;

    float directonx = sign(old_Nor.x);
    float directonz = sign(old_Nor.z);

    vec3 Sandx = texture(sand_Normal, fs_UV * 10.0 * u_GridSize / 300.0).rgb;
    vec3 Sandz = texture(sand_Normal, fs_UV.yx * 10.0 * u_GridSize / 300.0).rgb;
    vec3 Sandx2 = texture(sand_Normal2, fs_UV.yx * 10.0 * u_GridSize / 300.0).rgb;
    vec3 Sandz2 = texture(sand_Normal2, fs_UV * 10.0 * u_GridSize / 300.0).rgb;

    float xzRate = smoothstep(-0.5,0.5,(abs(old_Nor.z)-abs(old_Nor.x)) * u_SandEdge);
    vec3 sandsteep = mix(Sandz, Sandx, xzRate);
    vec3 sandshallow = mix(Sandz2, Sandx2, xzRate);
    vec3 sandnormal = mix(sandsteep, sandshallow, clamp(old_Nor.y - u_SandSteep, 0.0, 1.0));

    vec3 Normal_WS = applyNormalMap(fs_Nor.xyz, normalize(sandnormal * 2.0 - vec3(1.0)));

    vec3 Normal_WS2 = applyNormalMap(old_Nor.xyz, normalize(sandnormal * 2.0 - vec3(1.0)));
    directonx = sign(Normal_WS2.x);
    directonz = sign(Normal_WS2.z);
    vec3 SpecularMove = texture(tex_Specular, fs_UV * 10.0 * u_GridSize / 300.0 - vec2(u_Time * u_FlowSpeed * directonx, u_Time * u_FlowSpeed * directonz)).rgb;
    vec3 SpecularStill = texture(tex_Specular, fs_UV.yx * 10.0 * u_GridSize / 300.0).rgb;
    vec3 Specular = mix(SpecularMove, SpecularStill, clamp(old_Nor.y - u_FlowEdge, 0.0, 1.0));

    fragColor[0] = vec4(Normal_WS, fs_Pos.z);
    fragColor[1] = vec4(fs_Pos.xyz, Specular.x);
    fragColor[2] = vec4(u_SandDiffuse.rgb * Albedo, fs_Shadow);
}
