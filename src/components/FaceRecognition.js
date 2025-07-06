import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

const FaceRecognition = () => {
  const videoRef = useRef(null);
  const [similarityResult, setSimilarityResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataset, setDataset] = useState([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = "/models";
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load models:", err);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (modelsLoaded) {
      loadDataset();
      startCamera();
    }
  }, [modelsLoaded]);

  const loadDataset = async () => {
    const labels = ["Sergei", "Sergey", "Salma"];
    const loaded = await Promise.all(
      labels.map(async (label) => {
        try {
          const img = await faceapi.fetchImage(`/dataset/${label}.jpeg`);
          const detections = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (!detections) return null;
          return { name: label, descriptor: detections.descriptor };
        } catch (err) {
          console.warn(`Failed to load face for ${label}`, err);
          return null;
        }
      })
    );
    setDataset(loaded.filter(Boolean));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const scanFace = async () => {
    setLoading(true);
    setSimilarityResult(null);

    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setSimilarityResult("🙈 No face detected. Please try again.");
      setLoading(false);
      return;
    }

    const distances = dataset.map((person) => {
      const distance = faceapi.euclideanDistance(detection.descriptor, person.descriptor);
      return { name: person.name, distance };
    });

    distances.sort((a, b) => a.distance - b.distance);
    const bestMatch = distances[0];
    const similarity = Math.max(0, 1 - bestMatch.distance) * 100;

    setSimilarityResult(`🧠 You look like: ${bestMatch.name} (${similarity.toFixed(1)}% similarity)`);
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gray-100">
      <div className="w-full max-w-2xl p-8 text-center bg-white border border-gray-300 shadow-2xl rounded-3xl">
        <h2 className="mb-6 text-3xl font-semibold text-gray-800">👤 Face Similarity Scanner</h2>

        {!modelsLoaded ? (
          <p className="text-lg text-gray-600 animate-pulse">🔄 Loading face recognition models...</p>
        ) : (
          <>
            <div className="flex justify-center mb-6">
              <video ref={videoRef} autoPlay muted width="560" height="400" className="border-4 border-gray-300 shadow-md rounded-xl" />
            </div>

            <button
              onClick={scanFace}
              disabled={loading || dataset.length === 0}
              className={`w-full sm:w-1/2 transition-colors duration-200 text-white text-lg py-3 rounded-xl font-semibold shadow-md ${
                loading || dataset.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Scanning..." : "🔍 Scan Face"}
            </button>

            {similarityResult && (
              <div className="p-4 mt-6 text-xl font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-xl">
                {similarityResult}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FaceRecognition;
