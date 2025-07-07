import { useEffect, useMemo, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { FaceMesh as MediaPipeFaceMesh } from "@mediapipe/face_mesh";
import { drawConnectors } from "@mediapipe/drawing_utils";
import { FACEMESH_TESSELATION } from "@mediapipe/face_mesh";
import FaceApi from "./FaceApi";

const aiJokes = [
  "😅 אתה כל כך מיוחד שהבינה המלאכותית לא הצליחה לזהות אותך",
  "😎 הפנים שלך כל כך מבריקות שהמערכת הסתנוורה",
  "🧙‍♂️ המערכת חושבת שאתה אגדה – לא נמצא במאגר בכלל",
  "⭐️ ה-AI מגרד בראש... מי זה הכוכב הזה?",
  "🕵️‍♂️ לא הצלחנו לזהות אותך, אולי אתה מרגל?",
  "😴 מערכת הזיהוי החליטה לקחת הפסקה דווקא כשאתה הופעת",
  "🤖🫣 אתה כל כך אנושי שזה בילבל את האלגוריתם"
];

const FaceRecognitionAuto = () => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [bestMatch, setBestMatch] = useState(null);
  const [dataset, setDataset] = useState([]);
  const [age, setAge] = useState(null);
  const [gender, setGender] = useState(null);
  const [ageRange, setAgeRange] = useState(null);

  const ageSamplesRef = useRef([]);
  const lastAgeTimestampRef = useRef(Date.now());

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

  const randomJoke = useMemo(() => {
    const index = Math.floor(Math.random() * aiJokes.length);
    return aiJokes[index];
  }, [ageRange]);

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

      const scannerRect = scanner.getBoundingClientRect();
      const containerRect = scanner.parentElement.getBoundingClientRect();
      const scannerY = scannerRect.top - containerRect.top + scannerRect.height / 2;

      const { top: faceTop, bottom: faceBottom } = faceVerticalRange.current;

      const margin = 100;
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

  useEffect(() => {
    if (age === null) return;

    const now = Date.now();
    const elapsed = now - lastAgeTimestampRef.current;

    if (elapsed > 2000) {
      ageSamplesRef.current = [];
      lastAgeTimestampRef.current = now;
    }

    ageSamplesRef.current.push(age);

    if (ageSamplesRef.current.length >= 5) {
      const avg = ageSamplesRef.current.reduce((a, b) => a + b, 0) / ageSamplesRef.current.length;
      const rounded = Math.round(avg);
      setAgeRange([rounded - 2, rounded + 2]);
      ageSamplesRef.current = [];
      lastAgeTimestampRef.current = now;
    }
  }, [age, bestMatch]);

  const loadDataset = async () => {
    const labels = [
      "איתי",
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
      "מאיה כלב",
      "דני גל",
      "אלה טרכטנברג",
      "מחמוד סאבק",
      "איתי רכטמן",
      "שני אביטן",
      "מסאלחה עבד אלכרים",
      "איתמר יהושע",
      "רון עוזרי",
      "ענבל לאור צדיק",
      "שרונה חבסוב",
      "בת אל גטו",
      "סיגלית רובין פלור"
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
      setBestMatch({ similarity: similarity.toFixed(1) });
    }
  };

  const clearCanvas = (canvas) => {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-8 bg-gray-100">
      <div className="relative w-full max-w-2xl p-6 bg-white border border-gray-300 shadow-xl rounded-3xl">
        <h2 className="mb-4 text-3xl font-semibold text-center text-gray-800">רישום נוכחות על ידי סריקת הפנים</h2>

        <div className="relative">
          <video ref={videoRef} autoPlay muted playsInline width="auto" height="600" className="shadow rounded-xl" />
          {bestMatch && ageRange && (
            <div className="flex flex-col justify-between">
              <div className="absolute z-40 flex flex-col items-end gap-2 space-y-2 text-lg font-medium text-right text-gray-800 right-4 top-4 rtl">
                {bestMatch?.similarity > 45 ? (
                  <div className="px-4 py-1 bg-white rounded-lg shadow bg-opacity-60">
                    <strong>{bestMatch.name}</strong> זוהה בווידאו
                  </div>
                ) : (
                  <div className="px-4 py-1 bg-white rounded-lg shadow bg-opacity-60 rtl">{randomJoke}</div>
                )}
                <div className="flex flex-row gap-3">
                  <div className="flex gap-2 px-4 py-1 bg-white rounded-lg shadow bg-opacity-60">
                    גילך מוערך בין {ageRange[0] || 30} ל-{ageRange[1] || 34}
                  </div>
                  <div className="flex gap-2 px-4 py-1 bg-white rounded-lg shadow bg-opacity-60">
                    אתה {gender === "male" ? "גבר" : "אישה"}
                  </div>
                </div>
              </div>
              {bestMatch?.similarity > 45 && (
                <div className="absolute z-40 flex flex-col items-end gap-2 space-y-2 text-lg font-medium text-right text-gray-800 right-3 bottom-8 rtl">
                  <div className="px-4 py-1 bg-gradient-to-r from-[#00ff2f] via-[#aeff00] to-[#00ff2f] rounded-lg shadow-2xl bg-opacity-80 rtl">
                    !וכבר רשמנו את הנוכחות שלך למפגש הנוכחי AI זיהינו אותך אוטומטית על ידי{" "}
                  </div>
                </div>
              )}
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

        {!modelsLoaded && <p className="mt-4 text-center text-gray-600 animate-pulse">...טוען</p>}
      </div>
    </div>
  );
};

export default FaceRecognitionAuto;
