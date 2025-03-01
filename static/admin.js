// 获取 Firestore 实例
const db = firebase.firestore();

// 加载统计数据
async function loadStats() {
    try {
        const response = await fetch('/get_survey_data');
        const surveys = await response.json();
        
        // 计算总提交数
        document.getElementById('total-submissions').textContent = surveys.length;
        
        // 计算平均噪音级别
        const validNoiseReadings = surveys.filter(s => s.measured_db != null);
        const averageNoise = validNoiseReadings.reduce((acc, curr) => acc + curr.measured_db, 0) / validNoiseReadings.length;
        document.getElementById('average-noise').textContent = `${Math.round(averageNoise)} dB`;
        
        // 计算最近24小时提交
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentSurveys = surveys.filter(s => new Date(s.timestamp) > last24Hours);
        document.getElementById('recent-submissions').textContent = recentSurveys.length;
        
        // 创建噪音来源分布图表
        createNoiseSourcesChart(surveys);
        
        // 创建噪音级别分布图表
        createNoiseLevelsChart(surveys);
        
        // 加载最近数据表格
        loadRecentData(surveys);
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// 创建噪音来源分布图表
function createNoiseSourcesChart(surveys) {
    const sourceCounts = {};
    surveys.forEach(survey => {
        sourceCounts[survey.noise_source] = (sourceCounts[survey.noise_source] || 0) + 1;
    });
    
    const ctx = document.getElementById('noise-sources').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(sourceCounts),
            datasets: [{
                data: Object.values(sourceCounts),
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// 创建噪音级别分布图表
function createNoiseLevelsChart(surveys) {
    const levelCounts = {};
    surveys.forEach(survey => {
        levelCounts[survey.noise_level] = (levelCounts[survey.noise_level] || 0) + 1;
    });
    
    const ctx = document.getElementById('noise-levels').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(levelCounts),
            datasets: [{
                label: '数量',
                data: Object.values(levelCounts),
                backgroundColor: '#36A2EB'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 加载最近数据表格
function loadRecentData(surveys) {
    const tbody = document.getElementById('recent-data');
    tbody.innerHTML = '';
    
    surveys.slice(0, 10).forEach(survey => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${survey.timestamp}</td>
            <td>${survey.location}</td>
            <td>${survey.environment}</td>
            <td>${survey.noise_level}</td>
            <td>${survey.noise_source}</td>
        `;
        tbody.appendChild(row);
    });
}

// 初始化加载
loadStats(); 