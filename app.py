from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
import os, requests, time
import werkzeug
werkzeug.cached_property = werkzeug.utils.cached_property  # Fix if using older Flask version

from flask import send_from_directory
# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# === Database Config ===
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///chat_history.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# === OpenRouter Config ===
API_URL = "https://openrouter.ai/api/v1/chat/completions"
API_KEY = os.getenv("OPENROUTER_API_KEY")

# Debug print API key status
if not API_KEY:
    print("❌ OPENROUTER_API_KEY is not loaded from .env file!")

# === Message Model ===
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender = db.Column(db.String(10))  # 'user' or 'bot'
    text = db.Column(db.Text)
    feedback = db.Column(db.String(10))  # 'like', 'dislike', or None

with app.app_context():
    db.create_all()

# === Routes ===

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    # Handle file and message from FormData
    user_input = request.form.get("message", "")
    file = request.files.get("file")

    if file:
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
        file.save(filepath)
        print("📎 Received and saved file:", file.filename)

    if user_input:
        db.session.add(Message(sender="user", text=user_input))
    elif file:
        db.session.add(Message(sender="user", text=f"[File uploaded: {file.filename}]"))
    else:
        return jsonify({"reply": "⚠ No input received."})

    # Send to OpenRouter
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }

    body = {
        "model": "mistralai/mistral-7b-instruct",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": user_input or f"Received file: {file.filename}"}
        ]
    }

    try:
        res = requests.post(API_URL, headers=headers, json=body, timeout=30)
        data = res.json()
        reply = data["choices"][0]["message"]["content"]
    except Exception as e:
        print("❌ API error:", e)
        reply = "⚠ Error during processing."

    db.session.add(Message(sender="bot", text=reply))
    db.session.commit()
    return jsonify({"reply": reply})



@app.route("/history")
def history():
    msgs = Message.query.all()
    data = [{"sender": m.sender, "text": m.text, "type": m.sender} for m in msgs]
    return jsonify(data)

@app.route("/clear", methods=["POST"])
def clear():
    Message.query.delete()
    db.session.commit()
    return jsonify({"message": "Chat history cleared."})

@app.route("/feedback", methods=["POST"])
def feedback():
    data = request.get_json()
    message_text = data.get("message")
    feedback_type = data.get("feedback")  # 'like' or 'dislike'

    if not message_text or feedback_type not in ["like", "dislike"]:
        return jsonify({"error": "Invalid data"}), 400

    message = Message.query.filter_by(text=message_text, sender="bot").order_by(Message.id.desc()).first()
    if message:
        message.feedback = feedback_type
        db.session.commit()
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Message not found"}), 404


@app.route("/delete_message_pair", methods=["POST"])
def delete_message_pair():
    data = request.get_json()
    bot_text = data.get("bot_text")
    if not bot_text:
        return jsonify({"error": "No message provided"}), 400

    # Delete bot reply first
    bot_msg = Message.query.filter_by(sender="bot", text=bot_text).order_by(Message.id.desc()).first()
    if bot_msg:
        # Delete the user message before this bot message
        user_msg = Message.query.filter(Message.id < bot_msg.id, Message.sender == "user").order_by(Message.id.desc()).first()
        
        db.session.delete(bot_msg)
        if user_msg:
            db.session.delete(user_msg)

        db.session.commit()
        return jsonify({"success": True})
    
    return jsonify({"error": "Bot message not found"}), 404




UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("file")
    if file:
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
        file.save(filepath)
        return jsonify({"filename": file.filename})
    return jsonify({"error": "No file"}), 400

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

if __name__ == "__main__":
    app.run(debug=True)
