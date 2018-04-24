#version 300 es
precision highp float;

in vec4 fs_Pos;
in vec4 fs_Nor;
in vec4 fs_Col;
in vec2 fs_UV;
in float fs_Dep;
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
// uniform sampler2D sand_Normal;
// uniform sampler2D sand_Normal2;

uniform float u_SandEdge;
uniform float u_SandSteep;
uniform float u_FlowEdge;
uniform float u_FlowSpeed;

uniform vec4 u_SandDiffuse;
uniform vec4 u_SandSpecular;
uniform float u_Time;


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

    
    vec3 Albedo = texture(tex_Color, fs_UV).rgb;
    vec3 Normal = texture(tex_Normal, fs_UV).rgb;
    vec3 Specular = texture(tex_Specular, fs_UV).rgb;

    vec3 Normal_WS = applyNormalMap(fs_Nor.xyz, normalize(Normal * 2.0 - vec3(1.0)));

    float depth = 1.0 - clamp(fs_Dep + u_SandEdge, 0.0, 1.0);
    depth = smoothstep(0.0, 1.0, depth);
    vec3 finalcolor = mix(u_SandDiffuse.rgb, u_SandSpecular.rgb, depth) * Albedo;

    fragColor[0] = vec4(Normal_WS, fs_Pos.z);
    fragColor[1] = vec4(fs_Pos.xyz, Specular.x * 3.0);
    fragColor[2] = vec4(finalcolor * Albedo * 2.3, fs_Shadow);
}
