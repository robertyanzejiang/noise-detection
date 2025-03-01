// Update current time
function updateTime() {
    fetch('/get_time')
        .then(response => response.json())
        .then(data => {
            document.getElementById('current-time').textContent = data.time;
        });
}

// Update time every second
setInterval(updateTime, 1000);
updateTime();

// Get current location with reverse geocoding
let lastMeasuredDb = null;
let currentLatitude = null;
let currentLongitude = null;
let currentAddress = null;
let locationUpdateInterval = null;

async function getLocationWithRetry(maxRetries = 3, delay = 2000) {
    let retries = 0;
    
    async function tryGetLocation() {
        if (!navigator.geolocation) {
            throw new Error("您的浏览器不支持地理位置功能");
        }
        
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });
    }
    
    async function reverseGeocode(lat, lon) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
            const data = await response.json();
            return data.display_name;
        } catch (error) {
            console.error("Reverse geocoding error:", error);
            return null;
        }
    }
    
    while (retries < maxRetries) {
        try {
            const position = await tryGetLocation();
            currentLatitude = position.coords.latitude;
            currentLongitude = position.coords.longitude;
            
            // Update coordinates display
            const coordsElement = document.getElementById('current-location');
            coordsElement.innerHTML = `<div>纬度: ${currentLatitude.toFixed(4)}</div><div>经度: ${currentLongitude.toFixed(4)}</div>`;
            
            // Get and display address
            const address = await reverseGeocode(currentLatitude, currentLongitude);
            if (address) {
                currentAddress = address;
                coordsElement.innerHTML += `<div class="mt-2">地址: ${address}</div>`;
            }
            
            return true;
        } catch (error) {
            console.error(`Location attempt ${retries + 1} failed:`, error);
            retries++;
            if (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    document.getElementById('current-location').innerHTML = 
        `<div class="text-danger">无法获取位置信息，请确保已允许位置访问权限</div>
         <button onclick="getLocationWithRetry()" class="btn btn-sm btn-primary mt-2">重试</button>`;
    return false;
}

// Initialize location with periodic updates
async function initializeLocation() {
    await getLocationWithRetry();
    // Update location every 5 minutes
    locationUpdateInterval = setInterval(() => getLocationWithRetry(), 300000);
}

// Start location tracking
initializeLocation();

// Noise detection with improved accuracy
let audioContext = null;
let microphone = null;
let analyser = null;
let isRecording = false;
let recordingTimer = null;
let noiseReadings = [];
let recordingStartTime = null;
let visualizer = null;

// Create audio visualizer
function createVisualizer() {
    const canvas = document.createElement('canvas');
    canvas.id = 'waveform';
    canvas.width = 300;
    canvas.height = 100;
    canvas.style.backgroundColor = '#f8f9fa';
    canvas.style.borderRadius = '4px';
    canvas.style.marginTop = '10px';
    
    const meterElement = document.querySelector('.noise-meter');
    meterElement.insertBefore(canvas, document.getElementById('db-value'));
    
    return canvas.getContext('2d');
}

// Calculate RMS value from audio data
function calculateRMS(dataArray) {
    const squareSum = dataArray.reduce((sum, value) => sum + (value * value), 0);
    return Math.sqrt(squareSum / dataArray.length);
}

// Convert RMS to decibels with proper scaling
function rmsToDecibels(rms) {
    // Reference level and scaling factor calibration
    const REF_LEVEL = 0.00002; // Reference sound pressure level (20 μPa)
    const CALIBRATION_FACTOR = 0.85; // Calibration factor for typical device microphones
    
    if (rms < 0.0001) return 30; // Noise floor
    
    // Calculate dB with calibration
    const db = 20 * Math.log10(rms / REF_LEVEL) * CALIBRATION_FACTOR;
    return Math.min(Math.max(Math.round(db), 30), 120); // Clamp between 30 and 120 dB
}

// Draw waveform
function drawWaveform(dataArray, context, width, height) {
    context.fillStyle = '#f8f9fa';
    context.fillRect(0, 0, width, height);
    
    context.lineWidth = 2;
    context.strokeStyle = '#4B286D';
    context.beginPath();
    
    const sliceWidth = width / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height / 2) + height / 2;
        
        if (i === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    context.lineTo(width, height / 2);
    context.stroke();
}

async function startMeasurement() {
    try {
        if (!isRecording) {
            // Initialize audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false
                } 
            });
            
            microphone = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            
            microphone.connect(analyser);
            
            isRecording = true;
            noiseReadings = [];
            recordingStartTime = Date.now();
            
            // Create progress bar
            const progressBar = document.createElement('div');
            progressBar.className = 'progress mb-3';
            progressBar.innerHTML = `
                <div class="progress-bar bg-primary" role="progressbar" 
                     style="width: 0%" id="recording-progress"></div>
            `;
            document.querySelector('.noise-meter').insertBefore(
                progressBar, 
                document.getElementById('db-value')
            );
            
            // Create and setup visualizer
            visualizer = createVisualizer();
            
            // Update button state
            const button = document.getElementById('start-recording');
            button.disabled = true;
            button.textContent = '录音中...';
            
            // Start recording timer
            recordingTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
                const remaining = 10 - elapsed;
                
                // Update progress bar
                const progress = (elapsed / 10) * 100;
                document.getElementById('recording-progress').style.width = `${progress}%`;
                
                if (remaining >= 0) {
                    document.getElementById('recording-progress').textContent = `${remaining}秒`;
                }
                
                if (elapsed >= 10) {
                    stopRecording();
                    clearInterval(recordingTimer);
                    
                    // Calculate average with outlier removal
                    const sortedReadings = [...noiseReadings].sort((a, b) => a - b);
                    const trimmedReadings = sortedReadings.slice(
                        Math.floor(sortedReadings.length * 0.1),
                        Math.ceil(sortedReadings.length * 0.9)
                    );
                    const average = trimmedReadings.reduce((a, b) => a + b, 0) / trimmedReadings.length;
                    const averageDb = Math.round(average);
                    lastMeasuredDb = averageDb;
                    
                    // Display results
                    const resultElement = document.createElement('div');
                    resultElement.className = 'average-result card mt-3 p-3';
                    resultElement.innerHTML = `
                        <h4 class="card-title">10秒测量结果</h4>
                        <div class="card-body">
                            <p class="mb-2">平均噪音级别: <strong>${averageDb} dB</strong></p>
                            <p class="mb-0">${getNoiseLevelAssessment(averageDb)}</p>
                        </div>
                    `;
                    
                    document.querySelector('.noise-meter').appendChild(resultElement);
                }
            }, 1000);
            
            measureNoise();
        }
    } catch (error) {
        console.error('Error accessing microphone:', error);
        document.getElementById('db-value').innerHTML = 
            `<div class="text-danger">无法访问麦克风: ${error.message}</div>
             <button onclick="startMeasurement()" class="btn btn-sm btn-primary mt-2">重试</button>`;
    }
}

