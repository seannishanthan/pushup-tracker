import { useEffect, useRef, useState } from 'react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import * as drawing from '@mediapipe/drawing_utils';
import { useNavigate } from 'react-router-dom';
import { pushupAPI } from '../utils/api';

function Session() {
    // State for session notes
    const [sessionNotes, setSessionNotes] = useState("");
    const [showNotesInput, setShowNotesInput] = useState(false);

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
    const [sessionActualStartTime, setSessionActualStartTime] = useState(null);
    const [sessionDuration, setSessionDuration] = useState(0);
    const [setupCountdown, setSetupCountdown] = useState(5);
    const [countdownKey, setCountdownKey] = useState(0); // Force restart countdown
    const [poseKey, setPoseKey] = useState(0); // Force recreate MediaPipe pose

    // Debug state to see what's happening
    const [debugInfo, setDebugInfo] = useState({
        armAngle: 0,
        bodyAngle: 0,
        visibility: 0,
        kneeVis: [0, 0],
        ankleVis: [0, 0],
        upperBodyVis: [0, 0, 0, 0, 0, 0]
    });

    // Push-up detection parameters - simplified state machine approach
    const pushupStateRef = useRef({
        count: 0,
        phase: 'setup',             // setup -> waiting -> down -> holding -> up -> waiting
        downStartTime: null,        // When we entered down position
        requiredHoldTime: 300,      // Minimum hold time (300ms)
        armAngleThreshold: { up: 130, down: 120, upExit: 125, downExit: 125 }, // Hysteresis thresholds
        setupStartTime: null,       // When setup phase started
        setupDuration: 5000,        // 5 second setup period
    });

    // Timer for session duration
    useEffect(() => {
        let interval;
        if (status === 'running' && sessionActualStartTime) {
            interval = setInterval(() => {
                setSessionDuration(Math.floor((Date.now() - sessionActualStartTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [status, sessionActualStartTime]);

    // Setup countdown timer
    useEffect(() => {
        let interval;
        console.log(`Setup countdown useEffect triggered. Status: ${status}`);

        if (status === 'running') {
            console.log(`Starting countdown timer. Initial countdown: ${setupCountdown}`);

            // Start countdown immediately when session starts
            interval = setInterval(() => {
                const state = pushupStateRef.current;
                if (state?.phase === 'setup') {
                    // Initialize setup start time if not set
                    if (!state.setupStartTime) {
                        state.setupStartTime = Date.now();
                        console.log(`Setup start time initialized`);
                    }

                    const elapsed = Date.now() - state.setupStartTime;
                    const remaining = Math.max(0, Math.ceil((state.setupDuration - elapsed) / 1000));
                    setSetupCountdown(remaining);

                    console.log(`Countdown: ${remaining}, Phase: ${state.phase}`);

                    if (remaining === 0) {
                        console.log(`Countdown reached 0, transitioning to waiting phase`);
                        // Force transition to waiting phase when countdown reaches 0
                        state.phase = 'waiting';
                        // Start the actual session timer now that setup is complete
                        if (!sessionActualStartTime) {
                            setSessionActualStartTime(Date.now());
                        }
                        clearInterval(interval);
                    }
                } else {
                    // Not in setup phase, clear the interval
                    console.log(`Not in setup phase (${state?.phase}), clearing interval`);
                    clearInterval(interval);
                }
            }, 100); // Update every 100ms for smooth countdown
        } else {
            console.log(`Status is not running (${status}), clearing any existing interval`);
        }

        return () => {
            console.log(`Cleanup: clearing countdown interval`);
            clearInterval(interval);
        };
    }, [status, countdownKey]);

    // Camera preview - start camera when component mounts for positioning
    useEffect(() => {
        const startPreview = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720, facingMode: "user" },
                    audio: false,
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                console.log('📹 Camera preview started');
            } catch (error) {
                console.error('Failed to start camera preview:', error);
            }
        };

        startPreview();

        // Cleanup on unmount
        return () => {
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject;
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
                videoRef.current.srcObject = null;
                console.log('📹 Camera preview stopped');
            }
        };
    }, []);    // Helper function to calculate angle between three points
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
            const LEFT_KNEE = 25;
            const RIGHT_KNEE = 26;
            const LEFT_ANKLE = 27;
            const RIGHT_ANKLE = 28;

            // Separate upper body and lower body landmark checks
            const upperBodyLandmarks = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW,
                LEFT_WRIST, RIGHT_WRIST];
            const lowerBodyLandmarks = [LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE];
            const allLandmarks = [...upperBodyLandmarks, ...lowerBodyLandmarks];

            const validUpperBody = upperBodyLandmarks.filter(index =>
                landmarks[index] && landmarks[index].visibility > 0.6
            );


            // Print visibility for knees and ankles
            const kneeVisibilities = [LEFT_KNEE, RIGHT_KNEE].map(index => landmarks[index]?.visibility ?? 0);
            const ankleVisibilities = [LEFT_ANKLE, RIGHT_ANKLE].map(index => landmarks[index]?.visibility ?? 0);
            const upperBodyVisibilities = upperBodyLandmarks.map(index => landmarks[index]?.visibility ?? 0);
            console.log(`Knee visibilities:`, kneeVisibilities, `Ankle visibilities:`, ankleVisibilities);

            const validKnees = [LEFT_KNEE, RIGHT_KNEE].filter(index =>
                landmarks[index] && landmarks[index].visibility > 0.6
            );

            const validAnkles = [LEFT_ANKLE, RIGHT_ANKLE].filter(index =>
                landmarks[index] && landmarks[index].visibility > 0.6
            );

            const avgVisibility = allLandmarks.reduce((sum, index) =>
                sum + (landmarks[index]?.visibility || 0), 0) / allLandmarks.length;

            // Require 4/6 upper body landmarks AND at least 1 knee AND 1 ankle for full body visibility
            if (validUpperBody.length < 4 || validKnees.length < 1 || validAnkles.length < 1) {
                setDebugInfo(prev => ({
                    ...prev,
                    visibility: Math.round(avgVisibility * 100),
                    kneeVis: kneeVisibilities,
                    ankleVis: ankleVisibilities,
                    upperBodyVis: upperBodyVisibilities
                }));
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
                visibility: Math.round(avgVisibility * 100),
                kneeVis: kneeVisibilities,
                ankleVis: ankleVisibilities,
                upperBodyVis: upperBodyVisibilities
            });

            // Simplified state machine for pushup detection
            const state = pushupStateRef.current;
            let currentPhase = state.phase;

            // State machine transitions
            switch (state.phase) {
                case 'setup':
                    // Setup phase - let user get into position, no counting yet
                    if (!state.setupStartTime) {
                        state.setupStartTime = Date.now();
                        console.log(`🔧 Setup phase started - get into pushup position! (3 seconds)`);
                    }

                    const setupElapsed = Date.now() - state.setupStartTime;
                    if (setupElapsed >= state.setupDuration) {
                        currentPhase = 'waiting';
                        state.phase = 'waiting'; // Update the ref phase
                        // Start the actual session timer now that setup is complete
                        if (!sessionActualStartTime) {
                            setSessionActualStartTime(Date.now());
                        }
                        console.log(`✅ Setup complete - pushup tracking now active!`);
                    }
                    break;

                case 'waiting':
                    // Start pushup when arm angle goes below down threshold
                    if (armAngle <= state.armAngleThreshold.down) {
                        currentPhase = 'down';
                        state.phase = 'down'; // Update the ref phase
                        state.downStartTime = Date.now();
                        console.log(`🔴 Entering DOWN phase! Angle: ${armAngle.toFixed(1)}°`);
                    }
                    break;

                case 'down':
                    // If we leave down position too early, reset to waiting
                    if (armAngle > state.armAngleThreshold.downExit) {
                        currentPhase = 'waiting';
                        state.phase = 'waiting'; // Update the ref phase
                        state.downStartTime = null;
                        console.log(`🔄 Left down position too early, resetting to waiting`);
                    }
                    // If we've held down long enough, move to holding phase
                    else if (state.downStartTime && (Date.now() - state.downStartTime) >= state.requiredHoldTime) {
                        currentPhase = 'holding';
                        state.phase = 'holding'; // Update the ref phase
                        console.log(`⏱️ Hold requirement met! Moving to holding phase`);
                    }
                    break;

                case 'holding':
                    // Still in down position - stay in holding
                    if (armAngle <= state.armAngleThreshold.down) {
                        // Continue holding
                    }
                    // Move to up position - count the rep!
                    else if (armAngle >= state.armAngleThreshold.up) {
                        currentPhase = 'up';
                        state.phase = 'up'; // Update the ref phase
                        state.count++;
                        setPushupCount(state.count);
                        console.log(`🎉 Push-up #${state.count} completed! Angle: ${armAngle.toFixed(1)}°`);
                    }
                    // In transition zone - stay in holding
                    else {
                        // Stay in holding phase during transition
                    }
                    break;

                case 'up':
                    // Wait for user to go back down before allowing next rep
                    if (armAngle <= state.armAngleThreshold.upExit) {
                        currentPhase = 'waiting';
                        state.phase = 'waiting'; // Update the ref phase
                        state.downStartTime = null;
                        console.log(`🔄 Ready for next rep`);
                    }
                    break;

                default:
                    currentPhase = 'waiting';
                    break;
            }

            // Update state
            state.phase = currentPhase;

            // Set UI position based on current phase
            let uiPosition;
            switch (currentPhase) {
                case 'setup':
                    uiPosition = 'setup';
                    break;
                case 'down':
                case 'holding':
                    uiPosition = 'down';
                    break;
                case 'up':
                    uiPosition = 'up';
                    break;
                default:
                    uiPosition = armAngle <= 120 ? 'down' : armAngle >= 130 ? 'up' : 'transition';
                    break;
            }

            setCurrentPosition(uiPosition);

            // Debug logging
            console.log(`Phase: ${currentPhase}, Angle: ${armAngle.toFixed(1)}°, Count: ${state.count}`);

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
            // Define which landmarks to draw (exclude hands/fingers for performance)
            const relevantLandmarks = [
                11, 12, // Left/Right Shoulder
                13, 14, // Left/Right Elbow  
                15, 16, // Left/Right Wrist
                23, 24, // Left/Right Hip (for body alignment)
                25, 26, // Left/Right Knee
                27, 28  // Left/Right Ankle
            ];

            // Draw only relevant connections (exclude hand connections)
            const relevantConnections = POSE_CONNECTIONS.filter(connection => {
                const [start, end] = connection;
                // Only draw connections where both points are in our relevant landmarks
                return relevantLandmarks.includes(start) && relevantLandmarks.includes(end);
            });

            // Draw filtered connections
            drawing.drawConnectors(ctx, results.poseLandmarks, relevantConnections, {
                color: '#00FF00',
                lineWidth: 2
            });

            // Draw only relevant landmarks
            const filteredLandmarks = results.poseLandmarks.filter((landmark, index) =>
                relevantLandmarks.includes(index)
            );

            drawing.drawLandmarks(ctx, filteredLandmarks, {
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
    }, [status, poseKey]);

    const start = async () => {
        // Wait for mediapipe pose to be setup with retry mechanism
        let retries = 0;
        const maxRetries = 20; // Increased retries for more patience
        while (!poseRef.current && retries < maxRetries) {
            console.log(`Waiting for MediaPipe pose to initialize... (attempt ${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 200)); // Shorter interval
            retries++;
        }

        if (!poseRef.current) {
            console.error('MediaPipe pose failed to initialize after maximum retries');
            return;
        }

        console.log('MediaPipe pose is ready, starting session...');

        // Reset push-up tracking state
        pushupStateRef.current = {
            count: 0,
            phase: 'setup',
            downStartTime: null,
            requiredHoldTime: 120,
            armAngleThreshold: { up: 130, down: 120, upExit: 125, downExit: 125 },
            setupStartTime: null,
            setupDuration: 5000
        };
        setPushupCount(0);
        setCurrentPosition('unknown');
        setSessionStartTime(Date.now());
        setSessionDuration(0);
        setSetupCountdown(5);
        setCountdownKey(prev => prev + 1); // Force restart countdown timer

        // Camera stream should already be running from preview
        // Just create the MediaPipe Camera instance to start pose detection
        if (!videoRef.current?.srcObject) {
            console.error('No camera stream available - preview should have started the camera');
            return;
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

    const stopAndSave = async () => {
        setStatus('idle');
        // Stop camera and pose detection
        if (cameraRef.current) await cameraRef.current.stop();
        const stream = videoRef.current?.srcObject;
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            videoRef.current.srcObject = null;
        }
        // Clear the canvas
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        // Show notes input
        setShowNotesInput(true);
    };
    // Save session with notes
    const saveSessionWithNotes = async () => {
        const sessionEndTime = new Date();
        const sessionData = {
            count: pushupStateRef.current.count,
            startedAt: sessionStartTime ? new Date(sessionStartTime).toISOString() : new Date().toISOString(),
            endedAt: sessionEndTime.toISOString(),
            durationSec: sessionDuration,
            notes: sessionNotes.slice(0, 500)
        };
        try {
            const response = await pushupAPI.create(sessionData);
            console.log('✅ Session saved successfully:', response.data);
        } catch (error) {
            alert(`Failed to save session: ${error.response?.data?.message || error.message}`);
        }
        navigate('/');
    };

    // ...existing code...

    const goToDashboard = async () => {
        if (status === 'running') {
            // Clean up camera and streams before navigating
            setStatus('idle');
            if (cameraRef.current) await cameraRef.current.stop();

            const stream = videoRef.current?.srcObject;
            if (stream) {
                stream.getTracks().forEach((t) => t.stop());
                videoRef.current.srcObject = null;
            }

            // Clear the canvas
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
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
            case 'setup': return 'text-orange-600';
            case 'up': return 'text-green-600';
            case 'down': return 'text-blue-600';
            case 'transition': return 'text-yellow-600';
            default: return 'text-gray-600';
        }
    };

    const getPositionText = (position) => {
        switch (position) {
            case 'setup': return 'Setting Up - Get Into Position';
            case 'up': return 'Up Position ✓';
            case 'down': return 'Down Position ✓';
            case 'transition': return 'In Motion';
            case 'landmarks_not_detected': return 'Can\'t See You Clearly';
            case 'insufficient_landmarks': return 'Move Into Better View';
            case 'error': return 'Detection Error';
            default: return 'Getting Ready...';
        }
    };

    const getVisibilityFeedback = () => {
        const { kneeVis, ankleVis, upperBodyVis, visibility } = debugInfo;

        // Check for low visibility landmarks
        const lowKnees = kneeVis.filter(v => v < 0.5).length;
        const lowAnkles = ankleVis.filter(v => v < 0.5).length;
        const lowUpperBody = upperBodyVis.filter(v => v < 0.5).length;

        if (visibility < 50) {
            return "Move further back to get your full body in frame";
        }

        if (lowKnees > 0) {
            return `Bring your ${lowKnees === 1 ? 'knee' : 'knees'} within the frame`;
        }

        if (lowAnkles > 0) {
            return `Bring your ${lowAnkles === 1 ? 'ankle' : 'ankles'} within the frame`;
        }

        if (lowUpperBody > 2) {
            return "Adjust your upper body position for better tracking";
        }

        if (visibility >= 80) {
            return "Great positioning! All landmarks are clearly visible";
        }

        return "Good positioning, keep it up!";
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
                    <div className="text-sm font-semibold text-purple-800 mb-2">
                        Current Phase: {pushupStateRef.current?.phase || 'waiting'}
                        {pushupStateRef.current?.phase === 'setup' && pushupStateRef.current?.setupStartTime &&
                            ` (${Math.max(0, Math.ceil((pushupStateRef.current.setupDuration - (Date.now() - pushupStateRef.current.setupStartTime)) / 1000))}s)`
                        }
                    </div>
                    <div className="text-sm font-semibold text-purple-800">
                        Arm Angle: {debugInfo.armAngle}°
                    </div>
                </div>
            </div>

            {/* Landmark Visibility Feedback */}
            {status === 'running' && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-sm text-yellow-800">
                        <strong>Visibility Check:</strong> {getVisibilityFeedback()}
                    </div>
                </div>
            )}

            {/* Webcam or Notes Input */}
            <div className="relative rounded-2xl overflow-hidden shadow min-h-[320px] flex items-center justify-center">
                {showNotesInput ? (
                    <div className="w-full flex flex-col items-center justify-center p-8">
                        <h2 className="text-xl font-bold mb-2">Session Notes</h2>
                        <textarea
                            className="w-full max-w-2xl h-48 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg"
                            maxLength={500}
                            value={sessionNotes}
                            onChange={e => setSessionNotes(e.target.value)}
                            placeholder="Add any notes about your session (optional)"
                        />
                        <div className="text-xs text-gray-500 mt-1 mb-4">{sessionNotes.length}/500 characters</div>
                    </div>
                ) : (
                    <>
                        <video ref={videoRef} className="w-full h-auto" autoPlay playsInline muted />
                        <canvas
                            ref={canvasRef}
                            className="absolute top-0 left-0 w-full h-full pointer-events-none"
                            width={1280}
                            height={720}
                        />
                        {/* Setup Phase Overlay */}
                        {status === 'running' && pushupStateRef.current?.phase === 'setup' && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    <div className="text-6xl font-bold mb-4 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                                        {setupCountdown}
                                    </div>
                                    <div className="text-2xl font-bold mb-2 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Get Into Position</div>
                                    <div className="text-lg text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Position yourself sideways to camera</div>
                                    <div className="text-lg text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Tracking starts when countdown ends</div>
                                </div>
                            </div>
                        )}
                        {/* Camera Preview Overlay */}
                        {status === 'idle' && (
                            <div className="absolute bottom-4 right-4 pointer-events-none">
                                <div className="bg-black bg-opacity-50 px-3 py-2 rounded-lg">
                                    <div className="text-sm font-semibold text-white">
                                        📹 Camera Preview
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="flex gap-2 mt-4">
                {showNotesInput ? (
                    <button onClick={saveSessionWithNotes} className="px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
                        Save Session
                    </button>
                ) : status !== "running" ? (
                    <button onClick={start} className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700">
                        Start Session
                    </button>
                ) : (
                    <button onClick={stopAndSave} className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700">
                        End Session
                    </button>
                )}
            </div>

            {/* Instructions - Only show when idle (before starting session) */}
            {status === 'idle' && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-semibold mb-2 text-blue-800">Tips for a good session:</h3>
                    <ul className="text-sm space-y-1 text-blue-700">
                        <li>• Position yourself <strong>sideways</strong> to the camera, you should see green edges and red nodes on your body once tracking starts</li>
                        <li>• Make sure your <strong>full body from head to toe</strong> is visible in frame</li>
                        <li>• Ensure good lighting on the side facing the camera</li>
                        <li>• Do <strong>slow, controlled</strong> push-ups for accurate counting</li>
                        <li>• <strong>Hold at the bottom</strong> for ~300ms to count the rep</li>
                        <li>• Watch arm angle: <strong>130°+ = Up</strong>, <strong>120°- = Down</strong></li>
                    </ul>
                </div>
            )}

        </div>

    );
}

export default Session;
