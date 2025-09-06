import { useEffect, useRef, useState } from 'react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import * as drawing from '@mediapipe/drawing_utils';
import { useNavigate } from 'react-router-dom';

function Session() {

    // hook declarations
    const videoRef = useRef(null);
    const cameraRef = useRef(null);
    const poseRef = useRef(null);
    const canvasRef = useRef(null);
    const navigate = useNavigate();

    // State to manage the session status (idle, running, stopped)
    const [status, setStatus] = useState('idle');

    // Push-up tracking state
    const [pushupCount, setPushupCount] = useState(0);
    const [currentPosition, setCurrentPosition] = useState('unknown');
    const [sessionStartTime, setSessionStartTime] = useState(null);
    const [sessionDuration, setSessionDuration] = useState(0);

    // Debug state to see what's happening
    const [debugInfo, setDebugInfo] = useState({ armAngle: 0, bodyAngle: 0, visibility: 0 });

    // Push-up detection parameters - made more sensitive
    const pushupStateRef = useRef({
        count: 0,
        lastPosition: 'unknown',
        armAngleThreshold: { up: 130, down: 120 }, // More sensitive thresholds
        stabilityFrames: 0,
        requiredStabilityFrames: 1, // Reduced stability requirement
        positionHistory: [], // Track last few positions for better detection
        hasSeenDown: false, // Track if we've seen a down position
        hasSeenUp: false // Track if we've seen an up position
    });

    // Timer for session duration
    useEffect(() => {
        let interval;
        if (status === 'running' && sessionStartTime) {
            interval = setInterval(() => {
                setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [status, sessionStartTime]);

    // Helper function to calculate angle between three points
    const calculateAngle = (point1, point2, point3) => {
        const radians = Math.atan2(point3.y - point2.y, point3.x - point2.x) -
            Math.atan2(point1.y - point2.y, point1.x - point2.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) {
            angle = 360 - angle;
        }
        return angle;
    };

    // Improved push-up detection logic
    const detectPushup = (landmarks) => {
        try {
            // MediaPipe pose landmark indices
            const LEFT_SHOULDER = 11;
            const RIGHT_SHOULDER = 12;
            const LEFT_ELBOW = 13;
            const RIGHT_ELBOW = 14;
            const LEFT_WRIST = 15;
            const RIGHT_WRIST = 16;
            const LEFT_HIP = 23;
            const RIGHT_HIP = 24;

            // Check if required landmarks are detected with lower threshold
            const requiredLandmarks = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW,
                LEFT_WRIST, RIGHT_WRIST];

            const validLandmarks = requiredLandmarks.filter(index =>
                landmarks[index] && landmarks[index].visibility > 0.2
            );

            const avgVisibility = requiredLandmarks.reduce((sum, index) =>
                sum + (landmarks[index]?.visibility || 0), 0) / requiredLandmarks.length;

            if (validLandmarks.length < 4) {
                setDebugInfo(prev => ({ ...prev, visibility: Math.round(avgVisibility * 100) }));
                setCurrentPosition('landmarks_not_detected');
                return;
            }

            // Use the side that's more visible
            let shoulderPoint, elbowPoint, wristPoint;

            const leftVisibility = (landmarks[LEFT_SHOULDER]?.visibility || 0) +
                (landmarks[LEFT_ELBOW]?.visibility || 0) +
                (landmarks[LEFT_WRIST]?.visibility || 0);
            const rightVisibility = (landmarks[RIGHT_SHOULDER]?.visibility || 0) +
                (landmarks[RIGHT_ELBOW]?.visibility || 0) +
                (landmarks[RIGHT_WRIST]?.visibility || 0);

            if (leftVisibility > rightVisibility) {
                shoulderPoint = landmarks[LEFT_SHOULDER];
                elbowPoint = landmarks[LEFT_ELBOW];
                wristPoint = landmarks[LEFT_WRIST];
            } else {
                shoulderPoint = landmarks[RIGHT_SHOULDER];
                elbowPoint = landmarks[RIGHT_ELBOW];
                wristPoint = landmarks[RIGHT_WRIST];
            }

            if (!shoulderPoint || !elbowPoint || !wristPoint) {
                setCurrentPosition('insufficient_landmarks');
                return;
            }

            // Calculate arm angle (shoulder-elbow-wrist)
            const armAngle = calculateAngle(shoulderPoint, elbowPoint, wristPoint);

            // Update debug info
            setDebugInfo({
                armAngle: Math.round(armAngle),
                bodyAngle: 0, // Simplified for now
                visibility: Math.round(avgVisibility * 100)
            });

            // Determine current position based on arm angle with hysteresis
            let newPosition = 'transition';

            if (armAngle >= pushupStateRef.current.armAngleThreshold.up) {
                newPosition = 'up';
                if (!pushupStateRef.current.hasSeenUp) {
                    console.log(`🔵 First time seeing UP position! Angle: ${armAngle.toFixed(1)}°`);
                }
                pushupStateRef.current.hasSeenUp = true;
            } else if (armAngle <= pushupStateRef.current.armAngleThreshold.down) {
                newPosition = 'down';
                if (!pushupStateRef.current.hasSeenDown) {
                    console.log(`🔴 First time seeing DOWN position! Angle: ${armAngle.toFixed(1)}°`);
                }
                pushupStateRef.current.hasSeenDown = true;
                // Reset hasSeenUp when we enter down position (start of new rep cycle)
                if (pushupStateRef.current.hasSeenUp && pushupStateRef.current.lastPosition !== 'down') {
                    console.log(`🔄 Resetting UP flag - starting new rep cycle`);
                    pushupStateRef.current.hasSeenUp = false;
                }
            }

            // Add to position history
            pushupStateRef.current.positionHistory.push(newPosition);
            if (pushupStateRef.current.positionHistory.length > 5) {
                pushupStateRef.current.positionHistory.shift();
            }

            // Count push-up when we reach UP position after seeing DOWN (regardless of transition frames)
            if (newPosition === 'up' && pushupStateRef.current.hasSeenDown && pushupStateRef.current.hasSeenUp) {

                // Increment count immediately
                pushupStateRef.current.count++;
                setPushupCount(pushupStateRef.current.count);

                console.log(`🎉 Push-up #${pushupStateRef.current.count} completed! Arm angle: ${armAngle.toFixed(1)}°`);

                // Reset flags for next rep - but keep hasSeenUp true since we're still in up position
                pushupStateRef.current.hasSeenDown = false;
                // Don't reset hasSeenUp immediately since we're still in the up position
            } else {
                // Debug: Why didn't we count?
                if (newPosition === 'up' && pushupStateRef.current.hasSeenDown) {
                    console.log(`❌ Reached UP but not counted:`, {
                        newPosition: newPosition,
                        hasSeenDown: pushupStateRef.current.hasSeenDown,
                        hasSeenUp: pushupStateRef.current.hasSeenUp,
                        armAngle: armAngle.toFixed(1)
                    });
                }
            }

            // Update last position
            pushupStateRef.current.lastPosition = newPosition;
            setCurrentPosition(newPosition);

            // Debug logging
            if (armAngle < 140) { // Only log when in lower positions
                console.log(`Arm angle: ${armAngle.toFixed(1)}°, Position: ${newPosition}, Count: ${pushupStateRef.current.count}`);
            }

        } catch (error) {
            console.error('Error in push-up detection:', error);
            setCurrentPosition('error');
        }
    };

    // Draw pose landmarks on canvas
    const drawPose = (results) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.poseLandmarks) {
            // Draw connections
            drawing.drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 2
            });

            // Draw landmarks
            drawing.drawLandmarks(ctx, results.poseLandmarks, {
                color: '#FF0000',
                lineWidth: 1,
                radius: 3
            });
        }
    };

    // When page is initially loaded, set up the Pose instance from MediaPipe
    useEffect(() => {
        const pose = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        // configure options of the pose instance
        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        // runs every time a new frame is processed 
        pose.onResults((results) => {
            // Draw pose on canvas
            drawPose(results);

            // Detect push-ups only when running
            if (results.poseLandmarks && status === 'running') {
                detectPushup(results.poseLandmarks);
            }
        });

        poseRef.current = pose;

        return () => {
            if (cameraRef.current) cameraRef.current.stop();
        };
    }, [status]);

    const start = async () => {
        // Wait for mediapipe pose to be setup
        if (!poseRef.current) return;

        // Reset push-up tracking state
        pushupStateRef.current = {
            count: 0,
            lastPosition: 'unknown',
            armAngleThreshold: { up: 130, down: 120 },
            stabilityFrames: 0,
            requiredStabilityFrames: 1,
            positionHistory: [],
            hasSeenDown: false,
            hasSeenUp: false
        };
        setPushupCount(0);
        setCurrentPosition('unknown');
        setSessionStartTime(Date.now());
        setSessionDuration(0);

        // Get user media stream from webcam
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: "user" },
            audio: false,
        });

        // Connect user webcam stream to the video element
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }

        // Create a new MediaPipe Camera instance to process the video stream
        const cam = new Camera(videoRef.current, {
            onFrame: async () => {
                await poseRef.current.send({ image: videoRef.current });
            },
            width: 1280,
            height: 720,
        });

        cameraRef.current = cam;
        cam.start();
        setStatus("running");

        console.log('🚀 Push-up tracking started! Do push-ups sideways to the camera.');
    };

    const cancel = async () => {
        setStatus('idle');
        if (cameraRef.current) await cameraRef.current.stop();

        const stream = videoRef.current?.srcObject;
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            videoRef.current.srcObject = null;
        }

        // Reset tracking state
        setPushupCount(0);
        setCurrentPosition('unknown');
        setSessionStartTime(null);
        setSessionDuration(0);
    };

    const stopAndSave = async () => {
        setStatus('stopped');
        if (cameraRef.current) await cameraRef.current.stop();

        const stream = videoRef.current?.srcObject;
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            videoRef.current.srcObject = null;
        }

        // Save session data
        const sessionData = {
            pushupCount: pushupStateRef.current.count,
            duration: sessionDuration,
            timestamp: new Date().toISOString(),
        };

        console.log('Saving session data:', sessionData);

        // Redirect to dashboard after saving
        navigate('/');
    };

    const goToDashboard = () => {
        if (status === 'running') {
            cancel();
        }
        navigate('/');
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getPositionColor = (position) => {
        switch (position) {
            case 'up': return 'text-green-600';
            case 'down': return 'text-blue-600';
            case 'transition': return 'text-yellow-600';
            default: return 'text-gray-600';
        }
    };

    const getPositionText = (position) => {
        switch (position) {
            case 'up': return 'Up Position ✓';
            case 'down': return 'Down Position ✓';
            case 'transition': return 'In Motion';
            case 'landmarks_not_detected': return 'Can\'t See You Clearly';
            case 'insufficient_landmarks': return 'Move Into Better View';
            case 'error': return 'Detection Error';
            default: return 'Getting Ready...';
        }
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

            {/* Stats Display */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-100 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-blue-600">{pushupCount}</div>
                    <div className="text-sm text-blue-800">Push-ups</div>
                </div>
                <div className="bg-green-100 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{formatTime(sessionDuration)}</div>
                    <div className="text-sm text-green-800">Duration</div>
                </div>
                <div className="bg-purple-100 p-4 rounded-lg text-center">
                    <div className={`text-sm font-semibold ${getPositionColor(currentPosition)}`}>
                        {getPositionText(currentPosition)}
                    </div>
                </div>
            </div>

            {/* Debug Information */}
            {status === 'running' && (
                <div className="grid grid-cols-4 gap-4 mb-4 text-xs">
                    <div className="bg-gray-100 p-2 rounded text-center">
                        <div className="font-semibold">Arm Angle</div>
                        <div className={debugInfo.armAngle <= 120 ? 'text-blue-600 font-bold' : 'text-gray-600'}>
                            {debugInfo.armAngle}°
                        </div>
                    </div>
                    <div className="bg-gray-100 p-2 rounded text-center">
                        <div className="font-semibold">State Flags</div>
                        <div className="text-xs">
                            <div className={pushupStateRef.current?.hasSeenDown ? 'text-blue-600' : 'text-gray-400'}>
                                Down: {pushupStateRef.current?.hasSeenDown ? '✓' : '✗'}
                            </div>
                            <div className={pushupStateRef.current?.hasSeenUp ? 'text-green-600' : 'text-gray-400'}>
                                Up: {pushupStateRef.current?.hasSeenUp ? '✓' : '✗'}
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-100 p-2 rounded text-center">
                        <div className="font-semibold">Visibility</div>
                        <div>{debugInfo.visibility}%</div>
                    </div>
                    <div className="bg-gray-100 p-2 rounded text-center">
                        <div className="font-semibold">Total Reps</div>
                        <div className="text-blue-600 font-bold">{pushupStateRef.current?.count || 0}</div>
                    </div>
                </div>
            )}

            <div className="relative rounded-2xl overflow-hidden shadow">
                <video ref={videoRef} className="w-full h-auto" autoPlay playsInline muted />
                <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    width={1280}
                    height={720}
                />
            </div>

            <div className="flex gap-2 mt-4">
                {status !== "running" ? (
                    <button onClick={start} className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700">
                        Start Session
                    </button>
                ) : (
                    <>
                        <button onClick={cancel} className="px-4 py-2 rounded-xl bg-gray-600 text-white hover:bg-gray-700">
                            Cancel Session
                        </button>
                        <button onClick={stopAndSave} className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                            Stop & Save Session
                        </button>
                    </>
                )}
            </div>

            {/* Instructions */}
            {status === 'idle' && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-semibold mb-2 text-blue-800">Instructions for Best Results:</h3>
                    <ul className="text-sm space-y-1 text-blue-700">
                        <li>• Position yourself <strong>sideways</strong> to the camera (profile view)</li>
                        <li>• Make sure your <strong>arms and shoulders</strong> are clearly visible</li>
                        <li>• Ensure good lighting on the side facing the camera</li>
                        <li>• Do <strong>slow, controlled</strong> push-ups for accurate counting</li>
                        <li>• You should see <strong>green lines and red dots</strong> on your body when ready</li>
                        <li>• Watch arm angle: <strong>130°+ = Up</strong>, <strong>120°- = Down</strong></li>
                    </ul>
                </div>
            )}

            {status === 'running' && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700">
                        <strong>Tip:</strong> The arm angle will show in <strong className="text-blue-600">blue</strong> when in down position (≤120°).
                        Reps are counted when you go from down to up position!
                    </p>
                </div>
            )}
        </div>
    );
}

export default Session;