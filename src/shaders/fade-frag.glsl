#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;

uniform sampler2D u_frame;

uniform float u_fadeLevel;


void main() {

	// fade level is determined by uniform variable
	vec3 baseColor = u_fadeLevel * texture(u_frame, fs_UV).xyz;

	out_Col = vec4(baseColor, 1.0);
}
