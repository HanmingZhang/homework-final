#version 300 es
precision highp float;
precision highp int;

uniform mat4 u_Model;       // The matrix that defines the transformation of the
                            // object we're rendering. In this assignment,
                            // this will be the result of traversing your scene graph.

uniform mat4 u_ModelInvTr;  // The inverse transpose of the model matrix.
                            // This allows us to transform the object's normals properly
                            // if the object has been non-uniformly scaled.

uniform mat4 u_View;
uniform mat4 u_Proj;


uniform vec3 u_SunPosition;
uniform float u_Turbidity;

// uniform float rayleigh;
const float rayleigh = 2.0;
// uniform float mieCoefficient;
const float mieCoefficient = 0.005;


const vec3 up = vec3( 0.0, 1.0, 0.0 );
const float e = 2.71828182845904523536028747135266249775724709369995957;
const float pi = 3.141592653589793238462643383279502884197169;
const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );
const float v = 4.0;
const vec3 K = vec3( 0.686, 0.678, 0.666 );
const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );
const float cutoffAngle = 1.6110731556870734;
const float steepness = 1.5;
const float EE = 1000.0;


in vec4 vs_Pos;             // The array of vertex positions passed to the shader
in vec4 vs_Nor;             // The array of vertex normals passed to the shader
in vec4 vs_Col;             // The array of vertex colors passed to the shader.


out vec3 vWorldPosition;
out vec3 vSunDirection;
out float vSunfade;
out vec3 vBetaR;
out vec3 vBetaM;
out float vSunE;



float sunIntensity( float zenithAngleCos ) {
    zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
    return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
}
vec3 totalMie( float T ) {
    float c = ( 0.2 * T ) * 10E-18;
    return 0.434 * c * MieConst;
}


void main()
{
    vec4 worldPosition = u_Model * vec4( vs_Pos.xyz, 1.0 );
    vWorldPosition = worldPosition.xyz;
    gl_Position = u_Proj * u_View * worldPosition;
    gl_Position.z = gl_Position.w;
    vSunDirection = normalize( u_SunPosition );
    vSunE = sunIntensity( dot( vSunDirection, up ) );
    vSunfade = 1.0 - clamp( 1.0 - exp( ( u_SunPosition.y / 450000.0 ) ), 0.0, 1.0 );
    float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );
    vBetaR = totalRayleigh * rayleighCoefficient;
    vBetaM = totalMie( u_Turbidity ) * mieCoefficient;
}
