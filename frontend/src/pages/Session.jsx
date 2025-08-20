import {use, useEffect, useRef, useState} from 'react';
import {Pose} from '@mediapipe/pose';
import {Camera} from '@mediapipe/camera_utils';
import * as drawing from '@mediapipe/drawing_utils';

function Session() {

    const videoRef = useRef(null);
    const [status, setStatus] = useState('idle');

    const start = async () => {
        try {
            // Get access to user's camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {width: 1280, height: 720, facingMode: 'user'},
                audio: false
            });

            // Connect user's webcam stream to video element
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setStatus('running');

        } catch (error) {
            console.error(error);
        }
    };

    const stop = () => {
        const stream = videoRef.current?.srcObject;
        if (stream) {
            // Stop all tracks of the stream and clear source object
            stream.getTracks().forEach((t) => t.stop());
            videoRef.current.srcObject = null;
        }

        setStatus('stopped');
    }



    return (
        <div className="mx-auto max-w-4xl p-4">
            <h1 className="text-2xl font-bold mb-4">Push‑Up Session (Step 1)</h1>

            <div className="rounded-2xl overflow-hidden shadow">
                <video ref={videoRef} className="w-full h-auto" autoPlay playsInline muted />
            </div>

            <div className="flex gap-2 mt-4">
                {status !== "running" ? (
                <button onClick={start} className="px-4 py-2 rounded-xl bg-green-600 text-white">
                    Start
                </button>
                ) : (
                <button onClick={stop} className="px-4 py-2 rounded-xl bg-red-600 text-white">
                    Stop
                </button>
                )}
            </div>
        </div>
    );

}

export default Session