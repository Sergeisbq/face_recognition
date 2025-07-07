import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { FaceMesh as MediaPipeFaceMesh } from "@mediapipe/face_mesh";
import { drawConnectors } from "@mediapipe/drawing_utils";
import { FACEMESH_TESSELATION } from "@mediapipe/face_mesh";
import FaceApi from "./FaceApi";

const FaceRecognitionAuto = () => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [bestMatch, setBestMatch] = useState(null);
  const [dataset, setDataset] = useState([]);
  const [age, setAge] = useState(null);
  const [gender, setGender] = useState(null);

  const videoRef = useRef(null);
  const faceApiCanvasRef = useRef(null);
  const mediaPipeCanvasRef = useRef(null);
  const datasetRef = useRef([]);
  const mediaPipeFaceMesh = useRef(null);
  const scannerLineRef = useRef(null);
  const faceVerticalRange = useRef({ top: 0, bottom: 0 });

  const userFaceInfo = useRef({
    expressions: {},
    age: 0,
    gender: 0
  });

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = "/models";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
      ]);
      setModelsLoaded(true);
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (modelsLoaded) {
      loadDataset();
      startCamera();
    }
  }, [modelsLoaded]);

  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  useEffect(() => {
    let animationFrameId;

    const updateOpacity = () => {
      const scanner = scannerLineRef.current;
      const canvas = mediaPipeCanvasRef.current;
      if (!scanner || !canvas) {
        animationFrameId = requestAnimationFrame(updateOpacity);
        return;
      }

      // Get scanner top relative to container
      const scannerRect = scanner.getBoundingClientRect();
      const containerRect = scanner.parentElement.getBoundingClientRect();
      // scanner relative Y inside container
      const scannerY = scannerRect.top - containerRect.top + scannerRect.height / 2;

      // face vertical bounds
      const { top: faceTop, bottom: faceBottom } = faceVerticalRange.current;

      // calculate opacity based on distance from scanner line to face center
      const margin = 100; // px fade distance
      const faceCenter = (faceTop + faceBottom) / 2;
      const dist = Math.abs(scannerY - faceCenter);

      let opacity = 0;
      if (dist < margin) {
        opacity = 1 - dist / margin;
      }

      canvas.style.opacity = opacity;

      animationFrameId = requestAnimationFrame(updateOpacity);
    };

    updateOpacity();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    setGender(userFaceInfo?.current?.gender);
    setAge(userFaceInfo?.current?.age);
  }, [userFaceInfo?.current?.age, userFaceInfo?.current?.gender]);

  const loadDataset = async () => {
    const labels = [
      "Sergei",
      "Sergey",
      "Salma",
      "Dima",
      "Daniil",
      "Eytan",
      "Itay",
      "Margo",
      "Noi",
      "Sasha",
      "Tom",
      "Evgeniy",
      "Eugeniy",
      "Marcelo",
      "דוריס מור",
      "רינה שוסטר",
      "אריאל פריש",
      "אלינור חייט",
      "אכרם קובטי",
      "אבי ארנוולד",
      "אלעד עובדיה",
      "שני ליבמן",
      "עאמר ותד",
      "עינב בן דוד כהן",
      "ענבל בית הלחמי",
      "רונן (רון) פרץ",
      "אבי אברמוביץ",
      "מריאנה נולמן סנין",
      "ניסן בשארי",
      "צביקה גרולד אייזנברג",
      "אורן חקון",
      "אמיל ביאדסה",
      "עמרם נהרי",
      "יעל גיל עד",
      "עופר אקריש",
      "מאיה כלב"
    ];
    const loaded = await Promise.all(
      labels.map(async (label) => {
        try {
          const img = await faceapi.fetchImage(`/dataset/${label}.jpeg`);
          const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (!detection) return null;
          return { name: label, descriptor: detection.descriptor };
        } catch {
          return null;
        }
      })
    );
    setDataset(loaded.filter(Boolean));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();

      mediaPipeFaceMesh.current = new MediaPipeFaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });
      mediaPipeFaceMesh.current.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      mediaPipeFaceMesh.current.onResults(onMediaPipeResults);

      requestAnimationFrame(mediaPipeFrame);

      setInterval(scanFace, 800);
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const mediaPipeFrame = async () => {
    if (mediaPipeFaceMesh.current && videoRef.current?.videoWidth) {
      await mediaPipeFaceMesh.current.send({ image: videoRef.current });
    }
    requestAnimationFrame(mediaPipeFrame);
  };

  const onMediaPipeResults = (results) => {
    const canvas = mediaPipeCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks) {
      for (const landmarks of results.multiFaceLandmarks) {
        drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {
          color: "#00b300",
          lineWidth: 0.7
        });
      }
    }
  };

  const scanFace = async () => {
    const video = videoRef.current;
    const canvas = faceApiCanvasRef.current;
    if (!video || !canvas || !datasetRef.current.length) return;

    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      setBestMatch(null);
      clearCanvas(canvas);
      return;
    }

    const dims = faceapi.matchDimensions(canvas, video, true);
    const resizedDetections = faceapi.resizeResults(detection, dims);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

    const distances = datasetRef.current.map((person) => ({
      name: person.name,
      distance: faceapi.euclideanDistance(detection.descriptor, person.descriptor)
    }));
    distances.sort((a, b) => a.distance - b.distance);
    const top = distances[0];
    const similarity = Math.max(0, 1 - top.distance) * 100;

    if (similarity > 45) {
      setBestMatch({ name: top.name, similarity: similarity.toFixed(1) });
    } else {
      setBestMatch(null);
    }
  };

  const clearCanvas = (canvas) => {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gray-100">
      <div className="relative w-full max-w-2xl p-6 bg-white border border-gray-300 shadow-xl rounded-3xl">
        <h2 className="mb-4 text-3xl font-semibold text-center text-gray-800">Face Match Scanner</h2>

        <div className="relative">
          <video ref={videoRef} autoPlay muted playsInline width="auto" height="600" className="shadow rounded-xl" />
          {bestMatch && age && (
            <div className="absolute z-40 px-4 py-2 text-lg font-medium text-right text-gray-800 bg-white rounded-lg shadow right-4 top-4 bg-opacity-80 rtl">
              שלום <strong>{bestMatch.name}</strong>
              <br />
              <div>האם אני צודק אם אני אומר שאתה</div>
              בגיל {age.toFixed(0)} {gender === "male" ? "גבר" : "אישה"}?<div>בכל מקרה, נרשמת הרגע לקורס בינה מלאכותית</div>
            </div>
          )}

          <canvas
            ref={faceApiCanvasRef}
            className="absolute top-0 left-0 hidden w-full h-full pointer-events-none"
            style={{ borderRadius: 24 }}
          />

          <canvas
            ref={mediaPipeCanvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ borderRadius: 24 }}
          />

          <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none rounded-xl">
            <div ref={scannerLineRef} className="h-[12px] w-full animate-scan absolute top-0" />
            {/* bg-[#fff45548] */}
          </div>
          <FaceApi video={videoRef.current} userFaceInfo={userFaceInfo} />
        </div>

        {!modelsLoaded && <p className="mt-4 text-center text-gray-600 animate-pulse">Loading models...</p>}
      </div>
    </div>
  );
};

export default FaceRecognitionAuto;
