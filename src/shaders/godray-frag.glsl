#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;

uniform sampler2D u_frame;
uniform vec2 u_screenSpaceLightPos;

uniform float u_Density;
uniform float u_Weight;
uniform float u_Decay;
uniform float u_Exposure;
uniform int u_NumSamples;

uniform float u_Width;
uniform float u_Height;

uniform vec4 u_Color;

//https://www.shadertoy.com/view/4sX3Rs
//musk's lens flare
vec3 lensflare(vec2 uv,vec2 pos)
{
	vec2 main = uv-pos;
	vec2 uvd = uv*(length(uv));
	
	float ang = atan(main.x,main.y);
	float dist=length(main); dist = pow(dist,.1);
	//float n = noise(vec2(ang*16.0,dist*32.0));
	
	float f0 = 1.0/(length(uv-pos)*16.0+3.0);
	
	//f0 = f0 + f0*(sin(noise(sin(ang*2.+pos.x)*4.0 - cos(ang*3.+pos.y))*16.)*.1 + dist*.1 + .8);
	
	float f1 = max(0.01-pow(length(uv+1.2*pos),1.9),.0)*7.0;

	float f2 = max(1.0/(1.0+32.0*pow(length(uvd+0.8*pos),2.0)),.0)*00.25;
	float f22 = max(1.0/(1.0+32.0*pow(length(uvd+0.85*pos),2.0)),.0)*00.23;
	float f23 = max(1.0/(1.0+32.0*pow(length(uvd+0.9*pos),2.0)),.0)*00.21;
	
	vec2 uvx = mix(uv,uvd,-0.5);
	
	float f4 = max(0.01-pow(length(uvx+0.4*pos),2.4),.0)*6.0;
	float f42 = max(0.01-pow(length(uvx+0.45*pos),2.4),.0)*5.0;
	float f43 = max(0.01-pow(length(uvx+0.5*pos),2.4),.0)*3.0;
	
	uvx = mix(uv,uvd,-.4);
	
	float f5 = max(0.01-pow(length(uvx+0.2*pos),5.5),.0)*2.0;
	float f52 = max(0.01-pow(length(uvx+0.4*pos),5.5),.0)*2.0;
	float f53 = max(0.01-pow(length(uvx+0.6*pos),5.5),.0)*2.0;
	
	uvx = mix(uv,uvd,-0.5);
	
	float f6 = max(0.01-pow(length(uvx-0.3*pos),1.6),.0)*6.0;
	float f62 = max(0.01-pow(length(uvx-0.325*pos),1.6),.0)*3.0;
	float f63 = max(0.01-pow(length(uvx-0.35*pos),1.6),.0)*5.0;
	
	vec3 c = vec3(.0);
	
	c.r+=f2+f4+f5+f6; c.g+=f22+f42+f52+f62; c.b+=f23+f43+f53+f63;
	c = c*1.3 - vec3(length(uvd)*.05);
	c+=vec3(f0);
	
	return c;
}


void main() {

	vec3 color = vec3(0.0,0.0,0.0);

	// vec2 deltaTextCoord = vec2(fs_UV - u_screenSpaceLightPos);

	// vec2 textCoo = fs_UV;

	// deltaTextCoord *= (1.0 /  float(u_NumSamples)) * u_Density;

	// float illuminationDecay = 1.0;

	// for(int i = 0; i < 100 ; i++){
    //     /*
    //     This makes sure that the loop only runs `numSamples` many times.
    //     We have to do it this way in WebGL, since you can't have a for loop
    //     that runs a variable number times in WebGL.
    //     This little hack gets around that.
    //     But the drawback of this is that we have to specify an upper bound to the
    //     number of iterations(but 100 is good enough for almost all cases.)
    //     */
	//     if(u_NumSamples < i) {
    //         break;
	//     }

	// 	textCoo -= deltaTextCoord;
	// 	vec3 samp = texture(u_frame, textCoo).xyz;
	// 	samp *= illuminationDecay * u_Weight;
	// 	color += samp;
	// 	illuminationDecay *= u_Decay;
	// }

	color *= u_Exposure;

	vec2 uv = fs_UV - 0.5;
	uv.x *= u_Width/u_Height;
	vec2 sunuv = (u_screenSpaceLightPos - 0.5) * 2.0;
	sunuv.y *= u_Height/u_Width;
	if(texture(u_frame, u_screenSpaceLightPos).x==1.0)
	{
		color += vec3(1.4,1.2,1.0)*lensflare(uv,sunuv);
	}

	out_Col = vec4(color * u_Color.xyz, 1.0);
}
