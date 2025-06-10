import * as THREE from "three";
import type { IGetMapsDetailsResponse, ILocalizeAndMapDetails, ILocalizeResponse, MapType } from "./interfaces";
import { FILE_DOWNLOAD_URL, MAP_DETAILS_URL, QUERY_URL } from "./config";
import axios from "axios";

export interface ICameraIntrinsics {
    fx: number;
    fy: number;
    px: number;
    py: number;
    width: number;
    height: number;
}

interface ICameraImgData {
    imgBlob: Blob;
    width: number;
    height: number;
}

const getCameraIntrinsics = (
    projectionMatrix: Float32Array,
    viewport: XRViewport
): ICameraIntrinsics => {
    const p = projectionMatrix;
    const u0 = ((1 - p[8]) * viewport.width) / 2 + viewport.x;
    const v0 = ((1 - p[9]) * viewport.height) / 2 + viewport.y;
    const ax = (viewport.width / 2) * p[0];
    const ay = (viewport.height / 2) * p[5];

    const intr = {
        fx: ax,
        fy: ay,
        px: u0,
        py: v0,
        width: viewport.width,
        height: viewport.height,
    };

    return intr;
}

const compressToJpeg = async (buffer: ArrayBuffer, width: number, height: number, quality = 0.8): Promise<Blob> => {
    // Create a canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Create an ImageData object
    const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);

    // Draw the image data onto the canvas
    ctx!.putImageData(imageData, 0, 0);

    return new Promise((resolve) => {
        // Compress the canvas image to a JPEG Blob
        canvas.toBlob(
            (blob) => {
                resolve(blob!);
            },
            "image/jpeg",
            quality // Specify compression quality (0 to 1)
        );
    });
}

const getCameraTextureAsImage = async (
    renderer: THREE.WebGLRenderer,
    webGLTexture: WebGLTexture,
    width: number,
    height: number
): Promise<ICameraImgData | null> => {
    if (!renderer) return null;

    const gl = renderer.getContext();
    if (!gl) return null;

    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        webGLTexture,
        0
    );

    // Step 3: Read the pixels from the framebuffer
    const pixelBuffer = new Uint8Array(width * height * 4);
    gl.readPixels(
        0,
        0,
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixelBuffer
    );

    // Step 4: Unbind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Flip the image vertically (optional, as WebGL textures are usually flipped)
    const flippedData = new Uint8ClampedArray(pixelBuffer.length);
    for (let row = 0; row < height; row++) {
        const sourceStart = row * width * 4;
        const destStart = (height - row - 1) * width * 4;
        flippedData.set(
            pixelBuffer.subarray(sourceStart, sourceStart + width * 4),
            destStart
        );
    }

    const blob = await compressToJpeg(flippedData.buffer, width, height, 0.7);

    if (blob.size) {
        return {
            imgBlob: blob,
            width: width,
            height: height,
        };
    }

    return null;
}

const fileDownload = async (key: string, accessToken: string) => {
    if (!key || !accessToken) {
        console.error("Invalid key or access token");
        return "";
    }

    const res = await axios.get(
        `${FILE_DOWNLOAD_URL}?key=${key}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
        }
    );

    if (res.status === 200) return res.data.url;
    return "";

}

const fetchMapDetails = async (mapId: string, accessToken: string): Promise<IGetMapsDetailsResponse | null> => {
    try {
        const response = await axios.get(`${MAP_DETAILS_URL}${mapId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
        });

        if (response.status === 200) {
            return response.data as IGetMapsDetailsResponse;
        }
    } catch (error) {
        console.error("Error fetching map details:", error);
    }
    return null;
}


const prepareFormdataAndQuery = async (
    imgData: ICameraImgData,
    cameraIntrinsics: ICameraIntrinsics,
    code: string,
    type: MapType,
    accessToken: string
): Promise<ILocalizeAndMapDetails | null> => {
    const formData = new FormData();
    formData.append("isRightHanded", "true");
    formData.append("width", `${imgData.width}`);
    formData.append("height", `${imgData.height}`);
    formData.append("px", `${cameraIntrinsics.px}`);
    formData.append("py", `${cameraIntrinsics.py}`);
    formData.append("fx", `${cameraIntrinsics.fx}`);
    formData.append("fy", `${cameraIntrinsics.fy}`);
    formData.append("queryImage", imgData.imgBlob);

    if (type === "map") {
        formData.append("mapCode", code);
    } else if (type === "map-set") {
        formData.append("mapSetCode", code);
    }

    try {
        const response = await axios.post(QUERY_URL, formData, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
        });

        if (response.status === 200) {
            const data: ILocalizeResponse = response.data;
            const queryData = {} as ILocalizeAndMapDetails;

            if (data.poseFound) {
                // Download the mesh here.
                queryData.localizeData = data;
                if (data.mapIds && data.mapIds.length > 0) {
                    const mapDetails = await fetchMapDetails(data.mapIds[0], accessToken)
                    if (mapDetails) {
                        queryData.mapDetails = mapDetails;
                    } else {
                        console.warn("Map details not found for the given map ID.");
                    }
                }

                return queryData;
            }
            console.warn("Pose not found in the response.");
            return null;
        }
        console.error("Unexpected response status:", response.status);
        return null;
    } catch (error) {
        console.error("Error during query:", error);
        return null;
    }
}

export { getCameraIntrinsics, getCameraTextureAsImage, prepareFormdataAndQuery, fileDownload }