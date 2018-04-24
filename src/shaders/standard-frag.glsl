#version 300 es
precision highp float;

in vec4 fs_Pos;
in vec4 fs_Pos_World;
in vec4 fs_Nor;
in vec4 fs_Col;
in vec2 fs_UV;

in vec3 fs_Nor_world_space;

in vec4 shadowPos;  
in vec3 vReflectionMapTexCoord; // for water reflection

out vec4 fragColor[3]; // The data in the ith index of this array of outputs
                       // is passed to the ith index of OpenGLRenderer's
                       // gbTargets array, which is an array of textures.
                       // This lets us output different types of data,
                       // such as albedo, normal, and position, as
                       // separate images from a single render pass.

uniform int u_EnableTexture;
uniform sampler2D tex_Color;

uniform float u_MaterialType;

uniform vec4 u_Color;

void main() {

    // store date into g-buffer

    vec3 col;
    // USE TEXTURES
    if(u_EnableTexture > 0){
        col = texture(tex_Color, fs_UV).rgb;

        // if using textures, inverse gamma correct
        col = pow(col, vec3(2.2));
    }
    // USE UNIFORM COLOR
    else{
        col = u_Color.rgb;
    }


    // fragColor[0] : RGBA 32f buffer
    //  Water material
    if(u_MaterialType > 100.0){
       fragColor[0] = vec4(fs_Pos_World.xyz, fs_Pos.z);
    }
    else{
       // world space normal.x | world space normal.y | world space normal.z | camera space depth(-near clip ~ -far clip)
       fragColor[0] = vec4(fs_Nor_world_space, fs_Pos.z); // fs_Pos is camera space position here
    }
    
    
    // fragColor[1] : RGBA 32f buffer
    fragColor[1] = vec4(shadowPos.xyz, u_MaterialType);

    //  Water material
    if(u_MaterialType > 100.0){
        fragColor[2] = vec4(vReflectionMapTexCoord, 1.0);
    }
    else{
        // fragColor[2] : RGBA 32f buffer
        // albedo.x | albedo.y | albedo.z | ...
        fragColor[2] = vec4(col, 1.0);
    }
}
