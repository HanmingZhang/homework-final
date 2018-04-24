#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;

uniform sampler2D u_frame;
uniform float u_Time;
uniform float u_Amount;
uniform float u_Amount2;
uniform float u_Amount3;
uniform float u_Ambient;

// Interpolate between regular color and channel-swizzled color
// on right half of screen. Also scale color to range [0, 5].

vec3 PhysicalChromaticAberration(vec3 color)
{
	//https://www.shadertoy.com/view/MtXXDr
	//Physical Chromatic Aberration
	float amount = 0.15;
	vec3 refractiveIndex = vec3(1.0, 1.0 + u_Amount, 1.0 + u_Amount * 2.0);
    vec2 uv = fs_UV;
    vec2 normalizedTexCoord = 2.0 * uv - 1.0;    // [0, 1] -> [-1, 1]
    vec3 texVec = vec3(normalizedTexCoord, 1.0);
    vec3 normalVec = vec3(0.0, 0.0, -1.0);
    vec3 redRefractionVec = refract(texVec, normalVec, refractiveIndex.r);
    vec3 greenRefractionVec = refract(texVec, normalVec, refractiveIndex.g);
    vec3 blueRefractionVec = refract(texVec, normalVec, refractiveIndex.b);
    vec2 redTexCoord = ((redRefractionVec / redRefractionVec.z).xy + vec2(1.0, 1.0)) / vec2(2.0, 2.0);
    vec2 greenTexCoord = ((greenRefractionVec / greenRefractionVec.z).xy + vec2(1.0, 1.0)) / vec2(2.0, 2.0);
    vec2 blueTexCoord = ((blueRefractionVec / blueRefractionVec.z).xy + vec2(1.0, 1.0)) / vec2(2.0, 2.0);
    
    return vec3(texture(u_frame, redTexCoord).r, texture(u_frame, greenTexCoord).g, texture(u_frame, blueTexCoord).b);
}

//https://www.shadertoy.com/view/4ttXWM
//BF Chromatic Aberration 
vec4 Aberrate (sampler2D source, vec2 uv, float amount) {
 
    return texture(source, 0.5 + uv / sqrt(1.0 + amount * dot(uv, uv)));
}

vec3 barreldistortion()
{	
	float distortion = 0.2;			// the bias of the barrel distortion
	const float iterations = 5.0;	// how many samples to use for edge blur
	float strength = 0.01;			// how much edge blur is applied (to obscure the r, g, b separation)
	float separation = u_Amount;			// how much to separate the r, g and b
	vec2 uv = fs_UV - 0.5;
    vec3 A = vec3(0, 0, 0);
    for (float i = -iterations; i < iterations; i++)
    {
	   	A.r += Aberrate(u_frame, uv, i * strength + (distortion + separation)).r;
        A.g += Aberrate(u_frame, uv, i * strength + distortion).g;
        A.b += Aberrate(u_frame, uv, i * strength + (distortion - separation)).b;
    }
    A /= iterations * 2.0;
	return A;   
}

vec3 SimpleVignetteEffect(vec3 color)
{
	//https://www.shadertoy.com/view/lsKSWR
	//Simple vignette effect 
	vec2 uv = fs_UV;
	uv *=  1.0 - uv.yx;   //vec2(1.0)- uv.yx; -> 1.-u.yx; Thanks FabriceNeyret !
    float vig = uv.x*uv.y * u_Amount3; // multiply with sth for intensity
    vig = pow(vig, u_Ambient); // change pow for modifying the extend of the  vignette
    return color * vig; 
}

vec3 FilmNoise(vec3 color)
{
    //https://www.shadertoy.com/view/4sXSWs
	//Film Noise
    float strength = u_Amount2;
    float x = (fs_UV.x + 4.0 ) * (fs_UV.y + 4.0 ) * (u_Time * 10.0);
	vec4 grain = vec4(mod((mod(x, 13.0) + 1.0) * (mod(x, 123.0) + 1.0), 0.01)-0.005) * strength;
	grain = 1.0 - grain;
	return color * grain.xyz;
}

void main() {
	//vec3 color = texture(u_frame, fs_UV).xyz;
	//color += 10.0 * max(color - 0.5, vec3(0.0)); // color is not clamped to 1.0 in 32 bit color
	//color = PhysicalChromaticAberration(color);
	vec3 color = barreldistortion();
	color = SimpleVignetteEffect(color);
	color = FilmNoise(color);

	// vec3 color2 = color.brg;
	// float t = 0.5 + 0.5 * cos(1.5 * 3.14 * (u_Time + 0.25));
	// t *= step(0.5, fs_UV.x);
	// color = mix(color, color2, smoothstep(0.0, 1.0, t));
	out_Col = vec4(color, 1.0);
}
