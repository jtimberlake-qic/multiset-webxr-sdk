/* eslint-disable @typescript-eslint/no-explicit-any */
import MultiSetIco from "./assets/MultiSet.svg";
import MultiSetARIco from "./assets/MultiSet_ar.svg";
import CancelIco from "./assets/cancel.svg";
import CameraIcon from "./assets/cameraIcon.svg";
import "./App.css";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import * as THREE from "three";
import {
  OrbitControls,
  ARButton,
  DRACOLoader,
  GLTFLoader,
} from "three/examples/jsm/Addons.js";

import {
  fileDownload,
  getCameraIntrinsics,
  getCameraTextureAsImage,
  prepareFormdataAndQuery,
  useDeviceOrientation,
} from "./Utils";

import {
  CODE,
  CURRENT_MAP_TYPE,
  SDK_AUTH_URL,
  CLIENT_ID,
  CLIENT_SECRET,
} from "./config";
import type { IGetMapsDetailsResponse, ILocalizeResponse } from "./interfaces";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const axesHelper = new THREE.AxesHelper(1);

const LARGE_MAP_THRESHOLD = 50.0;

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeCaptureBtn, setActiveCaptureBtn] = useState<boolean>(false);
  const [localizing, setLocalizing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [poseResult, setPoseResult] = useState<ILocalizeResponse | null>(null);
  const [mapDetails, setMapDetails] = useState<IGetMapsDetailsResponse | null>(
    null
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const trackerSpaceRef = useRef<THREE.Matrix4 | null>(null);

  const deviceOrientation = useDeviceOrientation();

  const exitARMode = useCallback(() => {
    const renderer = rendererRef.current;
    if (renderer) {
      const session = renderer.xr.getSession();
      if (session) {
        if (renderer.xr.isPresenting) session.end();
      }
    }

    setActiveCaptureBtn(false);
  }, []);

  const captureCameraFeed = useCallback(async () => {
    setLocalizing(true);

    const renderer = rendererRef.current;
    const camera = cameraRef.current;

    if (!renderer || !camera || !accessToken) return;

    const session = renderer.xr.getSession && renderer.xr.getSession();

    if (session) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      if (!referenceSpace) return;

      session.requestAnimationFrame(async (_, xrFrame) => {
        const viewerPose = xrFrame.getViewerPose(referenceSpace);
        const gl = renderer.getContext();

        if (viewerPose) {
          for (const view of viewerPose.views) {
            if ((view as any).camera) {
              const xrCamera = (view as any).camera;
              const binding = new XRWebGLBinding(xrFrame.session, gl);
              const cameraTexture = (binding as any).getCameraImage(xrCamera);

              const videoWidth = xrCamera.width;
              const videoHeight = xrCamera.height;

              const bytes = videoWidth * videoHeight * 4;

              if (bytes > 0) {
                const cameraViewport: XRViewport = {
                  width: videoWidth,
                  height: videoHeight,
                  x: 0,
                  y: 0,
                };

                const cameraIntrinsics = getCameraIntrinsics(
                  view.projectionMatrix,
                  cameraViewport,
                  deviceOrientation
                );

                trackerSpaceRef.current = new THREE.Matrix4();
                trackerSpaceRef.current.copy(camera.matrix);

                const imgData = await getCameraTextureAsImage(
                  renderer,
                  cameraTexture,
                  videoWidth,
                  videoHeight
                );

                if (imgData && cameraIntrinsics) {
                  const response = await prepareFormdataAndQuery(
                    imgData,
                    cameraIntrinsics,
                    CODE,
                    CURRENT_MAP_TYPE,
                    accessToken
                  );

                  if (
                    response &&
                    response.localizeData &&
                    response.localizeData.poseFound
                  ) {
                    setPoseResult(response.localizeData);
                    if (response.mapDetails) setMapDetails(response.mapDetails);
                    setToastMessage("Localization Success!");
                  } else {
                    setToastMessage("Localization Failed!");
                  }
                }
              }

              gl.bindFramebuffer(
                gl.FRAMEBUFFER,
                xrFrame.session.renderState.baseLayer!.framebuffer
              );
            }
          }
        }

        setLocalizing(false);
      });
    } else {
      setLocalizing(false);
      setToastMessage("AR Session not available");
      console.error("AR Session not available");
    }
  }, [accessToken, deviceOrientation]);

  // Handle window resize
  const onWindowResize = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;

    if (!renderer || !scene || !camera) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, []);

  // Animation loop
  const animate = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!renderer || !scene || !camera) return;

    renderer.render(scene, camera);
    if (controls) controls.update();
  }, []);

  const loadGizmo = useCallback(() => {
    const scene = sceneRef.current;

    if (!scene) return;

    gltfLoader.load("/models/transform_gizmo.glb", (gltf) => {
      gltf.scene.name = "gizmo";

      gltf.scene.traverse((child) => {
        if (child.name.includes("YAxis")) {
          (child as THREE.Mesh).material = new THREE.MeshBasicMaterial({
            color: "blue",
          });
        } else if (child.name.includes("ZAxis")) {
          (child as THREE.Mesh).material = new THREE.MeshBasicMaterial({
            color: "green",
          });
        } else if (child.name.includes("XAxis")) {
          (child as THREE.Mesh).material = new THREE.MeshBasicMaterial({
            color: "red",
          });
        }
      });

      gltf.scene.scale.set(0.2, 0.2, 0.2);
      if (meshGroupRef && meshGroupRef.current)
        meshGroupRef.current.add(gltf.scene);
    });
  }, []);

  // Initialize
  const InitializeAR = useCallback(() => {
    if (rendererRef.current) return;

    if (canvasRef.current) {
      // Renderer setup

      // Camera
      const camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.2,
        10000
      );
      camera.position.set(0.8, 0.6, -2.7);
      cameraRef.current = camera;

      // Scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Renderer
      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setAnimationLoop(animate);
      renderer.xr.enabled = true;
      renderer.xr.addEventListener("sessionstart", async () => {
        const session = renderer.xr.getSession();
        if (session) {
          setActiveCaptureBtn(true);
        }
      });
      rendererRef.current = renderer;

      // controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.minDistance = 0;
      controls.maxDistance = 100;
      controls.maxPolarAngle = Math.PI;
      controls.target.set(0, 0, -0.2);
      controlsRef.current = controls;

      // Add Mesh Parent to Scene
      meshGroupRef.current = new THREE.Group();
      meshGroupRef.current.visible = false;
      scene.add(meshGroupRef.current);

      // Lights
      const light = new THREE.HemisphereLight(0xffffff, 0xf8f0ff, 1);
      light.position.set(0.5, 2, 0.25);
      scene.add(light);

      const diLight = new THREE.DirectionalLight("#7B2CBF");
      diLight.position.set(0, 2, 0);
      scene.add(diLight);

      // Load Gizmo
      loadGizmo();

      // Add AR Button
      const arBtnCont = document.getElementById("ARButton_Container");
      const arBtn = ARButton.createButton(renderer, {
        requiredFeatures: ["camera-access", "dom-overlay"],
        domOverlay: { root: document.body },
      });
      arBtnCont!.appendChild(arBtn);
      window.addEventListener("resize", onWindowResize, false);
    }
  }, [animate, loadGizmo, onWindowResize]);

  // Function to handle authorization
  // This function will be called when the user clicks the "Authorize" button
  const handleAuth = useCallback(async () => {
    try {
      const response = await axios.post(
        SDK_AUTH_URL,
        {},
        {
          auth: { username: CLIENT_ID, password: CLIENT_SECRET },
        }
      );

      if (response.status === 200) {
        // resonse data has the access token
        // you can use this token to make further requests
        const accessToken = response.data.token;

        // You can now use the access token for further API requests
        // For example, you can store it in localStorage or state
        setAccessToken(accessToken);

        InitializeAR();
      } else {
        setError("Authorization failed");
        console.error(
          "Authorization failed:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      setError("Authorization failed");
      console.error("Request failed:", error);
    }
  }, [InitializeAR]);

  useEffect(() => {
    // Cleanup function
    return () => {
      if (rendererRef.current) {
        window.removeEventListener("resize", onWindowResize);
        rendererRef.current.dispose();
        rendererRef.current = null;
        // setQueryPoseData({} as ILocalizeResponse);
      }

      const arBtn = document.getElementById("ARButton");
      if (arBtn)
        document.getElementById("ARButton_Container")!.removeChild(arBtn);
    };
  }, [onWindowResize]);

  const loadMesh = useCallback(async () => {
    if (mapDetails && accessToken) {
      const meshGroup = meshGroupRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      if (!meshGroup || !scene || !camera || !controls) return;
      if (scene.getObjectByName(mapDetails._id)) return;

      const url = await fileDownload(
        mapDetails.mapMesh.rawMesh.meshLink,
        accessToken
      );

      const meshMaterial = new THREE.MeshStandardMaterial({
        color: "#7B2CBF",
        opacity: 0.6,
        transparent: true,
      });

      gltfLoader.load(url, (gltf) => {
        gltf.scene.traverse((child) => {
          (child as THREE.Mesh).material = meshMaterial;
        });

        const box = new THREE.Box3().setFromObject(gltf.scene);
        let size = box.getSize(new THREE.Vector3()).length();
        let center = box.getCenter(new THREE.Vector3());

        if (size > LARGE_MAP_THRESHOLD) {
          size = LARGE_MAP_THRESHOLD;
          center = new THREE.Vector3();
        }

        controls.reset();

        controls.maxDistance = size * 10;

        camera.position.copy(center);
        camera.position.x += size / 2.0;
        camera.position.y += size / 5.0;
        camera.position.z += size / 2.0;

        camera.position.z = -camera.position.z;

        const mesh = gltf.scene;
        mesh.name = mapDetails._id;
        meshGroup.add(gltf.scene);
        controls.update();
      });
    }
  }, [accessToken, mapDetails]);

  const processPoseResult = useCallback(async () => {
    if (poseResult) {
      // Load the mesh first
      await loadMesh();

      const scene = sceneRef.current;
      const trackerSpace = trackerSpaceRef.current;
      const meshGroup = meshGroupRef.current;

      if (!scene || !trackerSpace || !meshGroup || !poseResult) return;

      const resPosition = new THREE.Vector3(
        poseResult.position.x,
        poseResult.position.y,
        poseResult.position.z
      );

      const resRotation = new THREE.Quaternion(
        poseResult.rotation.x,
        poseResult.rotation.y,
        poseResult.rotation.z,
        poseResult.rotation.w
      );

      // 1. Compose the transformation matrix directly from position and rotation
      const responseMatrix = new THREE.Matrix4();
      const scaleVec = new THREE.Vector3(1, 1, 1); // Assuming scale is 1
      responseMatrix.compose(resPosition, resRotation, scaleVec);

      // 2. Invert the matrix to get the correct inverse pose
      // Using clone() before invert() is good practice to not modify responseMatrix
      const inverseResponseMatrix = responseMatrix.clone().invert();

      // 3. Multiply with the tracker space
      const resultantMatrix = new THREE.Matrix4();
      resultantMatrix.multiplyMatrices(trackerSpace, inverseResponseMatrix);

      // 4. Decompose the final matrix to get the object's new pose
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      resultantMatrix.decompose(position, rotation, scale);

      // 5. Apply the new pose to your object
      meshGroup.position.copy(position);
      meshGroup.quaternion.copy(rotation);
      meshGroup.scale.set(1, 1, 1); // It's better to explicitly set scale if you don't use the decomposed one

      meshGroup.visible = true;

      meshGroup.updateMatrix();
      meshGroup.visible = true;

      scene.add(axesHelper);
    }
  }, [loadMesh, poseResult]);

  // Hanlde Pose Result
  useEffect(() => {
    if (poseResult) processPoseResult();
  }, [poseResult, processPoseResult]);

  // Clear Toast after 4 seconds
  useEffect(() => {
    if (!toastMessage) return;

    const toastTimeout = setTimeout(() => {
      setToastMessage("");
    }, 4000);

    return () => clearTimeout(toastTimeout);
  }, [toastMessage]);

  // If there is an error, display it
  if (error) {
    return (
      <div className="flex h-screen w-full justify-center items-center">
        <div style={{ display: "flex" }}>
          <h2 style={{ color: "Red" }}>Error: {error}</h2>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="app-container">
        <div style={{ position: "relative" }}>
          {/* Canvas for Three.js */}
          <canvas
            ref={canvasRef}
            style={{ display: activeCaptureBtn ? "none" : "block" }}
          />

          <div
            id="ARButton_Container"
            className={`${
              activeCaptureBtn ? "arBtnContHide" : "arBtnContShow"
            }`}
          >
            <div className="absolute top-5 left-0 p-8 w-full">
              <img className="h-16" src={MultiSetIco} alt="MultiSet" />
            </div>

            {!accessToken && (
              <div>
                <button
                  className="btn px-4 py-2.5 text-white"
                  onClick={handleAuth}
                >
                  Authorize
                </button>
              </div>
            )}
          </div>

          {activeCaptureBtn && localizing && (
            <div className="absolute w-full h-screen flex justify-center items-center bg-[#00000099]">
              <div className="flex flex-col items-center justify-center gap-y-4">
                <video
                  id="localizing-gif"
                  playsInline
                  muted
                  autoPlay
                  loop
                  className="w-24"
                >
                  <source
                    id="video-source"
                    src="/video/findaplane.webm"
                    type="video/webm"
                  />
                  {/* Your browser does not support the video tag. */}
                </video>
                <h1 className="text-white text-sm w-36 text-center">
                  Look forward and move device slowly
                </h1>

                <h1 className="mt-4 text-white text-sm w-36 text-center">
                  Localizing...
                </h1>
              </div>
            </div>
          )}

          {/* Overlay button */}
          {activeCaptureBtn && !localizing ? (
            <>
              <div
                onClick={exitARMode}
                className=" rounded-xl flex justify-center items-center bg-[#311361] text-white top-14 right-5 text-xl fixed p-3 z-[99999999]"
              >
                <img src={CancelIco} alt="X" />
              </div>

              <button
                onClick={captureCameraFeed}
                className=" rounded-full border-2 border-[#311361] bg-white fixed bottom-5 right-6 z-[99999999]"
              >
                <img src={CameraIcon} alt="Capture Icon" />
              </button>
            </>
          ) : (
            ""
          )}

          {activeCaptureBtn ? (
            <>
              <div className="fixed bottom-5 left-5">
                <img className="h-10" src={MultiSetARIco} alt="multiset" />
              </div>
            </>
          ) : (
            ""
          )}

          {/* Custom Toast */}
          {toastMessage && (
            <div className="w-full h-screen absolute left-0 top-0 text-[#ffffff] flex justify-center items-end">
              <div className="mb-40 bg-[#7B2CBF] px-4 py-3 rounded-xl font-medium">
                {toastMessage}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
