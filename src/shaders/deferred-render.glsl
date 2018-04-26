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

uniform mat4 u_lightViewProj;

uniform vec3 u_Eye;
uniform vec3 u_SunDirection;


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
uniform vec4 u_Color;

uniform float u_CloudSize;
uniform float u_CloudEdge;

uniform float u_ShadowMoverScalar;

uniform sampler2D u_shadowTexture;

uniform sampler2D u_BgTexutre;

uniform sampler2D u_waterReflectionTexutre;
uniform sampler2D u_waterNoramlTexture;

uniform sampler2D u_ParticleTexture;

uniform float u_waterSize;
uniform float u_waterDistortionScale;

const float shadowDepthTextureSize = 2048.0; // This one should be consistent with that in OpenGLRenderer.ts

const mat4 texUnitConverter = mat4(0.5, 0.0, 0.0, 0.0, 
                                   0.0, 0.5, 0.0, 0.0, 
                                   0.0, 0.0, 0.5, 0.0, 
                                   0.5, 0.5, 0.5, 1.0);

// SHOULD BE CONSISTENT WITH SUN POS in main.ts
// directional light
const vec3 directional_lighting_dir = vec3(0, 50.0, -50.0); //-1500, 280.0, -6000.0
// point light position
// const vec3 point_light_pos = vec3(0.0, 50.0, -50.0);

// Water paras
// const float size = 0.5;
// const float distortionScale = 3.7;

const vec3  sunColor = vec3(1.0, 1.0, 1.0);
const vec3  waterColor = vec3(0, 0.1176, 0.0588);


// decode from shadow map
float decodeFloat (vec4 color) {
  const vec4 bitShift = vec4(
    1.0 / (256.0 * 256.0 * 256.0),
    1.0 / (256.0 * 256.0),
    1.0 / 256.0,
    1
  );
  return dot(color, bitShift);
}

vec4 getNoise(vec2 uv) {
	float timeScalar = 0.5;

    vec2 uv0 = ( uv / 103.0 ) + vec2(timeScalar * u_Time / 17.0, timeScalar * u_Time / 29.0);
    vec2 uv1 = uv / 107.0-vec2( timeScalar * u_Time / -19.0, timeScalar * u_Time / 31.0 );
    vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( timeScalar * u_Time / 101.0, timeScalar * u_Time / 97.0 );
    vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( timeScalar * u_Time / 109.0, timeScalar * u_Time / -113.0 );
    vec4 noise = texture( u_waterNoramlTexture, uv0 ) +
				 texture( u_waterNoramlTexture, uv1 ) +
				 texture( u_waterNoramlTexture, uv2 ) +
				 texture( u_waterNoramlTexture, uv3 );
    return noise * 0.5 - 1.0;
}

