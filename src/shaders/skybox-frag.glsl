#version 300 es

precision highp float;
precision highp int;

uniform float u_Luminance;

uniform float u_Time;

uniform float u_CloudEdge;
uniform float u_CloudSize;
uniform float u_CloudNoise;
uniform float u_CloudSpeed;
uniform float u_CloudSpeed2;
uniform float u_Amount;
uniform float u_Amount2;
uniform float u_Amount3;
uniform vec4 u_SandDiffuse;

// uniform float mieDirectionalG;
const float mieDirectionalG = 0.8;


const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );
const float pi = 3.141592653589793238462643383279502884197169;
const float n = 1.0003;
const float N = 2.545E25;
const float rayleighZenithLength = 8.4E3;
const float mieZenithLength = 1.25E3;
const vec3 up = vec3( 0.0, 1.0, 0.0 );
const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;
const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
const float ONE_OVER_FOURPI = 0.07957747154594767;

in vec3 vWorldPosition;
in vec3 vSunDirection;
in float vSunfade;
in vec3 vBetaR;
in vec3 vBetaM;
in float vSunE;

out vec4 out_Col;

//https://gist.github.com/yiwenl/3f804e80d0930e34a0b33359259b556c
mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
	mat4 m = rotationMatrix(axis, angle);
	return (m * vec4(v, 1.0)).xyz;
}

//https://www.shadertoy.com/view/4djSRW
#define HASHSCALE1 .1031
float hash(float p)
{
	vec3 p3  = fract(vec3(p) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}
float Noise3d(vec3 p)
{
    vec3 i = floor(p);
	vec3 f = fract(p); 
	//https://www.shadertoy.com/view/4dS3Wd
	//For performance, compute the base input to a 1D hash from the integer part of the argument and the 
    //incremental change to the 1D based on the 3D -> 1D wrapping
	const vec3 step = vec3(110, 241, 171);
    float n = dot(i, step);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y),
               mix(mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z);
}

float FBM3(vec3 p, int Octaves)
{
	p *= .5;
    float f = 0.0;
	float amplitude = 0.5;
	for(int i = 0;i < Octaves;i++)
	{
		f += amplitude * Noise3d(p);
		p *= 3.0;
		amplitude *= 0.5;
	}
    return f;
}

float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

// Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

vec2 rotate(vec2 v, float a) {
	float s = sin(a);
	float c = cos(a);
	mat2 m = mat2(c, -s, s, c);
	return m * v;
}

vec2 rotate2(vec2 uv)
{
    uv = uv + noise(uv*0.2)*0.005;
    float rot = 3.0;
    float sinRot=sin(rot);
    float cosRot=cos(rot);
    mat2 rotMat = mat2(cosRot,-sinRot,sinRot,cosRot);
    return uv * rotMat;
}

#define OCTAVES 6
#define HEIGHT 50.0
#define SIZE 4.0
float FBM (in vec2 st, int octaves) {
    // Initial values
    vec2 newpos =st * SIZE;
    float value = 0.0;
    float amplitude = .5;
    float frequency = 0.;
    //
    // Loop of octaves
    vec2 temppos = newpos;
    for (int i = 0; i < octaves; i++) {
        value += amplitude * noise(temppos + u_Time * u_CloudSpeed2);
        temppos *= 2.;
        temppos = rotate2(temppos);
        amplitude *= .5;
    }
    return value;
}

float rayleighPhase( float cosTheta ) {
    return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
}
float hgPhase( float cosTheta, float g ) {
    float g2 = pow( g, 2.0 );
    float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
    return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
}
const float A = 0.15;
const float B = 0.50;
const float C = 0.10;
const float D = 0.20;
const float E = 0.02;
const float F = 0.30;
const float whiteScale = 1.0748724675633854;

vec3 Uncharted2Tonemap( vec3 x ) {
    return ( ( x * ( A * x + C * B ) + D * E ) / ( x * ( A * x + B ) + D * F ) ) - E / F;
}

