import {use, useEffect, useRef, useState} from 'react';
import {Pose, POSE_CONNECTIONS} from '@mediapipe/pose';
import {Camera} from '@mediapipe/camera_utils';
import * as drawing from '@mediapipe/drawing_utils';
import { useNavigate } from 'react-router-dom';

function Session() {

    // hook declarations
    const videoRef = useRef(null);
    const cameraRef = useRef(null);
    const poseRef = useRef(null);
    const navigate = useNavigate();

    // State to manage the session status (idle, running, stopped)
    const [status, setStatus] = useState('idle');

    // When page is initally loaded, set up the Pose instance from MediaPipe
    useEffect(() => {
        const pose = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        
        // configure options of the pose instance
        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6,
        });
        
        // runs every time a new frame is processed 
        pose.onResults((res) => {
        // res.poseLandmarks is an array of the body's keypoint landmarks
            if (res.poseLandmarks) {
                console.log("Landmarks:", res.poseLandmarks.length);
            }
        });

        poseRef.current = pose;

        return () => {
            if (cameraRef.current) cameraRef.current.stop();
        };
    }, []);

    const start = async () => {

        // Wait for mediapipe pose to be setup
        if (!poseRef.current) return;

        // Get user media stream from webcam
        const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
        });

        // Connect user webcam stream to the video element, this allows the user to see themselves in the video element
        if (videoRef.current) {
        videoRef.current.srcObject = stream;
        }

        // Create a new MediaPipe Camera instance to process the video stream
        const cam = new Camera(videoRef.current, {
        onFrame: async () => {
            await poseRef.current.send({ image: videoRef.current });
        }, width: 1280, height: 720, });


        cameraRef.current = cam;
        cam.start();
        setStatus("running");
    };

    const cancel = async () => {
        setStatus('idle');
        if (cameraRef.current) await cameraRef.current.stop();

        const stream = videoRef.current?.srcObject;
        if (stream) {
            // Stop all tracks of the stream and clear source object
            stream.getTracks().forEach((t) => t.stop());
            videoRef.current.srcObject = null;
        }
    };

    const stopAndSave = async () => {
        setStatus('stopped');
        if (cameraRef.current) await cameraRef.current.stop();

        const stream = videoRef.current?.srcObject;
        if (stream) {
            // Stop all tracks of the stream and clear source object
            stream.getTracks().forEach((t) => t.stop());
            videoRef.current.srcObject = null;
        }

        // TODO: Save the session data to backend
        // This would include pushup count, duration, etc.
        console.log('Saving session data...');

        // Redirect to dashboard after saving
        navigate('/');
    };

    const goToDashboard = () => {
        navigate('/');
    };



    return (
        <div className="mx-auto max-w-4xl p-4">
            
            <button 
                onClick={goToDashboard}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 text-xl font-bold"
            >
                X
            </button>



            <h1 className="text-2xl font-bold mb-4">Push‑Up Session</h1>

            <div className="rounded-2xl overflow-hidden shadow">
                <video ref={videoRef} className="w-full h-auto" autoPlay playsInline muted />
            </div>

            <div className="flex gap-2 mt-4">
                {status !== "running" ? (
                <button onClick={start} className="px-4 py-2 rounded-xl bg-green-600 text-white">
                    Start
                </button>
                ) : (
                <>
                    <button onClick={cancel} className="px-4 py-2 rounded-xl bg-gray-600 text-white">
                        Cancel Session
                    </button>
                    <button onClick={stopAndSave} className="px-4 py-2 rounded-xl bg-blue-600 text-white">
                        Stop & Save Session
                    </button>
                </>
                )}
            </div>
        </div>
    );

}

export default Session