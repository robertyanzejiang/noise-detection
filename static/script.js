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

// Get current location
let lastMeasuredDb = null;
let currentLatitude = null;
let currentLongitude = null;

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                currentLatitude = position.coords.latitude;
                currentLongitude = position.coords.longitude;
                document.getElementById('current-location').textContent = 
                    `纬度: ${currentLatitude.toFixed(4)}, 经度: ${currentLongitude.toFixed(4)}`;
            },
            error => {
                document.getElementById('current-location').textContent = "无法获取位置信息";
                console.error("Error getting location:", error);
            }
        );
    } else {
        document.getElementById('current-location').textContent = "您的浏览器不支持地理位置功能";
    }
}

// Initialize location
getLocation();

// Noise detection
let audioContext = null;
let microphone = null;
let analyser = null;
let isRecording = false;
let recordingTimer = null;
let noiseReadings = [];
let recordingStartTime = null;

document.getElementById('start-recording').addEventListener('click', async () => {
    try {
        if (!isRecording) {
            // Initialize audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphone = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            
            microphone.connect(analyser);
            analyser.fftSize = 2048;
            
            isRecording = true;
            noiseReadings = [];
            recordingStartTime = Date.now();
            document.getElementById('start-recording').disabled = true;
            document.getElementById('start-recording').textContent = '录音中...';
            
            // 添加计时器显示
            const timerElement = document.createElement('div');
            timerElement.id = 'recording-timer';
            timerElement.className = 'recording-timer';
            document.querySelector('.noise-meter').insertBefore(timerElement, document.getElementById('db-value'));
            
            recordingTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
                const remaining = 10 - elapsed;
                
                if (remaining >= 0) {
                    timerElement.textContent = `剩余时间: ${remaining} 秒`;
                }
                
                if (elapsed >= 10) {
                    stopRecording();
                    clearInterval(recordingTimer);
                    
                    // 计算平均值
                    const average = noiseReadings.reduce((a, b) => a + b, 0) / noiseReadings.length;
                    const averageDb = Math.round(average);
                    lastMeasuredDb = averageDb;
                    
                    // 显示结果
                    const resultElement = document.createElement('div');
                    resultElement.className = 'average-result';
                    resultElement.innerHTML = `
                        <h4>10秒测量结果</h4>
                        <p>平均噪音级别: ${averageDb} dB</p>
                        <p>噪音评估: ${getNoiseLevelAssessment(averageDb)}</p>
                    `;
                    
                    document.querySelector('.noise-meter').appendChild(resultElement);
                }
            }, 1000);
            
            measureNoise();
        }
    } catch (error) {
        console.error('Error accessing microphone:', error);
        document.getElementById('db-value').textContent = '无法访问麦克风';
    }
});

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
    document.getElementById('start-recording').disabled = false;
    document.getElementById('start-recording').textContent = '重新检测';
    
    const timerElement = document.getElementById('recording-timer');
    if (timerElement) {
        timerElement.remove();
    }
}

function measureNoise() {
    if (!isRecording) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const db = Math.round((average / 255) * 100);
    
    // Store the reading
    noiseReadings.push(db);
    
    // Update UI
    document.getElementById('db-value').textContent = `当前噪音级别: ${db} dB`;
    document.getElementById('noise-level').style.width = `${db}%`;

    // Schedule next measurement
    requestAnimationFrame(measureNoise);
}

function getNoiseLevelAssessment(db) {
    if (db < 40) return '环境非常安静，适合休息和工作';
    if (db < 60) return '环境较为安静，属于正常范围';
    if (db < 70) return '噪音级别适中，建议注意控制';
    if (db < 80) return '噪音较大，可能影响日常活动';
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