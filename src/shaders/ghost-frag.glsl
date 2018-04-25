#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;

uniform sampler2D u_frame;
uniform float u_Time;

void main() {
	//vec3 color = texture(u_frame, fs_UV).xyz;
	//color += 10.0 * max(color - 0.5, vec3(0.0)); // color is not clamped to 1.0 in 32 bit color
	//color = PhysicalChromaticAberration(color);

	float uGhostDispersal = 0.37;
	const int uGhosts = 8;

	vec2 texcoord = -fs_UV + vec2(1.0);
	vec2 ghostVec = (vec2(0.5) -texcoord) * uGhostDispersal;

	vec3 result = vec3(0.0);
	for (int i = 0; i < uGhosts; ++i){
		vec2 offset = fract(texcoord + ghostVec * float(i));
		vec3 light = texture(u_frame, offset).xyz;
		if(light.x>0.95 && light.y>0.95 && light.z>0.95)
		{
			result += texture(u_frame, offset).xyz;
			
		}		
		//    float brightness = OriCol.r * 0.2126 + OriCol.g * 0.7152 + OriCol.b * 0.0722;
		//OriCol = brightness * OriCol;
	}

	vec3 color = texture(u_frame, fs_UV).xyz;

	// vec3 color2 = color.brg;
	// float t = 0.5 + 0.5 * cos(1.5 * 3.14 * (u_Time + 0.25));
	// t *= step(0.5, fs_UV.x);
	// color = mix(color, color2, smoothstep(0.0, 1.0, t));
	out_Col = vec4(result, 1.0);
}
