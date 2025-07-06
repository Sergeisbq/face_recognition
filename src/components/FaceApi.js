import { useEffect, useRef } from "react";
import * as faceapi from "face-api.js";
import { createDummyImage } from "./DummyPhoto";

export async function FaceApiWarmUp() {
  const dummyImage = await createDummyImage();
  await faceapi.detectSingleFace(dummyImage, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
  await faceapi.detectSingleFace(dummyImage, new faceapi.TinyFaceDetectorOptions()).withAgeAndGender();
}

const FaceApi = ({ video, userFaceInfo }) => {
  const intervalId = useRef();

  useEffect(() => {
    if (video && !intervalId.current) {
      intervalId.current = setInterval(async () => {
        const detectionWithExpressions = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
        const detectionWithAgeAndGender = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withAgeAndGender();

        if (!detectionWithExpressions && !detectionWithAgeAndGender) return;

        const newDetectedAge = detectionWithAgeAndGender?.age;

        const focusUserFaceDetails = userFaceInfo.current;

        userFaceInfo.current = focusUserFaceDetails;
        userFaceInfo.current.age = newDetectedAge;
        userFaceInfo.current.gender = detectionWithAgeAndGender?.gender;
      }, 100);

      return () => {
        clearInterval(intervalId.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  return;
};

export default FaceApi;
