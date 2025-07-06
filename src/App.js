import "./App.css";
import FaceRecognition from "./components/FaceRecognition";
import FaceRecognitionAuto from "./components/FaceRecognitionAuto";
import FaceRecognitionWithAgeRange from "./components/FaceRecognitionWithAgeRange";
import "./index.css";

function App() {
  // return <FaceRecognition />;
  // return <FaceRecognitionAuto />;
  return <FaceRecognitionWithAgeRange />;
}

export default App;