function stopRecording() {
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    
    isRecording = false;
    
    // Reset UI
    const button = document.getElementById('start-recording');
    button.disabled = false;
    button.textContent = '重新检测';
    
    // Remove progress bar and waveform
    const progressBar = document.querySelector('.progress');
    if (progressBar) progressBar.remove();
    
    const waveform = document.getElementById('waveform');
    if (waveform) waveform.remove();
}

function measureNoise() {
    if (!isRecording) return;

    const dataArray = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(dataArray);

    // Calculate RMS and convert to decibels
    const rms = calculateRMS(dataArray);
    const db = rmsToDecibels(rms);
    
    // Store the reading
    noiseReadings.push(db);
    
    // Update UI
    document.getElementById('db-value').innerHTML = `
        <div>当前噪音级别: <strong>${db} dB</strong></div>
        <div class="small text-muted">${getNoiseLevelDescription(db)}</div>
    `;
    
    // Update noise level indicator
    const level = document.getElementById('noise-level');
    level.style.width = `${Math.min((db - 30) * 1.1, 100)}%`;
    level.style.backgroundColor = getNoiseLevelColor(db);
    
    // Draw waveform
    if (visualizer) {
        drawWaveform(dataArray, visualizer, 300, 100);
    }

    // Schedule next measurement
    requestAnimationFrame(measureNoise);
}

function getNoiseLevelDescription(db) {
    if (db < 40) return '非常安静';
    if (db < 50) return '安静';
    if (db < 60) return '普通谈话';
    if (db < 70) return '嘈杂';
    if (db < 80) return '很吵';
    if (db < 90) return '非常吵';
    return '危险噪音水平';
}

function getNoiseLevelColor(db) {
    if (db < 40) return '#28a745';  // 绿色
    if (db < 60) return '#4B286D';  // CUHK紫色
    if (db < 70) return '#B4A069';  // CUHK金色
    if (db < 80) return '#ffc107';  // 黄色
    if (db < 90) return '#fd7e14';  // 橙色
    return '#dc3545';  // 红色
}

function getNoiseLevelAssessment(db) {
    if (db < 40) return '环境非常安静，适合休息和工作';
    if (db < 50) return '环境安静，适合日常活动';
    if (db < 60) return '正常谈话音量，属于舒适范围';
    if (db < 70) return '噪音级别中等，建议注意控制';
    if (db < 80) return '噪音较大，可能影响交谈和工作';
    if (db < 90) return '噪音严重，建议采取防护措施';
    return '噪音非常严重，请立即采取措施！';
}

// Form validation
document.getElementById('survey-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    console.log('Form submission started');
    
    if (this.checkValidity()) {
        try {
            const formData = {
                age: this.querySelector('select[required]').value,
                location: this.querySelectorAll('select[required]')[1].value,
                environment: this.querySelector('input[name="environment"]:checked')?.value,
                activity: this.querySelectorAll('select[required]')[2].value,
                noise_level: this.querySelectorAll('select[required]')[3].value,
                noise_source: this.querySelectorAll('select[required]')[4].value,
                tolerance: this.querySelectorAll('select[required]')[5].value,
                measured_db: lastMeasuredDb,
                latitude: currentLatitude,
                longitude: currentLongitude,
                device_info: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    screenResolution: `${window.screen.width}x${window.screen.height}`,
                    language: navigator.language,
                    timestamp: new Date().toISOString()
                }
            };

            console.log('Form data prepared:', formData);

            if (!formData.environment) {
                throw new Error('请选择所在环境（室内/室外）');
            }

            console.log('Attempting to save data...');
            const response = await fetch('/submit_survey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            
            if (result.success) {
                alert('问卷提交成功！感谢您的参与。');
                this.reset();
                lastMeasuredDb = null;
                
                // 清除之前的测量结果显示
                const previousResult = document.querySelector('.average-result');
                if (previousResult) {
                    previousResult.remove();
                }
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('提交失败：' + error.message);
        }
    } else {
        console.log('Form validation failed');
        alert('请填写所有必填项');
    }
    
    this.classList.add('was-validated');
}); 