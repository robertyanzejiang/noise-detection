from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import datetime
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# 根据环境使用不同的数据库配置
if os.environ.get('VERCEL_ENV') == 'production':
    # 在 Vercel 上使用 PostgreSQL
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
else:
    # 本地开发使用 SQLite
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///noise_data.db'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class NoiseRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)
    age = db.Column(db.String(20), nullable=False)
    location = db.Column(db.String(50), nullable=False)
    environment = db.Column(db.String(20), nullable=False)
    activity = db.Column(db.String(50), nullable=False)
    noise_level = db.Column(db.String(20), nullable=False)
    noise_source = db.Column(db.String(50), nullable=False)
    tolerance = db.Column(db.String(20), nullable=False)
    measured_db = db.Column(db.Float)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    device_info = db.Column(db.Text)

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/detect')
def detect():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/get_time')
def get_time():
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return jsonify({"time": current_time})

@app.route('/submit_survey', methods=['POST'])
def submit_survey():
    try:
        data = request.json
        new_record = NoiseRecord(
            age=data['age'],
            location=data['location'],
            environment=data['environment'],
            activity=data['activity'],
            noise_level=data['noise_level'],
            noise_source=data['noise_source'],
            tolerance=data['tolerance'],
            measured_db=data['measured_db'],
            latitude=data['latitude'],
            longitude=data['longitude'],
            device_info=json.dumps(data['device_info'])
        )
        db.session.add(new_record)
        db.session.commit()
        return jsonify({"success": True, "message": "数据提交成功"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@app.route('/get_survey_data')
def get_survey_data():
    records = NoiseRecord.query.order_by(NoiseRecord.timestamp.desc()).all()
    data = []
    for record in records:
        data.append({
            'timestamp': record.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            'age': record.age,
            'location': record.location,
            'environment': record.environment,
            'activity': record.activity,
            'noise_level': record.noise_level,
            'noise_source': record.noise_source,
            'tolerance': record.tolerance,
            'measured_db': record.measured_db,
            'latitude': record.latitude,
            'longitude': record.longitude,
            'device_info': json.loads(record.device_info)
        })
    return jsonify(data)

# 创建数据库表
try:
    with app.app_context():
        db.create_all()
except Exception as e:
    print(f"Database initialization error: {e}")

# 为 Vercel 提供应用实例
app.debug = False 