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

uniform vec4 u_CamPos;   

// directional light
const vec3 directional_lighting_dir = vec3(5.0, 5.0, 5.0); 

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

void main() { 
	// read from GBuffers
	vec4 gb2 = texture(u_gb2, fs_UV);
	vec3 col = gb2.xyz;


	// Calculate the diffuse term for Lambert shading
	vec3 normal_world_space = texture(u_gb0, fs_UV).xyz;

	float camera_space_depth = -texture(u_gb0, fs_UV).w;

	// actually, we can know whether this fragment is 
	// overlapped by a mesh by checking its depth
	bool isPixelOverlap = (camera_space_depth > EPS);

	if(isPixelOverlap){
		// -------------------------------------------------------------
		// directional light lambert term
		// float diffuseTerm = dot(normalize(normal_world_space), normalize(directional_lighting_dir));

		// -------------------------------------------------------------
		// point light lambert term
		// reconstruct world space position from screen space position and camera space depth

		vec2 ndc_pos = vec2((2.0 * gl_FragCoord.x / u_Width) - 1.0, 
							1.0 - (2.0 * gl_FragCoord.y / u_Height));


		vec4 ndc_pos_vec4 = vec4(camera_space_depth * ndc_pos.x, camera_space_depth * ndc_pos.y, camera_space_depth, camera_space_depth);
		
		vec4 camera_space_pos = inverse(u_Proj) * ndc_pos_vec4;
		camera_space_pos.z = -camera_space_depth;
		camera_space_pos.w = 1.0;

		vec4 world_space_pos = inverse(u_View) * camera_space_pos;
		
		float diffuseTerm = 0.0;
		float ambientTerm = 0.4;

		// Lambert shading
		// if(u_ShadingType == 0){
			diffuseTerm = dot(normalize(normal_world_space), normalize(point_light_pos - world_space_pos.xyz));
		// }
		// Ramp / Toon shading
		// else{
		// 	float rampUnitLength =  0.25;
		// 	float rampUnitValue = 0.33;
		// 	float rampCoord = max(dot(normalize(normal_world_space), normalize(point_light_pos - world_space_pos.xyz)), 0.0);
		// 	int rampLevel = int(rampCoord / rampUnitLength);
		// 	diffuseTerm = float(rampLevel) * rampUnitValue;
		// 	ambientTerm = 0.2;
		// }

		float lightIntensity = diffuseTerm + ambientTerm;   //Add a small float value to the color multiplier
															//to simulate ambient lighting. This ensures that faces that are not
															//lit by our point light are not completely black.

		// Lambert shading
		out_Col = vec4(lightIntensity * col, 1.0);
	}
	// background
	else{
		
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