void sunLight(vec3 surfaceNormal, vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {
    vec3 reflection = normalize(reflect( -u_SunDirection, surfaceNormal));
    float direction = max(0.0, dot(eyeDirection, reflection ));
    specularColor += pow( direction, shiny ) * sunColor * spec;
    diffuseColor += max( dot( u_SunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;
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
	vec4 gb0 = texture(u_gb0, fs_UV);

	float camera_space_depth = -gb0.w;

	// actually, we can know whether this fragment is 
	// overlapped by a mesh by checking its depth
	bool isPixelOverlap = (camera_space_depth > EPS);

	vec3 final_col;

	if(isPixelOverlap){

		vec4 gb1 = texture(u_gb1, fs_UV);
		vec4 gb2 = texture(u_gb2, fs_UV);

		float materialType = gb1.w;

		// -------------------------------------------------------------
		// Shadow map portion
		vec3 shadowPos;
		if(materialType > -0.1 && materialType < 25.1){
			vec4 tmp = texUnitConverter * u_lightViewProj * inverse(u_View) * vec4(gb1.xyz, 1.0);
			shadowPos = tmp.xyz;
		}
		else{
			shadowPos = gb1.xyz;
		}

		 
		vec3 fragmentDepth = shadowPos;
		float shadowAcneRemover = u_ShadowMoverScalar * 0.000001;
		fragmentDepth.z -= shadowAcneRemover;

		float texelSize = 1.0 / shadowDepthTextureSize;
		float amountInLight = 0.0;

		// we loop through nearby fragments and find out on average how much all of them are in shadow.
		// This smooths out the edges of our shadow since with a limited resolution depth color texture some fragments at the edge
		// might sample the wrong depth and thus lead to jagged edges.
		for (int x = -1; x <= 1; x++) {
			for (int y = -1; y <= 1; y++) {
				vec2 textCoord = vec2(fragmentDepth.x + texelSize * float(x), fragmentDepth.y + texelSize * float(y));

				vec4 fetchedCol = texture(u_shadowTexture, textCoord);

				float texelDepth = decodeFloat(fetchedCol);

				if (fragmentDepth.z < texelDepth) {
					amountInLight += 1.0;
				}
			}
		}
		amountInLight /= 9.0;
		amountInLight = clamp(amountInLight + 0.5, 0.0, 1.0);

		// Sand Material
		if(materialType > -0.1 && materialType < 25.1){
			vec3 col = gb2.xyz;
				float shadow = gb2.w;
			vec3 pos = gb1.xyz;
				float spe = materialType;
				// Calculate the diffuse term for Lambert shading
				vec3 normal_world_space = texture(u_gb0, fs_UV).xyz;

				//vec3 sandcolor = vec3(237.0/255.0, 201.0/255.0, 175.0/255.0);
			//specular, blin_phong
			//vec3 lightColor = vec3(255.0/255.0, 245.0/255.0, 231.0/255.0);
			vec3 viewDir = normalize(u_CameraPos.xyz - pos);
			vec3 halfwayDir = normalize(normalize(directional_lighting_dir) + viewDir);
			float blin = pow(max(dot(normal_world_space, halfwayDir), 0.0), u_Shininess);
			vec3 specular = spe * u_SandSpecular.xyz * blin;
			// -------------------------------------------------------------
			// directional light lambert term
			float diffuseTerm = dot(normalize(normal_world_space), normalize(directional_lighting_dir));
			float ONdiffuseTerm = lightingOrenNayerEval(normalize(directional_lighting_dir), normal_world_space, viewDir, u_Roughness);
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

			vec3 x = max(vec3(0.0), color - vec3(0.004));
			vec3 color2 = (x * (vec3(6.2) * x + vec3(0.5))) / (x * (vec3(6.2) * x + vec3(1.7)) + vec3(0.06));
			vec3 color3 = mix(color, color2, 0.4);
			final_col = color3 * u_Color.xyz * amountInLight;
		}

		// Water Material
		else if(materialType > 100.0){
			// // -------------------------------------------------------------
			// // Pure Mirror
			// // Fetch reflection color from texture
			// vec3 vReflectionMapTexCoord = gb2.xyz;
			// vec2 projectedReflectionTexCoords = clamp(vReflectionMapTexCoord.xy / vReflectionMapTexCoord.z, 0.0, 1.0);
        	// vec4 reflectiveColor = texture(u_waterReflectionTexutre, projectedReflectionTexCoords);

			// out_Col = vec4(reflectiveColor.rgb, 1.0);

			// -------------------------------------------------------------
			// Water (refer to Three.js ocean demo https://threejs.org/examples/#webgl_shaders_ocean)
			vec3 worldPosition = gb0.xyz;
			vec4 noise = getNoise(worldPosition.xz * u_waterSize);
    		vec3 surfaceNormal = normalize(noise.xzy * vec3( 1.5, 1.0, 1.5 ));
			vec3 diffuseLight = vec3(0.0);
			vec3 specularLight = vec3(0.0);
    		vec3 worldToEye = u_Eye - worldPosition;
    		vec3 eyeDirection = normalize(worldToEye);
    		sunLight(surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );
    		float Distance = length(worldToEye);
    		vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / Distance ) * u_waterDistortionScale;

			vec3 vReflectionMapTexCoord = gb2.xyz;
			vec2 projectedReflectionTexCoords = clamp(vReflectionMapTexCoord.xy / vReflectionMapTexCoord.z + distortion, 0.0, 1.0);
        	vec3 reflectionSample = texture(u_waterReflectionTexutre, projectedReflectionTexCoords).rgb;

			float theta = max(dot(eyeDirection, surfaceNormal), 0.0);
			float rf0 = 0.3;
			float reflectance = rf0 + ( 1.0 - rf0 ) * pow(( 1.0 - theta ), 5.0);
			vec3 scatter = max(0.0, dot(surfaceNormal, eyeDirection)) * waterColor;

			vec3 albedo = mix((sunColor * diffuseLight * 0.3 + scatter) * amountInLight, (vec3(0.1) + reflectionSample * 0.9 + reflectionSample * specularLight), reflectance);
			
			// out_Col = vec4(albedo, 1.0);
			final_col = albedo;
		}

		// Lambert Shading
		else{
			// Calculate the diffuse term for Lambert shading
			vec3 normal_world_space = gb0.xyz;

			float ambientTerm = 0.08;

			// -------------------------------------------------------------
			// directional light lambert term
			float diffuseTerm = dot(normalize(normal_world_space), normalize(directional_lighting_dir));

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

			// diffuseTerm = dot(normalize(normal_world_space), normalize(point_light_pos - world_space_pos.xyz));
			
			float lightIntensity = diffuseTerm + ambientTerm;   //Add a small float value to the color multiplier
																//to simulate ambient lighting. This ensures that faces that are not
																//lit by our point light are not completely black.


			// -------------------------------------------------------------
			// Lambert shading
			vec3 col = gb2.xyz; // albedo color fetched from texture
			// out_Col = vec4(lightIntensity * amountInLight * col, 1.0);
			final_col = lightIntensity * amountInLight * col;
		}
	}

	// background
	else{
		// fetch Sky box color from texture
		// out_Col = texture(u_BgTexutre, fs_UV);
		final_col = texture(u_BgTexutre, fs_UV).rgb;
	}



	// Handle particles
	vec4 particle_info = texture(u_ParticleTexture, fs_UV);
	float particle_camera_space_depth = -particle_info.w;

	// know whether this fragment is 
	// overlapped by a mesh by checking its depth
	bool isPixelOverlapParticle = (particle_camera_space_depth > EPS);

	// check whether this particle is occuluded by scene geometry
	bool isParticleNotOcculuded = (!isPixelOverlap) || (isPixelOverlap && (particle_camera_space_depth < camera_space_depth));
	
	if(isPixelOverlapParticle && isParticleNotOcculuded){
		final_col += particle_info.rgb;
	}

	out_Col = vec4(final_col, 1.0);


	// -------------------------------------------------------------
	// camera space depth debug
	// float near = 0.1;
	// float far  = 100.0;
	// out_Col = vec4(vec3((-texture(u_gb0, fs_UV).w - near) / far), 1.0);


	// -------------------------------------------------------------
	// world space normal debug
	// out_Col = vec4(texture(u_gb0, fs_UV).xyz, 1.0);
}