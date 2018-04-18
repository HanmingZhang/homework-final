#version 300 es
precision highp float;

in vec4 fs_Pos;
in vec4 fs_Nor;
in vec4 fs_Col;
in vec2 fs_UV;

out vec4 out_Col;

uniform sampler2D tex_Color;

uniform vec4 u_Color;

void main() {

    vec3 col;

    col = texture(tex_Color, fs_UV).rgb;

    // if using textures, inverse gamma correct
    col = pow(col, vec3(2.2));

    out_Col = vec4(col, 1.0);
}
