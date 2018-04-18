import {gl} from '../../globals';

export class Texture {
  texture: WebGLTexture;
  
  bindTex() {
  	  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }

  handle(): WebGLTexture {
  	return this.texture;
  }

  isPowerOf2(value: number) : boolean {
      return (value & (value - 1)) == 0;
  }

  constructor(imgSource: string) {
  	this.texture = gl.createTexture();
  	this.bindTex();

    // create a white pixel to serve as placeholder
  	const formatSrc = gl.RGBA;
  	const formatDst = gl.RGBA;
  	const lvl = 0;
  	const phWidth = 1; // placeholder
  	const phHeight = 1;
  	const phImg = new Uint8Array([255, 255, 255, 255]);
  	const formatBit = gl.UNSIGNED_BYTE; // TODO: HDR

  	gl.texImage2D(gl.TEXTURE_2D, lvl, formatDst, phWidth, phHeight, 0, formatSrc, formatBit, phImg);

  	// get a javascript image locally and load it. not instant but will auto-replace white pixel
  	const img = new Image();

  	img.onload = function() {
		this.bindTex()
		gl.texImage2D(gl.TEXTURE_2D, lvl, formatDst, img.width, img.height, 0, formatSrc, formatBit, img);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		// !!!!! We use mips for any texture whose width & height is power of 2 here
		// Check if the image is a power of 2 in both dimensions.
		if (this.isPowerOf2(img.width) && this.isPowerOf2(img.height)) {
			// Yes, it's a power of 2. Generate mips.
			gl.generateMipmap(gl.TEXTURE_2D);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		 } else {
			// No, it's not a power of 2. Turn off mips
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		 }

		console.log('texture onload is called!');
  	}.bind(this);

  	img.src = imgSource; // load the image
  }


};

export default Texture;