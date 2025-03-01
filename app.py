from flask import Flask, render_template, jsonify, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import datetime
import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Database configuration for Vercel deployment
if os.environ.get('VERCEL_ENV') == 'production':
    # Use PostgreSQL in production
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('POSTGRES_URL')
else:
    # Use SQLite in development
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///noise_data.db'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Database model
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

# Create database tables
try:
    with app.app_context():
        db.create_all()
except Exception as e:
    print(f"Database initialization error: {e}")

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/detect')
def detect():
    return render_template('index.html')

@app.route('/get_time')
def get_time():
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return jsonify({"time": current_time})

@app.route('/submit_survey', methods=['POST'])
def submit_survey():
    try:
        data = request.get_json()
        
        # Create new record
        new_record = NoiseRecord(
            age=data['age'],
            location=data['location'],
            environment=data['environment'],
            activity=data['activity'],
            noise_level=data['noise_level'],
            noise_source=data['noise_source'],
            tolerance=data['tolerance'],
            measured_db=data.get('measured_db'),
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            device_info=json.dumps(data.get('device_info', {}))
        )
        
        # Save to database
        db.session.add(new_record)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '数据提交成功'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/thank_you')
def thank_you():
    return render_template('thank_you.html')

@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('500.html'), 500

# For Vercel deployment
app.debug = False 