void main() {
    float zenithAngle = acos( max( 0.0, dot( up, normalize( vWorldPosition - cameraPos ) ) ) );
    float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
    float sR = rayleighZenithLength * inverse;
    float sM = mieZenithLength * inverse;
    vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );
    float cosTheta = dot( normalize( vWorldPosition - cameraPos ), vSunDirection );
    float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
    vec3 betaRTheta = vBetaR * rPhase;
    float mPhase = hgPhase( cosTheta, mieDirectionalG );
    vec3 betaMTheta = vBetaM * mPhase;
    vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
    Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 ) );
    vec3 direction = normalize( vWorldPosition - cameraPos );
    float theta = acos( direction.y );
    // elevation --> y-axis, [-pi/2, pi/2]
    float phi = atan( direction.z, direction.x );
    // azimuth --> x-axis [-pi/2, pi/2]
    vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
    vec3 L0 = vec3( 0.1 ) * Fex;
    float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );
    L0 += ( vSunE * 19000.0 * Fex ) * sundisk;
    vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );
    vec3 curr = Uncharted2Tonemap( ( log2( 2.0 / pow( u_Luminance, 4.0 ) ) ) * texColor );
    vec3 color = curr * whiteScale;
    vec3 retColor = pow( color, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) );

    //float fs_Shadow = clamp(FBM(vec2(direction.z, direction.x) / u_CloudNoise + u_CloudSpeed * u_Time, OCTAVES) - u_CloudSize, 0.0, 1.0);
    //fs_Shadow = pow(fs_Shadow, u_CloudEdge);
    float fs_Shadow = clamp(FBM(vec2(direction.z, direction.x) / (pow(direction.y, u_Amount) * u_CloudNoise) + u_CloudSpeed * u_Time, OCTAVES) - u_CloudSize, 0.0, 1.0);
    float fs_Shadow2 = pow(fs_Shadow, u_CloudEdge);
    float fs_Shadow3 = clamp(pow(fs_Shadow, u_Amount3) - 0.2, 0.0, 1.0);//cloud color, 1: cloud center; 0: cloud edge

    vec3 cloudcolor2 = mix(vec3(1.0, 1.0, 1.0), vec3(0.0, 0.0, 0.0), fs_Shadow3);

    fs_Shadow2 *= smoothstep(0.0, u_Amount2, direction.y);//alpha, 1: cloud; 0: sky;

    float transmittance = exp2( - fs_Shadow2 * 1.0 );
    float exponent = 32.0 * transmittance; // some magic number
    float intensity = ( exponent + 1.0 ) / 2.0; // cheap normalization
    float cloudcolor = ( pow( max( 0.0, dot( direction, vSunDirection ) ), 1.0 ) * 1.0  + 0.1);
    float alpha = clamp( 1.0 - transmittance, 0.0, 1.0 );

    

    // vec4 sum = vec4(0.0);
    // vec2 cpos = vec2(direction.z, direction.x) / ((direction.y + u_Amount) * u_CloudNoise) + u_CloudSpeed * u_Time;
    // for (int i=0; i<10; i++) // 120 layers
    // {
    //   if (sum.w>0.999) break;
    //   cpos += u_CloudSpeed2;
    //   float alpha = pow(FBM(cpos), u_CloudEdge); // fractal cloud density
    //   vec3 localcolor = mix(vec3( 1.1, 1.05, 1.0 ), retColor * 0.1, alpha); // density color white->gray
    //   alpha = (1.0-sum.w)*alpha; // alpha/density saturation (the more a cloud layer's density, the more the higher layers will be hidden)
    //   sum += vec4(localcolor*alpha, alpha); // sum up weightened color
    // }
    vec3 cloudcolor3 = (retColor + cloudcolor * alpha);
    cloudcolor2 = mix(cloudcolor3, cloudcolor2, cloudcolor);

    float u_StarSpeed = 0.05;
    float u_StarNoise = 350.0;
    float u_StarSize = 0.8;
    float u_StarEdge = 0.22;
    float u_StarHide = 3.75;

    float star = pow(clamp(FBM3(rotate(direction, vec3(1.0, 0.0, 1.0), u_StarSpeed * u_Time) * u_StarNoise, OCTAVES) - u_StarSize, 0.0, 1.0), u_StarEdge);
    star = clamp(star, 0.0, 1.0);

    out_Col = vec4( mix(retColor * u_SandDiffuse.xyz, cloudcolor2, fs_Shadow2) + vec3(star) * clamp((1.0 - fs_Shadow2 * u_StarHide), 0.0, 1.0), 1.0 );
    //out_Col = vec4(vec3(1.0, 0.0, 0.0) * vec3(star) * clamp((1.0 - fs_Shadow2 * u_Amount), 0.0, 1.0) + vec3(fs_Shadow2), 1.0 );
}
