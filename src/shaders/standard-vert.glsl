#version 300 es
precision highp float;

uniform mat4 u_Model;
uniform mat4 u_ModelInvTr;  

uniform mat4 u_View;   
uniform mat4 u_Proj; 

uniform mat4 u_lightViewProj; // light spave view project matrix

uniform float u_MaterialType;
uniform mat4 u_worldReflectionViewProjection; // for water material

const mat4 texUnitConverter = mat4(0.5, 0.0, 0.0, 0.0, 
                                   0.0, 0.5, 0.0, 0.0, 
                                   0.0, 0.0, 0.5, 0.0, 
                                   0.5, 0.5, 0.5, 1.0);

                                   
in vec4 vs_Pos;
in vec4 vs_Nor;
in vec4 vs_Col;
in vec2 vs_UV;

out vec4 fs_Pos;
out vec4 fs_Pos_World;
out vec4 fs_Nor;            
out vec4 fs_Col;           
out vec2 fs_UV;

out vec3 fs_Nor_world_space;

out vec4 shadowPos;         // light space position
out vec3 vReflectionMapTexCoord; // for water reflection

void main()
{
    fs_Col = vs_Col;
    fs_UV = vs_UV;
    fs_UV.y = 1.0 - fs_UV.y;

    // fragment info is in view space
    mat3 invTranspose = mat3(u_ModelInvTr);
    mat3 view = mat3(u_View);

    fs_Nor_world_space = invTranspose * vec3(vs_Nor);
    // fs_Nor = vec4(view * invTranspose * vec3(vs_Nor), 0);
    fs_Nor = vec4(view * fs_Nor_world_space, 0);

    vec4 model_pos = u_Model * vs_Pos;   // Temporarily store the transformed vertex positions for use below
    
    fs_Pos_World = model_pos;

    fs_Pos = u_View * model_pos;
    
    gl_Position = u_Proj * u_View * model_pos;

    shadowPos = texUnitConverter * u_lightViewProj * model_pos;

    vReflectionMapTexCoord = vec3(0.0, 0.0, 0.0);

    if(u_MaterialType > 0.5){
        vec4 worldPos = u_worldReflectionViewProjection * model_pos;
	    vReflectionMapTexCoord.x = 0.5 * (worldPos.w + worldPos.x);
	    vReflectionMapTexCoord.y = 0.5 * (worldPos.w + worldPos.y);
	    vReflectionMapTexCoord.z = worldPos.w;
    }
}
