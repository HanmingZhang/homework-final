#version 300 es
precision highp float;

#define EPS 0.0001
#define PI 3.1415962
#define OCTAVES 6

in vec2 fs_UV;
out vec4 out_Col;

uniform sampler2D u_gb0;
uniform sampler2D u_gb1;
uniform sampler2D u_gb2;

uniform float u_Time;

uniform float u_Height;
uniform float u_Width;
uniform mat4 u_View;
uniform mat4 u_Proj;

// uniform int u_ShadingType;
// uniform int u_BgType;

uniform vec4 u_CameraPos;   

uniform float u_Roughness;
uniform float u_Shininess;
uniform float u_Ambient;
uniform float u_Brightness;
uniform float u_Level;
uniform float u_SandEdge;

uniform vec4 u_SandDiffuse;
uniform vec4 u_SandSpecular;
uniform float u_FogDensity;

uniform float u_CloudSize;
uniform float u_CloudEdge;

// directional light
const vec3 directional_lighting_dir = normalize(vec3(1.0, 1.0, 1.0)); 

// point light position
const vec3 point_light_pos = vec3(10.0, 10.0, 10.0);



float random (vec2 uv) {
    return fract(sin(dot(uv.xy,vec2(12.9898,78.233)))*43758.5453123);
}

float noise (vec2 uv) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}


float fbm (in vec2 uv) {
    // Initial values
    float value = 0.0;
    float amplitude = .5;
    float frequency = 0.;

    // Loop of octaves
    for (int i = 0; i < OCTAVES; i++) {
        value += amplitude * noise(uv);
        uv *= 2.;
        amplitude *= .5;
    }
    return value;
}

float lightingOrenNayerEval(const vec3 directionToLight,const vec3 surfaceNormal,const vec3 directionToEye,float materialRoughness){
	float NdotL = dot(surfaceNormal,directionToLight);
	float NdotV = dot(surfaceNormal,directionToEye);
	
	/*
	See: http://fgiesen.wordpress.com/2010/10/21/finish-your-derivations-please/
	float angleVN = acos(NdotV);
	float angleLN = acos(NdotL);
	float alpha = max(angleVN,angleLN);
	float beta = min(angleVN,angleLN);
	float C = sin(alpha) * tan(beta);
	*/
	float C = sqrt((1.0 - NdotV*NdotV) * (1.0 - NdotL*NdotL)) / max(NdotV, NdotL);
	float gamma = dot(directionToEye - surfaceNormal * NdotV,directionToLight - surfaceNormal * NdotL);
	
	float roughnessSquared = materialRoughness*materialRoughness;
	float A = 1.0 - 0.5 * (roughnessSquared / (roughnessSquared + 0.33));
	float B = 0.45 * (roughnessSquared / (roughnessSquared + 0.09));
	float diffuseTerm = max(0.0, NdotL) * (B * max(0.0, gamma) * C + A);
	return diffuseTerm;
}

float fogFactorExp(const float dist) {
  return 1.0 - clamp(exp(-u_FogDensity * dist), 0.0, 1.0);
}

void main() { 
	// read from GBuffers
	vec4 gb2 = texture(u_gb2, fs_UV);
	vec3 col = gb2.xyz;
	float shadow = gb2.w;
    vec4 gb1 = texture(u_gb1, fs_UV);
	vec3 pos = gb1.xyz;
	float spe = gb1.w;
	// Calculate the diffuse term for Lambert shading
	vec3 normal_world_space = texture(u_gb0, fs_UV).xyz;

	float camera_space_depth = -texture(u_gb0, fs_UV).w;

	// actually, we can know whether this fragment is 
	// overlapped by a mesh by checking its depth
	bool isPixelOverlap = (camera_space_depth > EPS);

	if(isPixelOverlap){
		//vec3 sandcolor = vec3(237.0/255.0, 201.0/255.0, 175.0/255.0);
		//specular, blin_phong
		//vec3 lightColor = vec3(255.0/255.0, 245.0/255.0, 231.0/255.0);
		vec3 viewDir = normalize(u_CameraPos.xyz - pos);
		vec3 halfwayDir = normalize(directional_lighting_dir + viewDir);
		float blin = pow(max(dot(normal_world_space, halfwayDir), 0.0), u_Shininess);
		vec3 specular = spe * u_SandSpecular.xyz * blin;
		// -------------------------------------------------------------
		// directional light lambert term
		float diffuseTerm = dot(normalize(normal_world_space), normalize(directional_lighting_dir));
		float ONdiffuseTerm = lightingOrenNayerEval(directional_lighting_dir, normal_world_space, viewDir, u_Roughness);
		// -------------------------------------------------------------
		// point light lambert term
		// reconstruct world space position from screen space position and camera space depth

		// vec2 ndc_pos = vec2((2.0 * gl_FragCoord.x / u_Width) - 1.0, 
		// 					1.0 - (2.0 * gl_FragCoord.y / u_Height));
		// vec4 ndc_pos_vec4 = vec4(camera_space_depth * ndc_pos.x, camera_space_depth * ndc_pos.y, camera_space_depth, camera_space_depth);
		// vec4 camera_space_pos = inverse(u_Proj) * ndc_pos_vec4;
		// camera_space_pos.z = -camera_space_depth;
		// camera_space_pos.w = 1.0;
		// vec4 world_space_pos = inverse(u_View) * camera_space_pos;
		
		// float diffuseTerm = 0.0;

		// Lambert shading
		// diffuseTerm = dot(normalize(normal_world_space), normalize(point_light_pos - world_space_pos.xyz));
		
		float lightIntensity = ONdiffuseTerm + u_Ambient;   //Add a small float value to the color multiplier
															//to simulate ambient lighting. This ensures that faces that are not
															//lit by our point light are not completely black.
															

        
		// Lambert shading
		float shadow1 = clamp(shadow * u_CloudSize, 0.0, 1.0);
		float shadow2 = clamp(shadow1 + u_CloudEdge, 0.0, 1.0);
		vec3 color = (col * lightIntensity * shadow2 + specular * u_SandEdge * shadow1);
		color += u_Brightness * max(color - u_Level, vec3(0.0));
		color = mix(color, u_SandDiffuse.rgb, fogFactorExp(camera_space_depth));
		out_Col = vec4(color, 1.0);
	}
	// background
	else{
		// TODO : use sky box here
		out_Col = vec4(65.0 / 255.0, 166.0 / 255.0, 136.0 / 255.0, 1.0);
	}


	// -------------------------------------------------------------
	// camera space depth debug
	// float near = 0.1;
	// float far  = 100.0;
	// out_Col = vec4(vec3((-texture(u_gb0, fs_UV).w - near) / far), 1.0);

	// -------------------------------------------------------------
	// world space normal debug
	// out_Col = vec4(texture(u_gb0, fs_UV).xyz, 1.0);
}